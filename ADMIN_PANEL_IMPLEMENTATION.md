# STITCHGRID Admin Panel

## Frontend structure

    frontend/src/
    ├── app/(dashboard)/admin/
    │   ├── page.tsx
    │   ├── users/page.tsx
    │   ├── verification/page.tsx
    │   ├── verification/[organizationId]/page.tsx
    │   ├── marketplace/page.tsx
    │   ├── rfqs/page.tsx
    │   ├── rfqs/[rfqId]/page.tsx
    │   ├── orders/page.tsx
    │   ├── payments/page.tsx
    │   ├── support/page.tsx
    │   └── settings/page.tsx
    ├── components/layout/AdminLayout.tsx
    └── features/admin/
        ├── AdminResourcePage.tsx
        └── admin.service.ts

## Backend structure

    backend/
    ├── prisma/
    │   ├── schema.prisma
    │   ├── admin-bootstrap.sql
    │   └── migrations/202611070001_admin_catalog_moderation/migration.sql
    └── src/
        ├── controllers/admin.controller.ts
        ├── routes/admin.routes.ts
        └── app.ts

## Database update

The current Prisma datasource is MySQL (also compatible with the configured TiDB URL format). The backend README previously said PostgreSQL, but that text did not match the actual Prisma schema or .env.example. Do not change database engines as part of this UI work.

From the backend folder, after confirming .env points to the intended database:

    npx prisma migrate deploy
    npx prisma generate
    npm run build

The migration is additive: it adds moderationStatus and moderationNote to CatalogItem.

## Grant the ADMIN role

1. Register the administrator using the normal signup flow.
2. Edit backend/prisma/admin-bootstrap.sql and replace REPLACE_WITH_ADMIN_EMAIL.
3. Run the SQL from a trusted database console.
4. Sign in again and select the ADMIN membership if the account has multiple memberships.

ADMIN cannot be selected during public signup. The API independently checks the JWT role for every admin endpoint.

## Admin API routes

- GET /api/admin/overview
- POST /api/catalog-items (supplier listing submission; starts in PENDING moderation)
- GET /api/admin/users and PATCH /api/admin/users/:userId/status
- GET /api/admin/organizations/:organizationId
- GET /api/admin/marketplace and PATCH /api/admin/marketplace/:itemId/moderation
- GET /api/admin/rfqs, GET /api/admin/rfqs/:rfqId, PATCH /api/admin/rfqs/:rfqId/status
- GET /api/admin/orders
- GET /api/admin/payments
- GET /api/admin/disputes and PATCH /api/admin/disputes/:disputeId
- GET /api/admin/audit-logs

## Current model limitations

- Verification document upload/review records do not yet have a dedicated database model. The verification review page currently reviews saved business profile fields and updates organization verification.
- Generic support tickets are not modeled; Support currently lists and resolves existing Dispute records.
- Payments are displayed from existing transaction records only. A payment gateway, signed webhooks, settlement and refund processing are not connected.
- Admin access currently uses the single ADMIN membership role. Fine-grained per-admin permissions are not modeled yet.
- Supplier catalogue submissions now create CatalogItem records with PENDING moderation status. Public supplier discovery only exposes APPROVED catalogue items. Catalogue moderation requires the included MySQL migration before its API actions can work.

## Validation note

Project files were updated in the local Stitchguard workspace. A build/test command could not be executed through the available desktop shell in this session because its PowerShell executable could not be started. Run the commands above locally and address any environment-specific Prisma generation or build errors before deployment.
