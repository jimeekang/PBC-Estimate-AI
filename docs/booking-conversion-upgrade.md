# Booking Conversion Upgrade

> Date: 2026-05-13
> Status: Active direction - external Jobber booking URL retained for Phase 1
> Goal: Make PBC Estimate AI trigger more company quotation bookings, not just generate price ranges.

---

## Verdict

The current direction is to keep Jobber's hosted booking URL as the Phase 1 booking path. This avoids building and maintaining a second scheduling system while still letting customers choose a time in Jobber.

The weak spot is not the integration. It is the moment after the user sees the estimate.

Right now the product gives a useful price range, then asks for a booking. To increase quotations without adding API/OAuth/schedule complexity, the result screen needs to make the Jobber booking step feel like the natural next action.

---

## What Is Already Good

- The app is positioned as a lead generator, not SaaS.
- The pricing engine has local 2026 Sydney Northern Beaches anchors.
- The AI estimate result is the strongest conversion point.
- The external Jobber booking flow already handles customer date/time selection, confirmation, and schedule placement.
- Keeping booking in Jobber reduces operational and engineering risk.
- The 2-free-estimate policy protects pricing data without turning the product into a paid tool.

Keep these.

---

## Missing Conversion Triggers

### 1. The result screen needs a stronger "why book now"

The result should not only say "Book Online Now." It should explain why the site visit is useful:

- "Turn this estimate into a fixed written quote."
- "Choose a time in Jobber."
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

### 3. Booking click tracking needs to be lightweight

Because Phase 1 uses the hosted Jobber booking URL, the app should not attempt booking-form abandonment recovery yet.

Minimum version:

- Track `jobber_booking_clicked` when a result-screen CTA sends the user to Jobber.
- Store enough estimate context to see which project types and price bands create booking intent.
- Treat final booking completion as Jobber-owned until a later integration or export confirms it.

This gives a useful conversion signal without building an in-app booking system.

### 4. The estimate should support a qualified Jobber handoff

With the external Jobber URL, estimate details are not automatically attached to the Jobber request. Do not claim that Connor already has the AI estimate unless that integration is later built.

Phase 1 should instead encourage the customer to use the AI estimate as a guide when booking:

- Price range and scope.
- Suburb/address.
- Project type: interior, exterior, combined.
- High-value flags: roof, exterior full repaint, multi-storey, difficult access.
- Any notes or photos they want Connor to check.

If Jobber custom fields are available, add a simple field such as "Anything Connor should know before the visit?" so customers can paste or summarize their AI estimate.

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

Headline:

```text
Ready for a firm written quote?
```

Support copy:

```text
Your AI estimate is a price guide. Book a free site visit in Jobber so Connor can inspect the property, confirm access and prep, and provide a final written quote.
```

Primary CTA:

```text
Book Your Free Site Visit
```

Trust strip near CTA:

- Your AI estimate gives the price guide.
- The site visit confirms the final written quote.
- Booking opens Connor's live Jobber calendar.

Secondary CTA:

```text
Download Estimate PDF
```

Do not make PDF equal weight with booking. PDF is useful, but booking is the business outcome.

### B. Jobber Booking Form Copy

The app should link to the hosted Jobber form. Configure that Jobber form to reduce friction:

```text
Choose a time for your free site visit.
```

Keep fields tight:

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

Do not ask customers to fully re-enter the estimate. Let them provide only what Jobber needs to book the visit.

### C. Confirmation Copy

Because confirmation is Jobber-owned in Phase 1, set expectations before the redirect:

```text
Choose your time in Jobber. Your AI estimate gives the price guide, and the site visit turns it into a firm written quote.
```

### D. Admin Lead Signals

The admin view should not claim full booking conversion unless Jobber data is imported. Phase 1 should prioritize:

1. New generated estimates.
2. High-value estimates.
3. Estimates where the user clicked the Jobber booking CTA, if click tracking is implemented.

This keeps the app honest about what it knows while still surfacing useful lead intent.

---

## Process Policy

### Lead Response SLA

| Situation | Response target |
|---|---|
| Jobber booking submitted during business hours | Follow the Jobber/PBC operating policy |
| Jobber booking submitted after hours | Follow the Jobber/PBC operating policy |
| App user clicks Jobber booking CTA | No app-side outreach unless marketing consent exists |

### Follow-Up Policy

| Lead state | Action |
|---|---|
| Estimate generated, no booking | No immediate outreach unless marketing consent exists |
| Jobber booking CTA clicked | No automatic reminder in Phase 1 |
| Booking submitted | Jobber manages confirmation |
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
| `jobber_booking_clicked` | User clicked through to hosted Jobber booking |

### Conversion Targets

| Metric | Target |
|---|---|
| Estimate generated -> Jobber booking click | 25%+ |
| Jobber booking click -> submitted | Track in Jobber, not app, until integration exists |
| Booking submitted -> first response within SLA | Track in Jobber/operations |

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
- External Jobber booking URL retained as the booking path.
- Jobber form configured for date/time selection and minimal fields.
- Optional `jobber_booking_clicked` metric with estimate context.

### P1 - Add Immediately After Phase 1

- High-value estimate queue.
- Daily estimate and Jobber-click summary.
- Manual reconciliation with Jobber booking data if needed.

### P2 - Later

- In-app booking form only if external Jobber conversion data proves it is needed.
- Jobber API/OAuth/schedule automation.
- Shareable estimate page.
- SEO suburb pages.
- Jobber webhook progression tracking.
- Paid-channel experiment dashboards.

---

## Open Decisions

1. What copy should the hosted Jobber form use for the site-visit notes field?
2. Does the current Jobber form expose available date/time slots clearly enough?
3. Should the result screen button say "Book Your Free Site Visit" or "Book Your Free Quote Visit"?
4. Which traffic sources will be used first: main site only, Google Ads, Meta, local SEO, or referral links?

---

## Assignment

Before implementation, test the trigger with five real or likely customers.

Show them an estimate result and ask:

1. "What would you do next?"
2. "What would stop you from booking the site visit?"
3. "What would make this feel trustworthy enough to submit your phone number?"

If fewer than three of five say they would book or seriously consider booking, improve the result screen copy before considering any Jobber API integration.
