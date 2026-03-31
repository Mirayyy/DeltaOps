import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut
} from 'firebase/auth'
import { auth } from './config'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (e) {
    // Popup failed — fall back to redirect (Safari, iOS, blocked popups)
    const redirectCodes = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment',
    ]
    if (redirectCodes.includes(e.code)) {
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
