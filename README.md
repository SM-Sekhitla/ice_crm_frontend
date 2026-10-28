# ICE CRM frontend

React + TypeScript CRM for Industrial Computing Engineering, connected to the FastAPI/PostgreSQL backend in `../crm_backend`. Products, contacts, relationships, leads, clients, follow-ups, campaigns, signatures, senders, users and activity come from the server. There are no seeded business records, demo accounts, local database, or fallback datasets.

## Run the connected application

Configure and start the backend first; see [backend setup](../crm_backend/README.md). It needs PostgreSQL, a unique `SECRET_KEY`, migrations, and an initial administrator:

```sh
cd ../crm_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Configure SECRET_KEY and DATABASE_URL in .env, and create the PostgreSQL database.
alembic upgrade head
# Set DEFAULT_PLATFORM_ADMIN_EMAIL and DEFAULT_PLATFORM_ADMIN_PASSWORD in .env.
uvicorn app.main:app --reload --host 127.0.0.1 --port 5002
```

In another terminal:

```sh
cd crm_frontend
npm install
cp .env.example .env
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:5002`. On API startup, the configured DEFAULT_PLATFORM_ADMIN_EMAIL is created as Super Admin using DEFAULT_PLATFORM_ADMIN_PASSWORD (12–128 characters), if that email does not exist. Sign in with that account; existing passwords are never reset and no demo credentials are supplied. A fresh server starts with no products or contacts. Create products, add staff and assign products under User management, then create/import contacts.

For deployments, set `VITE_API_URL` to the full API URL ending in `/api/v1` before building, or route `/api` to FastAPI through your web proxy. Set backend `CORS_ORIGINS` and `ALLOWED_HOSTS` for your deployment. Vite's development proxy is not part of the production build.

Frontend configuration is read from `.env` (or mode-specific Vite env files), not `.env.example`. Restart the dev server after editing environment files. `FRONTEND_PORT` sets the dev/preview port with strict port matching. `VITE_API_URL` sets the browser API path. `VITE_API_TARGET` sets the development proxy's backend address; `BACKEND_TARGET` is a fallback for a container address. Explicit process environment proxy settings override values from the local file. For host-side development use `http://localhost:5002`; the hostname `backend` only works in a Docker network where that service exists. `VITE_ALLOWED_HOSTS` accepts a comma-separated hostname list or a JSON array. `VITE_FRONTEND_BASE_URL` and `VITE_GIT_VERSION` are reserved metadata and currently do not affect application behavior.
Never put credentials or provider secrets in `VITE_` settings.

## Authentication and persistence

The login form posts credentials to FastAPI. Access tokens stay in memory; the tab's rotating refresh token is kept in `sessionStorage` to restore a session after reload. Concurrent expired requests share one refresh operation. Logout revokes server sessions and clears credentials and query data. Password changes and administrator account changes revoke sessions. Invalid/expired sessions return to sign-in; server outages show an error with retry rather than fabricated data.

Every signed-in user sees all contacts, leads and clients across owners and product assignments. Related products, follow-ups, history and public owner names are available for display. Write permissions remain ownership-based for BDOs, while Super Admins retain administration and deletion controls. Campaign and email settings keep their separate access rules. Frontend role checks improve the interface; the backend enforces authorization.

CRM records are stored only in PostgreSQL. TanStack Query caches the current server workspace in memory and refreshes it every 15 seconds while active. Browser storage contains only the tab's refresh token and personal UI preferences such as sidebar state, saved filters and recent searches. The old browser demo database, legacy session, and legacy search data are removed on application startup; old CRM demo records are never migrated into PostgreSQL.

## Connected workflows

- Product creation/editing, archival, and protected deletion.
- Contact creation/editing, CSV import, tags, notes, export, confirmed deletion and saved filters.
- Per-product relationships, owner reassignment, lead stages and client conversion with retained history.
- Follow-up creation, editing, completion and reopening.
- Staff invitations by email, one-time password setup, roles and product assignments under User management.
- Sender creation/editing under Email configurations. Verification means the administrator has authorised the address with the configured provider; credentials stay on the server.
- HTML/HTM signature import, safe inline formatting, image replacement/omission, preview, server storage and deletion protection.
- Campaign drafts, saved audiences, personalised previews, duplication, scheduling, cancellation, recipient logs and processing analytics.
- Dashboard, tables, search, charts and CSV exports derived from actual server records.
- Account password change and server-backed logout.

The frontend uses a shared CRM `GET /api/v1/workspace` snapshot with separately scoped campaign and administration data to preserve the existing collection-based screens. Contact and campaign changes use dedicated API routes. IDs and ownership come from the backend; the client never impersonates a supplied user ID. Mutations invalidate the server workspace query. As data grows, individual list queries can replace the snapshot using the backend's paginated routes.

