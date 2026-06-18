# Launch / Data Cutover Runbook

The application code is launch-ready and verified (build, lint, unit tests green). The
remaining steps require owner credentials, real supplier data, and a production deploy,
so they are documented here for an operator to execute.

## 1. Provision managed services (one-time)
These auto-inject env vars into the Vercel project `yulzs-projects/yachtuniform`:
```bash
vercel integration add neon      # Postgres
vercel integration add clerk     # Auth
# Create a Vercel Blob store (dashboard) -> sets BLOB_READ_WRITE_TOKEN
vercel env pull .env.local
```

## 2. Initialize the database
```bash
npx prisma migrate deploy        # applies prisma/migrations
npm run db:seed                  # OPTIONAL: demo yacht for smoke testing only
```

## 3. Load real catalog data
- Prepare supplier data using `docs/catalog-template.csv`.
- Sign in, then use in-app "Import Catalog CSV" (validates before persisting).
- Do NOT rely on the demo seed for production; create real yacht workspaces.

## 4. Invite users
- In the Clerk dashboard, invite captains / chief stews / owners.
- First sign-in auto-creates a personal yacht; reassign memberships as needed
  (the `Membership` model supports OWNER / CAPTAIN / CHIEF_STEW / MEMBER roles).

## 5. Deploy (required workflow)
```bash
git add -A && git commit -m "Production MVP: auth, database, catalog, procurement, exports"
git push origin main
npx vercel --prod --yes
```
Confirm Ready at https://yachtuniform.vercel.app and log the deployment URL in `handover.md`.

## 6. Verify
- Run every step in `docs/SMOKE_TEST.md` against production.
- Tag the release: `git tag -a v1.0.0 -m "Launch" && git push --tags`.

## Notes / known limitations
- Workspace saves use a transactional replace-all per yacht (fine for the small per-yacht
  datasets here; not designed for high-concurrency simultaneous editing).
- PDF export is client-rendered via html2canvas; very large catalogs produce large PDFs.
- Without env vars the app intentionally runs in local (localStorage) mode.
