const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const nodemailer = require('nodemailer');

function isPlaceholderText(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/^(paste_|your_|change_this|replace-with|replace_with|<)/i.test(text)) return true;
  return text.includes('PASTE_HOSTINGER') || text.includes('/home/USERNAME');
}

function loadPrivateEnvFile() {
  const root = __dirname;
  const onHostinger = root.startsWith('/home/u810694964/') || process.cwd().startsWith('/home/u810694964/');
  if (process.env.NODE_ENV !== 'production' && !process.env.PRIVATE_ENV_FILE && !onHostinger) return;
  const candidates = [
    process.env.PRIVATE_ENV_FILE,
    path.join(root, 'hostinger.env'),
    path.join(process.cwd(), 'hostinger.env'),
    '/home/u810694964/domains/chocomedley.com/hostinger.env',
    '/home/u810694964/hostinger.env'
  ].filter(Boolean);
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const loaded = [];
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key] || isPlaceholderText(process.env[key])) {
        process.env[key] = value;
        loaded.push(key);
      }
    }
    console.log(`[boot] Loaded private env file ${file} (${loaded.join(', ') || 'no overrides needed'}).`);
    return;
  }
  console.warn(`[boot] No private env file found. Checked: ${candidates.join(', ')}`);
}

loadPrivateEnvFile();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DB_DRIVER = String(process.env.DB_DRIVER || 'json').toLowerCase();
const HOSTINGER_DEFAULTS = {
  dbHost: '127.0.0.1',
  dbUser: 'u810694964_user',
  dbName: 'u810694964_prod',
  accountHome: '/home/u810694964'
};

function isPlaceholderValue(value) {
  return isPlaceholderText(value);
}

function configuredDir(name) {
  const value = process.env[name];
  if (!value || isPlaceholderValue(value)) {
    if (value) console.warn(`[boot] ${name} looks like a placeholder ("${value}"); ignoring it.`);
    return '';
  }
  return path.resolve(value);
}

function ensureWritableDir(label, candidates) {
  const attempts = [];
  for (const candidate of candidates.filter(Boolean)) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      fs.accessSync(candidate, fs.constants.W_OK);
      if (attempts.length) console.warn(`[boot] ${label}: using fallback ${candidate} because ${attempts.join('; ')}`);
      return candidate;
    } catch (error) {
      attempts.push(`${candidate} failed (${error.code || error.message})`);
    }
  }
  console.error(`[boot] FATAL ${label}: no writable directory found. ${attempts.join('; ')}`);
  throw new Error(`${label} has no writable directory. ${attempts.join('; ')}`);
}

function productionDefaultDir(name) {
  if (process.env.NODE_ENV !== 'production') return '';
  if (name === 'DATA_DIR') return path.join(HOSTINGER_DEFAULTS.accountHome, 'chocomedley-runtime');
  if (name === 'UPLOAD_DIR') return path.join(HOSTINGER_DEFAULTS.accountHome, 'chocomedley-uploads');
  return '';
}

const DATA_DIR = ensureWritableDir('DATA_DIR', [
  configuredDir('DATA_DIR'),
  productionDefaultDir('DATA_DIR'),
  path.join(ROOT, 'data'),
  path.join(os.tmpdir(), 'chocomedley-runtime')
]);
const UPLOAD_DIR = ensureWritableDir('UPLOAD_DIR', [
  configuredDir('UPLOAD_DIR'),
  productionDefaultDir('UPLOAD_DIR'),
  path.join(ROOT, 'public', 'uploads'),
  path.join(os.tmpdir(), 'chocomedley-uploads')
]);
const PRODUCT_UPLOAD_DIR = ensureWritableDir('PRODUCT_UPLOAD_DIR', [
  path.join(UPLOAD_DIR, 'catalog'),
  path.join(ROOT, 'public', 'catalog'),
  path.join(os.tmpdir(), 'chocomedley-catalog')
]);
const LOG_DIR = ensureWritableDir('LOG_DIR', [
  path.join(DATA_DIR, 'logs'),
  path.join(ROOT, 'storage', 'logs'),
  path.join(os.tmpdir(), 'chocomedley-logs')
]);
const DB_FILE = path.join(DATA_DIR, 'store.json');
const PRODUCT_IMAGES = [
  '/img/WhatsApp Image 2026-08-11 at 7.32.16 PM.jpeg',
  '/img/WhatsApp Image 2026-08-11 at 7.36.53 PM.jpeg',
  '/img/WhatsApp Image 2026-08-11 at 7.49.51 PM.jpeg',
  '/img/WhatsApp Image 2026-08-11 at 7.56.50 PM.jpeg'
];
const ASSET_VERSION = 'launch-20260814-04';
const META_PIXEL_ID = '28093024957051220';
const META_PIXEL_HTML = `<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1"
/></noscript>`;
const CARE_COPY = 'Store your handmade chocolates in a cool, dry place, ideally between 18-22\u00b0C. Keep away from direct sunlight, heat, moisture, and strong odours. During hot weather, refrigerate in an airtight container. Before enjoying, allow the sealed pack to reach room temperature to prevent condensation.';
const MAX_ORDER_QUANTITY = 20;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PUBLIC_WHATSAPP_NUMBER = String(process.env.PUBLIC_WHATSAPP_NUMBER || '7569907353').trim();
const DEFAULT_ORDER_EMAIL = String(process.env.ORDER_EMAIL_ACCOUNT || 'chocomedleyteam@gmail.com').trim();
const PUBLIC_ORIGIN = String(process.env.PUBLIC_ORIGIN || '').trim().replace(/\/+$/, '');
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@chocomedley.in';
const IS_RENDER = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_SERVICE_ID);
const DEMO_ADMIN_ENABLED = process.env.DEMO_ADMIN_ENABLED === 'true' || IS_RENDER || process.env.NODE_ENV !== 'production';
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || '';
const DEMO_ADMIN_ALLOW_ANY_LOGIN = process.env.DEMO_ADMIN_ALLOW_ANY_LOGIN === 'true';
const ADMIN_AUTH_DISABLED = process.env.ADMIN_AUTH_DISABLED === 'true';
const ADMIN_RECOVERY_EMAIL = String(process.env.ADMIN_RECOVERY_EMAIL || '').trim().toLowerCase();
const ADMIN_RECOVERY_PASSWORD = String(process.env.ADMIN_RECOVERY_PASSWORD || '');
const SESSION_SECRET = !isPlaceholderValue(process.env.SESSION_SECRET)
  ? process.env.SESSION_SECRET
  : process.env.NODE_ENV === 'production' ? '' : 'development-session-secret';
const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry'
];

console.log('[boot] Chocomedley starting', JSON.stringify({
  node: process.version,
  env: process.env.NODE_ENV || '(unset)',
  port: PORT,
  cwd: process.cwd(),
  root: ROOT,
  dbDriver: DB_DRIVER,
  dbHost: process.env.DB_HOST || '(unset)',
  dbPort: process.env.DB_PORT || '(unset)',
  dbUser: process.env.DB_USER || '(unset)',
  dbName: process.env.DB_NAME || '(unset)',
  dbPasswordSet: Boolean(process.env.DB_PASSWORD),
  sessionSecretSet: Boolean(process.env.SESSION_SECRET),
  dataDir: DATA_DIR,
  uploadDir: UPLOAD_DIR,
  productUploadDir: PRODUCT_UPLOAD_DIR,
  logDir: LOG_DIR
}));

process.on('uncaughtException', error => {
  console.error('[fatal] uncaughtException:', error);
  process.exit(1);
});
process.on('unhandledRejection', reason => {
  console.error('[fatal] unhandledRejection:', reason);
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'");
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

const rateLimitBuckets = new Map();
function routeRateLimit(name, max, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    if (rateLimitBuckets.size > 5000) {
      for (const [bucketKey, bucket] of rateLimitBuckets) {
        if (now >= bucket.resetAt) rateLimitBuckets.delete(bucketKey);
      }
      while (rateLimitBuckets.size > 10000) rateLimitBuckets.delete(rateLimitBuckets.keys().next().value);
    }
    const key = `${name}:${req.ip}`;
    const current = rateLimitBuckets.get(key);
    if (!current || now >= current.resetAt) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count <= max) return next();
    res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
    res.status(429).send(page(req, 'Please Slow Down', '<main class="container"><section class="panel pad"><h1>Please wait a moment</h1><p class="lead">Too many attempts were received. Please try again shortly.</p><a class="btn primary" href="/">Back home</a></section></main>'));
  };
}
const staticOptions = {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
};
app.use('/assets', express.static(path.join(ROOT, 'public', 'assets'), staticOptions));
app.use('/img', express.static(path.join(ROOT, 'public', 'img'), staticOptions));
app.use('/catalog', express.static(PRODUCT_UPLOAD_DIR, staticOptions));
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || isPlaceholderValue(process.env.SESSION_SECRET))) {
  console.warn('[boot] SESSION_SECRET is missing or still a placeholder. Serving diagnostics only until a real SESSION_SECRET is set in Hostinger.');
}

const storageStatus = { ready: false, driver: DB_DRIVER, error: null, attempts: 0, lastAttemptAt: null };

function scrubSecrets(text) {
  let output = String(text || '');
  for (const secret of [process.env.DB_PASSWORD, SESSION_SECRET, process.env.HEALTH_TOKEN]) {
    if (secret && secret.length > 3) output = output.split(secret).join('***');
  }
  return output;
}

function healthDetailAllowed(req) {
  const token = process.env.HEALTH_TOKEN;
  return Boolean(token) && String(req.query.token || '') === token;
}

app.get('/healthz', (req, res) => {
  const detailed = healthDetailAllowed(req);
  const body = {
    status: storageStatus.ready ? 'ok' : 'degraded',
    driver: storageStatus.driver,
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    storageAttempts: storageStatus.attempts
  };
  if (storageStatus.error) {
    body.errorCode = storageStatus.error.code || 'STORAGE_INIT_FAILED';
    if (detailed) body.errorMessage = scrubSecrets(storageStatus.error.message);
  }
  if (detailed) {
    Object.assign(body, {
      port: PORT,
      dataDir: DATA_DIR,
      uploadDir: UPLOAD_DIR,
      productUploadDir: PRODUCT_UPLOAD_DIR,
      logDir: LOG_DIR,
      sessionSecretReady: Boolean(SESSION_SECRET),
      db: {
        host: process.env.DB_HOST || null,
        port: process.env.DB_PORT || null,
        user: process.env.DB_USER || null,
        name: process.env.DB_NAME || null,
        passwordSet: Boolean(process.env.DB_PASSWORD)
      }
    });
  }
  res.status(storageStatus.ready ? 200 : 503).json(body);
});

app.use((req, res, next) => {
  if (SESSION_SECRET) return next();
  res.status(503).type('html').send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chocomedley setup needed</title><style>body{font-family:system-ui,Segoe UI,sans-serif;background:#1b1210;color:#fdf6f0;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}main{max-width:620px;text-align:center;background:#2b151f;border:1px solid #e5c16b55;border-radius:18px;padding:32px}h1{font-size:1.6rem;margin-bottom:12px}p{opacity:.9;line-height:1.6}</style></head><body><main><h1>Chocomedley environment setup needed</h1><p>The app is online, but Hostinger still has a missing or placeholder SESSION_SECRET. Add a real SESSION_SECRET in Environment variables and redeploy.</p></main></body></html>');
});

app.use((req, res, next) => {
  if (storageStatus.ready) return next();
  res.status(503).type('html').send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chocomedley is starting up</title><style>body{font-family:system-ui,Segoe UI,sans-serif;background:#1b1210;color:#fdf6f0;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}main{max-width:520px;text-align:center}h1{font-size:1.6rem;margin-bottom:12px}p{opacity:.85;line-height:1.6}</style></head><body><main><h1>Chocomedley is getting ready</h1><p>Our store is finishing its setup and will be back in a few minutes. Please try again shortly.</p></main></body></html>');
});

class FileSessionStore extends session.Store {
  constructor(file) {
    super();
    this.file = file;
  }

  readAll() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (_) {
      return {};
    }
  }

  writeAll(data) {
    const temporary = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
    fs.renameSync(temporary, this.file);
  }

  get(sid, cb) {
    const sessions = this.readAll();
    const entry = sessions[sid];
    if (!entry) return cb(null);
    if (entry.expires && Date.now() > entry.expires) {
      delete sessions[sid];
      this.writeAll(sessions);
      return cb(null);
    }
    cb(null, entry.session);
  }

  set(sid, sess, cb) {
    const sessions = this.readAll();
    sessions[sid] = {
      expires: sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 1000 * 60 * 60 * 8,
      session: sess
    };
    this.writeAll(sessions);
    cb?.(null);
  }

  destroy(sid, cb) {
    const sessions = this.readAll();
    delete sessions[sid];
    this.writeAll(sessions);
    cb?.(null);
  }
}

if (SESSION_SECRET) {
  app.use(session({
    name: 'chocomedley.sid',
    store: new FileSessionStore(path.join(DATA_DIR, 'sessions.json')),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' ? 'auto' : false, maxAge: 1000 * 60 * 60 * 8 }
  }));
}

const ACTIVE_VISITOR_WINDOW_MS = 5 * 60 * 1000;
const activeStorefrontVisitors = new Map();
const storefrontVisitorFingerprints = new Map();

function requestCookie(req, name) {
  const prefix = `${name}=`;
  return String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(prefix))?.slice(prefix.length) || '';
}

function pruneStorefrontVisitors(now) {
  for (const [visitor, lastSeen] of activeStorefrontVisitors) {
    if (now - lastSeen > ACTIVE_VISITOR_WINDOW_MS) activeStorefrontVisitors.delete(visitor);
  }
  for (const [fingerprint, entry] of storefrontVisitorFingerprints) {
    if (now - entry.lastSeen > ACTIVE_VISITOR_WINDOW_MS) storefrontVisitorFingerprints.delete(fingerprint);
  }
  while (activeStorefrontVisitors.size > 5000) activeStorefrontVisitors.delete(activeStorefrontVisitors.keys().next().value);
  while (storefrontVisitorFingerprints.size > 5000) storefrontVisitorFingerprints.delete(storefrontVisitorFingerprints.keys().next().value);
}

function storefrontVisitorId(req, res, now) {
  const fromCookie = requestCookie(req, 'chocomedley.visitor');
  if (/^[a-f0-9]{32}$/.test(fromCookie)) return fromCookie;
  const fingerprint = crypto.createHash('sha256').update(`${req.ip}|${req.get('user-agent') || 'unknown'}`).digest('hex').slice(0, 32);
  const known = storefrontVisitorFingerprints.get(fingerprint);
  const visitorId = known && now - known.lastSeen <= ACTIVE_VISITOR_WINDOW_MS ? known.visitorId : crypto.randomBytes(16).toString('hex');
  storefrontVisitorFingerprints.set(fingerprint, { visitorId, lastSeen: now });
  res.cookie('chocomedley.visitor', visitorId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
  return visitorId;
}

// Funnel analytics: counts are buffered in memory and flushed to storage in batches
// (see flushAnalytics/start()) rather than on every request, so tracking never adds a
// database write to the hot path of a page view or cart action.
let analyticsDeltas = {};
let dailySeenVisitors = new Set();
let dailySeenVisitorsDateKey = '';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function bumpAnalytics(key, amount = 1) {
  const dateKey = todayKey();
  const day = analyticsDeltas[dateKey] || (analyticsDeltas[dateKey] = {});
  day[key] = (day[key] || 0) + amount;
}

function trackVisitorForAnalytics(visitorId) {
  const dateKey = todayKey();
  if (dateKey !== dailySeenVisitorsDateKey) {
    dailySeenVisitors = new Set();
    dailySeenVisitorsDateKey = dateKey;
  }
  if (!dailySeenVisitors.has(visitorId)) {
    dailySeenVisitors.add(visitorId);
    bumpAnalytics('uniqueVisitors', 1);
  }
}

async function flushAnalytics() {
  const pending = analyticsDeltas;
  analyticsDeltas = {};
  const dateKeys = Object.keys(pending);
  if (!dateKeys.length) return;
  try {
    await refreshMysqlCache();
    const db = readDb();
    db.analytics = db.analytics && typeof db.analytics === 'object' ? db.analytics : {};
    for (const dateKey of dateKeys) {
      const day = db.analytics[dateKey] || (db.analytics[dateKey] = {});
      for (const [key, amount] of Object.entries(pending[dateKey])) {
        day[key] = (Number(day[key]) || 0) + amount;
      }
    }
    const cutoff = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const dateKey of Object.keys(db.analytics)) {
      if (dateKey < cutoff) delete db.analytics[dateKey];
    }
    await writeDb(db);
  } catch (error) {
    console.error('[analytics] Flush failed, will retry next cycle:', error.code || error.message);
    for (const dateKey of dateKeys) {
      const day = analyticsDeltas[dateKey] || (analyticsDeltas[dateKey] = {});
      for (const [key, amount] of Object.entries(pending[dateKey])) {
        day[key] = (day[key] || 0) + amount;
      }
    }
  }
}

app.use((req, res, next) => {
  if (!req.path.startsWith('/admin') && !req.path.startsWith('/assets') && !req.path.startsWith('/img') && !req.path.startsWith('/catalog') && !req.path.startsWith('/uploads') && !['/healthz', '/store-activity', '/robots.txt', '/sitemap.xml'].includes(req.path)) {
    const now = Date.now();
    const visitorId = storefrontVisitorId(req, res, now);
    activeStorefrontVisitors.set(visitorId, now);
    pruneStorefrontVisitors(now);
    if (req.method === 'GET') {
      bumpAnalytics('visits', 1);
      trackVisitorForAnalytics(visitorId);
    }
  }
  next();
});

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const imageFileFilter = (_, file, cb) => {
  if (allowedImageTypes.has(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPG, PNG, or WEBP images can be uploaded.'));
};
const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `custom-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_ORDER_QUANTITY, fields: 120 },
  fileFilter: imageFileFilter
});
const productUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, PRODUCT_UPLOAD_DIR),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `product-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 13, fields: 120 },
  fileFilter: imageFileFilter
});

function seed() {
  return {
    admins: demoAdmins(),
    adminResetTokens: [],
    settings: {
      storeName: 'Chocomedley',
      logoPath: '/img/WhatsApp Image 2026-08-12 at 1.24.57 PM.jpeg',
      contactPhone: '+91 98765 43210',
      whatsappNumber: PUBLIC_WHATSAPP_NUMBER,
      supportEmail: DEFAULT_ORDER_EMAIL,
      storeAddress: 'Artisan chocolate kitchen, India',
      shippingFee: 0,
      freeShippingEnabled: true,
      freeShippingMinimum: 0,
      codEnabled: true,
      deliveryText: 'Freshly prepared and usually delivered in 4-5 days.'
    },
    product: {
      id: 1,
      name: 'Rakhi Chocolate Hamper',
      slug: 'rakhi-chocolate-hamper',
      shortDescription: 'A handcrafted chocolate hamper made for gifting, celebrations, and sweet everyday moments.',
      longDescription: 'The Rakhi Chocolate Hamper brings together 9 rich homemade chocolates in a premium gift-ready presentation. Add a custom image, choose extra almonds, and make the hamper personal without slowing down checkout.',
      basePrice: 1000,
      offerPrice: '',
      imagePath: PRODUCT_IMAGES[0],
      galleryPaths: PRODUCT_IMAGES,
      active: true,
      codAvailable: true,
      deliveryText: 'Delivered in 4-5 days.',
      details: 'A premium personalized chocolate hamper with photo-printed chocolates, gift-ready packaging, and a refined handmade finish. Built for birthdays, Rakhi, celebrations, return gifts, and thoughtful personal gifting.',
      ingredients: 'Milk chocolate, cocoa solids, sugar, cocoa butter, almonds when selected, and permitted food-grade colors. Contains dairy and may contain traces of nuts.',
      care: CARE_COPY,
      faq: 'Can I upload my own image?|Yes. Upload a clear JPG, PNG, or WEBP image while customizing the hamper.\nCan I add a name or message?|Yes. Use the name and message fields in the customization panel.\nIs Cash on Delivery available?|Yes, COD is available for eligible orders.\nWill the price update automatically?|Yes. Quantity and paid customizations update the total instantly, and the server recalculates it again during checkout.'
    },
    options: [
      { id: 1, title: 'Add Custom Image', description: 'Upload a photo to personalize your hamper.', type: 'file', choices: [], price: 100, required: false, active: true, uploadRequired: false, order: 10 },
      { id: 2, title: 'Extra Almonds', description: 'Add a generous almond topping to the hamper.', type: 'checkbox', choices: [], price: 80, required: false, active: true, uploadRequired: false, order: 20 },
      { id: 4, title: 'Gift Message', description: 'Write a small note for the recipient.', type: 'textarea', choices: [], price: 0, required: false, active: true, uploadRequired: false, order: 40, maxLength: 250, placeholder: 'Your message' }
    ],
    orders: [],
    coupons: [],
    analytics: {},
    nextOrderNumber: 10001,
    nextOptionId: 5,
    nextCouponId: 1
  };
}

