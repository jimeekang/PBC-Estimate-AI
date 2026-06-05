# Design — AI Estimate → External Jobber Booking Funnel

**Date:** 2026-05-07
**Author:** Connor / Paint Buddy & Co
**Status:** Phase 1 revised 2026-06-03. Keep the external Jobber booking URL. Defer custom Jobber API/OAuth/schedule automation.
**Subdomain:** `quote.paintbuddyco.com`

---

## 1. Problem & Goal

The current `quote.paintbuddyco.com` (PBC Estimate AI) generates AI estimates and sends users to Jobber's hosted booking widget. This is now the intended Phase 1 direction because Jobber already handles customer date/time selection, confirmation, and schedule placement.

**Goal:** Turn the estimate result into a stronger booking trigger without building a second booking system:

1. Receives traffic from the main site's "Get a Quote" button.
2. Helps users understand why the free site visit is the next step after the AI estimate.
3. Sends booking-ready users to Jobber's hosted booking calendar.
4. Preserves login/usage limits to protect proprietary pricing data.
5. Tracks lightweight booking intent from the app, such as `jobber_booking_clicked`.

**Marketing priority order:** A (booking conversion) > C (SEO) > D (shareability) > B (lead capture).
This document covers Phase 1 (priority A) with the external Jobber URL retained. The original in-app Jobber API/OAuth plan is now a deferred Phase 2 candidate only if external Jobber conversion data proves the extra complexity is needed.

---

## 2. User Journey (Phase 1)

```
[paintbuddyco.com main site]
        │ "Get a Quote" button
        ▼
[quote.paintbuddyco.com landing]
        │
        ├─→ "Book Online for a Firm Quote" → existing Jobber Online Booking widget
        │   (fast track for users who have already decided)
        │
        └─→ "Start Free AI Estimate"
                │
                ▼
        [Login / Signup]   ← retained (pricing data protection + usage limits)
                │
                ▼
        [AI estimate input form]
                │
                ▼
        [AI estimate result screen] ★ primary conversion point
                │
                ├─→ "Book Your Free Site Visit" CTA
                │       │ external Jobber booking URL
                │       ▼
                │   [Jobber hosted booking form]
                │       │ customer chooses date/time in Jobber
                │       │ Jobber owns confirmation + schedule placement
                │       ▼
                │   [Jobber confirmation]
                │
                └─→ "Download PDF" (kept as today)
```

### Dual-track rationale

- **AI estimate → hosted Jobber booking** is the main Phase 1 funnel.
- **Direct "Book Online"** remains on the landing page as a fast track for users who arrive already decided.
- Both tracks land in Jobber. The app should not claim booking completion unless Jobber data is later imported or integrated.

---

## 3. AI Estimate Result Screen — Changes

Reference: [`src/components/estimate/estimate-result.tsx`](../../../src/components/estimate/estimate-result.tsx).

| Element | Current | Change |
|---|---|---|
| Price card, breakdown, explanation, key factors | Already polished | **Keep as-is** |
| Download PDF button | Present | **Keep** |
| Bottom booking CTA | "Book Online Now" → external Jobber URL | **Keep external Jobber URL**. Change copy to "Book Your Free Site Visit" and explain that Jobber lets the customer choose a time for Connor to confirm a firm written quote. |
| QR code on result screen | Desktop only | Keep if useful for desktop users. PDF version retains it. |
| External Jobber link on result screen | Present | **Keep** as the official Phase 1 booking path. |

### CTA copy

Headline:

```text
Ready for a firm written quote?
```

Support copy:

```text
Your AI estimate is a price guide. Book a free site visit in Jobber so Connor can inspect the property, confirm access and prep, and provide a final written quote.
```

Button:

```text
Book Your Free Site Visit
```

Trust strip:

- Your AI estimate gives the price guide.
- The site visit confirms the final written quote.
- Booking opens Connor's live Jobber calendar.

Do not claim "Connor already has your estimate details" while using the external Jobber URL. That is only true if a future API integration attaches estimate data to the Jobber request.

### Hosted Jobber form

Configure Jobber's hosted form with minimal fields:

- Name.
- Email.
- Mobile.
- Property address.
- Preferred date/time or Jobber availability slot.
- Painting type.
- Notes.

Recommended notes field label:

```text
Anything Connor should know before the visit?
```

---

## 4. Jobber API Integration (Deferred)

The API/OAuth/schedule automation below is **not part of Phase 1**. It is retained as a Phase 2 candidate only if hosted Jobber booking conversion is weak enough to justify the added complexity.

Phase 1 uses the hosted Jobber booking URL. Jobber owns date/time selection, booking confirmation, and schedule placement.

### 4.1 Deferred OAuth setup (Connor, one-time)

Single-tenant flow. Connor connects his Jobber account once via `/admin/integrations`.

