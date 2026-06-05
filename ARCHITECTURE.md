# ARCHITECTURE.md

> PBC Estimate AI — System Architecture
> Last updated: 2026-06-05

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| AI | Genkit + Google Generative AI (Gemini 2.5 Flash) |
| Auth | Firebase Authentication (Google + Email/Password) |
| Database | Cloud Firestore |
| Storage | Firebase Storage (estimate photos) |
| Security | App Check (reCAPTCHA v3), Admin custom claims |
| UI | Tailwind CSS, shadcn/ui (Radix UI), Framer Motion |
| Forms | react-hook-form + Zod |
| Testing | Jest |
| Hosting | Firebase App Hosting (Git-triggered) |

---

## Directory Structure

Estimate-specific code now uses a DDD-style bounded context under `src/domains/estimate`.
The old estimate paths under `src/lib`, `src/schemas`, `src/ai/flows`, and `src/components/estimate` remain as compatibility wrappers only.

```
src/
├── domains/
│   └── estimate/
│       ├── domain/
│       │   ├── pricing/
│       │   │   ├── pricing-engine.ts          — Pure deterministic pricing anchors/helpers
│       │   │   └── output-range.ts            — Estimate range clamping
│       │   ├── flow/
│       │   │   └── estimate-flow-logic.ts     — Form/scope decision rules
│       │   ├── schemas/
│       │   │   ├── estimate.ts                — Shared item schemas
│       │   │   ├── estimate-request.ts        — Full estimate request validation
│       │   │   └── estimate-lite.ts           — Public quick-guide validation
│       │   └── estimate-constants.ts          — Domain option constants
│       ├── application/
│       │   ├── generation/
│       │   │   ├── generate-painting-estimate.ts
│       │   │   └── generate-painting-estimate.exterior.ts
│       │   ├── lifecycle/estimate-lifecycle.ts
│       │   ├── lite/lite-estimate.ts
│       │   ├── normalization/normalize-estimate-request.ts
│       │   └── estimate-price-display.ts
│       └── presentation/
│           └── components/
│               ├── estimate-form.tsx
│               ├── estimate-result.tsx
│               └── lite-estimate-form.tsx
```

```
src/
├── ai/                          — AI layer
│   ├── genkit.ts                — Genkit instance config
│   ├── dev.ts                   — Genkit dev server entry
│   └── flows/
│       ├── generate-painting-estimate.ts          — Compatibility wrapper to estimate generation
│       └── generate-painting-estimate.exterior.ts — Compatibility wrapper to exterior generation
│
├── app/                         — Next.js App Router
│   ├── layout.tsx               — Root layout
│   ├── not-found.tsx            — 404 page
│   ├── globals.css              — Global styles
│   │
│   ├── (public)/                — Public routes (no auth)
│   │   └── page.tsx             — Landing page
│   │
│   ├── (auth)/                  — Auth routes (layout: minimal)
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── verify-email/page.tsx
│   │
│   ├── (protected)/             — Auth-required routes (layout: header + footer)
│   │   ├── layout.tsx
│   │   ├── estimate/page.tsx    — Estimate form page
│   │   ├── dashboard/page.tsx   — User dashboard
│   │   └── admin/
│   │       ├── page.tsx         — Admin estimate list
│   │       └── estimate/[id]/page.tsx — Admin estimate detail
│   │
│   ├── estimate/
│   │   └── actions.ts           — Server action (submit estimate)
│   │
│   ├── api/
│   │   └── estimate-photos/route.ts — Photo upload/download API
│   │
│   └── auth/
│       └── actions.ts           — Auth server actions
│
├── components/
│   ├── estimate/
│   │   ├── estimate-form.tsx    — Compatibility wrapper to estimate presentation
│   │   └── estimate-result.tsx  — Compatibility wrapper to estimate presentation
│   ├── admin/
│   │   └── estimates-table.tsx  — Admin data table
│   ├── auth/
│   │   ├── login-form.tsx
│   │   ├── signup-form.tsx
│   │   └── privacy-policy.tsx
│   ├── ui/                      — shadcn/ui components
│   ├── header.tsx
│   ├── footer.tsx
│   ├── logo.tsx
│   ├── icons.tsx
│   ├── app-providers.tsx        — Client provider wrapper
│   └── public-auth-redirect.tsx
│
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
│
├── lib/
│   ├── pricing-engine.ts        — Compatibility wrapper to estimate pricing domain
│   ├── estimate-constants.ts    — Compatibility wrapper to estimate domain constants
│   ├── firebase.ts              — Client-side Firebase init + helpers
│   ├── firebase-admin.ts        — Server-side Firebase Admin SDK
│   ├── utils.ts                 — General utilities
│   └── placeholder-images.ts
│
├── providers/
│   └── auth-provider.tsx        — Firebase Auth context (user, loading, isAdmin)
│
├── schemas/
│   ├── estimate.ts              — Compatibility wrapper to estimate schemas
│   └── estimate-request.ts      — Compatibility wrapper to estimate request schema
│
└── __tests__/
    └── pricing-engine.test.ts   — Pricing engine unit tests
```