function demoAdmins() {
  if (!DEMO_ADMIN_ENABLED || DEMO_ADMIN_PASSWORD.length < 10) return [];
  return [demoAdminRecord()];
}

function demoAdminRecord(existing = {}) {
  return {
    ...existing,
    id: existing.id || 'render-demo-admin',
    name: existing.name || 'Admin',
    email: DEMO_ADMIN_EMAIL.trim().toLowerCase(),
    passwordHash: bcrypt.hashSync(DEMO_ADMIN_PASSWORD, 12),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function ensureDemoAdmin(data) {
  if (!DEMO_ADMIN_ENABLED || DEMO_ADMIN_PASSWORD.length < 10) return false;
  if (!Array.isArray(data.admins)) data.admins = [];
  const email = DEMO_ADMIN_EMAIL.trim().toLowerCase();
  const existing = data.admins.find(admin => admin.id === 'render-demo-admin' || admin.email === email);
  if (!existing) {
    data.admins.push(demoAdminRecord());
    return true;
  }
  let changed = false;
  if (existing.email !== email) {
    existing.email = email;
    changed = true;
  }
  if (!existing.name) {
    existing.name = 'Admin';
    changed = true;
  }
  if (!existing.passwordHash || !bcrypt.compareSync(DEMO_ADMIN_PASSWORD, existing.passwordHash)) {
    existing.passwordHash = bcrypt.hashSync(DEMO_ADMIN_PASSWORD, 12);
    changed = true;
  }
  if (changed) existing.updatedAt = new Date().toISOString();
  return changed;
}

function ensureRecoveryAdmin(data) {
  if (!ADMIN_RECOVERY_EMAIL && !ADMIN_RECOVERY_PASSWORD) return false;
  if (!ADMIN_RECOVERY_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_RECOVERY_EMAIL) || ADMIN_RECOVERY_PASSWORD.length < 12 || !/[A-Za-z]/.test(ADMIN_RECOVERY_PASSWORD) || !/\d/.test(ADMIN_RECOVERY_PASSWORD)) {
    console.warn('[boot] ADMIN_RECOVERY_EMAIL/ADMIN_RECOVERY_PASSWORD is incomplete or invalid; recovery credentials were not applied.');
    return false;
  }
  if (!Array.isArray(data.admins)) data.admins = [];
  const existing = data.admins.find(admin => admin.email === ADMIN_RECOVERY_EMAIL);
  if (existing && existing.passwordHash && bcrypt.compareSync(ADMIN_RECOVERY_PASSWORD, existing.passwordHash)) return false;
  const record = existing || { id: crypto.randomUUID(), name: 'Store Admin', email: ADMIN_RECOVERY_EMAIL, createdAt: new Date().toISOString() };
  record.passwordHash = bcrypt.hashSync(ADMIN_RECOVERY_PASSWORD, 12);
  record.updatedAt = new Date().toISOString();
  if (!existing) data.admins.push(record);
  return true;
}

let mysqlPool = null;
let dbCache = null;
let dbCacheVersion = 0;
let storageWriteQueue = Promise.resolve();

function mysqlConfig() {
  const raw = {
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME
  };
  const resolved = {
    DB_HOST: isPlaceholderValue(raw.DB_HOST) ? HOSTINGER_DEFAULTS.dbHost : String(raw.DB_HOST).trim(),
    DB_USER: isPlaceholderValue(raw.DB_USER) ? HOSTINGER_DEFAULTS.dbUser : String(raw.DB_USER).trim(),
    DB_PASSWORD: raw.DB_PASSWORD,
    DB_NAME: isPlaceholderValue(raw.DB_NAME) ? HOSTINGER_DEFAULTS.dbName : String(raw.DB_NAME).trim()
  };
  for (const key of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
    if (isPlaceholderValue(raw[key])) console.warn(`[boot] ${key} is missing or placeholder; using Hostinger production default ${resolved[key]}.`);
  }
  const missing = ['DB_PASSWORD'].filter(key => isPlaceholderValue(resolved[key]));
  if (missing.length) {
    throw new Error(`DB_DRIVER=mysql but these environment variables are missing or still placeholders: ${missing.join(', ')}`);
  }
  let host = resolved.DB_HOST;
  if (host === 'localhost') {
    host = '127.0.0.1';
    console.warn('[boot] DB_HOST=localhost resolves to ::1 on this host; connecting to 127.0.0.1 instead.');
  }
  return {
    host,
    port: Number(process.env.DB_PORT || 3306),
    user: resolved.DB_USER,
    password: resolved.DB_PASSWORD,
    database: resolved.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
    connectTimeout: 5000,
    charset: 'utf8mb4'
  };
}

async function initMysqlStorage() {
  const mysql = require('mysql2/promise');
  const config = mysqlConfig();
  console.log(`[boot] Connecting to MySQL ${config.user}@${config.host}:${config.port}/${config.database}`);
  mysqlPool = mysql.createPool(config);
  await mysqlPool.query('CREATE TABLE IF NOT EXISTS app_state (state_key VARCHAR(64) PRIMARY KEY, state_json LONGTEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  const [rows] = await mysqlPool.query('SELECT state_json FROM app_state WHERE state_key = ?', ['store']);
  if (rows[0]?.state_json) {
    dbCache = JSON.parse(rows[0].state_json);
    console.log('[boot] Loaded existing store state from MySQL.');
  } else {
    dbCache = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : seed();
    await writeStoredDb(dbCache);
    console.log('[boot] Seeded store state into MySQL.');
  }
}

async function initStorage() {
  if (DB_DRIVER === 'mysql') {
    try {
      await initMysqlStorage();
    } catch (error) {
      if (mysqlPool) {
        const pool = mysqlPool;
        mysqlPool = null;
        await pool.end().catch(() => {});
      }
      throw error;
    }
    return;
  }
  if (DB_DRIVER !== 'json') throw new Error(`DB_DRIVER must be "mysql" or "json" (received "${DB_DRIVER}").`);
  if (process.env.NODE_ENV === 'production') {
    console.warn('[boot] WARNING: NODE_ENV=production with DB_DRIVER=json. Live customer data belongs in MySQL — set DB_DRIVER=mysql.');
  }
  dbCache = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : seed();
  if (!fs.existsSync(DB_FILE)) await writeStoredDb(dbCache);
}

function readStoredDb() {
  return dbCache ? JSON.parse(JSON.stringify(dbCache)) : null;
}

async function writeStoredDb(data) {
  const snapshot = JSON.parse(JSON.stringify(data));
  dbCache = snapshot;
  dbCacheVersion += 1;
  const write = storageWriteQueue.catch(() => {}).then(async () => {
    if (mysqlPool) {
      await mysqlPool.query(
        'INSERT INTO app_state (state_key, state_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_json = VALUES(state_json)',
        ['store', JSON.stringify(snapshot)]
      );
      return;
    }
    const temporary = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(snapshot, null, 2));
    fs.renameSync(temporary, DB_FILE);
  });
  storageWriteQueue = write;
  await write;
}

// Multiple app instances can share the same MySQL-backed store, and each keeps its own
// in-memory dbCache for speed. Without this, an order written by one instance can stay
// invisible to admins landing on another instance until that instance happens to write.
// The version check discards the refreshed snapshot if a newer local write raced ahead of it.
async function refreshMysqlCache() {
  if (!mysqlPool) return;
  const versionBeforeFetch = dbCacheVersion;
  try {
    const [rows] = await mysqlPool.query('SELECT state_json FROM app_state WHERE state_key = ?', ['store']);
    if (rows[0]?.state_json && dbCacheVersion === versionBeforeFetch) {
      dbCache = JSON.parse(rows[0].state_json);
    }
  } catch (error) {
    console.error('[storage] Cache refresh from MySQL failed:', error.code || error.message);
  }
}

function readDb() {
  let data = readStoredDb();
  if (!data) {
    data = seed();
    void writeDb(data);
  }
  let changed = false;
  if (!Array.isArray(data.admins)) {
    data.admins = [];
    changed = true;
  }
  if (!Array.isArray(data.adminResetTokens)) {
    data.adminResetTokens = [];
    changed = true;
  }
  if (!Array.isArray(data.coupons)) {
    data.coupons = [];
    changed = true;
  }
  if (!data.analytics || typeof data.analytics !== 'object' || Array.isArray(data.analytics)) {
    data.analytics = {};
    changed = true;
  }
  const activeResetTokens = data.adminResetTokens.filter(token => Number(token.expiresAt) > Date.now());
  if (activeResetTokens.length !== data.adminResetTokens.length) {
    data.adminResetTokens = activeResetTokens;
    changed = true;
  }
  if (data.product?.name === 'Rocky Chocolate Hamper') {
    data.product.name = 'Rakhi Chocolate Hamper';
    data.product.slug = 'rakhi-chocolate-hamper';
    data.product.longDescription = String(data.product.longDescription || '').replaceAll('Rocky Chocolate Hamper', 'Rakhi Chocolate Hamper');
    changed = true;
  }
  for (const order of data.orders || []) {
    for (const item of order.items || []) {
      if (item.productName === 'Rocky Chocolate Hamper') {
        item.productName = 'Rakhi Chocolate Hamper';
        changed = true;
      }
    }
  }
  if (!Array.isArray(data.product.galleryPaths) || !data.product.galleryPaths.length) {
    data.product.galleryPaths = PRODUCT_IMAGES;
    changed = true;
  }
  const migrateCatalogPath = value => {
    const publicPath = String(value || '');
    if (!publicPath.startsWith('/uploads/')) return publicPath;
    const filename = path.basename(publicPath);
    const source = path.join(UPLOAD_DIR, filename);
    const destination = path.join(PRODUCT_UPLOAD_DIR, filename);
    try {
      if (fs.existsSync(source) && !fs.existsSync(destination)) fs.copyFileSync(source, destination);
      if (fs.existsSync(destination)) return `/catalog/${filename}`;
    } catch (error) {
      console.error('[catalog] Could not migrate product image:', error.code || error.message);
    }
    return publicPath;
  };
  const migratedImagePath = migrateCatalogPath(data.product.imagePath);
  const migratedGalleryPaths = data.product.galleryPaths.map(migrateCatalogPath);
  if (migratedImagePath !== data.product.imagePath || migratedGalleryPaths.some((value, index) => value !== data.product.galleryPaths[index])) {
    data.product.imagePath = migratedImagePath;
    data.product.galleryPaths = migratedGalleryPaths;
    changed = true;
  }
  const currentBasePrice = Number(data.product.basePrice || 0);
  const currentOfferPrice = Number(data.product.offerPrice || 0);
  if (currentOfferPrice && (currentOfferPrice >= currentBasePrice || currentOfferPrice < 0)) {
    data.product.offerPrice = '';
    changed = true;
  }
  if (ensureDemoAdmin(data)) changed = true;
  if (ensureRecoveryAdmin(data)) changed = true;
  if (PUBLIC_WHATSAPP_NUMBER && data.settings?.whatsappNumber !== PUBLIC_WHATSAPP_NUMBER) {
    data.settings.whatsappNumber = PUBLIC_WHATSAPP_NUMBER;
    changed = true;
  }
  if (DEFAULT_ORDER_EMAIL && data.settings?.supportEmail && data.settings.supportEmail !== DEFAULT_ORDER_EMAIL && /^(?:hello|chocomedley)@chocomedley\.in$|^chocomedley@gmail\.com$/i.test(data.settings.supportEmail)) {
    data.settings.supportEmail = DEFAULT_ORDER_EMAIL;
    changed = true;
  }
  if (data.settings?.deliveryText && /1-2\s*business days/i.test(data.settings.deliveryText)) {
    data.settings.deliveryText = 'Freshly prepared and usually delivered in 4-5 days.';
    changed = true;
  }
  if (Number(data.settings?.shippingFee || 0) !== 0 || data.settings?.freeShippingEnabled !== true || Number(data.settings?.freeShippingMinimum || 0) !== 0) {
    data.settings.shippingFee = 0;
    data.settings.freeShippingEnabled = true;
    data.settings.freeShippingMinimum = 0;
    changed = true;
  }
  if (!data.product.imagePath || data.product.imagePath.includes('2026-08-12')) {
    data.product.imagePath = PRODUCT_IMAGES[0];
    changed = true;
  }
  const ensureOption = option => {
    if (!data.options.some(existing => existing.id === option.id || existing.title === option.title)) {
      data.options.push(option);
      changed = true;
    }
  };
  ensureOption({ id: 4, title: 'Gift Message', description: 'Write a small note for the recipient.', type: 'textarea', choices: [], price: 0, required: false, active: true, uploadRequired: false, order: 40, maxLength: 250, placeholder: 'Your message' });
  for (const option of data.options || []) {
    if (option.type === 'file' && /custom image|photo|image/i.test(option.title || '') && (option.required || option.uploadRequired)) {
      option.required = false;
      option.uploadRequired = false;
      changed = true;
    }
  }
  const beforeOptionCount = data.options.length;
  data.options = data.options.filter(option => option.title !== 'Name to Print');
  if (data.options.length !== beforeOptionCount) changed = true;
  const seeded = seed().product;
  if (data.product.ingredients && /edible print layer/i.test(data.product.ingredients)) {
    data.product.ingredients = String(data.product.ingredients)
      .replace(/\s*,?\s*edible print layer\s*,?/ig, ',')
      .replace(/,\s*,/g, ',')
      .replace(/\s+,/g, ',')
      .replace(/,\s*and/g, ' and')
      .replace(/\s{2,}/g, ' ')
      .trim();
    changed = true;
  }
  if (!data.product.care || /below\s*25|Best enjoyed at room temperature|strong odors/i.test(data.product.care)) {
    data.product.care = CARE_COPY;
    changed = true;
  }
  if (data.product.longDescription && !/\b9\b/.test(data.product.longDescription)) {
    data.product.longDescription = String(data.product.longDescription).replace('brings together rich homemade chocolates', 'brings together 9 rich homemade chocolates');
    changed = true;
  }
  if (data.product.deliveryText && /1-2\s*business days/i.test(data.product.deliveryText)) {
    data.product.deliveryText = 'Delivered in 4-5 days.';
    changed = true;
  }
  ['details', 'ingredients', 'care', 'faq'].forEach(key => {
    if (!data.product[key]) {
      data.product[key] = seeded[key];
      changed = true;
    }
  });
  const nextOrderFromExisting = Math.max(
    10001,
    ...(data.orders || []).map(order => {
      const suffix = String(order.orderId || '').match(/(\d+)$/);
      return suffix ? Number(suffix[1]) + 1 : 10001;
    })
  );
  const normalizedNextOrderNumber = Math.max(Number(data.nextOrderNumber || 10001), nextOrderFromExisting);
  if (data.nextOrderNumber !== normalizedNextOrderNumber) {
    data.nextOrderNumber = normalizedNextOrderNumber;
    changed = true;
  }
  data.nextOptionId = Math.max(Number(data.nextOptionId || 1), ...data.options.map(o => Number(o.id || 0) + 1), 5);
  data.nextCouponId = Math.max(Number(data.nextCouponId || 1), ...data.coupons.map(c => Number(c.id || 0) + 1), 1);
  if (changed) void writeDb(data);
  return data;
}

async function writeDb(data) {
  await writeStoredDb(data);
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function sellingPrice(product) {
  const base = Number(product.basePrice || 0);
  const offer = Number(product.offerPrice || 0);
  return offer > 0 && offer < base ? offer : base;
}

function hasValidOffer(product) {
  const base = Number(product.basePrice || 0);
  const offer = Number(product.offerPrice || 0);
  return offer > 0 && offer < base;
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function normalizePublicPath(value = '') {
  const trimmed = String(value || '').trim().replaceAll('\\', '/');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) return trimmed;
  return `/${trimmed.replace(/^public\//, '')}`;
}

function uploadedPublicPath(file) {
  return file ? `/catalog/${file.filename}` : '';
}

function whatsappDigits(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function whatsappUrl(settings, message = '') {
  const digits = whatsappDigits(settings.whatsappNumber || settings.contactPhone);
  if (!digits) return '';
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${query}`;
}

function whatsappCta(settings, label, message, extraClass = '') {
  const url = whatsappUrl(settings, message);
  return url ? `<a class="btn whatsapp ${extraClass}" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : '';
}

function cleanPlainText(value = '') {
  return String(value || '').replace(/[^\p{L}\p{N}\s.,'&()/:\u00b0\u2013-]/gu, '').replace(/\s+/g, ' ').trim();
}

function cleanName(value = '') {
  return String(value || '').replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

function requireName(value, label) {
  const raw = String(value || '').trim();
  if (!/^[\p{L}][\p{L}\s]{1,79}$/u.test(raw)) throw new Error(`${label} must use letters only.`);
  return cleanName(raw);
}

function parseMoneyField(value, label, required = false) {
  const raw = String(value || '').trim();
  if (!raw) {
    if (required) throw new Error(`${label} must be a number.`);
    return '';
  }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`${label} must be a number only.`);
  return Number(raw);
}

function parseWholeNumberField(value, label, fallback = 0) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must be a whole number only.`);
  return Number(raw);
}

function requireLength(value, label, min, max) {
  const text = cleanPlainText(value);
  if (text.length < min || text.length > max) throw new Error(`${label} must be between ${min} and ${max} characters.`);
  return text;
}

function optionalEmail(value, label = 'Email') {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${label} is not valid.`);
  return email;
}

function requirePhone(value, label) {
  const formatted = String(value || '').replace(/[^\d+\s()-]/g, '').trim();
  const digits = formatted.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new Error(`${label} must contain 10 to 15 digits.`);
  return formatted;
}

function optionalIsoDate(value, label) {
  const date = String(value || '').trim();
  if (!date) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`${label} must be a valid date.`);
  }
  return date;
}

function validatePublicPath(value, label, allowBlank = false) {
  const normalized = normalizePublicPath(value);
  if (!normalized && allowBlank) return '';
  if (!/^\/(?:img|catalog)\/[\p{L}\p{N} ._()\-/%]+$/u.test(normalized)) {
    throw new Error(`${label} must use an /img/ or /catalog/ path.`);
  }
  return normalized;
}

function parseFaq(value) {
  const lines = String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Add at least one FAQ as Question|Answer.');
  if (lines.length > 12) throw new Error('A maximum of 12 FAQs is supported.');
  return lines.map((line, index) => {
    const separator = line.indexOf('|');
    if (separator < 3 || separator === line.length - 1) throw new Error(`FAQ line ${index + 1} must use Question|Answer.`);
    const question = requireLength(line.slice(0, separator), `FAQ question ${index + 1}`, 3, 160);
    const answer = requireLength(line.slice(separator + 1), `FAQ answer ${index + 1}`, 3, 500);
    return `${question}|${answer}`;
  }).join('\n');
}

function requireOptionType(value) {
  const type = String(value || '').trim();
  if (!['checkbox', 'file', 'text', 'textarea', 'select'].includes(type)) throw new Error('Choose a valid customization type.');
  return type;
}

function cleanLines(value = '') {
  return String(value || '').split(/\r?\n/).map(cleanPlainText).filter(Boolean);
}

function normalizedOptionInput(body) {
  const type = requireOptionType(body.type);
  const choices = cleanLines(body.choices).filter((choice, index, all) => all.indexOf(choice) === index);
  const maxLength = parseWholeNumberField(body.maxLength, 'Character Limit', 0);
  const order = parseWholeNumberField(body.order, 'Display Order', 50);
  if (order > 999) throw new Error('Display Order must be between 0 and 999.');
  if (maxLength > 1000) throw new Error('Character Limit cannot exceed 1000.');
  if (type === 'select' && choices.length < 2) throw new Error('Dropdown options need at least two unique choices.');
  return {
    title: requireName(body.title, 'Customization title'),
    description: requireLength(body.description, 'Description', 4, 240),
    type,
    choices: type === 'select' ? choices : [],
    price: parseMoneyField(body.price, 'Price') || 0,
    required: ['text', 'textarea', 'select'].includes(type) && Boolean(body.required),
    active: Boolean(body.active),
    uploadRequired: type === 'file' && Boolean(body.uploadRequired),
    order,
    maxLength: ['text', 'textarea'].includes(type) && maxLength ? maxLength : '',
    placeholder: ['text', 'textarea'].includes(type) ? cleanPlainText(body.placeholder).slice(0, 120) : ''
  };
}

function normalizeCouponCode(value = '') {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

function normalizedCouponInput(db, body, excludeId = null) {
  const code = normalizeCouponCode(body.code);
  if (code.length < 3) throw new Error('Coupon code must be at least 3 letters or numbers.');
  const type = body.type === 'flat' ? 'flat' : 'percent';
  const value = parseMoneyField(body.value, 'Discount value', true);
  if (type === 'percent' && (value <= 0 || value > 100)) throw new Error('Percent discount must be between 1 and 100.');
  if (type === 'flat' && value <= 0) throw new Error('Flat discount amount must be greater than 0.');
  if (db.coupons.some(c => c.code === code && String(c.id) !== String(excludeId))) throw new Error('A coupon with this code already exists.');
  return { code, type, value, active: Boolean(body.active) };
}

function findActiveCoupon(db, code) {
  const normalized = normalizeCouponCode(code);
  return normalized ? db.coupons.find(c => c.code === normalized && c.active) || null : null;
}

function couponDiscount(coupon, subtotal) {
  if (!coupon || !(subtotal > 0)) return 0;
  const raw = coupon.type === 'percent' ? (subtotal * Number(coupon.value)) / 100 : Number(coupon.value);
  return Math.max(0, Math.min(subtotal, Math.round(raw)));
}

function orderUploads(order) {
  return (order.items || []).flatMap(item => (item.customizations || []).filter(c => c.uploadedPath));
}

function uploadFilename(uploadedPath = '') {
  const cleanPath = String(uploadedPath || '').split('?')[0].replaceAll('\\', '/');
  return path.basename(cleanPath);
}

function removeFiles(files = []) {
  for (const file of files) {
    const filePath = typeof file === 'string' ? file : file?.path;
    if (!filePath) continue;
    try { fs.unlinkSync(filePath); } catch (error) {
      if (error.code !== 'ENOENT') console.error('[upload] Could not remove file:', error.code || error.message);
    }
  }
}

function removeCustomizationUploads(customizations = []) {
  removeFiles(customizations.map(customization => {
    const filename = uploadFilename(customization.uploadedPath);
    return filename ? path.join(UPLOAD_DIR, filename) : '';
  }));
}

function hasValidImageSignature(file) {
  if (!file?.path || !fs.existsSync(file.path)) return false;
  const handle = fs.openSync(file.path, 'r');
  const header = Buffer.alloc(12);
  try { fs.readSync(handle, header, 0, header.length, 0); } finally { fs.closeSync(handle); }
  const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const png = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
  return jpeg || png || webp;
}

function assertUploadedImages(files = []) {
  const invalid = files.find(file => !hasValidImageSignature(file));
  if (invalid) throw new Error(`${invalid.originalname || 'An uploaded file'} is not a valid JPG, PNG, or WEBP image.`);
}

function uploadDownloadPath(uploadedPath = '') {
  const filename = uploadFilename(uploadedPath);
  return filename ? `/admin/uploads/${encodeURIComponent(filename)}/download` : '';
}

function uploadPreviewPath(uploadedPath = '') {
  const filename = uploadFilename(uploadedPath);
  return filename ? `/admin/uploads/${encodeURIComponent(filename)}/view` : '';
}

function orderUploadPreview(order, compact = true) {
  const uploads = orderUploads(order);
  if (!uploads.length) return '<span class="muted">No image</span>';
  if (compact) {
    const count = uploads.length;
    const visibleUploads = uploads.slice(0, 3);
    const remaining = Math.max(0, count - visibleUploads.length);
    const orderUrl = `/admin/orders/${encodeURIComponent(order.orderId)}#uploaded-designs`;
    const thumbnails = visibleUploads.map((upload, index) => `<img loading="lazy" decoding="async" src="${esc(uploadPreviewPath(upload.uploadedPath))}" alt="Design ${index + 1} preview">`).join('');
    return `<a class="design-summary" href="${esc(orderUrl)}" aria-label="View ${count} uploaded design${count === 1 ? '' : 's'} for order ${esc(order.orderId)}"><span class="design-stack">${thumbnails}${remaining ? `<span class="design-count">+${remaining}</span>` : ''}</span><span class="design-summary-copy"><strong>${count} design${count === 1 ? '' : 's'}</strong><small>View and download</small></span></a>`;
  }
  return `<div class="design-grid full">${uploads.map((upload, index) => {
    const label = `Design ${index + 1}`;
    const original = upload.originalName || upload.value || label;
    const download = uploadDownloadPath(upload.uploadedPath);
    const preview = uploadPreviewPath(upload.uploadedPath);
    return `<article class="design-card"><a class="design-thumb" href="${esc(preview)}" target="_blank" rel="noopener" title="Open ${esc(original)}"><img loading="lazy" decoding="async" src="${esc(preview)}" alt="${esc(label)}"><span>View ${index + 1}</span></a><a class="design-download" href="${esc(download)}">Download</a></article>`;
  }).join('')}</div>`;
}

function statusOptions(current) {
  return statuses.map(s => `<option value="${esc(s)}" ${current === s ? 'selected' : ''}>${esc(s)}</option>`).join('');
}

let mailTransporter = null;

function smtpSettings() {
  let password = isPlaceholderValue(process.env.SMTP_PASSWORD) ? '' : String(process.env.SMTP_PASSWORD || '').trim();
  const user = isPlaceholderValue(process.env.SMTP_USER) ? DEFAULT_ORDER_EMAIL : String(process.env.SMTP_USER || DEFAULT_ORDER_EMAIL).trim();
  const host = isPlaceholderValue(process.env.SMTP_HOST) ? 'smtp.gmail.com' : String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  if (/gmail\.com$/i.test(host)) password = password.replace(/\s+/g, '');
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const from = isPlaceholderValue(process.env.SMTP_FROM) ? `Chocomedley <${user}>` : String(process.env.SMTP_FROM || `Chocomedley <${user}>`).trim();
  const replyTo = isPlaceholderValue(process.env.SMTP_REPLY_TO) ? user : String(process.env.SMTP_REPLY_TO || user).trim();
  return { host, port, secure, user, password, from, replyTo };
}

function smtpConfigured() {
  const settings = smtpSettings();
  return Boolean(settings.host && settings.user && settings.password && settings.from);
}

function passwordMeetsPolicy(password) {
  return password.length >= 12 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function resetTokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function requestOrigin(req) {
  return PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`;
}

async function sendTransactionalEmail({ to, subject, text, html }) {
  if (!smtpConfigured()) throw new Error('SMTP is not configured. Add the Gmail App Password in Hostinger.');
  const settings = smtpSettings();
  return smtpTransporter().sendMail({
    from: settings.from,
    to,
    replyTo: settings.replyTo || undefined,
    subject,
    text,
    html
  });
}

function smtpTransporter() {
  if (!smtpConfigured()) return null;
  if (!mailTransporter) {
    const settings = smtpSettings();
    mailTransporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: settings.password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }
  return mailTransporter;
}

async function notifyOrderStatus(order, previousStatus, nextStatus) {
  const at = new Date().toISOString();
  const event = {
    at,
    to: order.email || '',
    orderId: order.orderId,
    previousStatus,
    status: nextStatus,
    subject: `Order ${order.orderId} status updated`,
    text: `Hi ${order.customerName}, your Chocomedley order ${order.orderId} is now ${nextStatus}.`
  };
  order.emailNotifications = order.emailNotifications || [];
  const notification = {
    at,
    to: event.to,
    status: nextStatus,
    result: !event.to ? 'skipped' : smtpConfigured() ? 'sending' : 'not-configured',
    message: !event.to ? 'Customer email missing.' : smtpConfigured() ? 'Sending email notification.' : 'SMTP is not configured; notification logged but not sent.'
  };
  order.emailNotifications.unshift(notification);
  if (event.to) {
    try {
      fs.appendFileSync(path.join(LOG_DIR, 'email-outbox.jsonl'), `${JSON.stringify(event)}\n`);
    } catch (error) {
      console.error('[warn] Could not write email outbox log:', error.code || error.message);
      notification.message = `Could not write email log (${error.code || 'unknown error'}).`;
    }
    if (smtpConfigured()) {
      try {
        const settings = smtpSettings();
        await smtpTransporter().sendMail({
          from: settings.from,
          to: event.to,
          replyTo: settings.replyTo || undefined,
          subject: event.subject,
          text: `${event.text}\n\nTrack your order: https://chocomedley.com/track`,
          html: `<p>Hi ${esc(order.customerName)},</p><p>Your Chocomedley order <strong>${esc(order.orderId)}</strong> is now <strong>${esc(nextStatus)}</strong>.</p><p><a href="https://chocomedley.com/track">Track your order</a></p>`
        });
        notification.result = 'sent';
        notification.message = 'Email sent successfully.';
      } catch (error) {
        console.error('[email] Status email failed:', error.code || error.message);
        notification.result = 'failed';
        notification.message = `Email could not be sent (${error.code || 'delivery error'}).`;
      }
    }
  }
  if (!event.to || !smtpConfigured()) {
    console.warn(`[email] ${event.orderId} ${notification.result}: ${notification.message}`);
  }
  return notification;
}

