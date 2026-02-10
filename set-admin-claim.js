
const admin = require('firebase-admin');

// ===============================================================================================
// === IMPORTANT: SET YOUR CONFIGURATION HERE ====================================================
// ===============================================================================================

// 1. Path to your Service Account Key JSON file.
const serviceAccount = require('./studio-5245261553-378c8-firebase-adminsdk-fbsvc-032b22c6a5.json');

// 2. The email of the user you want to make an admin.
const userEmail = 'jimee@paintbuddyco.com.au';

// ===============================================================================================

// Initialize the Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
    if (error.code === 'app/duplicate-app') {
        // This is expected if the script is run multiple times.
        // We can safely ignore it and proceed.
    } else {
        console.error('Error initializing Firebase Admin SDK:', error);
        process.exit(1);
    }
}

// Get the user by email
admin.auth().getUserByEmail(userEmail)
  .then((user) => {
    // Set the 'admin' custom claim for the specified user
    const uid = user.uid;
    return admin.auth().setCustomUserClaims(uid, { admin: true })
      .then(() => {
        console.log(`Successfully set admin claim for user: ${userEmail} (UID: ${uid})`);
        console.log('This user now has admin privileges across the application.');
        process.exit(0);
      });
  })
  .catch(error => {
    console.error('Error setting custom claim:', error);
    process.exit(1);
  });

