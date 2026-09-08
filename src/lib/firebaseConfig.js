/**
 * Firebase web config. These values are public by design - they identify the
 * project, they don't authorize anything. Access is enforced by firestore.rules,
 * which only lets a signed-in user touch their own users/{uid} document.
 *
 * Paste the config object from Firebase console -> Project settings -> Your apps.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
}

/** Local emulator runs against a throwaway project id; Firebase treats a
 * "demo-" prefix as emulator-only and never talks to the network for it. */
export const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1'

export const emulatorConfig = {
  apiKey: 'demo-key',
  authDomain: 'localhost',
  projectId: 'demo-workout-app',
  appId: 'demo-app',
}

/** Cloud sync is optional - without a config the app just runs local-only. */
export const isFirebaseConfigured = useEmulator || Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
