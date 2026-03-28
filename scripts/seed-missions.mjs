/**
 * Seed missions — loads test missions into Firestore
 * Usage: node scripts/seed-missions.mjs
 */

import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'
import { db } from './firebase-config.mjs'

const SLOTS = ['friday_1', 'friday_2', 'saturday_1', 'saturday_2']

const missions = {
  friday_1: {
    missionTitle: 'Пальмира',
    missionSlot: 'friday_1',
    type: 'TSG',
    map: 'Алтис',
    platform: 'Atrium',
    status: 'Протестирована',
    testStatus: 'Игровая проверена',
    uploader: 'Koreec',
    authors: ['Koreec'],
    version: '30',
    uploadDate: '13.03.2026 16:10',
    lastUpdate: '13.03.2026 18:08',
    downloadLink: '',
    description: 'Освобождение древней части города от сил повстанцев.',
    sidesRaw: 'НАПА: 102 (Атака) VS ЧДКЗ: 94 (Оборона)',
    additionalConditions: '',
    sides: [
      {
        name: 'Синие', color: 'blue', role: 'Атака', playerCount: 102,
        vehicles: 'БМП-2 х4, Т-72Б х2, МТ-ЛБ х6',
        gallery: [],
        squads: [
          { name: 'Alpha-1-1', size: 11, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок-помощник', 'Снайпер', 'Стрелок'] },
          { name: 'Alpha-HQ', size: 5, slots: ['Командир роты', 'Заместитель', 'Связист', 'Медик', 'Сапер'] },
        ],
      },
      {
        name: 'Красные', color: 'red', role: 'Оборона', playerCount: 94,
        vehicles: 'Т-55 х2, БТР-80 х3',
        gallery: [],
        squads: [
          { name: 'Bravo-1-1', size: 11, slots: ['Командир отделения', 'Пулеметчик', 'Гренадер', 'Стрелок', 'Стрелок', 'Стрелок', 'Стрелок', 'Медик', 'Стрелок', 'Стрелок', 'Стрелок'] },
          { name: 'Bravo-HQ', size: 4, slots: ['Командир роты', 'Заместитель', 'Связист', 'Медик'] },
        ],
      },
    ],
    scrapedAt: '2026-03-27T06:28:27.551Z',
    sourceUrl: 'https://tsgames.ru/missions/ss_Palmira',
  },
}

async function cleanup() {
  console.log('Cleaning old subcollections...\n')
  for (const slot of SLOTS) {
    try {
      const subcol = collection(db, 'missions', slot, 'data')
      const snapshot = await getDocs(subcol)
      for (const d of snapshot.docs) {
        await deleteDoc(d.ref)
        console.log(`  deleted missions/${slot}/data/${d.id}`)
      }
    } catch {
      // subcollection doesn't exist
    }
  }
}

async function seed() {
  await cleanup()

  console.log('\nSeeding missions...\n')

  for (const [slot, mission] of Object.entries(missions)) {
    try {
      await setDoc(doc(db, 'missions', slot), mission)
      console.log(`missions/${slot} — ${mission.missionTitle}`)
    } catch (e) {
      console.error(`${slot}: ${e.message}`)
    }
  }

  console.log('\nDone.')
  process.exit(0)
}

seed()
