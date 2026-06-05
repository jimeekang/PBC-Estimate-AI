# PBC Estimate AI - Product Blueprint

> Last updated: 2026-06-05
> Status: **Active** - reflects the current production direction

---

## Product Summary

AI-powered painting estimate platform for Sydney Northern Beaches.
It generates instant indicative price ranges based on real historical quote data and is designed to convert leads into on-site quote bookings.

---

## Core Features

### Estimate Generation
- **Interior Painting**: Ceiling, Wall, Trim, Ensuite, Handrail, Skirting, Doors, Windows
- **Exterior Painting**: Wall (cladding/rendered/brick), Eaves, Gutter, Fascia, Roof, Deck, Paving, Trim, Pipes, Doors, Windows, Architraves, Front Door
- **Combined**: Interior + Exterior with separate breakdowns and total range
- **Scope modes**: "Entire property" (anchor/SQM-based) or "Specific areas only" (per-room/item-based)

### Pricing Engine
- Pure function pricing engine (`pricing-engine.ts`) with no server dependencies
- Sydney Northern Beaches 2026 calibrated anchors
- Apartment: continuous SQM curve (entire) or class-based anchors (specific)
- House: bedroom/bathroom-based anchors + SQM interpolation
- Exterior: wallType-based anchors with area band multipliers
- Modifiers: paint condition, storey, difficulty, water-based uplift
- Range width caps (interior vs exterior separate policies)
- Price floor/ceiling enforcement (`MAX_PRICE_CAP = $35,000`)

#### Trim Selection Rules

Trim은 scope (specific / entire) 와 context (interior / exterior) 에 관계없이 동일한 강제 규칙을 따른다.

- Trim 항목을 선택하면 **하위 세부 항목 선택이 필수(required)**
- 하위 항목: window 종류 및 수량, door 종류 및 수량
- **Specific Trim**: item-based 앵커 사용 (window/door 개수 × 단가)
- **Entire Trim**: property-level 앵커 사용 (window/door 수량 범위에 따른 밴드 가격)
- 어느 경우든 window/door 종류·수량 미입력 시 폼 제출 불가 (validation error)

#### Current Trim Pricing Direction

The current implementation direction supersedes the legacy trim note above where they conflict.

- **Interior / Entire property**: when trim is selected, collect trim quantities and price them with a new whole-property trim quantity anchor. The new anchor is 50% of the existing specific-area trim item unit prices, so quantity affects the estimate without double-counting the whole-property base anchor.
- **Interior / Specific areas only**: keep the existing specific trim prices unchanged. This remains a direct item quote using the current door, window, and skirting anchors.
- **Exterior / Entire or full exterior scope**: keep exterior trim item quantities because exterior door, window, architrave, and front door counts materially affect labour. If no detailed quantities are supplied, the engine can use the standard exterior trim allowance.
- **Exterior / Specific areas only**: keep the current exterior item-based trim pricing.
- Result and PDF copy should indicate whether detailed trim quantity pricing or a standard trim allowance was used.

### AI Integration
- Genkit + Google Generative AI (Gemini 2.5 Flash)
- AI generates a natural-language explanation of the estimate
- Pricing logic stays deterministic in `pricing-engine.ts`; AI provides the narrative wrapper

### User Authentication
- Firebase Auth (Google Login + Email/Password with email verification)
- App Check (reCAPTCHA v3) for production security
- Admin access via Firebase custom claims (`admin: true`)

### Estimate Usage Policy
- Non-admin users: **2 free estimates**
- Admin users: unlimited estimates
- Promotional extra estimates via coupon or event may be explored later, but this is **not confirmed or implemented in the current product**
- Rate limits for abuse prevention remain separate: 30s interval, 5/hour, 10/day

### Data Persistence
- Estimate data saved to Firestore (user ID, form inputs, AI result, timestamp)
- Photo upload to Firebase Storage via API route
- Admin can view all estimates with detail pages

### Address & Location
- Australian address autocomplete (Google Maps API)
- Location is used for regional context in estimates

---

## Service Categories (Landing Page)

| Service | Starting From |
|---------|--------------|
| Interior Painting | $2,800 |
| Exterior Painting | $4,500 |
| Trim & Doors | $850 |
| Roof Painting | $3,200 |
| Deck & Timber | $950 |
| Paving & Concrete | $1,200 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| AI | Genkit + Google Generative AI (Gemini 2.5 Flash) |
| Auth & DB | Firebase (Authentication, Firestore, Storage) |
| Security | App Check (reCAPTCHA v3), Admin custom claims |
| UI | Tailwind CSS, shadcn/ui, Radix UI, Framer Motion |
| Forms | react-hook-form + Zod validation |
| Hosting | Firebase App Hosting (Git-triggered deploy) |

---

## Style Guidelines

- Current UI uses HSL design tokens defined in `globals.css`
- Visual direction remains trust-oriented blue with light neutral surfaces
- Legacy blueprint reference colors were Soft blue (#77B5FE), Light gray (#F0F4F8), and Pale purple (#B19CD9)
- Font: Inter
- Icons: Simple outlined style (Lucide React)
- Layout: Clean grid-based forms and results
- Transitions: Subtle animations for form steps and loading states

---

## Business Model

This app is a **painting lead generator**, not a SaaS product.

Funnel: Free AI estimate -> On-site quote booking -> Actual contract

Key metrics: estimate generation count, booking conversion rate, contract close rate

## Booking Conversion Strategy

The app should make the site visit feel like the obvious next step after the AI estimate, not a separate sales ask.

Primary trigger: the estimate result screen explains that the free site visit turns the indicative AI range into a fixed written quote. Phase 1 keeps the hosted Jobber booking URL so customers can choose a time in Jobber without the app owning scheduling.

Operational promise: Jobber owns booking confirmation and schedule placement in Phase 1. PBC should keep the Jobber form short and make the response policy clear inside Jobber/operations.

Measurement: the app can track `jobber_booking_clicked` with estimate context. Final booking completion remains Jobber-owned until a later API integration or manual reconciliation is added.

See [`docs/booking-conversion-upgrade.md`](./booking-conversion-upgrade.md) for the conversion trigger, process policy, measurement plan, and open decisions.