---

## Data Flow

```
User (Browser)
  │
  ├─ Landing page (public) ──→ Auth pages ──→ Protected routes
  │
  ▼
Estimate Form (multi-step wizard)
  │
  ├─ Photo upload ──→ POST /api/estimate-photos ──→ Firebase Storage
  │
  ▼
Server Action (src/app/estimate/actions.ts)
  │
  ├─ 1. Verify Firebase ID token (firebase-admin)
  ├─ 2. Rate limit check (Firestore estimateRateLimits collection)
  ├─ 3. Validate form data (Zod: estimateSubmissionSchema)
  ├─ 4. Call AI flow (generate-painting-estimate)
  │     │
  │     ├─ src/domains/estimate/domain/pricing/pricing-engine.ts
  │     └─ Genkit + Gemini (natural language explanation)
  │
  ├─ 5. Save to Firestore (estimates collection)
  └─ 6. Return result to client
        │
        ▼
      Estimate Result page (price range + AI explanation)
        â”‚
        â””â”€ Booking CTA â”€â”€â†’ External Jobber booking URL
              â””â”€ Customer chooses date/time in Jobber
```

---

## Key Design Decisions

### 1. Pricing Engine Isolation
`src/domains/estimate/domain/pricing/pricing-engine.ts` is a **pure function module**: no `use server`, no Genkit, no Next.js dependencies. This allows:
- Unit testing without server environment
- Reuse across AI flows and tests
- Clear separation: pricing = deterministic, AI = narrative

### 2. Dual Pricing Modes
- **Entire property**: Anchor-based (apartment SQM curve / house bedroom count)
- **Specific areas only**: Per-room/per-item calculation with individual anchors
- **Interior entire trim**: When trim is selected, collect door/window/skirting quantities and price them with a whole-property trim quantity anchor set to 50% of the existing specific-area trim unit prices. Specific-area trim pricing stays unchanged.
- **Exterior trim**: Keep detailed exterior trim quantities for full/exterior scopes because exterior door, window, architrave, and front door counts materially affect labour. Fall back to the standard exterior trim allowance only when detailed quantities are not supplied.

### 3. Range Width Caps
Price ranges are dynamically capped to prevent unrealistically wide spreads:
- Interior/Total: $0~5k→$1,200 cap / $5k~10k→$1,800 / $10k~18k→$2,500 / $18k+→$3,500
- Exterior: $0~10k→$800 / $10k~20k→$1,500 / $20k+→$2,500

### 4. Overlap Control
- Double storey + difficult access: capped at +0.5%~1% interior (prevents double counting)
- Stairwell auto-inclusion: reduces double storey uplift when stairwell already selected
- High ceiling: reduces extra uplift to avoid stacking

### 5. Auth Architecture
- Client: Firebase Auth (onIdTokenChanged) → AuthContext (user, isAdmin)
- Server: firebase-admin verifyIdToken → admin custom claims check
- App Check: reCAPTCHA v3 for production, debug token for local dev

### 6. Estimate Usage Policy
- 2 free estimates for non-admin users
- Admin users have unlimited estimates
- Promotional +1 estimate via coupon/event is only being considered and is not confirmed or implemented yet
- Separate rate limits (30s/5hr/10day) for abuse prevention

### 7. Booking Strategy
- Phase 1 keeps booking in Jobber's hosted booking flow.
- The app result screen links out to Jobber for date/time selection and confirmation.
- The app may track lightweight booking intent such as `jobber_booking_clicked`, but final booking completion remains Jobber-owned unless a future integration imports it.

---

## Firestore Collections

| Collection | Purpose | Key Fields |
|-----------|---------|------------|
| `estimates` | Submitted estimate records | userId, formData, aiResult, createdAt, photoPaths |
| `estimateRateLimits` | Per-user rate limiting | lastSubmitAt, hourlyCount, dailyCount, estimateCount |

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_API_KEY` | Firebase Web API key | Yes |
| `NEXT_PUBLIC_AUTH_DOMAIN` | Firebase Auth domain | Yes |
| `NEXT_PUBLIC_PROJECT_ID` | Firebase project ID | Yes |
| `NEXT_PUBLIC_STORAGE_BUCKET` | Firebase Storage bucket | Yes |
| `NEXT_PUBLIC_MESSAGING_SENDER_ID` | Firebase messaging | Yes |
| `NEXT_PUBLIC_APP_ID` | Firebase app ID | Yes |
| `NEXT_PUBLIC_SITE_URL` | Firebase App Hosting production URL for metadata/canonical links | Recommended |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps autocomplete | Yes |
| `GOOGLE_GENAI_API_KEY` | Gemini API key | Yes (server) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Admin SDK credentials | Yes (server) |
| `NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY` | App Check reCAPTCHA | Production |
| `NEXT_PUBLIC_ENABLE_APPCHECK` | Toggle App Check | Production |
