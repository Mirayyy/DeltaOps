#!/usr/bin/env node
/**
 * Recreate archive documents so the Firestore doc id matches the corrected archive date.
 *
 * This script is safe to run after `repair-archive-dates.mjs`, but it can also work on its own:
 * if an archive date is still future-shifted relative to archivedAt, it will first derive the
 * corrected date, then recreate the document under the correct id.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=path/to/service-account.json node scripts/recreate-archive-doc-ids.mjs
 *   FIREBASE_SERVICE_ACCOUNT_PATH=path/to/service-account.json node scripts/recreate-archive-doc-ids.mjs --apply
 */

import { readFileSync } from 'fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import {
  getSuggestedArchiveDate,
  parseDateString,
  resolveRotationIdForDate,
  timestampToDate,
} from '../src/utils/gameDates.js'

const APPLY = process.argv.includes('--apply')
const BATCH_LIMIT = 200
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || ''
const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''

function loadServiceAccount() {
  if (SERVICE_ACCOUNT_JSON.trim()) {
    return JSON.parse(SERVICE_ACCOUNT_JSON)
  }

  if (SERVICE_ACCOUNT_PATH.trim()) {
    return JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
  }

  throw new Error(
    'Missing service account credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_SERVICE_ACCOUNT_JSON.',
  )
}

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(loadServiceAccount()),
    })
  }

  return getFirestore()
}

