import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut
} from 'firebase/auth'
import { auth } from './config'

const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle() {
  try {
    // Try popup first
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (e) {
    // If popup blocked or failed, fall back to redirect
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, googleProvider)
      return null // redirect will reload the page
    }
    throw e
  }
}

export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth)
    return result?.user || null
  } catch (e) {
    console.warn('Redirect result error:', e.message)
    return null
  }
}

export async function signOut() {
  await firebaseSignOut(auth)
}
