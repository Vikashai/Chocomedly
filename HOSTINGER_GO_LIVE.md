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
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_hostinger_database_user
DB_PASSWORD=your_hostinger_database_password
DB_NAME=your_hostinger_database_name
DB_CONNECTION_LIMIT=5
DATA_DIR=/home/USERNAME/chocomedley-runtime
UPLOAD_DIR=/home/USERNAME/chocomedley-uploads
```

Replace `USERNAME` with the real Hostinger account username or choose another persistent writable path outside the auto-deployed code folder.

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
- After every deployment, test `/`, `/checkout`, `/track`, `/admin/login`, and `/admin/orders`.
