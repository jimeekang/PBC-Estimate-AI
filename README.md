# PBC-Estimate-AI

Professional painting estimate service using AI, "PBC Estimate AI".

## Key Features
- **AI Estimate Generation**: Accurate price calculation using Genkit and Gemini 2.5 Flash, based on real historical quote data.
- **Data-Driven Logic**: Specialized pricing for Interior, Exterior, and Combined projects with specific rules for trim types, paint conditions, and difficulty factors.
- **Address Autocomplete**: Integrated Australian address suggestion for precise location entry.
- **Customized Form**: Detailed options for building type, work scope, room types, paint condition, and more.
- **History Management**: Generated estimate data stored in Firebase Firestore for admin review.
- **Authentication System**: Secure user management via Firebase Auth (Google Login and Email verification).

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **AI**: Genkit, Google Generative AI (Gemini 2.5 Flash)
- **Backend/Auth**: Firebase (Firestore, Authentication)
- **UI/UX**: Tailwind CSS, Shadcn UI, Framer Motion
- **Language**: Fully localized in English

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
