# Booking Conversion Upgrade

> Date: 2026-05-13
> Status: Product upgrade proposal
> Goal: Make PBC Estimate AI trigger more company quotation bookings, not just generate price ranges.

---

## Verdict

The current plan is technically strong. The Jobber booking funnel, Firestore audit trail, ownership checks, fallback email, and admin view are the right bones.

The weak spot is not the integration. It is the moment after the user sees the estimate.

Right now the product gives a useful price range, then asks for a booking. To increase quotations, the app needs to make the site visit feel like the natural next step, with clear timing, trust, reduced effort, and a recovery path for users who hesitate.

---

## What Is Already Good

- The app is positioned as a lead generator, not SaaS.
- The pricing engine has local 2026 Sydney Northern Beaches anchors.
- The AI estimate result is the strongest conversion point.
- The Jobber API design avoids external redirects for AI estimate users.
- Firestore is the source of truth, so Jobber downtime does not lose leads.
- The 2-free-estimate policy protects pricing data without turning the product into a paid tool.

Keep these.

---

## Missing Conversion Triggers

### 1. The result screen needs a stronger "why book now"

The result should not only say "Get Your Free Site Visit." It should explain why the site visit is useful:

- "Turn this estimate into a fixed written quote."
- "Connor already has your estimate details, so you do not need to explain it again."
- "Most site visits take 10-15 minutes."
- "Photos and access details help confirm the final price."

This matters because a price range can satisfy curiosity. A site visit needs a reason.

### 2. The app needs a speed-to-lead policy

"Connor will contact you within 24 hours" is safe, but it is not conversion-optimized. For high-intent quote requests, speed wins.

Recommended policy:

- Business hours: contact within 15 minutes.
- After hours: contact next morning before 10:00.
- Weekend: contact by the next business morning.
- If Connor is unavailable, send a short confirmation email that says the request is received and when the customer will hear back.

This should become a real operating rule, not just copy.

### 3. Booking form abandonment needs recovery

The Phase 1 spec intentionally keeps abandoned recapture in Phase 2. That is understandable, but it is one of the highest-leverage booking upgrades.

Minimum version:

- Track `booking_form_opened`.
- If the user does not submit within 2 hours, send one reminder email.
- The reminder links back to the estimate result, not the landing page.
- Do not send reminders without consent or a legitimate transactional basis.

This turns generated estimates into recoverable leads.

### 4. The estimate should create a qualified sales handoff

Connor should not receive a generic booking. He should receive a lead brief.

Include:

- Price range and scope.
- Suburb/address.
- Project type: interior, exterior, combined.
- High-value flags: roof, exterior full repaint, multi-storey, difficult access.
- Urgency: preferred time or timeline.
- Customer hesitation signals: downloaded PDF but did not book, opened booking form but abandoned.

This lets Connor call with context, which increases trust.

### 5. Funnel analytics need attribution, not just counts

The current metrics are a good start, but they need source and segment fields.

Add dimensions:

- UTM source, medium, campaign.
- Entry source: main site CTA, direct, paid ad, social, referral.
- Service category.
- Suburb.
- Estimate amount band.
- Device type.
- New vs returning user.

Without this, the team can see that bookings changed but not why.

### 6. The free estimate limit needs conversion-aware messaging

The 2-free-estimate policy is fine. The copy should frame it as quality control, not restriction.

Recommended message:

"You have 2 free AI estimates. We limit estimates so the pricing tool stays accurate and useful for real projects."

Avoid making the user feel rationed before they trust the product.

---

## Product Changes To Add Before Build

### A. Result Screen CTA Stack

Primary CTA:

```text
Get Your Free Site Visit
```

Support copy:

```text
Connor will review this estimate before the visit, so you do not need to repeat the project details.
```

Trust strip near CTA:

- Local Northern Beaches painter.
- Fixed written quote after site visit.
- No obligation.
- Response within the stated SLA.

Secondary CTA:

```text
Download Estimate PDF
```

Do not make PDF equal weight with booking. PDF is useful, but booking is the business outcome.

### B. Booking Form Copy

Use the form to reduce effort:

