# Hostinger Go-Live Checklist

Use this branch/repository for production, not the Render demo branch.

## Hostinger App Settings

- App type: Node.js Web App
- Framework: Express.js or Other
- Node version: 24.x preferred, 22.x minimum
- Build command: `npm ci`
- Start command: `npm start`
- Entry file: `server.js`

## Create The Production Database

In Hostinger hPanel, create a MySQL database before starting the app:

1. Open **Databases** -> **MySQL Databases**.
2. Create the database and database user.
3. Save the database host, database name, username, and password.

The app will create its production `app_state` table automatically on first start.

## Required Environment Variables

Set these in Hostinger hPanel before the first production start:

```env
NODE_ENV=production
SESSION_SECRET=replace-with-a-long-random-string
ADMIN_SETUP_ENABLED=true
ADMIN_AUTH_DISABLED=false
DEMO_ADMIN_ALLOW_ANY_LOGIN=false
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_hostinger_database_user
DB_PASSWORD=your_hostinger_database_password
DB_NAME=your_hostinger_database_name
DB_CONNECTION_LIMIT=5
DATA_DIR=/home/your_hostinger_username/chocomedley-runtime
UPLOAD_DIR=/home/your_hostinger_username/chocomedley-uploads
HEALTH_TOKEN=optional-random-token-for-healthz-diagnostics
```

Use `127.0.0.1` rather than `localhost`: `localhost` resolves to `::1` on Hostinger and MySQL grants usually do not cover the IPv6 loopback. The app rewrites `localhost` to `127.0.0.1` automatically and logs when it does.

Replace `your_hostinger_username` with the real Hostinger account username, or use another persistent writable path outside the auto-deployed code folder. `hostinger.env.example` in this repo is the ready-to-fill template; copy it to `hostinger.env` (git-ignored) before importing into hPanel.

## Startup Behaviour And Diagnostics

- Boot writes a `[boot]` diagnostic line to the runtime log with Node version, port, resolved directories, and DB host/user/name. The password is never logged.
- If a configured `DATA_DIR`/`UPLOAD_DIR` is missing, unwritable, or still a placeholder, the app logs a warning and falls back to the next candidate instead of crashing. A fallback means uploads/sessions are not on persistent storage — fix the path.
- If MySQL cannot be reached, the app still starts and serves a maintenance page with HTTP 503, retrying the connection every 30 seconds. It never silently falls back to file storage in MySQL mode.
- `GET /healthz` returns the live storage status:
  - public response: `status`, `driver`, `node`, `uptimeSeconds`, `errorCode`
  - with `?token=HEALTH_TOKEN`: full error message, resolved paths, and DB host/user/name
- Placeholder values for `SESSION_SECRET`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, or `DB_NAME` are rejected with an explicit log line naming the variables.

## Real Production Storage

- Product settings, admin accounts, customizations, orders, tracking data, and order status history are stored in Hostinger MySQL.
- Customer uploaded images are stored in `UPLOAD_DIR`.
- Login sessions are stored in `DATA_DIR/sessions.json`.

Do not use `/tmp` paths for production. Do not set `DB_DRIVER=json` for the live customer site.

## Create Admin

After deploy:

1. Open `/setup-admin`.
2. Create the real admin account.
3. Set `ADMIN_SETUP_ENABLED=false`.
4. Restart/redeploy the app.
5. Login at `/admin/login`.

## Optional Admin Bootstrap

If setup page is inconvenient, set these env vars and restart:

```env
DEMO_ADMIN_ENABLED=true
DEMO_ADMIN_EMAIL=admin@chocomedley.in
DEMO_ADMIN_PASSWORD=use-a-strong-password
```

The app will create or repair that admin account automatically.

## Production Notes

- Do not set `ADMIN_AUTH_DISABLED=true` on the live site.
- Back up the MySQL database and `UPLOAD_DIR` regularly.
- Keep customer exports, uploaded images, and credentials out of public Git repositories.
- After every deployment, test `/healthz`, `/`, `/checkout`, `/track`, `/admin/login`, and `/admin/orders`.

## Troubleshooting A 503

Read the **Runtime** log, not the build log, then match the message:

| Runtime log | Cause | Fix |
| --- | --- | --- |
| `ER_ACCESS_DENIED_ERROR` | Wrong password, or the user is not attached to the database | Reset the MySQL password in hPanel and re-import the env |
| `ER_BAD_DB_ERROR` | `DB_NAME` wrong | Copy the exact database name from hPanel |
| `ECONNREFUSED` / `ETIMEDOUT` | Wrong host or MySQL not reachable from the Node container | Try `127.0.0.1`, then the host shown in hPanel |
| `missing or still placeholders: ...` | Env import did not apply | Re-import `hostinger.env` and restart the app |
| `no writable directory found` | `DATA_DIR`/`UPLOAD_DIR` not writable | Switch to `/home/<user>/domains/chocomedley.com/...` |
| `SESSION_SECRET must be set` | Secret missing or placeholder | Set a long random `SESSION_SECRET` |
| No `[boot]` line at all | App never started | Check start command `npm start`, entry `server.js`, Node 22+ |