```
GET /api/jobber/oauth/start
   → generate CSRF state token, store in Firestore
   → redirect to Jobber authorize URL

GET /api/jobber/oauth/callback?code=...&state=...
   → verify state
   → exchange code for access_token + refresh_token
   → persist to Firestore `system_integrations/jobber`
   → redirect to /admin/integrations (Connected ✓)
```

### 4.2 Token storage & refresh

Firestore document: `system_integrations/jobber` (single doc, single-tenant).

```ts
{
  accessToken: string;           // store encrypted
  refreshToken: string;          // store encrypted
  expiresAt: Timestamp;
  scopes: string[];
  connectedAt: Timestamp;
  connectedBy: string;           // Connor's uid
  lastRefreshedAt: Timestamp;
}
```

Firestore rules:
```
match /system_integrations/{doc} {
  allow read, write: if false;   // Admin SDK only
}
```

**Refresh logic** (`_lib/jobber-client.ts`):
- Before every mutation, check `expiresAt`.
- If within 5 minutes of expiry, refresh.
- Use a Firestore transaction so concurrent requests don't double-refresh.

### 4.3 Deferred booking submission flow

`POST /api/jobber/booking`

1. **Authenticate** — verify Firebase Auth ID token server-side.
2. **Validate input** with Zod (name, email, phone, address, optional fields, consent=true).
3. **Verify estimate ownership** — load `estimateId`, confirm `estimate.userId === auth.uid`. Reject with 403 otherwise.
4. **Deduplicate** — reject 409 if a booking already exists for the same `(userId, estimateId)`.
5. **Persist booking** to Firestore `bookings/{bookingId}` with `status: 'pending'` (audit-first; Firestore is source of truth).
6. **Generate `referenceId`** in format `PBC-YYYY-XXXXX`. Use a random 5-character alphanumeric suffix (excluding ambiguous characters `0/O`, `1/I/L`); confirm uniqueness with a Firestore transactional read against `bookings` keyed by `referenceId`. Retry up to 5 times on collision.
7. **Call Jobber:**
   - Look up existing client by email (`clients(filter: { email: ... })`). Reuse `clientId` if found.
   - Otherwise `clientCreate`.
   - `requestCreate` with title `"AI Estimate Booking — {scope} — {referenceId}"`. Description embeds the full AI estimate snapshot, user notes, preferred time, attribution, high-value flags, and a link back to the booking record.
8. **Update Firestore booking** to `status: 'submitted'` with `jobberClientId` and `jobberRequestId`.
9. **Send emails** via Resend:
   - User: confirmation with `referenceId`.
   - Connor: backup notification (always sent — Connor sees it in Jobber too, but the email is a safety channel).
10. **Respond** to client: `{ success: true, referenceId }`.

### 4.4 Error handling & fallback

If any Jobber call fails (network, 429, 500):

- The Firestore booking remains in `status: 'pending'`.
- The user response stays optimistic — `{ success: true, referenceId }` — to protect conversion.
- Connor receives a backup notification email containing **all** booking details so he can manually enter the lead into Jobber if needed.
- A lightweight admin view at `/admin/bookings` (Phase 1) lists `pending` and `failed` bookings so Connor can intervene. The existing `/admin` route already gates on admin claims; this is a new sub-page that reuses that guard.
- An automated retry queue is **explicitly deferred to Phase 2** — we will assess actual failure rate from logs first.

**Principle:** the user experience is not coupled to Jobber availability. Firestore is the source of truth; Jobber is the sync target.

### 4.5 Deferred Firestore schema additions

```ts
// bookings/{bookingId}
{
  bookingId: string;
  referenceId: string;             // "PBC-2026-00123"
  userId: string;                  // Firebase Auth uid
  estimateId: string;
  estimateSnapshot: {
    priceRange: string;
    scope: string[];
    breakdown: unknown;            // copy of pricing-engine output
  };
  contact: {
    name: string;
    email: string;
    phone: string;
    address: string;
    preferredTime?: string;
    notes?: string;
  };
  attribution?: {
    source?: string;
    medium?: string;
    campaign?: string;
    referrer?: string;
    entryPath?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
  };
  leadSignals?: {
    serviceCategory: 'interior' | 'exterior' | 'combined';
    priceBand: string;
    suburb?: string;
    highValueFlags: string[];
    bookingFormOpenedAt?: Timestamp;
  };
  status: 'pending' | 'submitted' | 'failed';
  jobberClientId?: string;
  jobberRequestId?: string;
  syncAttempts: number;
  lastSyncError?: string;
  consentGivenAt: Timestamp;
  createdAt: Timestamp;
  submittedAt?: Timestamp;
}
```

Firestore rules:
```
match /bookings/{bookingId} {
  allow read: if request.auth != null
    && (request.auth.uid == resource.data.userId
        || request.auth.token.admin == true);
  allow write: if false;   // API routes only (Admin SDK)
}
```

### 4.6 Deferred file structure

