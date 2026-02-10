# PBC-Estimate-AI

Professional painting estimate service using AI, "PBC Estimate AI".

## Key Features
- **AI Estimate Generation**: Accurate price calculation using Genkit and Gemini 2.5 Flash.
- **Customized Form**: Detailed options for building type, work scope, room types, paint condition, etc.
- **History Management**: Generated estimate data stored in Firebase Firestore.
- **Authentication System**: Secure user management via Firebase Auth (Google Login and Email verification).

## Recent Updates
- **Authentication Error Fix**: Added domain authorization guide for cases where Google login popups close automatically (`auth/popup-closed-by-user`).
- **Admin Permission Management**: Script `set-admin-claim.js` to grant or revoke admin privileges.
- **Estimate Usage Limit**: Standard users are limited to 2 estimates, while admins have unlimited access.
- **UI/UX Improvements**: Added intuitive icons and animations to the form, and fixed build errors.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **AI**: Genkit, Google Generative AI
- **Backend/Auth**: Firebase (Firestore, Authentication)
- **UI/UX**: Tailwind CSS, Shadcn UI, Framer Motion

## Getting Started

### 1. Environment Configuration
Set up the required API keys in the `.env` file.

### 2. Set Admin Permissions
To designate a specific account as admin, modify the `userEmail` in `set-admin-claim.js` and run:
```bash
node set-admin-claim.js
```

### 3. Run Development Server
```bash
npm install
npm run dev
```

## Troubleshooting (Google Login)
If the login popup closes immediately:
1. Ensure **third-party cookies** are allowed in your browser settings.
2. Register the current domain in Firebase Console > Authentication > Settings > **Authorized domains**.
