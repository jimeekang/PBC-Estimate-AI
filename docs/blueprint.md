# PBC Estimate AI - Product Blueprint

> Last updated: 2026-03-30
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