```
src/app/api/jobber/
├── oauth/
│   ├── start/route.ts          # Connor admin only
│   └── callback/route.ts
├── booking/route.ts             # user booking submission
└── _lib/
    ├── jobber-client.ts         # GraphQL client + auto-refresh
    ├── token-store.ts           # Firestore token CRUD
    └── operations.ts            # clientCreate, clientLookup (query), requestCreate

src/components/estimate/
├── booking-form.tsx             # inline form (Option A)
└── booking-confirmation.tsx     # inline confirmation

src/lib/
├── booking-reference.ts         # PBC-YYYY-XXXXX generator
└── jobber-description.ts        # build the Request description text from estimate
```

### 4.7 Security checklist

- `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET` → Firebase env vars; secret in Secret Manager.
- OAuth state token verified to prevent CSRF.
- Estimate ownership enforced (`estimate.userId === auth.uid`).
- Same `(userId, estimateId)` cannot submit a booking twice.
- Token refresh wrapped in Firestore transaction.
- Zod validates Australian phone format and address length.
- PII redacted in logs (mask email and phone).
- Rate limit on the booking route at user level (existing AI estimate quota already gates upstream).
- Webhook handler (Phase 2) will require HMAC SHA256 signature verification.

---

## 5. Testing

| Layer | Tooling | Cases |
|---|---|---|
| Unit (Jest) | Existing setup | Existing estimate generation and display tests continue to pass |
| Integration | None for Phase 1 | No Jobber API integration is built in Phase 1 |
| Manual E2E | Browser | Login → estimate → result CTA → hosted Jobber booking page opens; verify Jobber form allows customer date/time selection |

A separate Jobber dev/sandbox app is only needed if the deferred API/OAuth integration is revived.

---

## 6. Deployment & Environment

### 6.1 Environment variables (Firebase App Hosting)

```
NEXT_PUBLIC_SITE_URL              (https://quote.paintbuddyco.com)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   (existing address autocomplete)
```

No Jobber API credentials are required for Phase 1 because booking uses the hosted Jobber URL.

### 6.2 Deploy order

1. Confirm the hosted Jobber booking URL and form fields.
2. Confirm the Jobber form allows date/time selection for a free site visit.
3. Deploy App Hosting build.
4. Connect `quote.paintbuddyco.com` as a custom domain.
5. Update `paintbuddyco.com` main site's "Get a Quote" button to point at `quote.paintbuddyco.com`.

### 6.3 Rollback

Rollback is simple because the app already links to hosted Jobber. If the CTA copy underperforms, change the result-screen copy without touching backend booking infrastructure.

---

## 7. Monitoring

Lightweight for Phase 1 — no extra SaaS and no Jobber API dependency.

```
metrics_daily/{YYYY-MM-DD}
├── estimateGenerated: number
├── resultBookingCtaViewed: number
├── jobberBookingClicked: number
└── jobberClickRate (computed at read time on /admin)
```

If click tracking is added, record `jobber_booking_clicked` when the result-screen CTA opens the hosted Jobber booking URL. Store estimate context such as work type, price band, suburb, and device type.

Every app-side metric event should preserve attribution and segment fields where available: UTM source/medium/campaign, entry source, service category, suburb, estimate price band, device type, and new vs returning user.

KPIs visible on `/admin`:
- Estimate → Jobber booking click conversion.
- High-value estimates generated.
- Final booking completion only if Jobber data is imported or reconciled.

No app-side Jobber sync alerting exists in Phase 1 because the app does not call Jobber's API.

GA4 events instrumented in Phase 1 to support future paid-channel work:
- `estimate_started`
- `estimate_generated`
- `jobber_booking_clicked`

---

## 8. Out of Scope (Phase 2+)

Documented here so they are remembered, not built now.

| Priority | Item |
|---|---|
| C | `/pricing-guide` SEO page |
| C | `/painters/[suburb]` regional landing pages |
| D | Shareable estimate URL (`/estimate/share/[token]`) + auto OG image |
| D | Instagram-friendly estimate card image export |
| — | Jobber webhook/API ingestion, only if later integration is justified |
| — | In-app time-slot selection, only if hosted Jobber conversion data proves it is needed |
| B | Abandoned external-booking recovery, only if consent and Jobber data allow it |
| B | Exit-intent modal |
| — | Automated retry queue for failed Jobber syncs, only if API integration is revived |

---

## 9. Open Questions / Future Decisions

1. Confirm the hosted Jobber booking form fields and date/time selection experience.
2. Confirm whether "Book Your Free Site Visit" or "Book Your Free Quote Visit" converts better.
3. Decide whether to add lightweight `jobber_booking_clicked` tracking.
4. Only revisit API/OAuth/schedule automation if hosted Jobber conversion is poor or duplicate data entry becomes a proven blocker.

---

## 10. Conversion Upgrade Reference

The implementation plan should read [`docs/booking-conversion-upgrade.md`](../../booking-conversion-upgrade.md) before build work begins.

That document defines the current external Jobber URL direction, result-screen CTA copy, lightweight measurement plan, and pre-build customer test assignment.
