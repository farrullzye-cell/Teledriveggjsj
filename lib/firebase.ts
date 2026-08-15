import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

function getFirebaseCredentials() {
  // 1. Try reading from config.json
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed.firebase && parsed.firebase.projectId) {
          return parsed.firebase;
        }
        if (parsed.projectId && parsed.apiKey) {
          return {
            projectId: parsed.projectId,
            appId: parsed.appId || '',
            apiKey: parsed.apiKey,
            authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
            firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
            storageBucket: parsed.storageBucket || `${parsed.projectId}.firebasestorage.app`,
            messagingSenderId: parsed.messagingSenderId || '',
            measurementId: parsed.measurementId || '',
            oAuthClientId: parsed.oAuthClientId || '',
            recaptchaSiteKey: parsed.recaptchaSiteKey || '',
          };
        }
      }
    }
  } catch (e) {
    // Ignore error and try fallback
  }

  // 2. Try reading from firebase-applet-config.json
  try {
    const appletConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(appletConfigPath)) {
      const raw = fs.readFileSync(appletConfigPath, 'utf-8');
      if (raw.trim()) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    // Ignore error
  }

  // 3. Fallback to process.env
  return {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0854109396',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '1:704609502090:web:ff5864d6845bddb943fe73',
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyDOXo8Fo5-B3X3htoNkaLMtShfqgZMQbks',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0854109396.firebaseapp.com',
    firestoreDatabaseId: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || 'ai-studio-rullzyecloud-d8ccd23e-2ae8-4f68-be30-455eb3379287',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0854109396.firebasestorage.app',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '704609502090',
  };
}

const firebaseConfig = getFirebaseCredentials();

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export { firebaseConfig };
