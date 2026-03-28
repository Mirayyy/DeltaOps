#!/usr/bin/env node
/**
 * Cleanup DB: delete all collections except users, players, nicknameIndex.
 * Uses Firestore REST API (no firebase-admin needed).
 *
 * Usage: node scripts/cleanup-db.mjs
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load env from .env.local
const envPath = resolve(import.meta.dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=')
    return [k.trim(), v.join('=').trim()]
  })
)

const PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID
const API_KEY = env.VITE_FIREBASE_API_KEY
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const COLLECTIONS_TO_DELETE = [
  'missions',
  'games',
  'attendance',
  'rotations',
  'archive',
  'stats',
  'structures',
  'webContent',
  'config',
]

async function listDocuments(collection) {
  const docs = []
  let pageToken = ''

  while (true) {
    const url = `${BASE_URL}/${collection}?key=${API_KEY}&pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json()
      throw new Error(`List ${collection}: ${err.error?.message || res.status}`)
    }
    const data = await res.json()
    if (data.documents) {
      docs.push(...data.documents)
    }
    if (data.nextPageToken) {
      pageToken = data.nextPageToken
    } else {
      break
    }
  }

  return docs
}

async function deleteDocument(docName) {
  const url = `https://firestore.googleapis.com/v1/${docName}?key=${API_KEY}`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const err = await res.json()
    throw new Error(`Delete ${docName}: ${err.error?.message || res.status}`)
  }
}

async function deleteCollection(name) {
  const docs = await listDocuments(name)
  if (docs.length === 0) {
    console.log(`  ${name}: empty`)
    return 0
  }

  for (const doc of docs) {
    await deleteDocument(doc.name)
  }
  console.log(`  ${name}: deleted ${docs.length} docs`)
  return docs.length
}

async function main() {
  console.log(`Cleaning DB: ${PROJECT_ID}`)
  console.log(`Keeping: users, players, nicknameIndex\n`)

  let total = 0
  for (const col of COLLECTIONS_TO_DELETE) {
    try {
      total += await deleteCollection(col)
    } catch (e) {
      console.error(`  ${col}: ERROR — ${e.message}`)
    }
  }

  console.log(`\nDone. Deleted ${total} documents.`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
