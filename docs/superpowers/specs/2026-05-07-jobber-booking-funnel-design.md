# Design — AI Estimate → Jobber Booking Funnel

**Date:** 2026-05-07
**Author:** Connor / Paint Buddy & Co
**Status:** Approved (brainstorming complete) → ready for implementation plan. Conversion trigger upgrade added 2026-05-13.
**Subdomain:** `quote.paintbuddyco.com`

---

## 1. Problem & Goal

The current `quote.paintbuddyco.com` (PBC Estimate AI) generates AI estimates but does not flow into a real human-confirmed booking. Users hitting the AI estimate result currently see a CTA that links externally to Jobber's Online Booking widget, breaking funnel attribution and forcing users to re-enter their information. The site also exists separately from the main marketing site (`paintbuddyco.com`).

**Goal:** Turn this app into a self-contained marketing funnel that:

1. Receives traffic from the main site's "Get a Quote" button.
2. Converts that traffic to bookings inside our own app (no external Jobber redirect for AI estimate users).
3. Pushes lead data with the AI estimate context directly into Connor's Jobber via the Jobber Public API.
4. Preserves login/usage limits to protect proprietary pricing data.

**Marketing priority order:** A (booking conversion) > C (SEO) > D (shareability) > B (lead capture).
This document covers Phase 1 (priority A end-to-end). Phases 2/3 (C, D, B) are listed but not specified in detail.

---

## 2. User Journey (Phase 1)

```
[paintbuddyco.com main site]
        │ "Get a Quote" button
        ▼
[quote.paintbuddyco.com landing]
        │
        ├─→ "Book Online for a Firm Quote" → existing Jobber Online Booking widget
        │   (fast track, kept for users who have already decided)
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
                ├─→ "Get Your Free Site Visit" CTA  (NEW — the main funnel)
                │       │ inline form expansion (Option A)
                │       ▼
                │   POST /api/jobber/booking
                │       │ → Firestore booking record (audit-first)
                │       │ → Jobber clientCreate + requestCreate (Option 2A)
                │       │ → Resend confirmation email to user
                │       │ → Resend backup notification to Connor
                │       ▼
                │   [Inline confirmation: reference ID + next steps]
                │
                └─→ "Download PDF" (kept as today)
```

### Dual-track rationale

- **AI estimate → booking** is the **main funnel**.
- **Direct "Book Online"** is kept on the landing only, as a fast track for users who arrive already decided.
- Both tracks land in Connor's Jobber inbox.

---

## 3. AI Estimate Result Screen — Changes

Reference: [`src/components/estimate/estimate-result.tsx`](../../../src/components/estimate/estimate-result.tsx).

| Element | Current | Change |
|---|---|---|
| Price card, breakdown, explanation, key factors | Already polished | **Keep as-is** |
| Download PDF button | Present | **Keep** |
| Bottom booking CTA | "Book Online Now" → external Jobber URL | **Replace**: "Get Your Free Site Visit" → triggers inline form (Option A). Support copy explains that Connor receives the estimate details and the site visit turns the range into a fixed written quote. |
| QR code on result screen | Desktop only | **Remove from screen** (PDF version retains it) |
| External Jobber link on result screen | Present | **Remove** — confined to landing page only |

### Booking form (inline expansion)

**Required fields (4):**
- Name (prefilled from auth profile, editable)
- Email (prefilled from auth profile, readonly)
- Mobile phone (Australian format)
- Property address

**Optional fields (2):**
- Preferred site visit time (free text or quick-select chips)
- Notes for Connor (textarea)

**Consent:** single checkbox — "I agree Connor may contact me about this estimate."

**Submit behaviour:** loading state → inline confirmation block in the same position. No page navigation.

### Confirmation block

```
Sent. Your reference is PBC-2026-00123.
Connor will contact you within 15 minutes during business hours, or by 10:00 the next business morning.
Your AI estimate and project details were attached to the request.
[Back to Home]   [Generate Another Estimate]
```

---

## 4. Jobber API Integration (Option 2A)

### 4.1 OAuth setup (Connor, one-time)

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

### 4.3 Booking submission flow

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

### 4.5 Firestore schema additions

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

### 4.6 File structure

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
| Unit (Jest) | Existing setup | Booking Zod schema; reference-id generator; token-expiry check (5-min buffer); Jobber description builder |
| Integration (Jest + msw) | Mock Jobber GraphQL | clientCreate + requestCreate happy path; existing-client reuse via email lookup; token refresh and retry; 429 → optimistic success + Connor email; ownership rejection (403) |
| Manual E2E | Browser | Login → estimate → booking form → submit → confirmation; verify request appears in Connor's Jobber dashboard; simulate Jobber failure (invalid token in env) and verify Connor backup email arrives |

