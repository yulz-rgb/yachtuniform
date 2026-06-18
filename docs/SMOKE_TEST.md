# Production Smoke Test

Run after each production deploy. All steps must pass before considering a release done.

## Preconditions
- `DATABASE_URL`, Clerk keys, and `BLOB_READ_WRITE_TOKEN` set in the Vercel project.
- `npx prisma migrate deploy` has been run against the production database.

## Steps

1. Auth
   - [ ] Visit the site unauthenticated → redirected to `/sign-in`.
   - [ ] Sign up a new user → lands on the lookbook with an auto-created yacht.
2. Tenant isolation
   - [ ] Create products/looks/crew as User A.
   - [ ] Sign in as User B (different yacht) → none of User A's data is visible.
3. Persistence
   - [ ] Edit a product, add a crew member → "Saved" pill appears.
   - [ ] Hard refresh → changes persist (loaded from database).
4. Catalog import
   - [ ] Open "Import Catalog CSV", paste `docs/catalog-template.csv`, Validate → shows valid/invalid counts.
   - [ ] Import → products appear in the catalog.
5. Images
   - [ ] In Manage Products, upload an image → product card shows the photo.
6. Procurement
   - [ ] Set VAT/shipping/setup and spare % → Grand Total updates accordingly.
   - [ ] A product with high MOQ shows a "below MOQ" error in Procurement Checks.
7. Exports
   - [ ] Export PDF → multi-page document renders looks, crew matrix, purchase order, budget.
   - [ ] Export CSV → opens with crew rows and a Supplier Purchase Order section.
8. Approval
   - [ ] Open Approvals → Create snapshot (Draft) → Advance through Captain/Owner → Approved.
9. Deploy log
   - [ ] Deployment is Ready at `https://yachtuniform.vercel.app` and logged in `handover.md`.
