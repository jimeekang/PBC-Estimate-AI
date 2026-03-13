const admin = require('firebase-admin');
require('dotenv').config();

const userEmail = process.argv[2] || process.env.ADMIN_USER_EMAIL;
const isAdmin = (process.argv[3] || process.env.ADMIN_IS_ADMIN || 'false').toLowerCase() === 'true';

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }

  return admin.credential.applicationDefault();
}

if (!userEmail) {
  console.error('Usage: node set-admin-claim.js <email> <true|false>');
  process.exit(1);
}

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: getCredential(),
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  });
} catch (error) {
  if (error.code !== 'app/duplicate-app') {
    console.error('Error initializing Firebase Admin SDK:', error);
    process.exit(1);
  }
}

// Find user by email and update permissions
async function updateAdminClaim() {
  try {
    const user = await admin.auth().getUserByEmail(userEmail);
    const uid = user.uid;

    // Set/Revoke 'admin' custom claim
    await admin.auth().setCustomUserClaims(uid, { admin: isAdmin });

    if (isAdmin) {
      console.log(
        `Success: Admin permission granted to ${userEmail} (UID: ${uid}).`,
      );
    } else {
      console.log(
        `Success: Admin permission revoked from ${userEmail} (UID: ${uid}).`,
      );
    }

    console.log(
      'The user must log out and log back in for the changes to take effect.',
    );
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(
        `Error: User '${userEmail}' not found. Please ensure the user has signed up first.`,
      );
    } else {
      console.error('Error setting permissions:', error);
    }
    process.exit(1);
  }
}

updateAdminClaim();