A separate Jobber dev/sandbox app should be registered in the Jobber Developer Center for non-production testing.

---

## 6. Deployment & Environment

### 6.1 Environment variables (Firebase App Hosting)

```
JOBBER_CLIENT_ID                  (public OK)
JOBBER_CLIENT_SECRET              (Secret Manager)
JOBBER_REDIRECT_URI               (https://quote.paintbuddyco.com/api/jobber/oauth/callback)
RESEND_API_KEY                    (Secret Manager)
RESEND_FROM_EMAIL                 (e.g. noreply@paintbuddyco.com)
CONNOR_NOTIFICATION_EMAIL         (Connor's direct email)
APP_BASE_URL                      (https://quote.paintbuddyco.com)
```

### 6.2 Deploy order

1. Register prod app in Jobber Developer Center; configure redirect URI.
2. Add secrets to Firebase Secret Manager and reference them in `apphosting.yaml`.
3. Deploy Firestore rules (`bookings`, `system_integrations`).
4. Deploy App Hosting build.
5. Connect `quote.paintbuddyco.com` as a custom domain.
6. Connor performs OAuth setup once at `/admin/integrations`.
7. Update `paintbuddyco.com` main site's "Get a Quote" button to point at `quote.paintbuddyco.com`.

### 6.3 Rollback

A feature flag `NEXT_PUBLIC_USE_JOBBER_API_BOOKING` (default true). If issues appear post-deploy, set the flag to false and the result screen reverts to the existing external Jobber link with no code change required.

---

## 7. Monitoring

Lightweight, Firestore-based for Phase 1 — no extra SaaS.

```
metrics_daily/{YYYY-MM-DD}
├── estimateGenerated: number
├── resultBookingCtaViewed: number
├── bookingFormOpened: number       (CTA click)
├── bookingSubmitted: number
├── bookingJobberSyncFailed: number
└── conversionRate (computed at read time on /admin)
```

Counters are incremented atomically from server-side API routes using `FieldValue.increment(1)`. The `bookingFormOpened` event is recorded by a thin `POST /api/metrics/booking-form-opened` route fired when the user expands the inline form (auth-gated, deduped per `(userId, estimateId)` per day).

Every booking and metric event should preserve attribution and segment fields where available: UTM source/medium/campaign, entry source, service category, suburb, estimate price band, device type, and new vs returning user.

KPIs visible on `/admin`:
- Estimate → booking conversion (target ≥ 15%).
- Jobber sync success rate (target ≥ 99%).
- Booking → site visit progression (Phase 2 — webhook-driven).

Alerting in Phase 1 is the Connor backup-notification email itself, plus a daily digest if any `pending`/`failed` bookings remain unprocessed for >24 hours (small Cloud Function cron).

GA4 events instrumented in Phase 1 to support future paid-channel work:
- `estimate_started`
- `estimate_generated`
- `booking_form_opened`
- `booking_submitted`

---

## 8. Out of Scope (Phase 2+)

Documented here so they are remembered, not built now.

| Priority | Item |
|---|---|
| C | `/pricing-guide` SEO page |
| C | `/painters/[suburb]` regional landing pages |
| D | Shareable estimate URL (`/estimate/share/[token]`) + auto OG image |
| D | Instagram-friendly estimate card image export |
| — | Jobber webhook ingestion (quote sent → user notification) |
| — | In-app time-slot selection (Option 2B) |
| B | Abandoned booking-form recapture email |
| B | Exit-intent modal |
| — | Automated retry queue for failed Jobber syncs |

---

## 9. Open Questions / Future Decisions

1. Whether to encrypt Jobber tokens at the application layer (in addition to Firestore at-rest encryption). Decide during implementation review.
2. Whether to allow Connor multiple `system_integrations/jobber` token entries for staging vs prod, or whether environment separation is sufficient.
3. Long-term: can Jobber's Online Booking time-slot API be used for full automation (Option 2C)? Investigate before Phase 2 booking enhancements.
4. Confirm the real response SLA before launch. The conversion upgrade recommends 15 minutes during business hours or by 10:00 the next business morning.
5. Confirm whether one booking-form abandonment reminder is allowed under the current consent and privacy policy.

---

## 10. Conversion Upgrade Reference

The implementation plan should read [`docs/booking-conversion-upgrade.md`](../../booking-conversion-upgrade.md) before build work begins.

That document defines the conversion trigger copy, speed-to-lead policy, follow-up policy, attribution fields, admin lead queue priority, and pre-build customer test assignment.
