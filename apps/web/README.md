This is the Zentry web app: a [Next.js](https://nextjs.org) 16 Progressive Web
App built inside the Zentry pnpm monorepo.

## Getting Started

From the repo root, start the web app with:

```bash
pnpm --filter @zentry/web dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses a self-hosted local install of Plus Jakarta Sans via
`@fontsource-variable/plus-jakarta-sans`, so the app does not depend on
external font fetching during development or build.

The app also uses:
- Tailwind CSS v4
- Zustand
- TanStack Query
- Framer Motion
- next-pwa

For the remaining browser/mobile Phase 1 acceptance checks, use:

- [docs/ai-context/PHASE1_MANUAL_ACCEPTANCE.md](/Users/admin/Deve-projects/Online-cafe/docs/ai-context/PHASE1_MANUAL_ACCEPTANCE.md)