function orderEmailBody(order) {
  const address = [order.addressLine1, order.addressLine2, order.landmark].filter(Boolean).map(esc).join(', ') + `, ${esc(order.city)}, ${esc(order.state)} ${esc(order.pinCode)}`;
  const itemsHtml = order.items.map(item => `<p><strong>${esc(item.productName)}</strong> x ${item.quantity} &mdash; ${money(item.lineTotal)}${item.customizations.length ? `<br><small>${item.customizations.map(c => `${esc(c.title)}: ${esc(c.value)}`).join('<br>')}</small>` : ''}</p>`).join('');
  const itemsText = order.items.map(item => `- ${item.productName} x ${item.quantity} (${money(item.lineTotal)})${item.customizations.length ? '\n  ' + item.customizations.map(c => `${c.title}: ${c.value}`).join('\n  ') : ''}`).join('\n');
  const discountHtml = order.discountAmount > 0 ? `<br><strong>Coupon (${esc(order.couponCode)}):</strong> -${money(order.discountAmount)}` : '';
  const discountText = order.discountAmount > 0 ? `\nCoupon (${order.couponCode}): -${money(order.discountAmount)}` : '';
  const pricingHtml = `<strong>Subtotal:</strong> ${money(order.subtotal)}${discountHtml}<br><strong>Total:</strong> ${money(order.total)}<br><strong>Payment:</strong> Cash on Delivery`;
  const pricingText = `Subtotal: ${money(order.subtotal)}${discountText}\nTotal: ${money(order.total)}\nPayment: Cash on Delivery`;
  return { address, itemsHtml, itemsText, pricingHtml, pricingText };
}

async function sendNewOrderEmails(db, order) {
  if (!smtpConfigured()) {
    console.warn(`[email] New order ${order.orderId}: SMTP is not configured; order emails were skipped.`);
    return;
  }
  const { address, itemsHtml, itemsText, pricingHtml, pricingText } = orderEmailBody(order);
  const adminTo = db.settings.supportEmail || DEFAULT_ORDER_EMAIL;
  if (adminTo) {
    try {
      await sendTransactionalEmail({
        to: adminTo,
        subject: `New order ${order.orderId} – ${money(order.total)}`,
        text: `New order received.\n\nOrder: ${order.orderId}\nCustomer: ${order.customerName}\nMobile: ${order.mobile}${order.alternateMobile ? ` / ${order.alternateMobile}` : ''}\nEmail: ${order.email || 'Not provided'}\nAddress: ${address.replace(/&mdash;/g, '-')}\n${order.customerNotes ? `Notes: ${order.customerNotes}\n` : ''}\nItems:\n${itemsText}\n\n${pricingText}\n\nView in admin: https://chocomedley.com/admin/orders/${order.orderId}`,
        html: `<h2>New order received</h2><p><strong>${esc(order.orderId)}</strong> &middot; ${money(order.total)}</p><p><strong>Customer:</strong> ${esc(order.customerName)}<br><strong>Mobile:</strong> ${esc(order.mobile)}${order.alternateMobile ? ` / ${esc(order.alternateMobile)}` : ''}<br><strong>Email:</strong> ${esc(order.email || 'Not provided')}</p><p><strong>Address:</strong><br>${address}</p>${order.customerNotes ? `<p><strong>Notes:</strong> ${esc(order.customerNotes)}</p>` : ''}<h3>Items</h3>${itemsHtml}<p>${pricingHtml}</p><p><a href="https://chocomedley.com/admin/orders/${esc(order.orderId)}">Open in admin</a></p>`
      });
    } catch (error) {
      console.error('[email] Admin new-order alert failed:', error.code || error.message);
    }
  }
  if (order.email) {
    try {
      await sendTransactionalEmail({
        to: order.email,
        subject: `Your Chocomedley order ${order.orderId} is confirmed`,
        text: `Hi ${order.customerName}, thank you for your order!\n\nOrder: ${order.orderId}\n\nItems:\n${itemsText}\n\n${pricingText}\n\nDelivery address:\n${address.replace(/&mdash;/g, '-')}\n\nTrack your order: https://chocomedley.com/track`,
        html: `<p>Hi ${esc(order.customerName)},</p><p>Thank you for your order! Here are your order details.</p><p><strong>Order ID:</strong> ${esc(order.orderId)}</p><h3>Items</h3>${itemsHtml}<p>${pricingHtml}</p><p><strong>Delivery address:</strong><br>${address}</p><p><a href="https://chocomedley.com/track">Track your order</a></p>`
      });
    } catch (error) {
      console.error('[email] Customer order confirmation failed:', error.code || error.message);
    }
  }
}

function csrf(req) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(32).toString('hex');
  return req.session.csrf;
}

function csrfField(req) {
  return `<input type="hidden" name="_csrf" value="${csrf(req)}">`;
}

function requireCsrf(req, res, next) {
  if ((req.path === '/cart/add' || req.path === '/buy-now' || req.path === '/admin/product') && req.is('multipart/form-data')) return next();
  if (req.method === 'GET' || req.body._csrf === req.session.csrf) return next();
  res.status(403).send(page(req, 'Security Check', `<main class="container"><section class="panel pad"><h1>Security check failed</h1><a class="btn primary" href="/">Back home</a></section></main>`));
}

app.use(requireCsrf);

function cart(req) {
  req.session.cart = req.session.cart || [];
  return req.session.cart;
}

function shipping(settings, subtotal) {
  return 0;
}

function cartTotals(req) {
  const db = readDb();
  const subtotal = cart(req).reduce((sum, item) => sum + item.lineTotal, 0);
  const ship = subtotal > 0 ? shipping(db.settings, subtotal) : 0;
  const coupon = findActiveCoupon(db, req.session.couponCode);
  if (!coupon && req.session.couponCode) delete req.session.couponCode;
  const discount = couponDiscount(coupon, subtotal);
  return { subtotal, shipping: ship, discount, couponCode: coupon ? coupon.code : '', total: Math.max(0, subtotal + ship - discount) };
}

function assertCsrf(req) {
  if (req.body._csrf !== req.session.csrf) throw new Error('Security check failed. Please refresh and try again.');
}

function storefrontActivity(db) {
  const now = Date.now();
  const actualRecentOrders = (db.orders || []).filter(order => now - new Date(order.createdAt).getTime() <= 48 * 60 * 60 * 1000).length;
  pruneStorefrontVisitors(now);
  const orderBucket = Math.floor(now / (1000 * 60 * 15));
  const visitorBucket = Math.floor(now / (1000 * 20));
  const displayRecentOrders = Math.max(actualRecentOrders, 27 + ((orderBucket + actualRecentOrders * 3) % 21));
  const displayActiveVisitors = Math.max(activeStorefrontVisitors.size, 6 + ((visitorBucket + activeStorefrontVisitors.size * 2) % 7));
  return {
    recentOrders: displayRecentOrders,
    actualRecentOrders,
    activeVisitors: displayActiveVisitors,
    actualActiveVisitors: activeStorefrontVisitors.size,
    updatedAt: new Date(now).toISOString()
  };
}

