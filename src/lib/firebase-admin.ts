import 'server-only';

import { readFileSync } from 'node:fs';

import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccountCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const hasApplicationDefaultCredentials =
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS || !!process.env.GCLOUD_PROJECT || !!process.env.GOOGLE_CLOUD_PROJECT;

  if (serviceAccountJson) {
    return cert(JSON.parse(serviceAccountJson));
  }

  if (serviceAccountPath) {
    return cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8')));
  }

  if (hasApplicationDefaultCredentials) {
    return applicationDefault();
  }

  throw new Error(
    'Firebase Admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH for local development.'
  );
}

const adminApp =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        credential: getServiceAccountCredential(),
        projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
      });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
