# STITCHGRID Mobile App

Independent Expo / React Native app. This project lives in `mobile-app/`; the existing `mobile/` and `frontend/` projects are not modified. The backend has a small auth-controller update to allow the mobile OAuth client IDs.

## Setup

```bash
cd mobile-app
npm install
```

Create a local `.env` from `.env.example` and set:

- `EXPO_PUBLIC_API_URL` to the deployed backend API base URL (including `/api`).
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` to the Android OAuth client ID.
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` to the iOS OAuth client ID.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the Web OAuth client ID.

These are OAuth **client IDs**, not client secrets. Never put a Google client secret in the mobile app.

In the backend / Render environment, set `GOOGLE_CLIENT_ID` to a comma-separated allowlist containing the same Web, Android and iOS client IDs. Keep any existing Web client ID in the list.

For Android, configure the OAuth Android client with package name `com.stitchgrid.mobileapp` and the SHA-1 fingerprint of the signing certificate used for the build. For iOS, configure the OAuth iOS client with bundle ID `com.stitchgrid.mobileapp`.

## Run

```bash
npx expo start
```

After adding the AuthSession dependencies or changing native OAuth configuration, install dependencies and create a fresh development/EAS build. A previously installed APK will not contain new native package configuration.

## Current implementation

- Login screen uses a clean white background with STITCHGRID purple accents.
- Email/mobile + password sign-in calls `POST /auth/login`.
- JWT, user, and membership are stored with Expo SecureStore.
- Remember Me stores only the identifier, never the password.
- Forgot Password calls `POST /auth/forgot-password`.
- Google sign-in uses Expo Google ID-token AuthSession and calls `POST /auth/google`.
- New Google accounts without an organization continue to the Google organization onboarding screen, which calls `POST /auth/google/onboarding`.
- Existing Buyer, Supplier and Admin membership routing is preserved.
- Register Organization continues to use the existing `/register` route.

## Backend contract

Email/password login request:

```json
{ "identifier": "registered@email.com", "password": "your-password" }
```

Google login request:

```json
{ "credential": "<Google ID token>" }
```

The backend verifies the Google ID token issuer, expiry, verified email and audience against the configured `GOOGLE_CLIENT_ID` allowlist.
