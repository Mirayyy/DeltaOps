/**
 * Shared Firebase config loader for CLI scripts
 * Reads from .env.local or environment variables
 *
 * Usage:
 *   import { db } from './firebase-config.mjs'
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local
function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.local')
  try {
    const content = readFileSync(envPath, 'utf-8')
    const vars = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [key, ...rest] = trimmed.split('=')
      vars[key.trim()] = rest.join('=').trim()
    }
    return vars
  } catch {
    return {}
  }
}

const env = { ...loadEnv(), ...process.env }

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
}

if (!firebaseConfig.apiKey) {
  console.error('Firebase config not found. Create .env.local with VITE_FIREBASE_* variables.')
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

export { db, firebaseConfig }
