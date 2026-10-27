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
python -m app.cli create-admin
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd crm_frontend
npm install
cp .env.example .env
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`. Sign in with the administrator account you created; no account is prefilled or automatically registered. A fresh server starts with no products or contacts. Create products, add staff and assign products under User management, then create/import contacts.

For deployments, set `VITE_API_URL` to the full API URL ending in `/api/v1` before building, or route `/api` to FastAPI through your web proxy. Set backend `CORS_ORIGINS` and `ALLOWED_HOSTS` for your deployment. Vite's development proxy is not part of the production build. Never put credentials or SMTP secrets in `VITE_` settings.

## Authentication and persistence

The login form posts credentials to FastAPI. Access tokens stay in memory; the tab's rotating refresh token is kept in `sessionStorage` to restore a session after reload. Concurrent expired requests share one refresh operation. Logout revokes server sessions and clears credentials and query data. Password changes and administrator account changes revoke sessions. Invalid/expired sessions return to sign-in; server outages show an error with retry rather than fabricated data.

The backend independently enforces roles and record ownership. BDOs only see their owned relationships on assigned products; administrators manage users, assignments, senders and products. Frontend role checks improve the interface but do not grant access.

CRM records are stored only in PostgreSQL. TanStack Query caches the current server workspace in memory and refreshes it every 15 seconds while active. Browser storage contains only the tab's refresh token and personal UI preferences such as sidebar state, saved filters and recent searches. The old browser demo database, legacy session, and legacy search data are removed on application startup; old CRM demo records are never migrated into PostgreSQL.

## Connected workflows

- Product creation/editing, archival, and protected deletion.
- Contact creation/editing, CSV import, tags, notes, export, confirmed deletion and saved filters.
- Per-product relationships, owner reassignment, lead stages and client conversion with retained history.
- Follow-up creation, editing, completion and reopening.
- Staff creation, activation, roles and product assignments under User management.
- Sender creation/editing under Email configurations. Verification means the administrator has authorised the address with the SMTP provider; SMTP credentials stay on the server.
- HTML/HTM signature import, safe inline formatting, image replacement/omission, preview, server storage and deletion protection.
- Campaign drafts, saved audiences, personalised previews, duplication, scheduling, cancellation, recipient logs and processing analytics.
- Dashboard, tables, search, charts and CSV exports derived from actual server records.
- Account password change and server-backed logout.

The frontend uses a scoped `GET /api/v1/workspace` snapshot to preserve the existing collection-based screens. Contact and campaign changes use dedicated API routes. IDs and ownership come from the backend; the client never impersonates a supplied user ID. Mutations invalidate the server workspace query. As data grows, individual list queries can replace the snapshot using the backend's paginated routes.

## Campaign delivery

Start the persistent worker separately:

```sh
cd ../crm_backend
source .venv/bin/activate
python -m app.services.worker
```

Configure the deployment SMTP connection on the backend and add an authorised sender under Email configurations. At launch, select **Send email via SMTP** or **Server simulation — no email sent**, then explicitly confirm. SMTP sends require `EMAIL_DELIVERY_ENABLED=true` and valid SMTP settings. The API rejects real sending when disabled; it never silently substitutes a simulation.

Schedules use Africa/Johannesburg (SAST, UTC+02:00); the worker processes them even when the browser is closed. Submission queues the campaign; it does not claim immediate completion. Recipient consent, suppression, access and sender availability are checked again by the worker. Reports show Queued, Dispatching, Accepted, Simulated, Excluded, Failed or Unknown outcomes. SMTP acceptance does not establish inbox delivery. Opens, clicks and delivery webhooks need a provider integration.

**Validate server preview** checks the personalised saved draft against server rules without sending email. General file attachments are not yet supported, so the previous filename-only attachment control has been removed. Uploaded signature images are supported: replace local/relative/CID image references in the import dialog, or omit them explicitly. Embedded images are stored with the signature and converted to CID attachments for SMTP delivery.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Unit tests cover CSV validation, HTTP error handling, session restoration/refresh/logout, request contracts and empty server workspaces. The obsolete demo-backed service and browser tests have been removed. Playwright is not run.

An optional real HTTP integration test exercises this frontend service layer against a running **disposable** FastAPI/PostgreSQL instance and worker. It creates test CRM records and a simulation campaign, so never run it against production. Provide an existing administrator on that test instance:

```sh
CRM_LIVE_API_URL=http://127.0.0.1:8000/api/v1 \
CRM_TEST_EMAIL=your-test-admin-email \
CRM_TEST_PASSWORD=your-test-admin-password \
npm test -- src/services/live-api.test.ts
```

No browser or real email delivery is used in this test. Backend tests and migration commands are documented in the backend README.

## Architecture

`src/services/http.ts` handles bearer authentication, refresh rotation, errors and API configuration. `api.ts` and `campaign-service.ts` translate UI actions to FastAPI routes. `workspace.ts` adapts transport nulls and numeric values without creating records. TanStack Query owns server data, Zustand holds transient identity and sidebar preferences, and TanStack Router handles navigation. Domain types live in `src/types`; features are separated under `src/features`.

The ICE palette uses crimson `#C1121F`, near-black `#0B0B0D`, white and gold `#F4B942`, with a black app header. Styling lives in `src/styles/globals.css`.
