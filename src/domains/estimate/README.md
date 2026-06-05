# Estimate Domain

This bounded context owns estimate pricing, validation, generation, and estimate-facing UI.

## Layers

- `domain/pricing`: pure pricing anchors, modifiers, and range helpers. Do not import Firebase, Next.js, Genkit, or React here.
- `domain/schemas`: Zod request contracts and validation rules shared by UI and server actions.
- `domain/flow`: form/scope decision helpers that are still pure domain rules.
- `application`: orchestration use cases such as estimate generation, lite estimate calculation, lifecycle payloads, normalization, and price display formatting.
- `presentation/components`: React components for the estimate wizard, result screen, and public quick-guide form.

## Compatibility

Legacy imports under `src/lib`, `src/schemas`, `src/ai/flows`, and `src/components/estimate` are wrappers. New estimate code should import directly from `src/domains/estimate`.
