import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { emulatorConfig, firebaseConfig, isFirebaseConfigured, useEmulator } from './firebaseConfig'

let auth = null
let firestore = null

if (isFirebaseConfigured) {
  const app = initializeApp(useEmulator ? emulatorConfig : firebaseConfig)
  auth = getAuth(app)
  firestore = getFirestore(app)
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
  }
}

export { auth, firestore, isFirebaseConfigured }
