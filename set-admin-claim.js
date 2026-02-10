const admin = require('firebase-admin');

// ===============================================================================================
// === Admin Permission Setup Guide =============================================================
// ===============================================================================================

// 1. Service Account Key File Path (Already configured)
const serviceAccount = require('./studio-5245261553-378c8-firebase-adminsdk-fbsvc-032b22c6a5.json');

// 2. Enter the email address of the user to modify admin permissions for.
const userEmail = 'kjm12081@gmail.com';

// 3. Set permission (true: Grant, false: Revoke)
const isAdmin = false;

// ===============================================================================================

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
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
      console.log(`Success: Admin permission granted to ${userEmail} (UID: ${uid}).`);
    } else {
      console.log(`Success: Admin permission revoked from ${userEmail} (UID: ${uid}).`);
    }
    
    console.log('The user must log out and log back in for the changes to take effect.');
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`Error: User '${userEmail}' not found. Please ensure the user has signed up first.`);
    } else {
      console.error('Error setting permissions:', error);
    }
    process.exit(1);
  }
}

updateAdminClaim();
