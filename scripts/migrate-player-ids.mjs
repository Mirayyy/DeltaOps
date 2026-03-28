/**
 * Migration: Assign stable IDs to all players
 * Usage: node scripts/migrate-player-ids.mjs [--dry-run]
 */

import {
  doc, collection, getDocs, getDoc, setDoc, deleteDoc,
  writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase-config.mjs'

function getWeekId() {
  const now = new Date()
  const jan1 = new Date(now.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((now - jan1) / 86400000) + 1
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7)
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

const dryRun = process.argv.includes('--dry-run')
const weekId = getWeekId()
console.log(`Current week: ${weekId}`)
console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`)

const playersSnap = await getDocs(collection(db, 'players'))
const players = playersSnap.docs.map(d => ({ docId: d.id, ...d.data() }))

console.log(`Found ${players.length} players\n`)

const alreadyMigrated = players.some(p => p.docId.startsWith('p-'))
if (alreadyMigrated) {
  console.log('Some players already have stable IDs. Skipping migrated docs.\n')
}

let counter = 0
const nicknameToId = {}

for (const player of players) {
  if (player.docId.startsWith('p-')) {
    nicknameToId[player.nickname || player.docId] = player.docId
    continue
  }

  const nickname = player.docId
  const stableId = `p-${Date.now() + counter}`
  counter++
  nicknameToId[nickname] = stableId

  console.log(`${nickname} -> ${stableId}`)

  if (dryRun) {
    console.log(`   (dry-run)\n`)
    continue
  }

  const batch = writeBatch(db)

  const { uid, docId, ...cleanData } = player
  batch.set(doc(db, 'players', stableId), {
    ...cleanData,
    nickname: nickname,
    updatedAt: serverTimestamp(),
  })

  batch.set(doc(db, 'nicknameIndex', nickname), {
    playerId: stableId,
  })

  const statsSnap = await getDoc(doc(db, 'stats', nickname))
  if (statsSnap.exists()) {
    batch.set(doc(db, 'stats', stableId), statsSnap.data())
    batch.delete(doc(db, 'stats', nickname))
    console.log(`   stats migrated`)
  }

  const readinessSnap = await getDoc(doc(db, 'gameWeeks', weekId, 'readiness', nickname))
  if (readinessSnap.exists()) {
    batch.set(
      doc(db, 'gameWeeks', weekId, 'readiness', stableId),
      { ...readinessSnap.data(), updatedAt: serverTimestamp() }
    )
    batch.delete(doc(db, 'gameWeeks', weekId, 'readiness', nickname))
    console.log(`   readiness migrated`)
  }

  batch.delete(doc(db, 'players', nickname))

  await batch.commit()
  console.log(`   done\n`)

  await new Promise(r => setTimeout(r, 5))
}

console.log(`\nNickname -> ID mapping:`)
for (const [nick, id] of Object.entries(nicknameToId)) {
  console.log(`  ${nick} -> ${id}`)
}

console.log(`\n${dryRun ? 'Would migrate' : 'Migrated'} ${counter} players.`)
process.exit(0)
