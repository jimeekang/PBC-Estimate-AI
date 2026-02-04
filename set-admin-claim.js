
const admin = require('firebase-admin');

// ===============================================================================================
// === IMPORTANT: SET YOUR CONFIGURATION HERE ====================================================
// ===============================================================================================

// 1. Path to your Service Account Key JSON file.
//    You can download this from your Firebase project settings:
//    Project settings > Service accounts > Generate new private key
const serviceAccount = require('./studio-5245261553-378c8-firebase-adminsdk-fbsvc-032b22c6a5.json');

// 2. The UID of the user you want to make an admin.
//    You can get this from the Firebase Authentication console.
const uid = 'EpM2qSQU5UaWMoTuJ9PlZpCpCTv1';

// ===============================================================================================

// Initialize the Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
    if (error.code === 'app/duplicate-app') {
        console.log('Firebase Admin SDK has already been initialized.');
    } else {
        console.error('Error initializing Firebase Admin SDK:', error);
        process.exit(1);
    }
}


// Set the 'admin' custom claim for the specified user
admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`Successfully set admin claim for user: ${uid}`);
    console.log('This user now has admin privileges across the application.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error setting custom claim:', error);
    process.exit(1);
  });

