# Phase 1 Manual Acceptance

This checklist covers the last browser and mobile checks that remain after the
automated Phase 1 verification commands.

## Automated Checks Already Covered

Run these from the repo root:

```bash
pnpm verify:phase1
pnpm verify:phase1:runtime
```

These already verify:
- lint, typecheck, test, and production build
- seeded login for all current roles
- refresh-token rotation
- logout
- protected-route redirects
- role-based redirects

## Local Prerequisites

From the repo root:

```bash
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Expected ports:
- web: `http://localhost:3000`
- api: `http://localhost:4000`

## Seeded Accounts

- `admin@zentry.ng` / `Admin@Zentry2024!`
- `tenant@test.com` / `Test@1234!`
- `user@test.com` / `Test@1234!`
- `cbt@test.com` / `Test@1234!`

Seeded PIN for all accounts:
- `123456`

## Browser Acceptance

### 1. Protected Route Handoff

1. Sign out.
2. Open `http://localhost:3000/profile` directly.
3. Confirm you are redirected to `/login?next=/profile`.
4. Sign in as `user@test.com`.
5. Confirm you land on `/profile`, not just `/home`.

### 2. Public Registration

Repeat these for:
- `/register`
- `/register/cbt`

Expected flow:
1. Submit registration inside a resolved tenant context.
2. Copy the OTP from the API terminal log.
3. Complete `/verify-email`.
4. Sign in successfully after verification.

### 3. Role Routing

- `user@test.com` should land on `/home`
- `cbt@test.com` should land on `/dashboard`
- `tenant@test.com` should land on `/tenant/dashboard`
- `admin@zentry.ng` should land on `/admin/dashboard`

### 4. Session Expiry Handling

1. Sign in.
2. In DevTools, remove the `refresh_token` cookie for `localhost`.
3. Trigger an authenticated page reload or navigate to another protected page.
4. Confirm the app returns to `/login`.
5. Confirm the page shows:
   `Your session expired. Please sign in again to continue.`

### 5. Logout

1. Sign in.
2. Log out from the app UI.
3. Attempt to revisit the previous protected page.
4. Confirm you are redirected back to `/login`.

## Mobile PWA Acceptance

### Android Chrome

1. Open the app from a production-like session.
2. Confirm the install prompt appears or Chrome exposes `Install app`.
3. Install the app.
4. Reopen it from the home screen.
5. Confirm it launches in standalone mode without browser chrome.

### iPhone / iPad Safari

1. Open the app in Safari.
2. Confirm the app shows the Share-menu install guidance.
3. Use `Add to Home Screen`.
4. Launch the installed app from the home screen.
5. Confirm it opens as a standalone app.

## Production PWA Endpoints Already Verified

The following passed against a production web build on `2026-04-06`:
- `/manifest.json` returns `200`
- `/sw.js` returns `200`
- `/offline` returns `200`
- app icons resolve correctly
