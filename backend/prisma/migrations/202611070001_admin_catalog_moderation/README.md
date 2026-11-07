# Admin catalogue moderation migration

This additive MySQL migration adds moderation status and an optional moderation note to existing catalogue items.

Apply from the backend directory after reviewing the target DATABASE_URL:

```bash
npx prisma migrate deploy
npx prisma generate
```

Do not use a production database URL for local development. Back up the database before applying schema changes.