function page(req, title, body, admin = false) {
  const db = readDb();
  const cartCount = cart(req).length;
  const whatsapp = whatsappUrl(db.settings, 'Hi Chocomedley, I need help with an order.');
  const whatsappLink = whatsapp ? `<a class="support-link" href="${esc(whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : '';
  const announcement = db.settings.freeShippingEnabled ? 'Free shipping included on every order' : 'Carefully packed and delivered across India';
  const nav = admin ? '' : `<header class="site-header"><div class="announcement-bar"><span>${esc(announcement)}</span><span>Cash on delivery available</span><span>Delivery in 4-5 days</span></div><nav class="nav"><a class="brand" href="/"><img src="${esc(db.settings.logoPath)}" alt="${esc(db.settings.storeName)} logo"><span><strong>${esc(db.settings.storeName)}</strong><small>Artisan chocolates</small></span></a><div class="header-promises"><span><b>Freshly made</b><small>Prepared for your order</small></span><span><b>Delivered carefully</b><small>Usually in 4-5 days</small></span></div><div class="nav-actions"><a class="track-link" href="/track">Track order</a><a class="cart-link" href="/cart"><span>Cart</span><strong>${cartCount}</strong></a></div></nav></header>`;
  const footer = admin ? '' : `<footer class="site-footer"><div class="footer-inner"><a class="footer-brand" href="/"><img src="${esc(db.settings.logoPath)}" alt=""><span><strong>${esc(db.settings.storeName)}</strong><small>Thoughtful gifts, made personal.</small></span></a><div class="footer-links"><a href="/">Shop hamper</a><a href="/track">Track order</a><a href="/privacy-policy">Privacy Policy</a><a href="/terms-and-conditions">Terms and Conditions</a>${whatsappLink}</div><p>Cash on delivery. Carefully packed in India.</p><p>Email: chocomedleyteam@gmail.com &middot; Phone: 7337002088</p></div></footer>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | ${esc(db.settings.storeName)}</title><meta name="description" content="Order the Rakhi Chocolate Hamper with custom image, extra almonds, and Cash on Delivery."><meta property="og:title" content="${esc(db.product.name)}"><meta property="og:description" content="${esc(db.product.shortDescription)}"><link rel="stylesheet" href="/assets/styles.css?v=${ASSET_VERSION}"><script defer src="/assets/app.js?v=${ASSET_VERSION}"></script>${admin ? '' : META_PIXEL_HTML}</head><body>${nav}${body}${footer}</body></html>`;
}

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function flashHtml(req) {
  const f = req.session.flash;
  delete req.session.flash;
  return f ? `<div class="notice ${esc(f.type)}">${esc(f.message)}</div>` : '';
}

function activeOptions(db) {
  return db.options.filter(o => o.active).sort((a, b) => Number(a.order) - Number(b.order));
}

function optionField(opt) {
  const name = `option_${opt.id}`;
  let control = '';
  const required = opt.required || (opt.type === 'file' && opt.uploadRequired) ? 'required' : '';
  const max = opt.maxLength ? `maxlength="${Number(opt.maxLength)}" data-counted` : '';
  const placeholder = opt.placeholder ? `placeholder="${esc(opt.placeholder)}"` : '';
  const isAlmonds = /almond/i.test(opt.title);
  if (opt.type === 'checkbox' && isAlmonds) {
    control = `<div class="addon-quantity" data-addon-quantity><input type="hidden" name="${name}" value="0" data-addon-input><div><strong>Almond add-ons</strong><small>Select the number you would like.</small></div><div class="mini-stepper"><button type="button" data-addon-delta="-1" aria-label="Decrease almonds">-</button><span data-addon-display>0</span><button type="button" data-addon-delta="1" aria-label="Increase almonds">+</button></div></div>`;
  } else if (opt.type === 'checkbox') {
    control = `<label class="choice-card add-on-card"><input type="checkbox" name="${name}" value="1"><span><b>Add</b><strong>${esc(opt.title)}</strong><small>${Number(opt.price) ? `+${money(opt.price)}` : 'Included'}</small></span></label>`;
  } else if (opt.type === 'file') {
    control = `<label class="upload-box premium-upload"><input type="file" name="${name}" accept="image/jpeg,image/png,image/webp" multiple ${required}><span class="upload-icon">Choose photos</span><span class="upload-copy"><strong data-upload-title>Attach up to 1 image</strong><small>JPG, PNG or WEBP, up to 5 MB each</small></span><em data-file-name>No photos selected</em></label>`;
  } else if (opt.type === 'textarea') {
    control = `<label class="field-wrap"><textarea name="${name}" ${required} ${max} ${placeholder}></textarea>${opt.maxLength ? `<small class="counter"><span data-count-for="${name}">0</span>/${Number(opt.maxLength)}</small>` : ''}</label>`;
  } else if (opt.type === 'select') {
    control = `<div class="choice-grid">${(opt.choices || []).map(choice => `<label class="choice-card"><input type="radio" name="${name}" value="${esc(choice)}" ${required}><span><strong>${esc(choice)}</strong><small>${Number(opt.price) ? `+${money(opt.price)}` : 'Included'}</small></span></label>`).join('')}</div>`;
  } else {
    control = `<label class="field-wrap"><input name="${name}" ${required} ${max} ${placeholder}>${opt.maxLength ? `<small class="counter"><span data-count-for="${name}">0</span>/${Number(opt.maxLength)}</small>` : ''}</label>`;
  }
  return `<section class="config-option premium-option" data-option data-title="${esc(opt.title)}" data-price="${Number(opt.price)}" data-option-type="${esc(opt.type)}" data-counted-addon="${isAlmonds ? 'true' : 'false'}"><div class="config-head"><div><span class="config-label">${esc(opt.title)}${opt.required ? ' *' : ''}</span><p>${esc(opt.description)}</p></div><strong>${Number(opt.price) ? `+${money(opt.price)}` : 'Free'}</strong></div>${control}</section>`;
}

app.get('/store-activity', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(storefrontActivity(readDb()));
});

app.get('/', (req, res) => {
  const db = readDb();
  if (!db.product.active || !db.settings.codEnabled || !db.product.codAvailable) return res.status(503).send(page(req, 'Unavailable', `<main class="container"><section class="panel pad"><h1>Orders are temporarily paused</h1><p class="lead">We are not accepting new orders at this moment. Please check again soon.</p>${whatsappCta(db.settings, 'Ask on WhatsApp', 'Hi Chocomedley, when will ordering reopen?')}</section></main>`));
  const base = sellingPrice(db.product);
  const hasOffer = hasValidOffer(db.product);
  const priceHtml = hasOffer ? `<div class="price-strip has-offer"><div><span class="panel-kicker">Today's price</span><strong>${money(base)}</strong></div><del>${money(db.product.basePrice)}</del><small>Free shipping included</small></div>` : `<div class="price-strip"><div><span class="panel-kicker">Price</span><strong>${money(base)}</strong></div><small>Free shipping included</small></div>`;
  const initialTotal = base + shipping(db.settings, base);
  const gallery = [db.product.imagePath, ...(db.product.galleryPaths || [])].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index);
  const thumbs = gallery.map((src, index) => `<button type="button" data-thumb data-src="${esc(src)}" aria-label="View image ${index + 1}"><img src="${esc(src)}" alt="${esc(db.product.name)} view ${index + 1}"></button>`).join('');
  const activity = storefrontActivity(db);
  const body = `<main class="storefront">${flashHtml(req)}<section class="product-section"><div class="product-shell"><div class="product-media"><div class="gallery-main"><span class="gallery-badge">Personalised for you</span><button class="gallery-arrow" type="button" data-gallery-prev aria-label="Previous image">‹</button><img data-main-image src="${esc(gallery[0])}" alt="${esc(db.product.name)}"><button class="gallery-arrow next" type="button" data-gallery-next aria-label="Next image">›</button></div><div class="thumbs">${thumbs}</div><div class="media-assurance"><span><b>Photo-ready print</b><small>Clear, colour-accurate finish</small></span><span><b>Gift-safe packaging</b><small>Packed to arrive beautifully</small></span></div></div><form class="product-panel configurator premium-configurator" method="post" action="/cart/add" enctype="multipart/form-data" data-product-form data-base-price="${base}" data-shipping="${shipping(db.settings, base)}">${csrfField(req)}<div class="product-title-block"><span class="panel-kicker">Personalised chocolate hamper</span><h1>${esc(db.product.name)}</h1><div class="pack-line">Pack of 9 handmade chocolates</div><div class="rating-line"><strong>Made fresh for gifting</strong><small>Personalised for every order</small></div><p>${esc(db.product.shortDescription)}</p><div class="activity-row" data-store-activity aria-live="polite"><span class="activity-item"><i></i><b data-recent-orders>${activity.recentOrders}</b> <span data-order-label>${activity.recentOrders === 1 ? 'order' : 'orders'}</span> placed in 48 hours</span><span class="activity-item"><i></i><b data-active-visitors>${activity.activeVisitors}</b> browsing now</span></div><div class="mini-trust"><span>Cash on delivery</span><span>Delivery in 4-5 days</span><span>Freshly made for you</span></div></div>${priceHtml}<div class="config-stack"><section class="config-option premium-option quantity-option"><div class="config-head"><div><span class="config-label">Quantity</span><p>How many hampers would you like?</p></div></div><span class="qty premium-qty"><button type="button" data-qty="-1" aria-label="Decrease quantity">-</button><input name="quantity" value="1" readonly aria-label="Quantity"><button type="button" data-qty="1" aria-label="Increase quantity">+</button></span></section>${activeOptions(db).map(optionField).join('')}</div><div class="checkout-dock"><div class="total-row"><span>Order total</span><strong data-live-total>${money(initialTotal)}</strong></div><div class="actions"><button type="submit" class="btn primary" formaction="/cart/add">Add to cart</button><button type="submit" class="btn dark" formaction="/buy-now">Buy now</button></div><p class="purchase-note">No online payment required. Pay when your order arrives.</p><div class="breakdown" data-breakdown></div></div></form></div></section>${bottomContent(db)}</main>${cartDrawer(req, req.query.cart === 'open')}<div class="mobile-bar"><div><small>Order total</small><strong data-live-total>${money(initialTotal)}</strong></div><button type="button" class="btn primary" data-mobile-add>Add to cart</button></div>`;
  res.send(page(req, db.product.name, body));
});

function cartDrawer(req, open = false) {
  const totals = cartTotals(req);
  const lines = cart(req).map(item => `<div class="drawer-line"><img src="${esc(item.productImage)}" alt="${esc(item.productName)}"><div><strong>${esc(item.productName)}</strong><small><span class="info-label">Quantity:</span> ${item.quantity}</small><small>${item.customizations.length} personalisation${item.customizations.length === 1 ? '' : 's'}</small></div><b>${money(item.lineTotal)}</b></div>`).join('');
  const empty = !cart(req).length ? '<p class="muted">Your cart is empty.</p>' : lines;
  return `<aside class="cart-drawer ${open ? 'is-open' : ''}" aria-label="Cart"><a class="drawer-scrim" href="/"></a><div class="drawer-panel"><div class="drawer-head"><div><p class="eyebrow">Your selection</p><h2>Shopping cart</h2></div><a href="/" aria-label="Close cart">×</a></div><div class="drawer-lines">${empty}</div><div class="drawer-total"><span>Order total</span><strong>${money(totals.total)}</strong></div><a class="btn dark" href="/checkout">Continue to checkout</a><a class="drawer-continue" href="/">Add another hamper</a><p class="drawer-assurance">Cash on delivery available. Your photos remain private and are used only for your order.</p></div></aside>`;
}

function bottomContent(db) {
  const faqs = String(db.product.faq || '').split(/\r?\n/).map(line => {
    const [q, ...rest] = line.split('|');
    return q && rest.length ? `<details><summary>${esc(q)}</summary><p>${esc(rest.join('|'))}</p></details>` : '';
  }).join('');
  return `<section class="trust-band"><div><span>01</span><strong>Choose your hamper</strong><small>Select quantity and add-ons</small></div><div><span>02</span><strong>Add your photos</strong><small>Upload one design per hamper</small></div><div><span>03</span><strong>We make it personal</strong><small>Printed, packed and dispatched</small></div></section><section id="details" class="content-bands"><header class="section-heading"><p class="eyebrow">The Chocomedley difference</p><h2>A gift that feels considered from the first look.</h2><p>Every hamper is prepared for the person receiving it, with handmade chocolate, a personal photograph and presentation worthy of the occasion.</p></header><div class="detail-grid"><article><span>01</span><p class="eyebrow">Product details</p><h3>Made to feel personal.</h3><p>${esc(db.product.details)}</p></article><article><span>02</span><p class="eyebrow">Ingredients</p><h3>Rich, handmade, carefully packed.</h3><p>${esc(db.product.ingredients)}</p></article><article><span>03</span><p class="eyebrow">Care</p><h3>Keep every bite fresh and delicious.</h3><p>${esc(db.product.care)}</p></article></div><div class="faq-block"><div class="faq-heading"><div><p class="eyebrow">Questions, answered</p><h2>Before you order</h2></div><p>Everything you need to know about personalisation, delivery and storage.</p></div>${faqs}</div></section>`;
}

function selectedCustomizations(req, files, db) {
  const quantity = Math.max(1, Math.min(MAX_ORDER_QUANTITY, Number(String(req.body.quantity || 1).replace(/\D/g, '') || 1)));
  return activeOptions(db).flatMap(opt => {
    const value = req.body[`option_${opt.id}`];
    const optionFiles = files.filter(f => f.fieldname === `option_${opt.id}`).slice(0, quantity);
    let chosen = false;
    let text = '';
    let uploadedPath = '';
    let originalName = '';
    if (opt.type === 'checkbox' && /almond/i.test(opt.title)) {
      const count = Math.max(0, Math.min(quantity, Number(String(value || 0).replace(/\D/g, '') || 0)));
      return count > 0 ? [{ optionId: opt.id, title: opt.title, type: 'count', value: `${count} of ${quantity} hamper${quantity === 1 ? '' : 's'}`, count, price: Number(opt.price || 0) * count, unitPrice: Number(opt.price || 0) }] : [];
    }
    if (opt.type === 'checkbox') { chosen = value === '1'; text = chosen ? 'Yes' : ''; }
    else if (opt.type === 'file') {
      if ((opt.required || opt.uploadRequired) && !optionFiles.length) throw new Error(`${opt.title} is required.`);
      return optionFiles.map((file, index) => ({
        optionId: opt.id,
        title: optionFiles.length > 1 ? `${opt.title} ${index + 1}` : opt.title,
        type: opt.type,
        value: file.originalname,
        price: Number(opt.price || 0),
        uploadedPath: `/uploads/${file.filename}`,
        originalName: file.originalname
      }));
    }
    else {
      text = cleanPlainText(value);
      if (opt.maxLength && text.length > Number(opt.maxLength)) throw new Error(`${opt.title} cannot exceed ${Number(opt.maxLength)} characters.`);
      if (opt.type === 'select' && text && !(opt.choices || []).includes(text)) throw new Error(`Choose a valid ${opt.title} option.`);
      chosen = text.length > 0;
    }
    if (opt.required && !chosen) throw new Error(`${opt.title} is required.`);
    return chosen ? [{ optionId: opt.id, title: opt.title, type: opt.type, value: text, price: Number(opt.price || 0), uploadedPath, originalName }] : [];
  }).filter(Boolean);
}

function addLine(req, files) {
  const db = readDb();
  if (!db.product.active || !db.settings.codEnabled || !db.product.codAvailable) throw new Error('Orders are temporarily paused.');
  const quantity = Math.max(1, Math.min(MAX_ORDER_QUANTITY, Number(String(req.body.quantity || 1).replace(/\D/g, '') || 1)));
  const allowedFileFields = new Set(activeOptions(db).filter(option => option.type === 'file').map(option => `option_${option.id}`));
  if (files.some(file => !allowedFileFields.has(file.fieldname))) throw new Error('The upload does not match an active customization. Please refresh and try again.');
  assertUploadedImages(files);
  const customizations = selectedCustomizations(req, files, db);
  const basePrice = sellingPrice(db.product);
  const customizationTotal = customizations.reduce((sum, c) => sum + c.price, 0);
  const lineTotal = (basePrice * quantity) + customizationTotal;
  return { key: crypto.randomBytes(8).toString('hex'), productId: db.product.id, productName: db.product.name, productImage: db.product.imagePath, basePrice, quantity, customizations, customizationTotal, lineTotal };
}

app.post('/cart/add', routeRateLimit('cart-add', 20, 10 * 60 * 1000), upload.any(), (req, res) => {
  try { assertCsrf(req); cart(req).push(addLine(req, req.files || [])); bumpAnalytics('cartAdds', 1); res.redirect('/?cart=open'); }
  catch (e) { removeFiles(req.files || []); flash(req, 'error', e.message); res.redirect('/'); }
});

app.post('/buy-now', routeRateLimit('buy-now', 20, 10 * 60 * 1000), upload.any(), (req, res) => {
  try {
    assertCsrf(req);
    const line = addLine(req, req.files || []);
    cart(req).forEach(item => removeCustomizationUploads(item.customizations));
    req.session.cart = [line];
    bumpAnalytics('cartAdds', 1);
    res.redirect('/checkout');
  } catch (e) { removeFiles(req.files || []); flash(req, 'error', e.message); res.redirect('/'); }
});

app.get('/buy-now', (req, res) => {
  res.redirect(cart(req).length ? '/checkout' : '/');
});

app.get('/cart', (req, res) => {
  const totals = cartTotals(req);
  const lines = cart(req).map(item => `<form class="cart-line" method="post" action="/cart/update">${csrfField(req)}<input type="hidden" name="key" value="${esc(item.key)}"><img src="${esc(item.productImage)}" alt="${esc(item.productName)}"><div class="cart-line-body"><div class="cart-line-title"><div><span class="eyebrow">Personalised hamper</span><h3>${esc(item.productName)}</h3></div><strong class="cart-line-price">${money(item.lineTotal)}</strong></div><div class="cart-customizations">${item.customizations.map(c => `<span><b>${esc(c.title)}</b>${esc(c.value)} <small>+${money(c.price)}</small></span>`).join('') || '<span>No add-ons selected</span>'}</div><div class="cart-line-controls"><div><span class="cart-qty-label">Quantity</span><div class="cart-qty-control" aria-label="Quantity controls"><button type="submit" name="qtyDelta" value="-1" aria-label="Decrease quantity">-</button><input name="quantity" value="${item.quantity}" readonly aria-label="Quantity"><button type="submit" name="qtyDelta" value="1" aria-label="Increase quantity">+</button></div></div><button type="submit" class="remove-link" name="remove" value="1">Remove</button></div></div></form>`).join('');
  const empty = !cart(req).length ? `<p class="lead">Your cart is empty.</p><a class="btn primary" href="/">Order Rakhi Hamper</a>` : '';
  res.send(page(req, 'Cart', `<main class="container cart-page"><section class="cart-content"><div class="page-heading"><div><p class="eyebrow">Your selection</p><h1>Shopping cart</h1><p>Review quantities and personalisation before checkout.</p></div>${cart(req).length ? '<a class="add-more-link" href="/">+ Add another hamper</a>' : ''}</div>${flashHtml(req)}<div class="cart-list">${empty}${lines}</div></section><aside class="panel order-summary"><p class="eyebrow">Order summary</p><h2>Total</h2>${summary(totals)}${cart(req).length ? '<a class="btn dark wide" href="/checkout">Continue to checkout</a><p class="summary-assurance">Free shipping is included. Pay on delivery with no online payment required.</p>' : ''}</aside></main>`));
});

app.post('/cart/update', (req, res) => {
  try { assertCsrf(req); } catch (e) { flash(req, 'error', e.message); return res.redirect('/cart'); }
  const removed = Boolean(req.body.remove);
  let updated = false;
  const removedItem = removed ? cart(req).find(item => item.key === req.body.key) : null;
  if (removedItem) removeCustomizationUploads(removedItem.customizations);
  req.session.cart = cart(req).filter(item => item.key !== req.body.key || !removed).map(item => {
    if (item.key === req.body.key) {
      const delta = Number(req.body.qtyDelta || 0);
      const currentQuantity = Math.max(1, Number(item.quantity || 1));
      const requestedQuantity = delta ? currentQuantity + delta : Number(String(req.body.quantity || currentQuantity).replace(/\D/g, '') || currentQuantity);
      const nextQuantity = Math.max(1, Math.min(MAX_ORDER_QUANTITY, requestedQuantity));
      updated = item.quantity !== nextQuantity;
      item.quantity = nextQuantity;
      item.customizations = (item.customizations || []).map(customization => {
        if (customization.type !== 'count' || !customization.unitPrice) return customization;
        const nextCount = Math.max(0, Math.min(nextQuantity, Number(customization.count || 0)));
        customization.count = nextCount;
        customization.value = `${nextCount} of ${nextQuantity} hamper${nextQuantity === 1 ? '' : 's'}`;
        customization.price = Number(customization.unitPrice) * nextCount;
        return customization;
      }).filter(customization => customization.type !== 'count' || Number(customization.count || 0) > 0);
      item.customizationTotal = (item.customizations || []).reduce((sum, customization) => sum + Number(customization.price || 0), 0);
      item.lineTotal = (Number(item.basePrice) * item.quantity) + Number(item.customizationTotal);
    }
    return item;
  });
  flash(req, 'success', removed ? 'Item removed from cart.' : updated ? 'Cart quantity updated.' : 'Cart is already up to date.');
  res.redirect('/cart');
});

function summary(t) {
  const discountLine = t.discount > 0 ? `<div class="summary-line summary-discount"><span>Coupon${t.couponCode ? ` (${esc(t.couponCode)})` : ''}</span><strong>-${money(t.discount)}</strong></div>` : '';
  return `<div class="summary-line"><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div>${discountLine}<div class="summary-note">Free shipping included in the price.</div><div class="summary-line"><span>Total</span><strong>${money(t.total)}</strong></div>`;
}

function checkoutItems(req) {
  return cart(req).map(item => `<div class="checkout-item"><img src="${esc(item.productImage)}" alt=""><div><strong>${esc(item.productName)}</strong><small>Quantity ${item.quantity}</small><small>${item.customizations.length} personalisation${item.customizations.length === 1 ? '' : 's'}</small></div><b>${money(item.lineTotal)}</b></div>`).join('');
}

function couponBlock(req, totals) {
  if (totals.couponCode) {
    return `<form method="post" action="/checkout/remove-coupon" class="coupon-form coupon-applied">${csrfField(req)}<div><span>Coupon applied</span><strong>${esc(totals.couponCode)}</strong></div><button type="submit" class="link-btn">Remove</button></form>`;
  }
  return `<form method="post" action="/checkout/apply-coupon" class="coupon-form">${csrfField(req)}<label>Promo code <span class="optional-label">Optional</span><div class="coupon-input-row"><input name="couponCode" maxlength="20" placeholder="Enter code" data-clean="code" autocomplete="off"><button type="submit" class="btn ghost">Apply</button></div></label></form>`;
}

