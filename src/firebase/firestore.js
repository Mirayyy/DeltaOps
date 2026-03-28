import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, writeBatch, serverTimestamp
} from 'firebase/firestore'
import { db } from './config'

// Collection references
export const usersRef = collection(db, 'users')
export const playersRef = collection(db, 'players')
export const missionsRef = collection(db, 'missions')
export const gamesRef = collection(db, 'games')
export const attendanceRef = collection(db, 'attendance')
export const rotationsRef = collection(db, 'rotations')
export const archiveRef = collection(db, 'archive')
export const statsRef = collection(db, 'stats')
export const structuresRef = collection(db, 'structures')
export const configRef = doc(db, 'config', 'app')
export const squadConfigRef = doc(db, 'config', 'squad')

// Re-export commonly used Firestore functions
export {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, writeBatch, serverTimestamp, collection, db
}
