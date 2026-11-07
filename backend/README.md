# STITCHGRID Backend API

Express + TypeScript + Prisma + MySQL/TiDB for the STITCHGRID B2B sourcing platform. The Prisma schema and `.env.example` use MySQL; keep the database provider consistent unless a separately planned PostgreSQL migration is performed.

## Setup (Windows PowerShell)
1. Install Node.js LTS and MySQL (or configure TiDB Cloud).
2. Copy .env.example to .env.
3. Create the `stitchgrid_db` MySQL database and set DATABASE_URL.
4. Set unique random JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values (at least 32 chars).
5. npm install
6. npm run db:generate
7. npm run db:migrate
8. npm run dev

Health: GET http://localhost:5000/api/health

## Authentication
- POST /api/auth/signup
- POST /api/auth/login — identifier accepts email or phone + password; OTP is sent to that channel.
- POST /api/auth/verify-otp — { userId, destination, otp, organizationId?, role? }
- POST /api/auth/resend-otp
- GET /api/auth/me

OTP delivery uses SMTP or SMS adapter. In development, OTP is logged only when delivery credentials are absent. Never enable this in production. SMS adapter must be connected to an approved provider. OTP storage uses Redis if configured; in-memory fallback is development-only.

## Marketplace / procurement
- GET /api/suppliers?category=&city=
- PUT /api/supplier-profile
- POST /api/catalog-items (supplier; new listings enter moderation as PENDING)
- POST /api/rfqs
- GET /api/rfqs?organizationId=
- POST /api/rfqs/:rfqId/invitations
- POST /api/quotations
- POST /api/purchase-orders
- PATCH /api/purchase-orders/:orderId/status

## Samples / production / collaboration
- POST /api/orders/:orderId/samples
- PATCH /api/samples/:sampleId
- PATCH /api/milestones/:milestoneId
- POST /api/conversations
- POST /api/conversations/:conversationId/messages
- GET /api/notifications
- PATCH /api/notifications/:notificationId/read

## Disputes / reviews / admin
- POST /api/orders/:orderId/disputes
- PATCH /api/admin/disputes/:disputeId (ADMIN)
- POST /api/orders/:orderId/reviews
- GET /api/admin/organizations (ADMIN)
- PATCH /api/admin/organizations/:organizationId/verification (ADMIN)
- GET /api/admin/audit-logs (ADMIN)

### Admin panel API
All routes below require a valid JWT with an active `ADMIN` membership.
- GET /api/admin/overview
- GET /api/admin/users and PATCH /api/admin/users/:userId/status
- GET /api/admin/organizations/:organizationId
- GET /api/admin/marketplace and PATCH /api/admin/marketplace/:itemId/moderation
- GET /api/admin/rfqs, GET /api/admin/rfqs/:rfqId and PATCH /api/admin/rfqs/:rfqId/status
- GET /api/admin/orders
- GET /api/admin/payments (read-only until a real payment provider is connected)
- GET /api/admin/disputes
- GET /api/admin/audit-logs

### Admin setup and schema update
- **Render production:** the start command runs `npx prisma migrate deploy` before starting the API, so committed migrations are applied during service startup. Confirm the Render `DATABASE_URL` points to the intended production database and keep a backup before the first deployment with schema changes.
- **Local development:** from `backend`, run `npx prisma migrate deploy` and then `npx prisma generate` after reviewing your local `DATABASE_URL`.
- Create a normal user account, then edit `prisma/admin-bootstrap.sql` and replace the email placeholder. Run that SQL only from a trusted database session to grant the `ADMIN` membership. Public signup intentionally does not allow users to select ADMIN.

## Production limitations / next integrations
Payment provider checkout and signed webhook verification are not enabled. Do not treat this service as a payment processor or money-holding service. Add official provider SDK and signature validation before production. Also finish real SMS adapter, password reset, refresh-token rotation/revocation, admin MFA, upload/object storage, full notifications, pagination, broader authorization tests, and automated tests before production. Never commit .env. Celery requires a separate Python worker when paired with this Node backend; Redis stores OTP state when configured.
