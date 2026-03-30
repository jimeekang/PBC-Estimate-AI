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

- **Framework**: Next.js 16 (App Router)
- **AI**: Genkit, Google Generative AI (Gemini 2.5 Flash)
- **Backend/Auth**: Firebase (Firestore, Authentication)
- **UI/UX**: Tailwind CSS, Shadcn UI, Framer Motion
- **Language**: Fully localized in English

## Getting Started

### 1. Environment Configuration

For local development, set the required values in `.env` using `.env.example` as the template.

For Firebase App Hosting deployments from Git:

- Copy `apphosting.example.yaml` to `apphosting.yaml`.
- Commit `apphosting.yaml` to Git after replacing server-side secrets with Firebase App Hosting `secret:` references.
- Keep public Firebase web config values in `value:` entries when appropriate, and store private server credentials in Firebase App Hosting secrets.
- Set `NEXT_PUBLIC_SITE_URL` to your Firebase App Hosting production URL so metadata and auth guidance point at the correct site.

Example secret setup commands:

```bash
firebase apphosting:secrets:set firebase-web-api-key
firebase apphosting:secrets:set google-maps-api-key
firebase apphosting:secrets:set gemini-api-key
```

This project already reads `NEXT_PUBLIC_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` from environment variables at build/runtime, so the deployed app will use the currently registered Firebase secrets without storing the actual keys in Git.

For Firebase App Check, add a reCAPTCHA v3 site key as `NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY` and enable App Check enforcement for the Firebase services you expose to the client.

## Estimate Usage Policy

- Standard client accounts: **2 free AI estimates**
- Admin accounts: unlimited estimates
- Promotional extra estimates via coupon or event are only a future option under consideration and are **not part of the confirmed product policy yet**
- Abuse-prevention rate limits remain separate from the free-estimate quota

### 2. Set Admin Permissions

Set `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH` in your environment, or authenticate with Application Default Credentials, then run:

```bash
node set-admin-claim.js user@example.com true
```

Use `false` as the second argument to revoke admin access.

### 3. Run Development Server

```bash
npm install
npm run dev
```

## Troubleshooting (Google Login)

If the login popup closes immediately:

1. Ensure **third-party cookies** are allowed in your browser settings.
2. Register the current domain in Firebase Console > Authentication > Settings > **Authorized domains**.

## Deployment Note

This app is hosted on Firebase App Hosting, and production deploys are triggered from commits pushed to the connected branch.