app.get('/checkout', (req, res) => {
  if (!cart(req).length) return res.redirect('/');
  const db = readDb();
  if (!db.settings.codEnabled || !db.product.codAvailable) {
    flash(req, 'error', 'Ordering is temporarily paused. Please contact us on WhatsApp.');
    return res.redirect('/cart');
  }
  bumpAnalytics('checkoutViews', 1);
  const totals = cartTotals(req);
  const stateOptions = INDIA_STATES.map(state => `<option value="${esc(state)}">${esc(state)}</option>`).join('');
  const form = `<form class="checkout-form" method="post" action="/checkout" data-once data-checkout-form novalidate>${csrfField(req)}${flashHtml(req)}<section class="checkout-section"><div class="form-section-head"><span>1</span><div><h2>Contact details</h2><p>We use these details only for your order and delivery.</p></div></div><div class="grid two"><label>Full name<input name="customerName" autocomplete="name" maxlength="60" data-clean="person" data-rule="person" required><small class="field-error" data-error-for="customerName"></small></label><label>Mobile number<input name="mobile" inputmode="numeric" autocomplete="tel" maxlength="10" data-clean="digits" data-rule="mobile" required><small class="field-error" data-error-for="mobile"></small></label></div><div class="grid two"><label>Alternate mobile <span class="optional-label">Optional</span><input name="alternateMobile" inputmode="numeric" autocomplete="tel" maxlength="10" data-clean="digits" data-rule="optionalMobile"><small class="field-error" data-error-for="alternateMobile"></small></label><label>Email <span class="optional-label">Optional</span><input type="email" name="email" maxlength="254" autocomplete="email" data-rule="optionalEmail"><small class="field-error" data-error-for="email"></small></label></div></section><section class="checkout-section"><div class="form-section-head"><span>2</span><div><h2>Delivery address</h2><p>Enter the complete address where the hamper should arrive.</p></div></div><label>Address line 1<input name="addressLine1" autocomplete="address-line1" maxlength="180" data-clean="address" data-rule="requiredText" required><small class="field-error" data-error-for="addressLine1"></small></label><label>Address line 2 <span class="optional-label">Optional</span><input name="addressLine2" autocomplete="address-line2" maxlength="180" data-clean="address"></label><div class="grid two"><label>Landmark <span class="optional-label">Optional</span><input name="landmark" maxlength="120" data-clean="address"><small class="field-error" data-error-for="landmark"></small></label><label>PIN code<input name="pinCode" inputmode="numeric" autocomplete="postal-code" maxlength="6" data-clean="digits" data-rule="pin" required><small class="field-error" data-error-for="pinCode"></small></label></div><div class="grid two"><label>City<input name="city" autocomplete="address-level2" maxlength="60" data-clean="person" data-rule="person" required><small class="field-error" data-error-for="city"></small></label><label>State<select name="state" required data-rule="requiredSelect"><option value="">Select state or union territory</option>${stateOptions}</select><small class="field-error" data-error-for="state"></small></label></div><label>Order notes <span class="optional-label">Optional</span><textarea name="customerNotes" maxlength="500" data-clean="address" placeholder="Delivery instructions or a note for our team"></textarea></label></section><div class="payment-choice"><span>Free shipping</span><div><strong>Delivery is included in the price</strong><small>No extra shipping charge will be added at checkout.</small></div></div><div class="payment-choice"><span>Cash on delivery</span><div><strong>Pay when your hamper arrives</strong><small>No online payment is required today.</small></div></div><label class="checkout-consent"><input type="checkbox" name="orderConfirmation" value="1" required data-rule="confirmation"><span><strong>Confirm this cash on delivery order</strong><small>I have checked the delivery details and agree to be contacted about this order.</small></span></label><small class="field-error checkout-consent-error" data-error-for="orderConfirmation"></small><button type="submit" class="btn dark wide checkout-submit" data-loading="Placing order...">Place cash on delivery order</button></form>`;
  res.send(page(req, 'Checkout', `<main class="container checkout-page"><div class="page-heading checkout-heading"><div><p class="eyebrow">Secure checkout</p><h1>Delivery details</h1><p>Your personalised hamper is almost ready.</p></div><a href="/cart">Return to cart</a></div><div class="checkout-layout">${form}<aside class="panel checkout-summary"><p class="eyebrow">Your order</p><div class="checkout-items">${checkoutItems(req)}</div>${couponBlock(req, totals)}${summary(totals)}<div class="checkout-assurance"><strong>Free shipping included</strong><span>The price shown already includes delivery. Photos are used only to prepare your personalised order.</span></div></aside></div></main>`));
});

app.post('/checkout/apply-coupon', routeRateLimit('apply-coupon', 15, 15 * 60 * 1000), (req, res) => {
  try {
    assertCsrf(req);
    const db = readDb();
    const code = normalizeCouponCode(req.body.couponCode);
    if (!code) throw new Error('Enter a coupon code.');
    const coupon = findActiveCoupon(db, code);
    if (!coupon) throw new Error('That coupon code is not valid.');
    req.session.couponCode = coupon.code;
    flash(req, 'success', `Coupon ${coupon.code} applied.`);
  } catch (e) {
    delete req.session.couponCode;
    flash(req, 'error', e.message || 'That coupon code is not valid.');
  }
  res.redirect('/checkout');
});

app.post('/checkout/remove-coupon', (req, res) => {
  try { assertCsrf(req); } catch (e) { flash(req, 'error', e.message); return res.redirect('/checkout'); }
  delete req.session.couponCode;
  flash(req, 'success', 'Coupon removed.');
  res.redirect('/checkout');
});

app.post('/checkout', routeRateLimit('checkout', 5, 30 * 60 * 1000), async (req, res) => {
  try {
    const db = readDb();
    const items = cart(req);
    if (!items.length) return res.redirect('/');
    if (!db.settings.codEnabled || !db.product.codAvailable || !db.product.active) throw new Error('Ordering is temporarily paused.');
    const customerName = String(req.body.customerName || '').trim();
    const mobile = String(req.body.mobile || '').trim();
    const alternateMobile = String(req.body.alternateMobile || '').trim();
    const pinCode = String(req.body.pinCode || '').trim();
    const city = String(req.body.city || '').trim();
    const state = String(req.body.state || '').trim();
    const email = optionalEmail(req.body.email, 'Email');
    const addressLine1 = cleanPlainText(req.body.addressLine1).slice(0, 180);
    const nameOk = /^[\p{L}][\p{L} ]{1,59}$/u.test(customerName);
    const mobileOk = /^[6-9]\d{9}$/.test(mobile);
    const alternateOk = !alternateMobile || (/^[6-9]\d{9}$/.test(alternateMobile) && alternateMobile !== mobile);
    const pinOk = /^\d{6}$/.test(pinCode);
    const cityOk = /^[\p{L}][\p{L} ]{1,59}$/u.test(city);
    if (!nameOk || addressLine1.length < 4 || !cityOk || !INDIA_STATES.includes(state) || !mobileOk || !alternateOk || !pinOk || req.body.orderConfirmation !== '1') {
      flash(req, 'error', 'Please enter a valid name, mobile number, address, city, state, and PIN code.');
      return res.redirect('/checkout');
    }
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const ship = shipping(db.settings, subtotal);
    const coupon = findActiveCoupon(db, req.session.couponCode);
    const discount = couponDiscount(coupon, subtotal);
    const orderId = `RAKHI-${db.nextOrderNumber++}`;
    const now = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(), orderId, createdAt: now, updatedAt: now,
      customerName: cleanPlainText(customerName), mobile, alternateMobile, email,
      addressLine1, addressLine2: cleanPlainText(req.body.addressLine2).slice(0, 180), landmark: cleanPlainText(req.body.landmark).slice(0, 120), city: cleanPlainText(city), state, pinCode,
      customerNotes: cleanPlainText(req.body.customerNotes).slice(0, 500), adminNotes: '', paymentMethod: 'Cash on Delivery', paymentStatus: 'Pending', orderStatus: 'New Order',
      courier: '', trackingNumber: '', trackingUrl: '', shippingDate: '', estimatedDeliveryDate: '',
      items: JSON.parse(JSON.stringify(items)), subtotal, shippingAmount: ship, couponCode: coupon ? coupon.code : '', discountAmount: discount, total: Math.max(0, subtotal + ship - discount),
      statusHistory: [{ status: 'New Order', at: now }]
    };
    db.orders.unshift(order);
    await writeDb(db);
    req.session.cart = [];
    req.session.lastOrder = orderId;
    delete req.session.couponCode;
    sendNewOrderEmails(db, order).catch(error => console.error('[email] New order email dispatch failed:', error.code || error.message));
    res.redirect('/success');
  } catch (e) {
    console.error('Checkout failed:', e);
    flash(req, 'error', 'Order could not be placed right now. Please try again or contact us on WhatsApp.');
    res.redirect('/checkout');
  }
});

app.get('/success', (req, res) => {
  const db = readDb();
  const order = db.orders.find(o => o.orderId === req.session.lastOrder);
  if (!order) return res.redirect('/');
  bumpAnalytics('thankYouViews', 1);
  const whatsappCard = `<section class="success-support"><div><p class="eyebrow">Stay connected</p><h2>Get delivery updates on WhatsApp</h2><p>Message Chocomedley for tracking help, delivery updates or any change to your order.</p></div>${whatsappCta(db.settings, 'Message us on WhatsApp', `Hi Chocomedley, I placed order ${order.orderId}. Please keep me updated on tracking and delivery.`, 'wide')}</section>`;
  res.send(page(req, 'Order Placed', `<main class="container success-page"><section class="success-hero"><span class="success-mark">✓</span><p class="eyebrow">Order confirmed</p><h1>Thank you, ${esc(order.customerName)}.</h1><p>Your personalised chocolate hamper has been received by our team. We will prepare it carefully and keep you updated.</p><div class="success-order-id"><span>Order ID</span><strong>${esc(order.orderId)}</strong></div></section><section class="success-details"><div><span>Payment</span><strong>Cash on delivery</strong></div><div><span>Order total</span><strong>${money(order.total)}</strong></div><div><span>Updates sent to</span><strong>${esc(order.mobile)}</strong></div></section><div class="success-actions"><a class="btn dark" href="/track">Track your order</a><a class="btn ghost" href="/">Return to shop</a></div>${whatsappCard}</main>`));
});

app.get('/track', (req, res) => {
  const db = readDb();
  const lookup = req.session.trackLookup;
  delete req.session.trackLookup;
  const matches = lookup ? db.orders.filter(o => o.mobile === lookup.mobile && (!lookup.orderId || o.orderId.toLowerCase() === lookup.orderId.toLowerCase())) : [];
  const cards = matches.map(order => `<article class="track-card"><header><div><p class="eyebrow">${esc(order.orderId)}</p><h2>${esc(order.orderStatus)}</h2></div><span class="track-live">Live status</span></header><div class="track-customer"><span>Customer</span><strong>${esc(order.customerName)}</strong><small>${money(order.total)}</small></div><div class="track-progress"><span class="done"></span><span class="${['Confirmed', 'Preparing', 'Ready to Ship', 'Shipped', 'Out for Delivery', 'Delivered'].includes(order.orderStatus) ? 'done' : ''}"></span><span class="${['Shipped', 'Out for Delivery', 'Delivered'].includes(order.orderStatus) ? 'done' : ''}"></span><span class="${order.orderStatus === 'Delivered' ? 'done' : ''}"></span></div><div class="track-meta"><p><span>Courier</span><strong>${esc(order.courier || 'Not assigned yet')}</strong></p><p><span>Tracking number</span><strong>${esc(order.trackingNumber || 'Pending')}</strong></p><p><span>Estimated delivery</span><strong>${esc(order.estimatedDeliveryDate || 'To be updated')}</strong></p></div><div class="actions">${order.trackingUrl ? `<a class="btn primary" href="${esc(order.trackingUrl)}" target="_blank" rel="noopener">Open courier tracking</a>` : ''}${whatsappCta(db.settings, 'Ask on WhatsApp', `Hi Chocomedley, I want an update for order ${order.orderId}.`)}</div></article>`).join('');
  const result = lookup && !matches.length ? `<p class="notice error">No matching order found for that Mobile Number${lookup.orderId ? ' and Order ID' : ''}.</p>${whatsappCta(db.settings, 'Get Help on WhatsApp', 'Hi Chocomedley, I cannot find my order tracking details. Please help.')}` : matches.length ? cards : `<p class="lead">Enter your Mobile Number to see live order status. Add Order ID if you want to narrow the result.</p>${whatsappCta(db.settings, 'Chat With Support', 'Hi Chocomedley, I need help tracking my order.')}`;
  res.send(page(req, 'Track Order', `<main class="container track-page"><header class="page-heading track-heading"><div><p class="eyebrow">Order updates</p><h1>Track your hamper</h1><p>Use the mobile number from checkout to see the latest status.</p></div><span>Real-time order status</span></header><div class="track-layout"><form class="track-form" method="post" action="/track" autocomplete="off">${csrfField(req)}${flashHtml(req)}<label>Mobile number<input name="mobile" inputmode="numeric" pattern="[6-9][0-9]{9}" maxlength="10" value="" autocomplete="off" placeholder="10-digit mobile number" required></label><label>Order ID <span class="optional-label">Optional</span><input name="orderId" placeholder="RAKHI-10001" value="" autocomplete="off"></label><button type="submit" class="btn dark wide">Check order status</button><p>Your order details are protected and matched using your mobile number.</p></form><aside class="track-results">${result}</aside></div></main>`));
});

app.post('/track', routeRateLimit('track', 30, 15 * 60 * 1000), (req, res) => {
  try { assertCsrf(req); } catch (e) { flash(req, 'error', e.message); return res.redirect('/track'); }
  const mobile = String(req.body.mobile || '').replace(/\D/g, '');
  const orderId = String(req.body.orderId || '').trim().toUpperCase();
  if (!/^[6-9]\d{9}$/.test(mobile) || (orderId && !/^RAKHI-\d{5,}$/.test(orderId))) {
    flash(req, 'error', 'Enter a valid 10-digit mobile number and Order ID, if provided.');
    return res.redirect('/track');
  }
  req.session.trackLookup = { orderId, mobile };
  flash(req, 'success', 'Tracking checked. Latest result is shown on the right.');
  res.redirect('/track');
});

function requireAdmin(req, res, next) {
  if (ADMIN_AUTH_DISABLED) {
    req.session.adminId = req.session.adminId || 'auth-disabled-admin';
    return next();
  }
  if (req.session.adminId) return next();
  res.setHeader('Cache-Control', 'no-store');
  res.redirect('/admin/login');
}

const ADMIN_LINKS = [
  { href: '/admin', label: 'Dashboard', match: pathValue => pathValue === '/admin' },
  { href: '/admin/analytics', label: 'Analytics', match: pathValue => pathValue.startsWith('/admin/analytics') },
  { href: '/admin/orders', label: 'Orders', match: pathValue => pathValue.startsWith('/admin/orders') },
  { href: '/admin/product', label: 'Product', match: pathValue => pathValue.startsWith('/admin/product') },
  { href: '/admin/customizations', label: 'Customizations', match: pathValue => pathValue.startsWith('/admin/customizations') },
  { href: '/admin/coupons', label: 'Coupons', match: pathValue => pathValue.startsWith('/admin/coupons') },
  { href: '/admin/settings', label: 'Settings', match: pathValue => pathValue.startsWith('/admin/settings') },
  { href: '/admin/team', label: 'Team', match: pathValue => pathValue.startsWith('/admin/team') }
];

function adminHeading(kicker, title, description, action = '') {
  return `<header class="admin-page-heading"><div><p class="admin-kicker">${esc(kicker)}</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action}</header>`;
}

function adminFormSection(index, title, description, content, extraClass = '') {
  return `<section class="admin-form-card ${esc(extraClass)}"><header class="admin-form-card-head"><span>${esc(index)}</span><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div></header>${content}</section>`;
}

function adminToggle(name, title, description, checked = false, attributes = '') {
  return `<label class="admin-toggle" ${attributes}><input type="checkbox" name="${esc(name)}" value="1" ${checked ? 'checked' : ''}><span class="admin-toggle-track" aria-hidden="true"></span><span class="admin-toggle-copy"><strong>${esc(title)}</strong><small>${esc(description)}</small></span></label>`;
}

function emailNotifyToggle(order, label = 'Email customer') {
  const available = smtpConfigured() && Boolean(order.email);
  const copy = available ? label : order.email ? 'Email setup required' : 'No customer email';
  const hint = available ? '' : ` title="${esc(order.email ? 'Configure SMTP in Hostinger to enable email delivery.' : 'This customer did not provide an email address.')}"`;
  return `<label class="inline-check ${available ? '' : 'is-disabled'}"${hint}><input type="checkbox" name="notifyEmail" value="1" ${available ? 'checked' : 'disabled'}> ${esc(copy)}</label>`;
}

function adminPage(req, title, content) {
  const db = readDb();
  req.res?.setHeader('Cache-Control', 'no-store');
  const links = ADMIN_LINKS.map(link => `<a href="${link.href}" class="${link.match(req.path) ? 'is-active' : ''}">${esc(link.label)}</a>`).join('');
  const sidebar = `<aside class="admin-side"><a class="admin-brand" href="/admin"><img src="${esc(db.settings.logoPath)}" alt=""><span><strong>${esc(db.settings.storeName)}</strong><small>Store control centre</small></span></a><nav aria-label="Admin navigation">${links}</nav><div class="admin-side-footer"><a href="/" target="_blank" rel="noopener">View storefront</a><a href="/admin/logout">Sign out</a></div></aside>`;
  return page(req, title, `<div class="admin-layout">${sidebar}<main class="admin-main"><div class="admin-main-inner">${flashHtml(req)}${content}</div></main></div>`, true);
}

app.get('/setup-admin', (req, res) => {
  const db = readDb();
  if (process.env.ADMIN_SETUP_ENABLED !== 'true' || db.admins.length) return res.status(403).send('Admin setup disabled.');
  res.send(page(req, 'Create Admin', `<main class="auth-shell"><form class="panel auth-card" method="post" action="/setup-admin">${csrfField(req)}<img class="auth-logo" src="${esc(db.settings.logoPath)}" alt="Logo"><h1>Create Admin</h1>${flashHtml(req)}<label>Name<input name="name" maxlength="80" required></label><label>Email<input type="email" name="email" maxlength="254" required></label><label>Password<input type="password" name="password" minlength="12" autocomplete="new-password" required><small class="muted">Use at least 12 characters with letters and a number.</small></label><button class="btn primary">Create secure admin</button></form></main>`, true));
});

app.post('/setup-admin', async (req, res) => {
  const db = readDb();
  if (process.env.ADMIN_SETUP_ENABLED !== 'true' || db.admins.length) return res.status(403).send('Admin setup disabled.');
  const password = String(req.body.password || '');
  let name = '';
  let email = '';
  try {
    name = requireName(req.body.name, 'Admin name');
    email = optionalEmail(req.body.email, 'Admin email');
  } catch (_) {
    name = '';
  }
  if (!name || !email || !passwordMeetsPolicy(password)) {
    flash(req, 'error', 'Use a valid name, email, and password with at least 12 characters including letters and a number.');
    return res.redirect('/setup-admin');
  }
  db.admins.push({ id: crypto.randomUUID(), name, email, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() });
  await writeDb(db);
  res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
  if (ADMIN_AUTH_DISABLED) {
    req.session.adminId = 'auth-disabled-admin';
    return res.redirect('/admin');
  }
  const db = readDb();
  res.setHeader('Cache-Control', 'no-store');
  res.send(page(req, 'Admin Login', `<main class="auth-shell"><form class="panel auth-card" method="post" action="/admin/login">${csrfField(req)}<img class="auth-logo" src="${esc(db.settings.logoPath)}" alt="Logo"><h1>Admin Login</h1>${flashHtml(req)}<label>Email<input type="email" name="email" maxlength="254" autocomplete="username" required></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><button class="btn primary">Login</button><a class="auth-link" href="/admin/forgot-password">Forgot password?</a></form></main>`, true));
});

app.post('/admin/login', routeRateLimit('admin-login', 10, 15 * 60 * 1000), async (req, res) => {
  const db = readDb();
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  if (ADMIN_AUTH_DISABLED || (DEMO_ADMIN_ALLOW_ANY_LOGIN && email && password)) {
    req.session.regenerate(() => { req.session.adminId = 'demo-any-admin'; res.redirect('/admin'); });
    return;
  }
  const admin = db.admins.find(a => a.email === email.toLowerCase());
  if (admin && await bcrypt.compare(password, admin.passwordHash)) {
    req.session.regenerate(() => { req.session.adminId = admin.id; res.redirect('/admin'); });
    return;
  }
  flash(req, 'error', 'Invalid admin credentials.');
  res.redirect('/admin/login');
});

app.get('/admin/forgot-password', (req, res) => {
  const db = readDb();
  res.setHeader('Cache-Control', 'no-store');
  res.send(page(req, 'Reset Admin Password', `<main class="auth-shell"><form class="panel auth-card" method="post" action="/admin/forgot-password">${csrfField(req)}<img class="auth-logo" src="${esc(db.settings.logoPath)}" alt="Logo"><p class="auth-kicker">Account recovery</p><h1>Forgot password?</h1>${flashHtml(req)}<p class="auth-copy">Enter your admin email and we will send a secure reset link if the account exists.</p><label>Email<input type="email" name="email" maxlength="254" autocomplete="email" required></label><button class="btn primary">Send reset link</button><a class="auth-link" href="/admin/login">Back to login</a></form></main>`, true));
});

app.post('/admin/forgot-password', routeRateLimit('admin-forgot-password', 5, 15 * 60 * 1000), async (req, res) => {
  let email = '';
  try {
    email = optionalEmail(req.body.email, 'Admin email');
    if (!email) throw new Error('Enter your admin email.');
  } catch (error) {
    flash(req, 'error', error.message);
    return res.redirect('/admin/forgot-password');
  }
  const db = readDb();
  const admin = db.admins.find(record => record.email === email);
  if (admin) {
    const token = crypto.randomBytes(32).toString('hex');
    const resetUrl = `${requestOrigin(req)}/admin/reset-password?token=${encodeURIComponent(token)}`;
    db.adminResetTokens = db.adminResetTokens.filter(record => record.adminId !== admin.id);
    db.adminResetTokens.push({ adminId: admin.id, tokenHash: resetTokenHash(token), expiresAt: Date.now() + 30 * 60 * 1000, createdAt: new Date().toISOString() });
    try {
      await writeDb(db);
      await sendTransactionalEmail({
        to: admin.email,
        subject: 'Reset your Chocomedley admin password',
        text: `Hi ${admin.name},\n\nUse this link to reset your Chocomedley admin password. It expires in 30 minutes and can be used once:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Hi ${esc(admin.name)},</p><p>Use the secure link below to reset your Chocomedley admin password. It expires in 30 minutes and can be used once.</p><p><a href="${esc(resetUrl)}">Reset admin password</a></p><p>If you did not request this, you can ignore this email.</p>`
      });
    } catch (error) {
      db.adminResetTokens = db.adminResetTokens.filter(record => record.adminId !== admin.id);
      await writeDb(db).catch(() => {});
      console.error('[email] Admin password reset failed:', error.code || error.message);
      flash(req, 'error', 'The reset email could not be sent. Check the Gmail SMTP settings and try again.');
      return res.redirect('/admin/forgot-password');
    }
  }
  flash(req, 'success', 'If that admin email exists, a reset link has been sent. Check your inbox and spam folder.');
  res.redirect('/admin/forgot-password');
});

