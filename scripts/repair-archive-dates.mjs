#!/usr/bin/env node
/**
 * Repair future-dated archive entries caused by old live-week date fallback.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=path/to/service-account.json node scripts/repair-archive-dates.mjs
 *   FIREBASE_SERVICE_ACCOUNT_PATH=path/to/service-account.json node scripts/repair-archive-dates.mjs --apply
 */

import { readFileSync } from 'fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import {
  getSuggestedArchiveDate,
  resolveRotationIdForDate,
  shouldRepairArchiveDate,
  timestampToDate,
} from '../src/utils/gameDates.js'

const APPLY = process.argv.includes('--apply')
const BATCH_LIMIT = 400
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

function formatTimestamp(value) {
  const date = timestampToDate(value)
  return date ? date.toISOString() : 'unparseable'
}

function chunk(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function loadCollection(name) {
  const snapshot = await getAdminDb().collection(name).get()
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

async function main() {
  const [archives, rotations] = await Promise.all([
    loadCollection('archive'),
    loadCollection('rotations'),
  ])

  const candidates = archives
    .filter(shouldRepairArchiveDate)
    .map(entry => {
      const newDate = getSuggestedArchiveDate(entry)
      const newRotation = resolveRotationIdForDate(newDate, rotations)
      return {
        id: entry.id,
        schedule: entry.schedule,
        archivedAt: formatTimestamp(entry.archivedAt),
        oldDate: entry.date || '',
        newDate,
        oldRotation: entry.rotation || '',
        newRotation,
      }
    })

  console.log(`Archive entries scanned: ${archives.length}`)
  console.log(`Repair candidates: ${candidates.length}`)
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`)

  for (const candidate of candidates) {
    console.log([
      candidate.id,
      `schedule=${candidate.schedule}`,
      `oldDate=${candidate.oldDate}`,
      `newDate=${candidate.newDate}`,
      `oldRotation=${candidate.oldRotation || '—'}`,
      `newRotation=${candidate.newRotation || '—'}`,
      `archivedAt=${candidate.archivedAt}`,
    ].join(' | '))
  }

  if (!APPLY || !candidates.length) {
    console.log(`\n${APPLY ? 'Nothing to update.' : 'Dry-run complete. Re-run with --apply to persist changes.'}`)
    return
  }

  for (const batchItems of chunk(candidates, BATCH_LIMIT)) {
    const batch = getAdminDb().batch()
    for (const candidate of batchItems) {
      batch.update(getAdminDb().collection('archive').doc(candidate.id), {
        date: candidate.newDate,
        rotation: candidate.newRotation,
      })
    }
    await batch.commit()
  }

  console.log(`\nUpdated ${candidates.length} archive entries.`)
}

main().catch(error => {
  if (String(error.message).toLowerCase().includes('permission')) {
    console.error('Fatal: Missing or insufficient permissions.')
    console.error('Run this script with an authenticated admin Firestore context before applying archive repairs.')
  } else {
    console.error('Fatal:', error.message)
  }
  process.exit(1)
})
