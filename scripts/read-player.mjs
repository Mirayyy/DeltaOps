/**
 * Read a player document from Firestore
 * Usage: node scripts/read-player.mjs [nickname]
 */

import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase-config.mjs'

const nickname = process.argv[2]

if (!nickname) {
  console.log('Listing all players...\n')
  const snap = await getDocs(collection(db, 'players'))
  for (const d of snap.docs) {
    const data = d.data()
    const fields = Object.keys(data).sort().join(', ')
    console.log(`${d.id}  [${Object.keys(data).length} fields]`)
    console.log(`   Fields: ${fields}\n`)
  }
  console.log(`Total: ${snap.docs.length} players`)
} else {
  const snap = await getDoc(doc(db, 'players', nickname))
  if (!snap.exists()) {
    console.log(`Player "${nickname}" not found`)
  } else {
    console.log(`players/${nickname}\n`)
    console.log(JSON.stringify(snap.data(), null, 2))
  }
}

process.exit(0)
