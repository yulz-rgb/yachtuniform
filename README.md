# Yacht Crew Uniform Lookbook

A production-ready Next.js platform for yacht management teams to compose crew uniform looks, manage per-yacht catalogs, plan crew orders and budgets, and export procurement-ready PDF/CSV artifacts.

## Two runtime modes

The app detects its environment and adapts automatically:

| Mode | When | Data | Auth |
|------|------|------|------|
| Local | No backend env vars | Browser `localStorage` + demo catalog | None |
| Production | `DATABASE_URL` + Clerk keys set | Neon/Postgres, per-yacht isolated | Clerk |

This means it always runs for design/dev, and becomes a full multi-tenant SaaS once configured.

## Stack

- Next.js 16 (App Router) + React 19
- Prisma ORM + Neon/Postgres
- Clerk authentication + multi-tenant memberships
- Vercel Blob (product images + export artifacts)
- Vercel Analytics
- Vitest unit tests, ESLint flat config, GitHub Actions CI

## Local development

```bash
npm install
npm run dev        # http://localhost:3000  (local mode, demo data)
npm test           # unit tests for calculations and CSV
npm run lint
npm run build
```

## Going to production

1. Provision managed services (auto-injects env vars):
   ```bash
   vercel integration add neon
   vercel integration add clerk
   vercel integration add blob     # or create a Blob store in the dashboard
   vercel env pull .env.local
   ```
   See `.env.example` for the full variable list.
2. Apply the schema and seed bootstrap demo data:
   ```bash
   npx prisma migrate deploy
   npm run db:seed          # optional: demo yacht for verification
   ```
3. Deploy (per handover workflow):
   ```bash
   git push origin main
   npx vercel --prod --yes
   ```

## Architecture

- `app/page.jsx` — server component; loads the active yacht's workspace (production) or renders local mode.
- `components/Workspace.jsx` — client app (preview, catalog, budget, crew, exports, approvals).
- `components/` — `Mannequin`, `ProductCard`, `ProductEditor`, `CatalogImport`.
- `lib/calc.js` — pure budget / order / validation logic (unit tested).
- `lib/csv.js` — CSV parse/build for orders and catalog import (unit tested).
- `lib/validation.js` — Zod schemas for products, looks, crew, settings, imports.
- `lib/repository.js` — tenant-scoped Prisma data access.
- `lib/auth.js` — Clerk user sync + active-yacht resolution + membership guards.
- `app/actions.js` — server actions (save workspace, switch yacht, approvals).
- `app/api/import` — catalog CSV validate/import. `app/api/upload` — Blob image upload.
- `prisma/schema.prisma` — full data model. `prisma/migrations` — migration history.

## Catalog import

Import real supplier data via the in-app "Import Catalog CSV" button. Template: `docs/catalog-template.csv`. List columns (`colours`, `fit`, `roleTags`) accept `|` or `,` separators. Rows are validated (Zod) with a preview before persisting; SKUs are matched within the yacht for create-vs-update.

## Procurement features

- Budget includes garments, embroidery/logo, spare allowance, per-product VAT, flat shipping, and one-off setup.
- Supplier purchase order aggregates quantities across crew and sets (with spare), flags below-MOQ lines.
- Procurement checks surface missing sizes, fit/body mismatches, missing SKUs, and MOQ violations.
- Approval workflow: Draft → Captain review → Owner approval → Approved, with a locked totals snapshot.

## Testing

```bash
npm test
```

See `docs/SMOKE_TEST.md` for the manual production smoke test.
