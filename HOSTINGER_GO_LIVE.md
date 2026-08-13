# Hostinger Go-Live Checklist

Use this branch/repository for production, not the Render demo branch.

## Hostinger App Settings

- App type: Node.js Web App
- Framework: Express.js or Other
- Node version: 20.x or 22.x
- Build command: `npm ci`
- Start command: `npm start`
- Entry file: `server.js`

## Required Environment Variables

Set these in Hostinger hPanel before the first production start:

```env
NODE_ENV=production
SESSION_SECRET=replace-with-a-long-random-string
ADMIN_SETUP_ENABLED=true
ADMIN_AUTH_DISABLED=false
DEMO_ADMIN_ALLOW_ANY_LOGIN=false
DATA_DIR=/home/USERNAME/chocomedley-data
UPLOAD_DIR=/home/USERNAME/chocomedley-uploads
```

Replace `USERNAME` with the real Hostinger account username or choose another persistent writable path outside the auto-deployed code folder.

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
- Back up `DATA_DIR` and `UPLOAD_DIR` regularly.
- Keep `data/store.json` and uploads out of public Git repositories.
- After every deployment, test `/`, `/checkout`, `/track`, `/admin/login`, and `/admin/orders`.