```text
Your estimate details will be attached automatically.
```

Keep fields tight:

- Name.
- Email.
- Mobile.
- Property address.
- Preferred contact time.
- Notes.
- Consent checkbox.

Do not ask for project details again unless the estimate is missing them.

### C. Confirmation Copy

Replace generic confirmation with an expectation-setting block:

```text
Sent. Your reference is PBC-2026-XXXXX.
Connor will contact you within 15 minutes during business hours, or by 10:00 the next business morning.
Your AI estimate and project details were attached to the request.
```

### D. Admin Lead Queue

The admin view should prioritize:

1. Pending Jobber sync failures.
2. New booking submissions.
3. High-value estimates with no booking.
4. Booking form opened but not submitted.

This makes the admin page an operating dashboard, not just a database viewer.

---

## Process Policy

### Lead Response SLA

| Situation | Response target |
|---|---|
| Booking submitted during business hours | 15 minutes |
| Booking submitted after hours | Next business day by 10:00 |
| Jobber sync fails | Connor backup email immediately |
| Booking pending for more than 24 hours | Admin digest and dashboard alert |

### Follow-Up Policy

| Lead state | Action |
|---|---|
| Estimate generated, no booking | No immediate outreach unless marketing consent exists |
| Booking form opened, no submit | One reminder email after 2 hours if allowed |
| Booking submitted | Confirmation email immediately |
| Site visit completed | Jobber manages quote follow-up |

### Claims And Boundaries

- The AI estimate is an indicative range, not a fixed quote.
- The site visit is used to provide a fixed written quote.
- Do not imply fake urgency or fake scarcity.
- Do not guarantee final price before inspection.
- Keep the price range visible, but make the next step about confirmation.

---

## Measurement Plan

### Core Funnel

| Event | Meaning |
|---|---|
| `landing_viewed` | User entered quote app |
| `estimate_started` | User began estimate |
| `estimate_generated` | User saw price range |
| `result_booking_cta_viewed` | Booking CTA was visible |
| `booking_form_opened` | User expressed booking intent |
| `booking_submitted` | User requested site visit |
| `jobber_sync_succeeded` | Jobber request created |
| `jobber_sync_failed` | Backup path triggered |

### Conversion Targets

| Metric | Target |
|---|---|
| Estimate generated -> booking form opened | 30%+ |
| Booking form opened -> submitted | 50%+ |
| Estimate generated -> booking submitted | 15%+ |
| Booking submitted -> first response within SLA | 90%+ |
| Jobber sync success | 99%+ |

### Segment Every Event By

- Source and UTM values.
- Service category.
- Suburb.
- Price band.
- Device type.
- New vs returning user.

---

## Priority Order

### P0 - Must Add To Phase 1

- Strong result-screen CTA copy and trust strip.
- Speed-to-lead SLA in confirmation copy and operations.
- Lead brief attached to Jobber request and Connor backup email.
- Attribution fields on booking and metric events.
- Admin queue sorted by action priority.

### P1 - Add Immediately After Phase 1

- Booking form abandonment reminder.
- Estimate result return link from email.
- High-value unbooked estimate queue.
- Daily conversion summary for Connor.

### P2 - Later

- Time-slot selection.
- Shareable estimate page.
- SEO suburb pages.
- Jobber webhook progression tracking.
- Paid-channel experiment dashboards.

---

## Open Decisions

1. What are PBC's real business hours for the 15-minute response SLA?
2. Can Connor reliably call within 15 minutes, or should the app promise "same business day" until ops are proven?
3. Should the result screen show "free site visit" or "free quote visit"? The latter may be clearer for high-intent users.
4. Is one reminder email acceptable under the current consent/privacy policy?
5. Which traffic sources will be used first: main site only, Google Ads, Meta, local SEO, or referral links?

---

## Assignment

Before implementation, test the trigger with five real or likely customers.

Show them an estimate result and ask:

1. "What would you do next?"
2. "What would stop you from booking the site visit?"
3. "What would make this feel trustworthy enough to submit your phone number?"

If fewer than three of five say they would book or seriously consider booking, improve the result screen copy before building the Jobber integration.
