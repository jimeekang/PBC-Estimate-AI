import 'server-only';

import { readFileSync } from 'node:fs';

import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccountCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (serviceAccountJson) {
    return cert(JSON.parse(serviceAccountJson));
  }

  if (serviceAccountPath) {
    return cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8')));
  }

  return applicationDefault();
}

export function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: getServiceAccountCredential(),
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
