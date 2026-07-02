import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import config from '../firebase-applet-config.json';

let db: any;
try {
  const firebaseApp = initializeApp(config);
  db = getFirestore(firebaseApp, config.firestoreDatabaseId || '(default)');
} catch (error) {
  console.error("Error initializing Firebase:", error);
}

export { db };