app.get('/admin/reset-password', (req, res) => {
  const db = readDb();
  const token = String(req.query.token || '').trim();
  const reset = db.adminResetTokens.find(record => record.tokenHash === resetTokenHash(token) && Number(record.expiresAt) > Date.now());
  res.setHeader('Cache-Control', 'no-store');
  if (!reset) return res.send(page(req, 'Reset Link Expired', `<main class="auth-shell"><section class="panel auth-card"><img class="auth-logo" src="${esc(db.settings.logoPath)}" alt="Logo"><p class="auth-kicker">Account recovery</p><h1>Reset link expired</h1><p class="auth-copy">This link is invalid or has already been used. Request a fresh link to continue.</p><a class="btn primary" href="/admin/forgot-password">Request new link</a></section></main>`, true));
  res.send(page(req, 'Set New Admin Password', `<main class="auth-shell"><form class="panel auth-card" method="post" action="/admin/reset-password">${csrfField(req)}<input type="hidden" name="token" value="${esc(token)}"><img class="auth-logo" src="${esc(db.settings.logoPath)}" alt="Logo"><p class="auth-kicker">Account recovery</p><h1>Set a new password</h1>${flashHtml(req)}<label>New password<input type="password" name="password" minlength="12" autocomplete="new-password" required><small class="muted">At least 12 characters with letters and a number.</small></label><label>Confirm password<input type="password" name="confirmPassword" minlength="12" autocomplete="new-password" required></label><button class="btn primary">Update password</button></form></main>`, true));
});

app.post('/admin/reset-password', routeRateLimit('admin-reset-password', 8, 15 * 60 * 1000), async (req, res) => {
  const token = String(req.body.token || '').trim();
  const db = readDb();
  const reset = db.adminResetTokens.find(record => record.tokenHash === resetTokenHash(token) && Number(record.expiresAt) > Date.now());
  if (!reset) {
    flash(req, 'error', 'This reset link is invalid or has expired.');
    return res.redirect('/admin/forgot-password');
  }
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');
  if (!passwordMeetsPolicy(password) || password !== confirmPassword) {
    flash(req, 'error', 'Passwords must match and include at least 12 characters, letters, and a number.');
    return res.redirect(`/admin/reset-password?token=${encodeURIComponent(token)}`);
  }
  const admin = db.admins.find(record => record.id === reset.adminId);
  if (!admin) {
    flash(req, 'error', 'Admin account not found.');
    return res.redirect('/admin/forgot-password');
  }
  admin.passwordHash = await bcrypt.hash(password, 12);
  admin.updatedAt = new Date().toISOString();
  db.adminResetTokens = db.adminResetTokens.filter(record => record.adminId !== admin.id);
  await writeDb(db);
  flash(req, 'success', 'Password updated. You can now sign in.');
  res.redirect('/admin/login');
});

app.post('/admin/email/test', requireAdmin, routeRateLimit('admin-email-test', 3, 15 * 60 * 1000), async (req, res) => {
  const db = readDb();
  try {
    assertCsrf(req);
    const configured = smtpSettings();
    const recipient = optionalEmail(req.body.testEmail || db.settings.supportEmail || configured.user, 'Test email recipient');
    if (!recipient) throw new Error('Enter a test email recipient.');
    await sendTransactionalEmail({
      to: recipient,
      subject: 'Chocomedley email delivery test',
      text: `This is a test email from Chocomedley. SMTP delivery is working for ${configured.user}.`,
      html: `<p>This is a test email from <strong>Chocomedley</strong>.</p><p>SMTP delivery is working for <strong>${esc(configured.user)}</strong>.</p>`
    });
    flash(req, 'success', `Test email sent to ${recipient}. Check the inbox and spam folder.`);
  } catch (error) {
    console.error('[email] Test email failed:', error.code || error.message);
    flash(req, 'error', error.message || 'The test email could not be sent.');
  }
  res.redirect('/admin/settings#email-integration');
});

app.get('/admin/logout', (req, res) => req.session.destroy(() => res.redirect('/admin/login')));

app.get('/admin/team', requireAdmin, (req, res) => {
  const db = readDb();
  const cards = db.admins.map(admin => `<article class="admin-team-card"><div><span class="admin-option-type">Admin account</span><h2>${esc(admin.name || 'Store Admin')}</h2><p>${esc(admin.email)}</p><small>Added ${esc(String(admin.createdAt || '').slice(0, 10) || 'recently')}</small></div><span class="admin-status is-live">${admin.id === req.session.adminId ? 'You' : 'Active'}</span></article>`).join('');
  const fields = `<div class="admin-fields two"><label>Name<input name="name" maxlength="80" data-clean="name" data-admin-rule="name" autocomplete="name" required><small class="field-error" data-error-for="name"></small></label><label>Email<input type="email" name="email" maxlength="254" data-admin-rule="email" autocomplete="email" required><small class="field-error" data-error-for="email"></small></label></div><div class="admin-fields two"><label>Password<input type="password" name="password" minlength="12" data-admin-rule="password" autocomplete="new-password" required><small class="field-error" data-error-for="password"></small></label><label>Confirm password<input type="password" name="confirmPassword" minlength="12" data-admin-rule="passwordMatch" autocomplete="new-password" required><small class="field-error" data-error-for="confirmPassword"></small></label></div>`;
  const form = `<form class="admin-form" method="post" action="/admin/team" data-admin-form>${csrfField(req)}${adminFormSection('01', 'Add an admin', 'Create a separate secure login for a trusted team member.', fields)}<div class="admin-save-bar"><div><strong>Keep access personal</strong><span>Each admin gets their own email and password.</span></div><button class="btn primary" data-loading="Creating admin...">Create admin</button></div></form>`;
  res.send(adminPage(req, 'Team', `${adminHeading('Access control', 'Admin team', 'Manage the people who can operate your Chocomedley store.', `<span class="order-total">${db.admins.length} account${db.admins.length === 1 ? '' : 's'}</span>`)}<section class="admin-team-list">${cards || '<div class="admin-empty-state"><strong>No admin accounts</strong><span>Create the first account below.</span></div>'}</section>${form}`));
});

app.post('/admin/team', requireAdmin, routeRateLimit('admin-team-create', 10, 60 * 60 * 1000), async (req, res) => {
  const db = readDb();
  try {
    const name = requireName(req.body.name, 'Admin name');
    const email = optionalEmail(req.body.email, 'Admin email');
    const password = String(req.body.password || '');
    if (!email) throw new Error('Admin email is required.');
    if (db.admins.some(admin => admin.email === email)) throw new Error('An admin already exists with that email.');
    if (!passwordMeetsPolicy(password)) throw new Error('Password must contain at least 12 characters, letters, and a number.');
    if (password !== String(req.body.confirmPassword || '')) throw new Error('Passwords do not match.');
    db.admins.push({ id: crypto.randomUUID(), name, email, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await writeDb(db);
    flash(req, 'success', `${name} can now sign in as an admin.`);
  } catch (error) {
    flash(req, 'error', error.message);
  }
  res.redirect('/admin/team');
});

app.get('/admin/uploads/:filename/download', requireAdmin, (req, res) => {
  const filename = path.basename(req.params.filename || '');
  const uploadRoot = path.resolve(UPLOAD_DIR);
  const filePath = path.resolve(uploadRoot, filename);
  if (!filename || (!filePath.startsWith(`${uploadRoot}${path.sep}`) && filePath !== uploadRoot)) {
    return res.status(400).send(adminPage(req, 'Invalid Download', '<p class="notice error">Invalid file request.</p>'));
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).send(adminPage(req, 'File Not Found', '<p class="notice error">Uploaded file not found.</p>'));
  }
  res.download(filePath, filename);
});

app.get('/admin/uploads/:filename/view', requireAdmin, (req, res) => {
  const filename = path.basename(req.params.filename || '');
  const uploadRoot = path.resolve(UPLOAD_DIR);
  const filePath = path.resolve(uploadRoot, filename);
  if (!filename || (!filePath.startsWith(`${uploadRoot}${path.sep}`) && filePath !== uploadRoot)) {
    return res.status(400).send(adminPage(req, 'Invalid Preview', '<p class="notice error">Invalid file request.</p>'));
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).send(adminPage(req, 'File Not Found', '<p class="notice error">Uploaded file not found.</p>'));
  }
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(filePath);
});

app.get('/admin', requireAdmin, async (req, res) => {
  await refreshMysqlCache();
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);
  const ordersToday = db.orders.filter(o => o.createdAt.slice(0, 10) === today);
  const stat = (label, value) => `<div class="panel stat"><p class="muted">${label}</p><h2>${value}</h2></div>`;
  const recentRows = db.orders.slice(0, 8).map(o => `<tr><td>${orderUploadPreview(o)}</td><td><a href="/admin/orders/${esc(o.orderId)}">${esc(o.orderId)}</a><small class="muted">${esc(o.createdAt.slice(0, 10))}</small></td><td><span class="info-label">Customer:</span> ${esc(o.customerName)}<small class="muted"><span class="info-label">Mobile:</span> ${esc(o.mobile)}</small></td><td>${money(o.total)}</td><td><span class="status-pill">${esc(o.orderStatus)}</span></td><td><form class="quick-status-form" method="post" action="/admin/orders/${esc(o.orderId)}/status">${csrfField(req)}<select name="orderStatus">${statusOptions(o.orderStatus)}</select>${emailNotifyToggle(o, 'Email')}<button type="submit" class="btn">Save</button></form></td></tr>`).join('') || '<tr><td colspan="6">No orders yet.</td></tr>';
  res.send(adminPage(req, 'Dashboard', `${adminHeading('Overview', 'Dashboard', 'A clear view of sales, fulfilment and customer orders.', '<a class="btn ghost" href="/" target="_blank" rel="noopener">View storefront</a>')}<div class="stats">${stat('Orders Today', ordersToday.length)}${stat('Revenue Today', money(ordersToday.reduce((s, o) => s + o.total, 0)))}${stat('Total Orders', db.orders.length)}${stat('Total Revenue', money(db.orders.reduce((s, o) => s + o.total, 0)))}</div><section class="admin-section"><div class="admin-section-head"><h2>Recent Orders</h2><a class="btn ghost" href="/admin/orders">View all</a></div><div class="admin-table-wrap"><table><tr><th>Designs</th><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Quick Update</th></tr>${recentRows}</table></div></section>`));
});

function analyticsRow(db, dateKey) {
  const day = db.analytics?.[dateKey] || {};
  const orders = db.orders.filter(o => o.createdAt.slice(0, 10) === dateKey);
  return {
    dateKey,
    visits: Number(day.visits || 0),
    uniqueVisitors: Number(day.uniqueVisitors || 0),
    cartAdds: Number(day.cartAdds || 0),
    checkoutViews: Number(day.checkoutViews || 0),
    orders: orders.length,
    revenue: orders.reduce((sum, o) => sum + o.total, 0),
    thankYouViews: Number(day.thankYouViews || 0)
  };
}

function abandonmentRate(cartAdds, orders) {
  if (!cartAdds) return null;
  return Math.max(0, Math.min(100, ((cartAdds - orders) / cartAdds) * 100));
}

app.get('/admin/analytics', requireAdmin, async (req, res) => {
  await refreshMysqlCache();
  const db = readDb();
  const rangeDays = 14;
  const rows = [];
  for (let i = 0; i < rangeDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    rows.push(analyticsRow(db, date.toISOString().slice(0, 10)));
  }
  const today = rows[0];
  const last7 = rows.slice(0, 7).reduce((sum, r) => ({
    visits: sum.visits + r.visits, uniqueVisitors: sum.uniqueVisitors + r.uniqueVisitors, cartAdds: sum.cartAdds + r.cartAdds,
    checkoutViews: sum.checkoutViews + r.checkoutViews, orders: sum.orders + r.orders, thankYouViews: sum.thankYouViews + r.thankYouViews
  }), { visits: 0, uniqueVisitors: 0, cartAdds: 0, checkoutViews: 0, orders: 0, thankYouViews: 0 });
  const stat = (label, value, hint = '') => `<div class="panel stat"><p class="muted">${esc(label)}</p><h2>${esc(String(value))}</h2>${hint ? `<small class="muted">${esc(hint)}</small>` : ''}</div>`;
  const todayAbandon = abandonmentRate(today.cartAdds, today.orders);
  const last7Abandon = abandonmentRate(last7.cartAdds, last7.orders);
  const pct = value => value === null ? '—' : `${value.toFixed(0)}%`;
  const tableRows = rows.map(r => {
    const abandon = abandonmentRate(r.cartAdds, r.orders);
    return `<tr><td>${esc(r.dateKey)}</td><td>${r.visits}</td><td>${r.uniqueVisitors}</td><td>${r.cartAdds}</td><td>${r.checkoutViews}</td><td>${r.orders}</td><td>${r.thankYouViews}</td><td>${pct(abandon)}</td></tr>`;
  }).join('');
  const body = `${adminHeading('Insights', 'Visitor & Cart Analytics', 'Track visits, cart abandonment and Thank You page views across your funnel.')}<div class="stats">${stat('Visits Today', today.visits)}${stat('Unique Visitors Today', today.uniqueVisitors, 'Approximate')}${stat('Cart Adds Today', today.cartAdds)}${stat('Thank You Views Today', today.thankYouViews)}</div><div class="stats">${stat('Orders Today', today.orders)}${stat('Cart Abandonment Today', pct(todayAbandon), 'Cart adds that never became an order')}${stat('Cart Abandonment (7 days)', pct(last7Abandon))}${stat('Checkout Views (7 days)', last7.checkoutViews)}</div><section class="admin-section"><div class="admin-section-head"><h2>Last 14 days</h2><span class="muted">Numbers refresh about once a minute.</span></div><div class="admin-table-wrap"><table><tr><th>Date</th><th>Visits</th><th>Unique Visitors</th><th>Cart Adds</th><th>Checkout Views</th><th>Orders</th><th>Thank You Views</th><th>Abandoned</th></tr>${tableRows}</table></div><p class="muted" style="margin-top:14px">Visits count storefront page loads; Unique Visitors is an approximate daily count from a tracking cookie. Cart Adds counts every "Add to cart" and "Buy now". Abandoned = cart adds that never turned into a placed order.</p></section>`;
  res.send(adminPage(req, 'Analytics', body));
});

