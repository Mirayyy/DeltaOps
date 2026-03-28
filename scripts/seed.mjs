/**
 * Seed script — creates initial data in Firestore
 * Usage: node scripts/seed.mjs
 *
 * Requires .env.local with Firebase config
 */

import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from './firebase-config.mjs'

const now = Timestamp.now()
const playerId = `p-${Date.now()}`

// ─── 1. Player ──────────────────────────────────────────────
const player = {
  nickname: 'Admin',
  email: '',          // Set your Google email for auto-linking
  position: 'Командир отряда',
  status: 'active',
  avatar: '',
  telegramUsername: '',
  telegramId: null,
  skills: [],
  wishes: '',
  nicknameHistory: [],
  createdAt: now,
  updatedAt: now,
}

// ─── 2. User (website account) ──────────────────────────────
const user = {
  email: '',          // Set your Google email
  displayName: 'Admin',
  photoURL: '',
  role: 'admin',
  createdAt: now,
  lastLoginAt: now,
}

// ─── 3. Rotation ─────────────────────────────────────────────
const rotation = {
  name: 'Сезон 1',
  startDate: new Date().toISOString().split('T')[0],
  endDate: null,
}

// ─── 4. App config ──────────────────────────────────────────
const appConfig = {
  currentRotationId: 'rotation-1',
}

// ─── 5. Squad identity ──────────────────────────────────────
const squadConfig = {
  name: 'MY_SQUAD',
  logo: '',
  siteUrl: '',
  siteName: 'SquadOps',
}

// ─── Write to Firestore ─────────────────────────────────────
async function seed() {
  console.log('Seeding Firestore...\n')

  try {
    // Player + nickname index
    await setDoc(doc(db, 'players', playerId), player)
    console.log(`✓ players/${playerId}`)

    await setDoc(doc(db, 'nicknameIndex', player.nickname), { playerId })
    console.log(`✓ nicknameIndex/${player.nickname}`)

    // User account (use 'seed-admin' as placeholder UID)
    await setDoc(doc(db, 'users', 'seed-admin'), user)
    console.log('✓ users/seed-admin')

    // Rotation
    await setDoc(doc(db, 'rotations', 'rotation-1'), rotation)
    console.log('✓ rotations/rotation-1')

    // Config
    await setDoc(doc(db, 'config', 'app'), appConfig)
    console.log('✓ config/app')

    await setDoc(doc(db, 'config', 'squad'), squadConfig)
    console.log('✓ config/squad')

    console.log('\n✅ Seed complete.')
    console.log('\nNext steps:')
    console.log('1. Set your email in players and users docs')
    console.log('2. Log in with Google → auto-link by email')
    console.log('3. Update squad config in Settings')
  } catch (e) {
    console.error('❌ Error:', e.message)
  }

  process.exit(0)
}

seed()
