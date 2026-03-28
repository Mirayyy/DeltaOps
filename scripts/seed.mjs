/**
 * Seed script — creates initial data in Firestore
 * Usage: node scripts/seed.mjs
 *
 * Requires .env.local with Firebase config
 */

import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from './firebase-config.mjs'

// ─── 1. Player ──────────────────────────────────────────────
const adminPlayer = {
  nickname: 'HardKil',
  email: '',  // Set your email here for auto-linking
  telegramId: null,
  squadRole: 'Командир отряда',
  status: 'active',
  profileUrl: '',
  joinedAt: Timestamp.now(),
  updatedAt: Timestamp.now(),

  skills: {
    'Снайпер': 'experienced',
    'БПЛА': 'intermediate',
  },

  allTime: {
    totalGames: 0,
    attendedGames: 0,
    attendanceRate: 0,
  },

  rotation: {
    rotationId: null,
    totalGames: 0,
    attendedGames: 0,
    attendanceRate: 0,
  },

  adminNotes: '',
}

// ─── 2. User (website account) ──────────────────────────────
const adminUser = {
  email: '',  // Set your Google account email here
  displayName: 'HardKil',
  photoURL: '',
  role: 'admin',
  createdAt: Timestamp.now(),
  lastLoginAt: Timestamp.now(),
}

// ─── 3. Current rotation ────────────────────────────────────
const rotation = {
  name: 'Весна 2026',
  status: 'active',
  startedAt: Timestamp.now(),
  archivedAt: null,
}

// ─── 4. Current game week ───────────────────────────────────
const currentWeekId = '2026-W13'
const gameWeek = {
  rotationId: 'rotation-2026-spring',
  fridayDate: '2026-03-27',
  saturdayDate: '2026-03-28',
  status: 'active',
  createdAt: Timestamp.now(),
  archivedAt: null,
}

// ─── 5. App config ──────────────────────────────────────────
const appConfig = {
  currentWeekId: '2026-W13',
  currentRotationId: 'rotation-2026-spring',
}

// ─── Write to Firestore ─────────────────────────────────────
async function seed() {
  console.log('Seeding Firestore...\n')

  try {
    await setDoc(doc(db, 'players', 'HardKil'), adminPlayer)
    console.log('players/HardKil — created')

    await setDoc(doc(db, 'users', 'seed-admin'), adminUser)
    console.log('users/seed-admin — created')

    await setDoc(doc(db, 'rotations', 'rotation-2026-spring'), rotation)
    console.log('rotations/rotation-2026-spring — created')

    await setDoc(doc(db, 'gameWeeks', currentWeekId), gameWeek)
    console.log('gameWeeks/2026-W13 — created')

    await setDoc(doc(db, 'gameWeeks', currentWeekId, 'readiness', 'HardKil'), {
      nickname: 'HardKil',
      friday_1: 'no_response',
      friday_2: 'no_response',
      saturday_1: 'no_response',
      saturday_2: 'no_response',
      updatedAt: Timestamp.now(),
    })
    console.log('gameWeeks/2026-W13/readiness/HardKil — created')

    await setDoc(doc(db, 'config', 'app'), appConfig)
    console.log('config/app — created')

    console.log('\nSeed complete.')
  } catch (e) {
    console.error('Error:', e.message)
  }

  process.exit(0)
}

seed()
