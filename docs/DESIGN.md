# DESIGN.md — UI/UX Design System

> PBC Estimate AI
> Last updated: 2026-03-30

---

## Design Framework

- **Component library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS with CSS custom properties (HSL)
- **Animation**: Framer Motion + tailwindcss-animate
- **Icons**: Lucide React (outlined style)
- **Font**: Inter (body + headline)
- **Dark mode**: Supported via `class` strategy

---

## Color System

Colors are defined as HSL CSS variables in `globals.css` and consumed via Tailwind config.

### Light Mode

| Token | HSL | Usage |
|-------|-----|-------|
| `--primary` | 209 69% 32% | Buttons, links, focus rings |
| `--primary-foreground` | 210 20% 98% | Text on primary |
| `--background` | 210 29% 98% | Page background |
| `--foreground` | 224 71% 4% | Body text |
| `--secondary` | 210 29% 90% | Secondary buttons, tags |
| `--muted` | 210 29% 92% | Disabled states, subtle bg |
| `--muted-foreground` | 220 9% 46% | Placeholder, secondary text |
| `--accent` | 209 69% 92% | Highlights, hover states |
| `--destructive` | 0 84% 60% | Error, delete actions |
| `--border` | 210 20% 90% | Borders, dividers |
| `--ring` | 209 69% 32% | Focus ring (matches primary) |

### Dark Mode

| Token | HSL | Notes |
|-------|-----|-------|
| `--primary` | 209 60% 45% | Slightly lighter for dark bg |
| `--background` | 224 71% 4% | Deep dark background |
| `--muted` | 215 28% 17% | Subtle dark surfaces |
| `--border` | 215 28% 25% | Visible on dark |

### Blueprint Colors (Reference)

The original blueprint defined: Soft blue (#77B5FE), Light gray (#F0F4F8), Pale purple (#B19CD9).
These were evolved into the current HSL-based system for better Tailwind integration.
The primary hue (209) preserves the blue trust tone from the original design.

---

## Typography

| Usage | Font | Class |
|-------|------|-------|
| Body text | Inter | `font-body` |
| Headlines | Inter | `font-headline` |
| Code | monospace | `font-code` |

Font loading: `var(--font-inter)` via Next.js font optimization, fallback to `'Inter', sans-serif`.

---

## Spacing & Radius

| Token | Value |
|-------|-------|
| `--radius` | 0.6rem |
| `rounded-lg` | var(--radius) |
| `rounded-md` | calc(var(--radius) - 2px) |
| `rounded-sm` | calc(var(--radius) - 4px) |

---

## Component Patterns

### Buttons
Use shadcn/ui `<Button>` with variants: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`.

### Forms
- `react-hook-form` + `zod` resolver for all forms
- shadcn/ui `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormMessage>`
- Validation: Zod schemas in `src/schemas/`

### Cards
Use `<Card>`, `<CardHeader>`, `<CardContent>`, `<CardFooter>` from shadcn/ui.

### Dialogs & Sheets
- `<Dialog>` for confirmations and modals
- `<Sheet>` for mobile navigation

### Tables
- `<Table>` from shadcn/ui for admin data display

---

## Layout Architecture

### Route Groups
| Group | Layout | Auth |
|-------|--------|------|
| `(public)` | None (standalone pages) | Not required |
| `(auth)` | Minimal (auth-focused) | Not required |
| `(protected)` | Header + Footer via `AppProviders` | Required (AuthProvider) |

### Protected Layout
```
AppProviders (AuthProvider wrapper)
└── div.flex.min-h-full.flex-col
    ├── Header
    ├── main.flex-1 → {children}
    └── Footer
```

---

## Responsive Strategy

- Mobile-first via Tailwind breakpoints (`sm`, `md`, `lg`, `xl`)
- `use-mobile` hook for programmatic mobile detection
- Forms: single column on mobile, multi-column on desktop where appropriate

---

## Animation

- **Form transitions**: Framer Motion for multi-step wizard (estimate form)
- **Accordion**: tailwindcss-animate with `accordion-down` / `accordion-up` keyframes (0.2s ease-out)
- **Loading states**: Skeleton components from shadcn/ui
- **General**: Subtle transitions only — no heavy animation

---

## Accessibility

- All interactive elements must be keyboard navigable (Radix UI handles this)
- Form errors announced via `<FormMessage>` with appropriate ARIA
- Color contrast: primary on primary-foreground meets WCAG AA
- Focus visible: ring style via `--ring` token