## Campaign delivery

The development runner `python3 run_backend.py` now starts both API and mail worker in one terminal. Ctrl+C stops both. If you start the API manually with Uvicorn instead, start the worker separately:

```sh
cd ../crm_backend
source .venv/bin/activate
python -m app.services.worker
```

Set backend `EMAIL_PROVIDER=smtp` or `EMAIL_PROVIDER=brevo` and add an authorised sender under Email configurations. At launch, the frontend displays **Send email via SMTP/BREVO** or **Server simulation — no email sent**. Real sends require `EMAIL_DELIVERY_ENABLED=true` and valid credentials for the selected provider. The API rejects real sending when disabled; it never silently substitutes a simulation. Restart both API and worker after changing the backend provider.

For Brevo, configure `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and `BREVO_FROM_NAME` in the backend `.env`. Campaigns can use any CRM sender authorised in your Brevo account and assigned to the product/user. BREVO_FROM_EMAIL and BREVO_FROM_NAME are the defaults for invitation emails. No API key is sent to the browser. See [backend provider setup](../crm_backend/README.md#switching-between-smtp-and-brevo).

Schedules use Africa/Johannesburg (SAST, UTC+02:00); the worker processes them even when the browser is closed. Submission queues the campaign; it does not claim immediate completion. Recipient consent, suppression, access and sender availability are checked again by the worker. Reports show Queued, Dispatching, Accepted, Simulated, Excluded, Failed or Unknown outcomes. Provider acceptance does not establish inbox delivery. Opens, clicks and delivery webhooks need a provider integration.

**Validate server preview** checks the personalised saved draft against server rules without sending email. General file attachments are not yet supported, so the previous filename-only attachment control has been removed. Uploaded signature images are supported: replace local/relative/CID image references in the import dialog, or omit them explicitly. Embedded images are stored with the signature and converted to CID attachments for SMTP delivery. The Brevo API integration requires HTTPS image URLs; unsupported embedded images are rejected before sending.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Unit tests cover CSV validation, HTTP error handling, session restoration/refresh/logout, request contracts and empty server workspaces. The obsolete demo-backed service and browser tests have been removed. Playwright is not run.

An optional real HTTP integration test exercises this frontend service layer against a running **disposable** FastAPI/PostgreSQL instance and worker. It creates test CRM records and a simulation campaign, so never run it against production. Provide an existing administrator on that test instance:

```sh
CRM_LIVE_API_URL=http://127.0.0.1:5002/api/v1 \
CRM_TEST_EMAIL=your-test-admin-email \
CRM_TEST_PASSWORD=your-test-admin-password \
npm test -- src/services/live-api.test.ts
```

No browser or real email delivery is used in this test. Backend tests and migration commands are documented in the backend README.

## Architecture

`src/services/http.ts` handles bearer authentication, refresh rotation, errors and API configuration. `api.ts` and `campaign-service.ts` translate UI actions to FastAPI routes. `workspace.ts` adapts transport nulls and numeric values without creating records. TanStack Query owns server data, Zustand holds transient identity and sidebar preferences, and TanStack Router handles navigation. Domain types live in `src/types`; features are separated under `src/features`.

The ICE palette uses crimson `#C1121F`, near-black `#0B0B0D`, white and gold `#F4B942`, with a black app header. Styling lives in `src/styles/globals.css`.

## Inviting staff and password setup

User management now sends invitations instead of asking an administrator to enter an initial password. The new user remains pending until they follow the email link and set their own password. The activation page contains only **New password** and **Confirm password**. A successful setup signs them in, shows a welcome popup, and offers a short module tour. Super Admins see administration steps; BDOs see their own modules. Completion or skipping is saved to the account and survives future logins.

The backend must have EMAIL_DELIVERY_ENABLED=true, valid SMTP/Brevo settings, and FRONTEND_BASE_URL pointing to this frontend at an address the recipient can reach. SMTP invitations use SMTP_FROM_EMAIL/SMTP_FROM_NAME or a verified sender; Brevo uses its configured sender. The persistent mail worker must be running; run_backend.py starts it automatically alongside the API. A successful create queues email; it does not claim the provider delivered it. User management shows invitation status and offers **Resend invitation** for pending accounts. Resending invalidates previous links.

Invitations expire after 24 hours by default and can be used once. The token travels in a URL fragment and a POST body, is removed from history after reading, and is never saved to browser storage. Expired, used, and invalid links show a recovery message. Invitations cannot reset already activated accounts.

