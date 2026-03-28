#!/usr/bin/env node
/**
 * Seed DB: create initial documents the site needs to function.
 * Uses Firestore REST API.
 *
 * Creates:
 *   config/squad    — squad identity (incl. awards + aboutMarkdown)
 *   rotations/...   — one active rotation
 *
 * Usage: node scripts/seed-db.mjs
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load env
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

// ── Firestore value converters ──

function toVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toVal) } }
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } }
  return { stringValue: String(v) }
}

function toFields(obj) {
  const f = {}
  for (const [k, v] of Object.entries(obj)) f[k] = toVal(v)
  return f
}

async function writeDoc(path, data) {
  const url = `${BASE_URL}/${path}?key=${API_KEY}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Write ${path}: ${err.error?.message || res.status}`)
  }
  console.log(`  ✓ ${path}`)
}

// ── Data ──

const rotationId = `rotation-${Date.now()}`

const SQUAD_CONFIG = {
  name: 'DELTA',
  tag: 'DELTA',
  logo: 'https://tsgames.ru/images/tsg_squad/J0/fB/R6jwSt75lUXL-iBtTpIfUQpYAzLEP9EW.png',
  status: 'Отряд Участник Проекта',
  server: 'T2',
  side: 'red',
  guaranteedSlots: 14,
  recruitment: 'open',
  createdAt: '17.12.2024',
  contacts: [],
  skillNames: [
    'ПТРК', 'ПЗРК', 'СПГ / АГС / МК', 'ЗУ', 'ДШК / М2 / КОРД',
    'Артиллерист', 'Снайпер', 'Сапер (Многоразовый)', 'БПЛА', 'Медик',
    'БМП', 'Танк', 'ПВО', 'Вертолёт [Т]', 'Вертолёт [Б]', 'Самолет',
  ],
  awards: [
    {
      icon: 'https://stats.tsgames.ru/icons/d_mad.svg',
      title: 'Operation AR',
      description: 'За успешное проведение операции Абсолютная решимость',
      type: 'squad',
      playerUid: '',
      showOnLanding: true,
    },
    {
      icon: 'https://stats.tsgames.ru/icons/sqd-gold.svg',
      title: '1 место',
      description: '1 место в статистике Отрядов по результатам ротации Лето 25 — Зима 25',
      type: 'squad',
      playerUid: '',
      showOnLanding: true,
    },
    {
      icon: 'https://stats.tsgames.ru/icons/sqd-silver.svg',
      title: '2 место',
      description: '2 место в статистике Отрядов по результатам ротации Зима 24 — Лето 25',
      type: 'squad',
      playerUid: '',
      showOnLanding: true,
    },
  ],
  aboutMarkdown: `**DELTA** — отряд на проекте **TSG (Tushino Serious Games)**, платформа Arma 3.\n\nСоздан **17.12.2024**, участник проекта с **07.12.2025**.\n\nСпециализируемся на выполнении сложных боевых задач: СПН, БПЛА, спецрасчёты, бронетехника. Действуем автономно от основных сил стороны, что позволяет вносить максимальный вклад в победу. Каждая миссия разбирается заранее — готовимся к играм серьёзно.`,
}

const APP_CONFIG = {
  siteName: 'DeltaOps',
  siteUrl: 'https://mirayyy.github.io/DeltaOps/',
  githubUrl: 'https://github.com/Mirayyy/DeltaOps',
  firestoreUrl: `https://console.firebase.google.com/project/${PROJECT_ID}/firestore`,
}

const ROTATION = {
  id: rotationId,
  name: 'Весна 2026',
  startDate: '2026-03-01',
  endDate: null,
}

// ── Run ──

async function main() {
  console.log(`Seeding DB: ${PROJECT_ID}\n`)

  await writeDoc('config/squad', SQUAD_CONFIG)
  await writeDoc('config/app', APP_CONFIG)
  await writeDoc(`rotations/${rotationId}`, ROTATION)

  console.log(`\nDone. Created 3 documents.`)
  console.log(`  Rotation ID: ${rotationId}`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