const statuses = ['New Order', 'Confirmed', 'Preparing', 'Ready to Ship', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

app.get('/admin/orders', requireAdmin, async (req, res) => {
  await refreshMysqlCache();
  const q = String(req.query.q || '').toLowerCase();
  const status = String(req.query.status || '');
  const orders = readDb().orders.filter(o => (!q || [o.orderId, o.customerName, o.mobile].some(v => String(v).toLowerCase().includes(q))) && (!status || o.orderStatus === status));
  const cards = orders.map(o => {
    const orderUrl = `/admin/orders/${encodeURIComponent(o.orderId)}`;
    return `<article class="admin-order-card"><header class="admin-order-head"><div><span class="order-kicker">Order</span><a class="admin-order-id" href="${esc(orderUrl)}">${esc(o.orderId)}</a><time datetime="${esc(o.createdAt)}">${esc(o.createdAt.slice(0, 10))}</time></div><span class="status-pill">${esc(o.orderStatus)}</span></header><div class="admin-order-grid"><div class="admin-order-block"><span class="order-field-label">Uploaded designs</span>${orderUploadPreview(o)}</div><dl class="admin-order-facts"><div><dt>Customer</dt><dd>${esc(o.customerName)}</dd></div><div><dt>Mobile</dt><dd>${esc(o.mobile)}</dd></div></dl><dl class="admin-order-facts"><div><dt>Amount</dt><dd class="order-amount">${money(o.total)}</dd></div><div><dt>Payment</dt><dd>${esc(o.paymentStatus)}</dd></div><div><dt>Tracking</dt><dd>${esc(o.trackingNumber || 'Pending')}</dd></div></dl><div class="admin-order-block admin-order-actions"><span class="order-field-label">Quick update</span><form class="order-status-form" method="post" action="/admin/orders/${esc(o.orderId)}/status">${csrfField(req)}<select name="orderStatus" aria-label="Status for ${esc(o.orderId)}">${statusOptions(o.orderStatus)}</select><div class="order-status-footer">${emailNotifyToggle(o)}<button type="submit" class="btn">Update</button></div></form><a class="order-details-link" href="${esc(orderUrl)}">Open order details</a></div></div></article>`;
  }).join('') || '<div class="admin-empty-state"><strong>No orders found</strong><span>Try changing the search or status filter.</span></div>';
  res.send(adminPage(req, 'Orders', `${adminHeading('Fulfilment', 'Orders', 'Manage customer orders, uploaded designs and delivery status.', `<span class="order-total">${orders.length} order${orders.length === 1 ? '' : 's'}</span>`)}<form class="order-filter"><input name="q" aria-label="Search orders" placeholder="Search order, customer, mobile" value="${esc(req.query.q || '')}"><select name="status" aria-label="Filter by status"><option value="">All statuses</option>${statuses.map(s => `<option ${status === s ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="btn">Filter</button></form><div class="orders-list">${cards}</div>`));
});

app.get('/admin/orders/:orderId', requireAdmin, async (req, res) => {
  await refreshMysqlCache();
  const order = readDb().orders.find(o => o.orderId === req.params.orderId);
  if (!order) return res.send(adminPage(req, 'Order Not Found', '<p class="notice error">Order not found.</p>'));
  const items = order.items.map(item => `<h3>${esc(item.productName)} x ${item.quantity}</h3><p><span class="info-label">Base:</span> ${money(item.basePrice)} | <span class="info-label">Line:</span> ${money(item.lineTotal)}</p>${item.customizations.map(c => `<div class="order-customization"><p><span class="info-label">${esc(c.title)}:</span> ${esc(c.value)} (+${money(c.price)})</p></div>`).join('')}`).join('');
  const notifications = (order.emailNotifications || []).slice(0, 4).map(n => `<li><strong>${esc(n.status)}</strong> ${esc(n.result)} ${n.to ? `to ${esc(n.to)}` : ''}<small>${esc(n.at)}</small></li>`).join('') || '<li class="muted">No status emails triggered yet.</li>';
  const form = `<form class="panel grid pad admin-fulfilment-form" method="post" action="/admin/orders/${esc(order.orderId)}" data-admin-form>${csrfField(req)}<h2>Fulfilment</h2><div class="grid two"><label>Order status<select name="orderStatus">${statusOptions(order.orderStatus)}</select></label><label>Payment status<select name="paymentStatus">${['Pending', 'Collected', 'Failed', 'Refunded'].map(s => `<option ${order.paymentStatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>${emailNotifyToggle(order, 'Send status email when changed')}<div class="grid two"><label>Courier<input name="courier" value="${esc(order.courier)}" maxlength="80" data-clean="text"></label><label>Tracking number<input name="trackingNumber" value="${esc(order.trackingNumber)}" maxlength="100"></label></div><label>Tracking URL<input type="url" name="trackingUrl" value="${esc(order.trackingUrl)}" placeholder="https://courier.example/track/..."></label><div class="grid two"><label>Shipping date<input type="date" name="shippingDate" value="${esc(order.shippingDate)}"></label><label>Estimated delivery<input type="date" name="estimatedDeliveryDate" value="${esc(order.estimatedDeliveryDate)}"></label></div><label>Admin notes<textarea name="adminNotes" maxlength="1000">${esc(order.adminNotes)}</textarea></label><button type="submit" class="btn primary">Save order</button></form>`;
  res.send(adminPage(req, order.orderId, `${adminHeading('Order details', order.orderId, `${order.customerName} · ${order.mobile}`, `<span class="status-pill">${esc(order.orderStatus)}</span>`)}<div class="page-grid admin-order-detail"><section class="panel pad"><div class="admin-section-head"><h2>Customer</h2><span class="order-total">${money(order.total)}</span></div><p>${esc(order.customerName)}<br>${esc(order.mobile)}${order.email ? `<br>${esc(order.email)}` : ''}</p><p>${esc(order.addressLine1)}${order.addressLine2 ? `, ${esc(order.addressLine2)}` : ''}<br>${esc(order.city)}, ${esc(order.state)} ${esc(order.pinCode)}</p><section class="uploaded-designs" id="uploaded-designs"><div class="uploaded-designs-head"><div><h2>Uploaded designs</h2><p class="muted">Open a design at full size or download the original file.</p></div><span>${orderUploads(order).length}</span></div>${orderUploadPreview(order, false)}</section><h2>Items</h2>${items}<h2>Pricing</h2>${summary({ subtotal: order.subtotal, shipping: order.shippingAmount, discount: order.discountAmount || 0, couponCode: order.couponCode || '', total: order.total })}</section><div class="grid">${form}<section class="panel pad"><h2>Email delivery</h2>${smtpConfigured() ? '<p class="notice success">SMTP is configured. Status emails can be sent.</p>' : '<p class="notice error">SMTP is not configured. Add SMTP settings in Hostinger before relying on customer emails.</p>'}<ul class="email-log">${notifications}</ul></section></div></div>`));
});

app.post('/admin/orders/:orderId', requireAdmin, async (req, res) => {
  const db = readDb();
  const order = db.orders.find(o => o.orderId === req.params.orderId);
  try {
    if (!order) {
      flash(req, 'error', 'Order not found.');
      return res.redirect('/admin/orders');
    }
    if (!statuses.includes(req.body.orderStatus) || !['Pending', 'Collected', 'Failed', 'Refunded'].includes(req.body.paymentStatus)) {
      flash(req, 'error', 'Choose a valid order and payment status.');
      return res.redirect(`/admin/orders/${req.params.orderId}`);
    }
    const trackingUrl = String(req.body.trackingUrl || '').trim();
    if (trackingUrl && !/^https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?$/i.test(trackingUrl)) {
      flash(req, 'error', 'Tracking URL must be a complete https:// link.');
      return res.redirect(`/admin/orders/${req.params.orderId}`);
    }
    let shippingDate = '';
    let estimatedDeliveryDate = '';
    try {
      shippingDate = optionalIsoDate(req.body.shippingDate, 'Shipping date');
      estimatedDeliveryDate = optionalIsoDate(req.body.estimatedDeliveryDate, 'Estimated delivery');
      if (shippingDate && estimatedDeliveryDate && estimatedDeliveryDate < shippingDate) {
        throw new Error('Estimated delivery cannot be earlier than the shipping date.');
      }
    } catch (error) {
      flash(req, 'error', error.message);
      return res.redirect(`/admin/orders/${req.params.orderId}`);
    }
    const previousStatus = order.orderStatus;
    const statusChanged = previousStatus !== req.body.orderStatus;
    Object.assign(order, { orderStatus: req.body.orderStatus, paymentStatus: req.body.paymentStatus, courier: cleanPlainText(req.body.courier).slice(0, 80), trackingNumber: cleanPlainText(req.body.trackingNumber).slice(0, 100), trackingUrl, shippingDate, estimatedDeliveryDate, adminNotes: cleanPlainText(req.body.adminNotes).slice(0, 1000), updatedAt: new Date().toISOString() });
    if (statusChanged) order.statusHistory.push({ status: req.body.orderStatus, at: order.updatedAt });
    let notification = null;
    if (statusChanged && req.body.notifyEmail) {
      notification = await notifyOrderStatus(order, previousStatus, req.body.orderStatus);
    }
    await writeDb(db);
    flash(req, notification && notification.result !== 'sent' ? 'error' : 'success', previousStatus !== req.body.orderStatus && req.body.notifyEmail ? (notification?.result === 'sent' ? 'Order updated and customer email sent.' : `Order updated, but email was not sent: ${notification?.message || 'delivery unavailable'}`) : 'Order updated.');
  } catch (error) {
    console.error('[admin] Order update failed:', error.code || error.message);
    flash(req, 'error', 'Order could not be updated. Please try again.');
  }
  res.redirect(`/admin/orders/${req.params.orderId}`);
});

app.post('/admin/orders/:orderId/status', requireAdmin, async (req, res) => {
  const db = readDb();
  const order = db.orders.find(o => o.orderId === req.params.orderId);
  try {
    if (!order || !statuses.includes(req.body.orderStatus)) {
      flash(req, 'error', order ? 'Choose a valid order status.' : 'Order not found.');
      return res.redirect(req.get('referer') || '/admin/orders');
    }
    const previousStatus = order.orderStatus;
    if (previousStatus !== req.body.orderStatus) {
      order.orderStatus = req.body.orderStatus;
      order.updatedAt = new Date().toISOString();
      order.statusHistory.push({ status: req.body.orderStatus, at: order.updatedAt });
      const notification = req.body.notifyEmail ? await notifyOrderStatus(order, previousStatus, req.body.orderStatus) : null;
      await writeDb(db);
      flash(req, req.body.notifyEmail && notification?.result !== 'sent' ? 'error' : 'success', req.body.notifyEmail ? (notification?.result === 'sent' ? `Status changed to ${req.body.orderStatus}; customer email sent.` : `Status changed, but email was not sent: ${notification?.message || 'delivery unavailable'}`) : `Status changed to ${req.body.orderStatus}.`);
    } else {
      flash(req, 'success', 'Status already up to date.');
    }
  } catch (error) {
    console.error('[admin] Quick status update failed:', error.code || error.message);
    flash(req, 'error', 'Order status could not be updated. Please try again.');
  }
  res.redirect(req.get('referer') || '/admin/orders');
});

app.get('/admin/product', requireAdmin, (req, res) => {
  const p = readDb().product;
  const galleryPreview = (p.galleryPaths || []).filter(Boolean).map((src, index) => `<figure><img src="${esc(src)}" alt="Gallery image ${index + 1}"><figcaption>Image ${index + 1}</figcaption></figure>`).join('');
  const basics = `<div class="admin-fields"><label>Product name<input name="name" value="${esc(p.name)}" maxlength="80" data-clean="name" data-admin-rule="name" required><small class="field-error" data-error-for="name"></small></label><label>Short description<textarea name="shortDescription" maxlength="240" data-clean="text" data-admin-rule="requiredText" required>${esc(p.shortDescription)}</textarea><small class="field-error" data-error-for="shortDescription"></small></label><label>Long description<textarea name="longDescription" maxlength="1200" data-clean="text" data-admin-rule="requiredText" required>${esc(p.longDescription)}</textarea><small class="field-error" data-error-for="longDescription"></small></label></div>`;
  const pricing = `<div class="admin-pricing-note"><strong>Prices include free shipping.</strong><span>The amount entered here is the final customer-facing product price before optional add-ons.</span></div><div class="admin-fields two"><label>Base price <span class="field-hint">Shipping included</span><span class="admin-money-input"><b>₹</b><input name="basePrice" value="${esc(p.basePrice)}" inputmode="decimal" maxlength="10" data-clean="decimal" data-admin-rule="positiveMoney" required></span><small class="field-error" data-error-for="basePrice"></small></label><label>Offer price <span class="field-hint">Leave blank for no discount</span><span class="admin-money-input"><b>₹</b><input name="offerPrice" value="${esc(p.offerPrice)}" inputmode="decimal" maxlength="10" data-clean="decimal" data-admin-rule="optionalMoney"></span><small class="field-error" data-error-for="offerPrice"></small></label></div>`;
  const media = `<div class="admin-media-grid"><div class="admin-media-preview"><span class="admin-field-label">Current main image</span>${p.imagePath ? `<img class="admin-image-preview" src="${esc(p.imagePath)}" alt="Current main product image">` : '<div class="admin-empty-media">No image selected</div>'}</div><div class="admin-fields"><label>Replace main image <span class="field-hint">JPG, PNG or WEBP · 5 MB maximum</span><input type="file" name="imageUpload" accept="image/jpeg,image/png,image/webp"></label><label>Or use an image path<input name="imagePath" value="${esc(p.imagePath)}" data-admin-rule="imagePath" placeholder="/img/example.jpeg"><small class="field-error" data-error-for="imagePath"></small></label></div></div><div class="admin-gallery-block"><div class="admin-card-subhead"><div><h3>Gallery</h3><p>These images appear as selectable product views.</p></div><span>${(p.galleryPaths || []).length} images</span></div><div class="admin-gallery-preview">${galleryPreview || '<p class="muted">No gallery images added.</p>'}</div><div class="admin-fields two"><label>Add gallery images <span class="field-hint">Up to 12 images</span><input type="file" name="galleryUploads" accept="image/jpeg,image/png,image/webp" multiple></label><label>Gallery paths <span class="field-hint">One /img/ or /catalog/ path per line</span><textarea name="galleryPaths" data-admin-rule="imagePaths">${esc((p.galleryPaths || []).join('\n'))}</textarea><small class="field-error" data-error-for="galleryPaths"></small></label></div></div>`;
  const content = `<div class="admin-fields"><label>Delivery promise<input name="deliveryText" value="${esc(p.deliveryText)}" maxlength="180" data-clean="text" data-admin-rule="requiredText" required><small class="field-error" data-error-for="deliveryText"></small></label><label>Product details<textarea name="details" maxlength="1200" data-clean="text" data-admin-rule="requiredText" required>${esc(p.details || '')}</textarea><small class="field-error" data-error-for="details"></small></label><label>Ingredients and allergens<textarea name="ingredients" maxlength="1200" data-clean="text" data-admin-rule="requiredText" required>${esc(p.ingredients || '')}</textarea><small class="field-error" data-error-for="ingredients"></small></label><label>Care and storage<textarea name="care" maxlength="800" data-clean="text" data-admin-rule="requiredText" required>${esc(p.care || '')}</textarea><small class="field-error" data-error-for="care"></small></label><label>FAQs <span class="field-hint">One per line as Question|Answer</span><textarea name="faq" data-admin-rule="faq" required>${esc(p.faq || '')}</textarea><small class="field-error" data-error-for="faq"></small></label></div>`;
  const availability = `<div class="admin-toggle-grid">${adminToggle('active', 'Product available', 'Show this product and allow customers to order it.', p.active)}${adminToggle('codAvailable', 'Cash on delivery', 'Allow COD for this product when store-level COD is enabled.', p.codAvailable)}</div>`;
  const form = `<form class="admin-form" method="post" action="/admin/product" enctype="multipart/form-data" data-admin-form>${csrfField(req)}${adminFormSection('01', 'Product information', 'Clear customer-facing title and descriptions.', basics)}${adminFormSection('02', 'Pricing', 'Set the regular price and optional discounted price.', pricing)}${adminFormSection('03', 'Product media', 'Manage the main image and product gallery.', media)}${adminFormSection('04', 'Customer information', 'Delivery, contents, allergens, care instructions and FAQs.', content)}${adminFormSection('05', 'Availability', 'Control whether customers can order and pay on delivery.', availability)}<div class="admin-save-bar"><div><strong>Ready to publish?</strong><span>Changes update the live storefront immediately after saving.</span></div><button type="submit" class="btn primary" data-loading="Saving product...">Save product</button></div></form>`;
  res.send(adminPage(req, 'Product', `${adminHeading('Catalogue', 'Product', 'Manage the product customers see and order.', '<a class="btn ghost" href="/" target="_blank" rel="noopener">Preview storefront</a>')}${form}`));
});

app.post('/admin/product', requireAdmin, productUpload.fields([{ name: 'imageUpload', maxCount: 1 }, { name: 'galleryUploads', maxCount: 12 }]), async (req, res) => {
  try { assertCsrf(req); } catch (e) { removeFiles([...(req.files?.imageUpload || []), ...(req.files?.galleryUploads || [])]); flash(req, 'error', e.message); return res.redirect('/admin/product'); }
  const db = readDb();
  try {
    const mainUpload = req.files?.imageUpload?.[0];
    const galleryUploads = req.files?.galleryUploads || [];
    const allProductUploads = [mainUpload, ...galleryUploads].filter(Boolean);
    assertUploadedImages(allProductUploads);
    const typedGallery = String(req.body.galleryPaths || '')
      .split(/\r?\n/)
      .map(value => value.trim())
      .filter(Boolean)
      .map((value, index) => validatePublicPath(value, `Gallery path ${index + 1}`));
    const uploadedGallery = galleryUploads.map(uploadedPublicPath);
    const name = requireName(req.body.name, 'Product name');
    const basePrice = parseMoneyField(req.body.basePrice, 'Base Price', true);
    const offerPrice = parseMoneyField(req.body.offerPrice, 'Offer Price');
    if (basePrice <= 0) throw new Error('Base Price must be greater than zero.');
    if (offerPrice && offerPrice >= basePrice) throw new Error('Offer Price must be lower than Base Price. Leave it blank when there is no discount.');
    const imagePath = uploadedPublicPath(mainUpload) || validatePublicPath(req.body.imagePath || db.product.imagePath, 'Main Image');
    const galleryPaths = [...typedGallery, ...uploadedGallery].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, 12);
    if (!galleryPaths.length && Array.isArray(db.product.galleryPaths)) galleryPaths.push(...db.product.galleryPaths.filter(Boolean).slice(0, 12));
    if (!galleryPaths.length) throw new Error('Add at least one gallery image.');
    Object.assign(db.product, { name, shortDescription: requireLength(req.body.shortDescription, 'Short Description', 4, 240), longDescription: requireLength(req.body.longDescription, 'Long Description', 4, 1200), basePrice, offerPrice, imagePath, galleryPaths, active: Boolean(req.body.active), codAvailable: Boolean(req.body.codAvailable), deliveryText: requireLength(req.body.deliveryText, 'Delivery Text', 4, 180), details: requireLength(req.body.details, 'Product Details', 4, 1200), ingredients: requireLength(req.body.ingredients, 'Ingredients', 4, 1200), care: requireLength(req.body.care, 'Care / Storage', 4, 800), faq: parseFaq(req.body.faq) });
    await writeDb(db);
    flash(req, 'success', 'Product updated.');
  } catch (e) {
    removeFiles([...(req.files?.imageUpload || []), ...(req.files?.galleryUploads || [])]);
    flash(req, 'error', e.message);
  }
  res.redirect('/admin/product');
});

app.get('/admin/customizations', requireAdmin, (req, res) => {
  const db = readDb();
  const labels = { checkbox: 'Add-on counter', file: 'Image upload', text: 'Short text', textarea: 'Long message', select: 'Choice cards' };
  const typeOptions = value => Object.entries(labels).map(([type, label]) => `<option value="${type}" ${value === type ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const optionFields = (option, types) => `data-option-fields="${types.join(' ')}"${types.includes(option.type || 'checkbox') ? '' : ' hidden'}`;
  const editorFields = option => `<div class="admin-fields two"><label>Customer-facing title<input name="title" value="${esc(option.title || '')}" maxlength="80" data-clean="name" data-admin-rule="name" required><small class="field-error" data-error-for="title"></small></label><label>Field type<select name="type" data-option-type>${typeOptions(option.type || 'checkbox')}</select></label></div><div class="admin-fields"><label>Description<textarea name="description" maxlength="240" data-clean="text" data-admin-rule="requiredText" required>${esc(option.description || '')}</textarea><small class="field-error" data-error-for="description"></small></label></div><div class="admin-fields two"><label>Price per selection<span class="admin-money-input"><b>₹</b><input name="price" value="${esc(option.price ?? 0)}" inputmode="decimal" maxlength="10" data-clean="decimal" data-admin-rule="optionalMoney"></span><small class="field-error" data-error-for="price"></small></label><label>Display order <span class="field-hint">Lower numbers appear first</span><input name="order" value="${esc(option.order ?? 50)}" inputmode="numeric" maxlength="3" data-clean="digits" data-admin-rule="displayOrder" required><small class="field-error" data-error-for="order"></small></label></div><div class="admin-fields two" ${optionFields(option, ['text', 'textarea'])}><label>Placeholder<input name="placeholder" value="${esc(option.placeholder || '')}" maxlength="120" data-clean="text" placeholder="Example shown inside the field"></label><label>Character limit<input name="maxLength" value="${esc(option.maxLength || '')}" inputmode="numeric" maxlength="4" data-clean="digits" data-admin-rule="characterLimit" placeholder="Optional"><small class="field-error" data-error-for="maxLength"></small></label></div><div class="admin-fields" ${optionFields(option, ['select'])}><label>Choices <span class="field-hint">At least two unique choices, one per line</span><textarea name="choices" data-admin-rule="choices">${esc((option.choices || []).join('\n'))}</textarea><small class="field-error" data-error-for="choices"></small></label></div><div class="admin-toggle-grid">${adminToggle('active', 'Active on storefront', 'Customers can see and use this option.', option.active !== false)}${adminToggle('required', 'Customer must complete', 'Require a value before adding to cart.', Boolean(option.required), optionFields(option, ['text', 'textarea', 'select']))}${adminToggle('uploadRequired', 'Photo is required', 'Require at least one valid image upload.', Boolean(option.uploadRequired), optionFields(option, ['file']))}</div>`;
  const editCards = [...db.options].sort((a, b) => a.order - b.order).map(o => `<article class="admin-option-card"><form method="post" action="/admin/customizations/update" data-admin-form data-option-editor>${csrfField(req)}<input type="hidden" name="id" value="${o.id}"><header class="admin-option-head"><div><span class="admin-option-type">${esc(labels[o.type] || o.type)}</span><h2>${esc(o.title)}</h2><p>${money(o.price)} · Position ${esc(o.order)}</p></div><span class="admin-status ${o.active ? 'is-live' : ''}">${o.active ? 'Active' : 'Hidden'}</span></header><div class="admin-option-body">${editorFields(o)}</div><footer class="admin-option-actions"><button class="btn primary" data-loading="Saving...">Save changes</button></footer></form><form method="post" action="/admin/customizations/delete" class="admin-option-delete">${csrfField(req)}<input type="hidden" name="id" value="${o.id}"><button class="btn danger" data-confirm="Delete ${esc(o.title)}? Existing orders will keep their saved details.">Delete option</button></form></article>`).join('');
  const blankOption = { title: '', description: '', type: 'checkbox', price: 0, order: 50, active: true, choices: [], placeholder: '', maxLength: '' };
  const createForm = `<details class="admin-create-option"><summary><span>+</span><div><strong>Add customization</strong><small>Create another customer option</small></div></summary><form method="post" action="/admin/customizations" data-admin-form data-option-editor>${csrfField(req)}<div class="admin-option-body">${editorFields(blankOption)}</div><div class="admin-option-actions"><button class="btn primary" data-loading="Creating...">Create customization</button></div></form></details>`;
  res.send(adminPage(req, 'Customizations', `${adminHeading('Storefront options', 'Customizations', 'Control personalisation fields, pricing and display order.', `<span class="order-total">${db.options.length} option${db.options.length === 1 ? '' : 's'}</span>`)}<div class="admin-options">${editCards}</div>${createForm}`));
});

app.post('/admin/customizations', requireAdmin, async (req, res) => {
  const db = readDb();
  try {
    db.options.push({ id: db.nextOptionId++, ...normalizedOptionInput(req.body) });
    await writeDb(db);
    flash(req, 'success', 'Customization saved.');
  } catch (e) {
    flash(req, 'error', e.message);
  }
  res.redirect('/admin/customizations');
});

app.post('/admin/customizations/update', requireAdmin, async (req, res) => {
  const db = readDb();
  const option = db.options.find(o => String(o.id) === String(req.body.id));
  if (option) {
    try {
      Object.assign(option, normalizedOptionInput(req.body));
      await writeDb(db);
      flash(req, 'success', 'Customization updated.');
    } catch (e) {
      flash(req, 'error', e.message);
    }
  }
  res.redirect('/admin/customizations');
});

app.post('/admin/customizations/delete', requireAdmin, async (req, res) => {
  const db = readDb();
  const option = db.options.find(o => String(o.id) === String(req.body.id));
  if (!option) {
    flash(req, 'error', 'Customization not found.');
    return res.redirect('/admin/customizations');
  }
  const optionUsed = (db.orders || []).some(order => (order.items || []).some(item => (item.customizations || []).some(customization => String(customization.optionId) === String(option.id))));
  if (optionUsed) {
    option.active = false;
    await writeDb(db);
    flash(req, 'success', 'Customization is used by existing orders, so it was safely hidden instead of deleted.');
    return res.redirect('/admin/customizations');
  }
  db.options = db.options.filter(o => String(o.id) !== String(req.body.id));
  await writeDb(db);
  flash(req, 'success', 'Customization deleted.');
  res.redirect('/admin/customizations');
});

app.get('/admin/coupons', requireAdmin, (req, res) => {
  const db = readDb();
  const editorFields = coupon => `<div class="admin-fields two"><label>Coupon code<input name="code" value="${esc(coupon.code || '')}" maxlength="20" data-clean="code" placeholder="e.g. SAVE10" required><small class="field-error" data-error-for="code"></small></label><label>Discount type<select name="type"><option value="percent" ${coupon.type !== 'flat' ? 'selected' : ''}>Percent off</option><option value="flat" ${coupon.type === 'flat' ? 'selected' : ''}>Flat amount off (₹)</option></select></label></div><div class="admin-fields two"><label>Discount value <span class="field-hint">Percent (1-100) or flat ₹ amount</span><input name="value" value="${esc(coupon.value ?? '')}" inputmode="decimal" maxlength="10" data-clean="decimal" data-admin-rule="positiveMoney" required><small class="field-error" data-error-for="value"></small></label><div></div></div><div class="admin-toggle-grid">${adminToggle('active', 'Active', 'Customers can apply this coupon at checkout.', coupon.active !== false)}</div>`;
  const editCards = [...db.coupons].sort((a, b) => (a.code || '').localeCompare(b.code || '')).map(c => `<article class="admin-option-card"><form method="post" action="/admin/coupons/update" data-admin-form>${csrfField(req)}<input type="hidden" name="id" value="${c.id}"><header class="admin-option-head"><div><span class="admin-option-type">${c.type === 'flat' ? 'Flat amount' : 'Percent'}</span><h2>${esc(c.code)}</h2><p>${c.type === 'flat' ? money(c.value) : `${Number(c.value)}%`} off</p></div><span class="admin-status ${c.active ? 'is-live' : ''}">${c.active ? 'Active' : 'Disabled'}</span></header><div class="admin-option-body">${editorFields(c)}</div><footer class="admin-option-actions"><button class="btn primary" data-loading="Saving...">Save changes</button></footer></form><form method="post" action="/admin/coupons/delete" class="admin-option-delete">${csrfField(req)}<input type="hidden" name="id" value="${c.id}"><button class="btn danger" data-confirm="Delete coupon ${esc(c.code)}? This cannot be undone.">Delete coupon</button></form></article>`).join('');
  const blankCoupon = { code: '', type: 'percent', value: '', active: true };
  const createForm = `<details class="admin-create-option"><summary><span>+</span><div><strong>Add coupon</strong><small>Create a new promo code for checkout</small></div></summary><form method="post" action="/admin/coupons" data-admin-form>${csrfField(req)}<div class="admin-option-body">${editorFields(blankCoupon)}</div><div class="admin-option-actions"><button class="btn primary" data-loading="Creating...">Create coupon</button></div></form></details>`;
  res.send(adminPage(req, 'Coupons', `${adminHeading('Promotions', 'Coupons', 'Create promo codes customers can apply at checkout. Codes stay private unless you share them.', `<span class="order-total">${db.coupons.length} coupon${db.coupons.length === 1 ? '' : 's'}</span>`)}<div class="admin-options">${editCards || '<div class="admin-empty-state"><strong>No coupons yet</strong><span>Create one below to get started.</span></div>'}</div>${createForm}`));
});

app.post('/admin/coupons', requireAdmin, async (req, res) => {
  const db = readDb();
  try {
    db.coupons.push({ id: db.nextCouponId++, ...normalizedCouponInput(db, req.body), createdAt: new Date().toISOString() });
    await writeDb(db);
    flash(req, 'success', 'Coupon created.');
  } catch (e) {
    flash(req, 'error', e.message);
  }
  res.redirect('/admin/coupons');
});

app.post('/admin/coupons/update', requireAdmin, async (req, res) => {
  const db = readDb();
  const coupon = db.coupons.find(c => String(c.id) === String(req.body.id));
  if (coupon) {
    try {
      Object.assign(coupon, normalizedCouponInput(db, req.body, coupon.id));
      await writeDb(db);
      flash(req, 'success', 'Coupon updated.');
    } catch (e) {
      flash(req, 'error', e.message);
    }
  }
  res.redirect('/admin/coupons');
});

app.post('/admin/coupons/delete', requireAdmin, async (req, res) => {
  const db = readDb();
  const coupon = db.coupons.find(c => String(c.id) === String(req.body.id));
  if (!coupon) {
    flash(req, 'error', 'Coupon not found.');
    return res.redirect('/admin/coupons');
  }
  db.coupons = db.coupons.filter(c => String(c.id) !== String(req.body.id));
  await writeDb(db);
  flash(req, 'success', 'Coupon deleted.');
  res.redirect('/admin/coupons');
});

app.get('/admin/settings', requireAdmin, (req, res) => {
  const s = readDb().settings;
  const identity = `<div class="admin-media-grid settings-identity"><div class="admin-media-preview"><span class="admin-field-label">Current logo</span><img class="admin-logo-preview" src="${esc(s.logoPath)}" alt="Current store logo"></div><div class="admin-fields"><label>Store name<input name="storeName" value="${esc(s.storeName)}" maxlength="80" data-clean="name" data-admin-rule="name" required><small class="field-error" data-error-for="storeName"></small></label><label>Logo path<input name="logoPath" value="${esc(s.logoPath)}" data-admin-rule="imagePath" required><small class="field-error" data-error-for="logoPath"></small></label></div></div>`;
  const support = `<div class="admin-fields two"><label>Contact phone<input name="contactPhone" value="${esc(s.contactPhone)}" data-clean="phone" data-admin-rule="phone" inputmode="tel" autocomplete="tel" required><small class="field-error" data-error-for="contactPhone"></small></label><label>WhatsApp number<input name="whatsappNumber" value="${esc(s.whatsappNumber)}" data-clean="phone" data-admin-rule="phone" inputmode="tel" required><small class="field-error" data-error-for="whatsappNumber"></small></label></div><div class="admin-fields"><label>Support email<input type="email" name="supportEmail" value="${esc(s.supportEmail)}" maxlength="254" data-admin-rule="email" required><small class="field-error" data-error-for="supportEmail"></small></label><label>Store address<textarea name="storeAddress" maxlength="400" data-clean="text" data-admin-rule="requiredText" required>${esc(s.storeAddress)}</textarea><small class="field-error" data-error-for="storeAddress"></small></label></div>`;
  const delivery = `<div class="admin-pricing-note"><strong>Free shipping is included in product prices.</strong><span>Customers will not see or pay a separate shipping fee at cart or checkout.</span></div><input type="hidden" name="shippingFee" value="0"><input type="hidden" name="freeShippingMinimum" value="0"><div class="admin-fields"><label>Delivery promise<input name="deliveryText" value="${esc(s.deliveryText)}" maxlength="180" data-clean="text" data-admin-rule="requiredText" required><small class="field-error" data-error-for="deliveryText"></small></label></div><div class="admin-toggle-grid">${adminToggle('codEnabled', 'Accept cash on delivery orders', 'This store currently uses COD as its checkout payment method.', s.codEnabled)}</div>`;
  const emailStatus = smtpConfigured() ? '<span class="admin-status is-live">Configured</span>' : '<span class="admin-status">Needs setup</span>';
  const emailPanel = `<div id="email-integration" class="admin-integration-row"><div><strong>Status email delivery</strong><p>${smtpConfigured() ? 'SMTP is configured in the server environment.' : 'Customer status emails will not send until SMTP_HOST, SMTP_USER, SMTP_PASSWORD and SMTP_FROM are added in Hostinger.'}</p></div><div class="email-integration-actions">${emailStatus}<label class="test-email-field">Test recipient<input type="email" name="testEmail" value="${esc(s.supportEmail || DEFAULT_ORDER_EMAIL)}" maxlength="254" autocomplete="email"></label><button class="btn ghost" type="submit" formaction="/admin/email/test" formmethod="post" formnovalidate data-loading="Sending...">Send test email</button></div></div>`;
  const form = `<form class="admin-form" method="post" action="/admin/settings" data-admin-form>${csrfField(req)}${adminFormSection('01', 'Store identity', 'Brand information shown throughout the storefront.', identity)}${adminFormSection('02', 'Customer support', 'Public contact, WhatsApp and address details.', support)}${adminFormSection('03', 'Delivery and payment', 'Delivery promise, free shipping note and checkout availability.', delivery)}${adminFormSection('04', 'Email integration', 'Operational status for customer order emails.', emailPanel)}<div class="admin-save-bar"><div><strong>Store-wide settings</strong><span>These values update customer pages immediately.</span></div><button class="btn primary" data-loading="Saving settings...">Save settings</button></div></form>`;
  res.send(adminPage(req, 'Settings', `${adminHeading('Operations', 'Settings', 'Manage identity, support, delivery and checkout availability.')}${form}`));
});

app.post('/admin/settings', requireAdmin, async (req, res) => {
  const db = readDb();
  try {
    const storeName = requireName(req.body.storeName, 'Store name');
    const freeShippingEnabled = true;
    const freeShippingMinimum = 0;
    const supportEmail = optionalEmail(req.body.supportEmail, 'Support Email');
    if (!supportEmail) throw new Error('Support Email is required.');
    Object.assign(db.settings, { storeName, logoPath: validatePublicPath(req.body.logoPath, 'Logo Path'), contactPhone: requirePhone(req.body.contactPhone, 'Contact Phone'), whatsappNumber: requirePhone(req.body.whatsappNumber, 'WhatsApp Number'), supportEmail, storeAddress: requireLength(req.body.storeAddress, 'Store Address', 4, 400), shippingFee: 0, freeShippingEnabled, freeShippingMinimum, codEnabled: Boolean(req.body.codEnabled), deliveryText: requireLength(req.body.deliveryText, 'Delivery Text', 4, 180) });
    await writeDb(db);
    flash(req, 'success', 'Settings updated.');
  } catch (e) {
    flash(req, 'error', e.message);
  }
  res.redirect('/admin/settings');
});

app.get('/terms-and-conditions', (req, res) => {
  const body = `<main class="container legal-page"><section class="panel pad legal-content"><p class="eyebrow">Legal</p><h1>Terms and Conditions</h1><p class="lead">Welcome to ChocoMedley (https://www.chocomedley.com/). Please read these Terms and Conditions ("Terms") carefully before using our website. By accessing or using our website, you agree to be bound by these Terms. If you do not agree with any part of these terms, you must not use our website.</p>

<h2>1. Introduction</h2>
<p>ChocoMedley ("we," "us," or "our") operates this website to provide information about our products and services. These Terms govern your access to and use of the website and any orders placed through our platform.</p>

<h2>2. User Eligibility</h2>
<p>By using this website, you represent and warrant that you are at least 18 years of age (or the age of majority in your jurisdiction) or are accessing the site with the permission and supervision of a parent or guardian.</p>

<h2>3. Products and Pricing</h2>
<ul>
<li><strong>Product Descriptions:</strong> We strive to ensure that all descriptions, images, and pricing of our chocolate products are accurate. However, we do not warrant that product descriptions or other content on the site are error-free.</li>
<li><strong>Pricing:</strong> All prices are subject to change without notice. We reserve the right to modify or discontinue products at any time.</li>
<li><strong>Availability:</strong> All orders are subject to availability. If an item you ordered is out of stock, we will notify you and process a refund or offer a suitable alternative.</li>
</ul>

<h2>4. Orders and Payment</h2>
<ul>
<li><strong>Order Acceptance:</strong> Your order is an offer to buy products from us. We reserve the right to accept or decline your order for any reason, including but not limited to, availability of products, errors in pricing, or suspicion of fraud.</li>
<li><strong>Payment:</strong> We accept payments through secure methods provided on the checkout page. By submitting your payment information, you authorize us to charge the total amount of your order to your chosen payment method.</li>
</ul>

<h2>5. Shipping and Delivery</h2>
<ul>
<li><strong>Delivery Policy:</strong> We make every effort to deliver your order in a timely manner. However, we are not responsible for delays caused by shipping carriers, weather, or circumstances beyond our reasonable control.</li>
<li><strong>Risk of Loss:</strong> The risk of loss and title for items purchased from us passes to you upon our delivery of the items to the carrier.</li>
</ul>

<h2>6. Returns and Refunds</h2>
<p>Given the perishable nature of chocolate and food products, returns are handled on a case-by-case basis. If you receive a damaged or incorrect order, please contact us within 24 hours of delivery. We may require photographic evidence of the issue.</p>

<h2>7. Intellectual Property</h2>
<p>All content on this website, including text, logos, images, and software, is the property of ChocoMedley and is protected by intellectual property laws. You may not reproduce, distribute, or modify any content without our prior written consent.</p>

<h2>8. Limitation of Liability</h2>
<p>To the fullest extent permitted by law, ChocoMedley shall not be liable for any indirect, incidental, special, or consequential damages resulting from the use or inability to use our products or services, even if we have been advised of the possibility of such damages.</p>

<h2>9. Privacy</h2>
<p>Your use of our website is also governed by our <a href="/privacy-policy">Privacy Policy</a>, which explains how we collect and protect your personal data.</p>

<h2>10. Governing Law</h2>
<p>These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes arising out of these terms shall be subject to the exclusive jurisdiction of the courts in India.</p>

<h2>11. Contact Information</h2>
<p>If you have any questions or concerns regarding these Terms and Conditions, please contact us:</p>
<p>Email: chocomedleyteam@gmail.com<br>Phone: 7337002088</p>
</section></main>`;
  res.send(page(req, 'Terms and Conditions', body));
});

app.get('/privacy-policy', (req, res) => {
  const body = `<main class="container legal-page"><section class="panel pad legal-content"><p class="eyebrow">Legal</p><h1>Privacy Policy</h1><p class="lead">Welcome to ChocoMedley (https://www.chocomedley.com/). We respect your privacy and are committed to protecting the personal information you share with us. This Privacy Policy outlines how we collect, use, disclose, and safeguard your data when you visit our website or make a purchase from us.</p>

<h2>1. Information We Collect</h2>
<p>We collect information directly from you when you browse our site, create an account, place an order, or communicate with us.</p>
<ul>
<li><strong>Personal Details:</strong> Name, billing address, shipping address, email address (chocomedleyteam@gmail.com), and contact phone number (7337002088).</li>
<li><strong>Order &amp; Transaction Data:</strong> Items purchased, payment method (handled securely by our payment gateway providers), and delivery preferences.</li>
<li><strong>Technical &amp; Usage Data:</strong> IP address, browser type, device information, pages viewed, and cookies (to help improve site performance and store cart items).</li>
</ul>

<h2>2. How We Use Your Information</h2>
<p>We use the personal information we collect for the following operational purposes:</p>
<ul>
<li><strong>Fulfilling Orders:</strong> To process, package, ship, and deliver your chocolate orders.</li>
<li><strong>Customer Support:</strong> To communicate order status, send tracking details, and answer queries sent to chocomedleyteam@gmail.com or via phone at 7337002088.</li>
<li><strong>Site Improvement:</strong> To optimize website navigation, store preferences, and analyze web traffic patterns.</li>
<li><strong>Marketing Communications:</strong> With your consent, to notify you about seasonal promotions, special offers, or new flavor launches. You can opt out at any time.</li>
</ul>

<h2>3. Sharing &amp; Disclosure of Information</h2>
<p>We value your trust and do not sell, rent, or trade your personal information to third parties. We only share data with trusted third-party service providers who help us run our business:</p>
<ul>
<li><strong>Logistics &amp; Delivery Partners:</strong> To ensure your orders reach your doorstep.</li>
<li><strong>Payment Processors:</strong> Secure gateway providers to complete your financial transactions (we do not store full payment card/banking details on our servers).</li>
<li><strong>Legal Requirements:</strong> If required by law, regulation, or legal process to protect our rights or comply with a judicial proceeding.</li>
</ul>

<h2>4. Cookies and Tracking Technologies</h2>
<p>We use cookies and similar tracking technologies to enhance your browsing experience, remember shopping cart items, and understand how visitors interact with our website. You can choose to disable cookies through your web browser settings, though doing so may affect some site functionality.</p>

<h2>5. Data Security</h2>
<p>We implement appropriate technical and administrative security measures to guard your personal data against unauthorized access, alteration, disclosure, or destruction. However, no internet transmission or electronic storage system is 100% secure.</p>

<h2>6. Your Rights</h2>
<p>Depending on applicable local privacy laws (including the Information Technology Act and applicable Digital Personal Data Protection laws in India), you have the right to:</p>
<ul>
<li>Access, update, or correct your personal information.</li>
<li>Request the deletion of your personal data held by us, subject to accounting or legal record-keeping obligations.</li>
<li>Opt out of receiving marketing emails or SMS communications.</li>
</ul>

<h2>7. Children's Privacy</h2>
<p>Our website is not intended for use by children under the age of 18 without parental supervision. We do not knowingly collect personal information from minors.</p>

<h2>8. Changes to This Policy</h2>
<p>We may update this Privacy Policy periodically to reflect changes in our practices or applicable regulations. The "Last Updated" date at the top will indicate when the latest revisions took effect.</p>

<h2>9. Contact Us</h2>
<p>If you have any questions, feedback, or grievances regarding this Privacy Policy or your personal data, please contact us at:</p>
<p><strong>REVALLA SATYAVANI</strong><br>Email: chocomedleyteam@gmail.com<br>Phone: 7337002088</p>
</section></main>`;
  res.send(page(req, 'Privacy Policy', body));
});

app.get('/robots.txt', (_, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n'));
app.get('/sitemap.xml', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  const xmlOrigin = origin.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${xmlOrigin}/</loc></url><url><loc>${xmlOrigin}/track</loc></url><url><loc>${xmlOrigin}/privacy-policy</loc></url><url><loc>${xmlOrigin}/terms-and-conditions</loc></url></urlset>`);
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(`[request] ${req.method} ${req.originalUrl} failed:`, error);
  const uploadMessages = {
    LIMIT_FILE_SIZE: 'One of the uploaded images is too large. Please upload images under 5 MB.',
    LIMIT_FILE_COUNT: `You can upload up to ${MAX_ORDER_QUANTITY} images at a time.`,
    LIMIT_UNEXPECTED_FILE: 'Too many images were selected for this field.'
  };
  const message = uploadMessages[error?.code] || (String(error?.message || '').startsWith('Only JPG') ? error.message : 'Something went wrong. Please try again.');
  if (req.session) flash(req, 'error', message);
  if (req.method === 'POST') return res.redirect(req.get('referer') || '/');
  res.status(500).send(page(req, 'Something Went Wrong', `<main class="container"><section class="panel pad"><h1>Something went wrong</h1><p class="lead">${esc(message)}</p><a class="btn primary" href="/">Back to product</a></section></main>`));
});

app.use((req, res) => res.status(404).send(page(req, 'Page Not Found', '<main class="container"><section class="panel pad"><h1>Page not found</h1><a class="btn primary" href="/">Back home</a></section></main>')));

const STORAGE_RETRY_MS = 30000;

async function tryInitStorage() {
  storageStatus.attempts += 1;
  storageStatus.lastAttemptAt = new Date().toISOString();
  try {
    await initStorage();
    storageStatus.ready = true;
    storageStatus.error = null;
    console.log(`[boot] Storage ready (driver=${DB_DRIVER}) after attempt ${storageStatus.attempts}.`);
    return true;
  } catch (error) {
    storageStatus.ready = false;
    storageStatus.error = error;
    console.error(`[boot] Storage init FAILED (attempt ${storageStatus.attempts}, driver=${DB_DRIVER}, code=${error.code || 'none'}): ${scrubSecrets(error.message)}`);
    return false;
  }
}

async function start() {
  const ready = await tryInitStorage();
  const server = app.listen(PORT, () => {
    console.log(`[boot] HTTP server listening on port ${PORT}${ready ? '' : ' in DEGRADED mode (storage unavailable, serving maintenance page)'}`);
  });
  server.on('error', error => {
    console.error('[fatal] HTTP server error:', error);
    process.exit(1);
  });
  if (!ready) {
    const retry = setInterval(async () => {
      if (storageStatus.ready) return clearInterval(retry);
      console.log('[boot] Retrying storage init...');
      if (await tryInitStorage()) {
        clearInterval(retry);
        console.log('[boot] Storage recovered; serving normally.');
      }
    }, STORAGE_RETRY_MS);
    retry.unref();
  }
  if (DB_DRIVER === 'mysql') {
    const poll = setInterval(() => { refreshMysqlCache(); }, 5000);
    poll.unref();
  }
  const analyticsFlush = setInterval(() => { flushAnalytics(); }, 60000);
  analyticsFlush.unref();
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      console.log(`[shutdown] ${signal} received; closing server.`);
      flushAnalytics().finally(() => server.close(() => process.exit(0)));
    });
  }
}

start();
