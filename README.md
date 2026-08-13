# Chocomedley Rakhi Hamper Store

A deploy-ready Hostinger Business Node.js single-product e-commerce site for the Rakhi Chocolate Hamper. It includes guest checkout, Cash on Delivery, dynamic customizations, secure admin login, order management, uploads, tracking, SEO basics, and persistent storage.

## Requirements

- Node.js 18+
- Hostinger Business hosting with Node.js app support
- Writable folders:
  - `data`
  - `public/uploads`

## Local Run

```bash
npm install
npm start
```

Open:

- Storefront: `http://localhost:3000`
- Admin setup: `http://localhost:3000/setup-admin`
- Admin login: `http://localhost:3000/admin/login`

## Hostinger Business Deployment

1. Push the project to the production GitHub repository.
2. In Hostinger hPanel, create a Node.js app from that repository, or upload the project files.
3. Set the app root to this project folder.
4. Set startup file to `server.js`.
5. Run `npm install`.
6. Add environment variables:
   - `NODE_ENV`: `production`
   - `SESSION_SECRET`: a long random secret
   - `DATA_DIR`: a persistent writable folder outside auto-replaced code, for example `/home/USERNAME/chocomedley-data`
   - `UPLOAD_DIR`: a persistent writable folder, for example `/home/USERNAME/chocomedley-uploads`
   - `ADMIN_SETUP_ENABLED`: `true` for first setup, then `false`
   - `PORT`: Hostinger may set this automatically
7. Start/restart the Node.js app.
8. Visit `/setup-admin` once and create the admin account.
9. Change `ADMIN_SETUP_ENABLED` to `false` and restart the app.

Alternative admin bootstrap:

- Set `DEMO_ADMIN_ENABLED=true`
- Set `DEMO_ADMIN_EMAIL=admin@chocomedley.in`
- Set `DEMO_ADMIN_PASSWORD=<strong password>`
- Restart the app. The app will create or repair that admin account automatically.

Do not set `ADMIN_AUTH_DISABLED=true` on production. That opens admin without login and is only for short local/demo testing.

## Data Storage

The app stores operational data in `data/store.json` and customer uploads in `public/uploads`. Back up both folders regularly from Hostinger.

Do not publish a real `data/store.json` with customer orders or admin accounts to a public repository. For free preview hosts, use fresh runtime paths such as `DATA_DIR=/tmp/chocomedley-data` and `UPLOAD_DIR=/tmp/chocomedley-uploads`.

## Free Preview Deployment

The fastest free preview is Render Web Service:

1. Push the project to GitHub.
2. In Render, create a new Web Service from the repo.
3. Render can use `render.yaml`, or set manually:
   - Build command: `npm ci`
   - Start command: `npm start`
   - Environment: `NODE_ENV=production`, `ADMIN_SETUP_ENABLED=true`, `SESSION_SECRET=<long random value>`
   - For a clean demo database: `DATA_DIR=/tmp/chocomedley-data`, `UPLOAD_DIR=/tmp/chocomedley-uploads`
4. Open `/setup-admin` once and create the admin account.
5. Set `ADMIN_SETUP_ENABLED=false` and redeploy/restart.

Free preview hosts usually use temporary filesystems. Orders and uploads can disappear after restarts or redeploys. This is acceptable for a client demo, but not for production orders.

## Default Demo Data

The first run seeds:

- Product: Rakhi Chocolate Hamper
- Base price: INR 1000
- Add Custom Image: INR 100
- Extra Almonds: INR 80
- Cash on Delivery enabled

All of these are editable in Admin.

## Admin

- URL: `/admin/login`
- Create credentials at `/setup-admin` before launch.
- Passwords are hashed with bcrypt.
- Admin routes use sessions and CSRF protection.

## Customer Flow

1. Visit homepage.
2. Customize Rakhi Hamper.
3. Add to cart or buy now.
4. Enter delivery details.
5. Select Cash on Delivery.
6. Place order.
7. Receive order ID.
8. Track order using order ID and mobile number.

## Security Notes

- Checkout totals are recalculated server-side.
- Passwords are hashed with bcrypt.
- Uploaded files are validated by MIME type and size.
- Historical order prices are stored as snapshots.
- Admin routes are protected.
- CSRF tokens are required for POST requests.
- Set a strong `SESSION_SECRET` before launch.
- Disable `ADMIN_SETUP_ENABLED` after creating the first admin.
