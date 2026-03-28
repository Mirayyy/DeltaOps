/**
 * Cleanup stale/invalid fields from players/ documents
 * Usage: node scripts/cleanup-players.mjs [--dry-run]
 */

import { doc, collection, getDocs, updateDoc, deleteField } from 'firebase/firestore'
import { db } from './firebase-config.mjs'

const ALLOWED_FIELDS = new Set([
  'nickname', 'email', 'squadRole', 'status', 'avatar', 'profileUrl', 'scrapedAt',
  'telegramId', 'telegram', 'discord', 'skills', 'adminNotes',
  'allTime', 'rotation', 'nicknameHistory', 'joinedAt', 'updatedAt',
])

const dryRun = process.argv.includes('--dry-run')

const snap = await getDocs(collection(db, 'players'))
let totalCleaned = 0

for (const d of snap.docs) {
  const data = d.data()
  const extraFields = Object.keys(data).filter(k => !ALLOWED_FIELDS.has(k))

  if (extraFields.length === 0) continue

  console.log(`${d.id}: removing [${extraFields.join(', ')}]`)
  totalCleaned++

  if (!dryRun) {
    const deletes = {}
    for (const f of extraFields) {
      deletes[f] = deleteField()
    }
    await updateDoc(doc(db, 'players', d.id), deletes)
    console.log(`  cleaned`)
  } else {
    console.log(`  (dry-run, skipped)`)
  }
}

if (totalCleaned === 0) {
  console.log('All players clean.')
} else {
  console.log(`\n${dryRun ? 'Would clean' : 'Cleaned'} ${totalCleaned} documents.`)
}

process.exit(0)
