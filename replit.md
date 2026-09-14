# Goju-Ryu Karate Dictionary

A responsive visual field guide for learning Goju-Ryu Karate terminology, Japanese kanji, and technique explanations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/goju-ryu-dictionary run dev` — run the dictionary website through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- The dictionary is a static frontend and does not require database access.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/goju-ryu-dictionary/src/App.tsx` — dictionary loading, search, filters, cards, and detail view
- `artifacts/goju-ryu-dictionary/src/index.css` — visual system and responsive styles
- `artifacts/goju-ryu-dictionary/public/terms.json` — source of truth for all 102 terms
- `artifacts/goju-ryu-dictionary/public/images/` — 34 supplied technique illustrations

## Architecture decisions

- Keep the dictionary fully static so it remains fast, portable, and easy to publish.
- Illustrated technique entries and text-only terminology share the same search and detail experience.
- The broader General category can be narrowed by its source tags, such as kata and dojo etiquette.

## Product

- Search 102 terms by romanized Japanese, kanji, English translation, or explanation.
- Filter by stances, punches, strikes, kicks, blocks, or general terminology.
- Study all 34 illustrated techniques in a focused detail view.
- Browse kata, commands, etiquette, directions, body weapons, and core concepts on desktop or mobile.

## User preferences

- Preserve the user's supplied terminology and JPG illustrations.
- Keep the experience modern, web-friendly, and mobile-friendly.

## Gotchas

- Use `import.meta.env.BASE_URL` when constructing public asset URLs so previews and published paths both work.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