Apply the backend migration with `alembic upgrade head` before restarting API and worker (run_backend.py applies it automatically). No services need to be started by the code checks; the isolated backend invitation tests mock database/provider access. No real email or Playwright is used by those tests.

## Editing staff emails and deleting accounts

In **User management → Edit**, the email field is editable. A changed address keeps the existing password and signs out sessions; pending accounts receive a replacement invitation and old links stop working.

The **Delete** action opens a confirmation with a replacement-owner choice and affected-work counts. The removed user can no longer sign in; products, relationships, open follow-ups and drafts move to the selected owner. Draft senders/signatures must be reviewed again. Contacts, clients and historical attribution remain. The old email may be used for a new invitation, with a new account ID. Your own account and the last active Super Admin cannot be deleted. Apply the backend migration before using these controls (`run_backend.py` does this on startup).

## Embedded images when sending through Brevo

If a signature or message contains an uploaded embedded image, use **Prepare images for Brevo** in Compose or the launch confirmation. The dialog detects the files and lets you download each image. Upload it to Brevo's Content library or your website, then paste its direct public HTTPS image link. Saving replaces image sources while keeping typography, tables, dimensions and text, updates the saved signature, and saves the current draft. Previously submitted campaign snapshots keep their original content. Review the preview and confirm launch again afterward.

This step requires hosting the image: a local development server cannot provide a public HTTPS image address to email recipients. The CRM does not upload images to a third party automatically. A URL format check does not confirm remote availability; use a publicly accessible direct image link rather than a private/shared page. See [Brevo Content library instructions](https://help.brevo.com/hc/en-us/articles/4504463584786-Add-and-manage-images-in-the-Content-library).

## Docker: frontend, API, PostgreSQL and email worker

Keep `crm_frontend` and `crm_backend` beside each other. The frontend Compose file starts the full stack, waits for PostgreSQL, applies migrations, then starts the API, worker and Nginx frontend. The browser calls `/api/v1` on the frontend's own origin; Nginx forwards those requests to `api:5002`. Direct links to React routes also work.

Configure `../crm_backend/.env` with your real `SECRET_KEY`, initial administrator settings, email settings, and database settings. The Compose database connection must use `db:5432`, not localhost. For example, replace the placeholders below; URL-encode special characters in the connection-string password:

```env
POSTGRES_DB=crm_db
POSTGRES_USER=crm
POSTGRES_PASSWORD=YOUR_DATABASE_PASSWORD
DOCKER_DATABASE_URL=postgresql+asyncpg://crm:YOUR_URL_ENCODED_PASSWORD@db:5432/crm_db
FRONTEND_BASE_URL=http://localhost:5173
ALLOWED_HOSTS=["localhost","127.0.0.1"]
```

From `crm_frontend`, run:

```sh
docker compose --env-file ../crm_backend/.env up --build -d
docker compose --env-file ../crm_backend/.env logs -f api worker frontend
```

Open `http://localhost:5173`. Set `FRONTEND_PORT` and `FRONTEND_BASE_URL` together in the backend `.env` if changing that address. This stack exposes only the frontend, bound to localhost; API and database stay on the internal Compose network. Its `crm_data` volume belongs to this Compose project: it does not automatically reuse a database from a separately started backend stack. To use an existing Compose database volume, explicitly map `crm_data` to that volume before starting this stack. Avoid running two stacks that expose the same frontend port.

To stop while preserving database data:

```sh
docker compose --env-file ../crm_backend/.env down
```

### Frontend Docker image on Render

For a Render Docker web service, use this frontend `Dockerfile` and leave Docker Command empty. Set runtime `BACKEND_TARGET=https://YOUR-BACKEND.onrender.com` with no trailing slash or API path. Nginx listens on Render's `PORT` (8080 by default). The baked-in `VITE_API_URL` defaults to `/api/v1`, so the browser uses the Nginx proxy. Vite variables are build arguments; set them before building if overriding their defaults.

On the backend, set `FRONTEND_BASE_URL` to the frontend's public HTTPS URL so invitations point to the deployed app. Add the backend's public hostname to backend `ALLOWED_HOSTS`; Nginx forwards the upstream host so Render can route to the correct backend service. Local Compose supplies `api`, `localhost` and `127.0.0.1` automatically, including the readiness check host. Add the frontend origin to `CORS_ORIGINS` if also calling the backend directly. Never pass backend secrets through `VITE_*` build arguments. The frontend image excludes local `.env` files.

The proxy uses the official [Nginx image's environment templates](https://hub.docker.com/_/nginx). The Compose command explicitly loads backend variables for [Compose interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation); a service's `env_file` alone does not provide interpolation values.