function chunk(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

function formatTimestamp(value) {
  const date = timestampToDate(value)
  return date ? date.toISOString() : 'unparseable'
}

function buildArchiveId(date, schedule) {
  return `${date}-${schedule}`
}

function buildTempArchiveId(sourceDocId) {
  return `__tmp_archive_recreate__${sourceDocId}`
}

async function loadCollection(name) {
  const snapshot = await getAdminDb().collection(name).get()
  return snapshot.docs.map(docSnap => ({
    _docId: docSnap.id,
    ...docSnap.data(),
  }))
}

function getTargetDate(entry) {
  const suggestedDate = getSuggestedArchiveDate(entry)
  if (suggestedDate) return suggestedDate
  return entry.date || ''
}

function getCandidate(entry, rotations) {
  const targetDate = getTargetDate(entry)
  if (!targetDate || !parseDateString(targetDate) || !entry.schedule) return null

  const targetId = buildArchiveId(targetDate, entry.schedule)
  const targetRotation = resolveRotationIdForDate(targetDate, rotations)
  const storedId = entry.id || ''
  const sourceDocId = entry._docId

  const needsIdRename = sourceDocId !== targetId
  const needsStoredIdFix = storedId !== targetId
  const needsDateFix = (entry.date || '') !== targetDate
  const needsRotationFix = (entry.rotation || '') !== targetRotation

  if (!needsIdRename && !needsStoredIdFix && !needsDateFix && !needsRotationFix) {
    return null
  }

  return {
    sourceDocId,
    storedId,
    targetId,
    tempId: buildTempArchiveId(sourceDocId),
    schedule: entry.schedule,
    archivedAt: formatTimestamp(entry.archivedAt),
    oldDate: entry.date || '',
    newDate: targetDate,
    oldRotation: entry.rotation || '',
    newRotation: targetRotation,
    data: entry,
  }
}

async function main() {
  const db = getAdminDb()
  const [archives, rotations] = await Promise.all([
    loadCollection('archive'),
    loadCollection('rotations'),
  ])

  const rawCandidates = archives
    .map(entry => getCandidate(entry, rotations))
    .filter(Boolean)

  const rawCandidateBySource = new Map(rawCandidates.map(candidate => [candidate.sourceDocId, candidate]))
  const targetIds = new Set()
  const duplicateTargets = new Set()
  for (const candidate of rawCandidates) {
    if (targetIds.has(candidate.targetId)) duplicateTargets.add(candidate.targetId)
    targetIds.add(candidate.targetId)
  }

  const existingTargetDocs = new Set(
    archives
      .map(entry => entry._docId)
      .filter(docId => targetIds.has(docId)),
  )

  const candidates = rawCandidates.map(candidate => ({
    ...candidate,
    hasDuplicateTarget: duplicateTargets.has(candidate.targetId),
    targetBlockedByExistingDoc: existingTargetDocs.has(candidate.targetId) &&
      candidate.sourceDocId !== candidate.targetId &&
      !(
        rawCandidateBySource.has(candidate.targetId) &&
        rawCandidateBySource.get(candidate.targetId)?.sourceDocId !== rawCandidateBySource.get(candidate.targetId)?.targetId
      ),
  }))

  console.log(`Archive entries scanned: ${archives.length}`)
  console.log(`Recreation candidates: ${candidates.length}`)
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

  for (const candidate of candidates) {
    const flags = []
    if (candidate.sourceDocId !== candidate.targetId) flags.push('rename-doc')
    if (candidate.storedId !== candidate.targetId) flags.push('fix-id-field')
    if (candidate.oldDate !== candidate.newDate) flags.push('fix-date')
    if (candidate.oldRotation !== candidate.newRotation) flags.push('fix-rotation')
    if (candidate.hasDuplicateTarget) flags.push('duplicate-target')
    if (candidate.targetBlockedByExistingDoc) flags.push('target-exists')

    console.log([
      `${candidate.sourceDocId} -> ${candidate.targetId}`,
      `schedule=${candidate.schedule}`,
      `oldDate=${candidate.oldDate || '—'}`,
      `newDate=${candidate.newDate}`,
      `oldRotation=${candidate.oldRotation || '—'}`,
      `newRotation=${candidate.newRotation || '—'}`,
      `archivedAt=${candidate.archivedAt}`,
      `flags=${flags.join(',') || 'none'}`,
    ].join(' | '))
  }

  const actionable = candidates.filter(candidate => !candidate.hasDuplicateTarget && !candidate.targetBlockedByExistingDoc)

  console.log(`\nActionable candidates: ${actionable.length}`)
  if (candidates.length !== actionable.length) {
    console.log(`Skipped due to collisions: ${candidates.length - actionable.length}`)
  }

  if (!APPLY || !actionable.length) {
    console.log(`\n${APPLY ? 'Nothing to update.' : 'Dry-run complete. Re-run with --apply to persist changes.'}`)
    return
  }

  for (const batchItems of chunk(actionable, BATCH_LIMIT)) {
    const batch = db.batch()

    for (const candidate of batchItems) {
      const payload = { ...candidate.data }
      delete payload._docId
      payload.id = candidate.targetId
      payload.date = candidate.newDate
      payload.rotation = candidate.newRotation

      const tempRef = db.collection('archive').doc(candidate.tempId)
      batch.set(tempRef, payload)
    }

    await batch.commit()
  }

  const renamed = actionable.filter(candidate => candidate.sourceDocId !== candidate.targetId)

  for (const batchItems of chunk(renamed, BATCH_LIMIT)) {
    const batch = db.batch()
    for (const candidate of batchItems) {
      const sourceRef = db.collection('archive').doc(candidate.sourceDocId)
      batch.delete(sourceRef)
    }
    await batch.commit()
  }

  for (const batchItems of chunk(actionable, BATCH_LIMIT)) {
    const batch = db.batch()

    for (const candidate of batchItems) {
      const payload = { ...candidate.data }
      delete payload._docId
      payload.id = candidate.targetId
      payload.date = candidate.newDate
      payload.rotation = candidate.newRotation

      const targetRef = db.collection('archive').doc(candidate.targetId)
      batch.set(targetRef, payload)
    }

    await batch.commit()
  }

  for (const batchItems of chunk(actionable, BATCH_LIMIT)) {
    const batch = db.batch()
    for (const candidate of batchItems) {
      const tempRef = db.collection('archive').doc(candidate.tempId)
      batch.delete(tempRef)
    }
    await batch.commit()
  }

  console.log(`\nRecreated or updated ${actionable.length} archive entries.`)
}

main().catch(error => {
  if (String(error.message).toLowerCase().includes('permission')) {
    console.error('Fatal: Missing or insufficient permissions.')
    console.error('Run this script with an authenticated admin Firestore context before applying archive recreation.')
  } else {
    console.error('Fatal:', error.message)
  }
  process.exit(1)
})
