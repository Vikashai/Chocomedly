const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(ROOT, 'public', 'uploads');
const DB_FILE = path.join(DATA_DIR, 'store.json');
const PRODUCT_IMAGES = [
  '/img/WhatsApp Image 2026-08-11 at 7.32.16 PM.jpeg',
  '/img/WhatsApp Image 2026-08-11 at 7.36.53 PM.jpeg',
  '/img/WhatsApp Image 2026-08-11 at 7.49.51 PM.jpeg',
  '/img/WhatsApp Image 2026-08-11 at 7.56.50 PM.jpeg'
];
const ASSET_VERSION = 'premium-20260813-15';
const LOG_DIR = path.join(ROOT, 'storage', 'logs');
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@chocomedley.in';
const IS_RENDER = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_SERVICE_ID);
const DEMO_ADMIN_ENABLED = process.env.DEMO_ADMIN_ENABLED === 'true' || IS_RENDER || process.env.NODE_ENV !== 'production';
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || '';
const DEMO_ADMIN_ALLOW_ANY_LOGIN = process.env.DEMO_ADMIN_ALLOW_ANY_LOGIN === 'true';
const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry'
];

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});
app.use(express.static(path.join(ROOT, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
}));
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
}));
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production.');
}

app.use(session({
  name: 'chocomedley.sid',
  secret: process.env.SESSION_SECRET || 'change-this-before-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' ? 'auto' : false, maxAge: 1000 * 60 * 60 * 8 }
}));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `custom-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  }
});

function seed() {
  return {
    admins: demoAdmins(),
    settings: {
      storeName: 'Chocomedley',
      logoPath: '/img/WhatsApp Image 2026-08-12 at 1.24.57 PM.jpeg',
      contactPhone: '+91 98765 43210',
      whatsappNumber: '+91 98765 43210',
      supportEmail: 'hello@chocomedley.in',
      storeAddress: 'Artisan chocolate kitchen, India',
      shippingFee: 200,
      freeShippingEnabled: false,
      freeShippingMinimum: 0,
      codEnabled: true,
      deliveryText: 'Freshly prepared and usually dispatched within 1-2 business days.'
    },
    product: {
      id: 1,
      name: 'Rakhi Chocolate Hamper',
      slug: 'rakhi-chocolate-hamper',
      shortDescription: 'A handcrafted chocolate hamper made for gifting, celebrations, and sweet everyday moments.',
      longDescription: 'The Rakhi Chocolate Hamper brings together rich homemade chocolates in a premium gift-ready presentation. Add a custom image, choose extra almonds, and make the hamper personal without slowing down checkout.',
      basePrice: 1000,
      offerPrice: '',
      imagePath: PRODUCT_IMAGES[0],
      galleryPaths: PRODUCT_IMAGES,
      active: true,
      codAvailable: true,
      deliveryText: 'Usually dispatched within 1-2 business days.',
      details: 'A premium personalized chocolate hamper with photo-printed chocolates, gift-ready packaging, and a refined handmade finish. Built for birthdays, Rakhi, celebrations, return gifts, and thoughtful personal gifting.',
      ingredients: 'Milk chocolate, cocoa solids, sugar, cocoa butter, edible print layer, almonds when selected, and permitted food-grade colors. Contains dairy and may contain traces of nuts.',
      care: 'Store in a cool, dry place below 25°C. Keep away from direct sunlight, moisture, and strong odors. Best enjoyed at room temperature.',
      faq: 'Can I upload my own image?|Yes. Upload a clear JPG, PNG, or WEBP image while customizing the hamper.\nCan I add a name or message?|Yes. Use the name and message fields in the customization panel.\nIs Cash on Delivery available?|Yes, COD is available for eligible orders.\nWill the price update automatically?|Yes. Quantity and paid customizations update the total instantly, and the server recalculates it again during checkout.'
    },
    options: [
      { id: 1, title: 'Add Custom Image', description: 'Upload a photo to personalize your hamper.', type: 'file', choices: [], price: 100, required: false, active: true, uploadRequired: true, order: 10 },
      { id: 2, title: 'Extra Almonds', description: 'Add a generous almond topping to the hamper.', type: 'checkbox', choices: [], price: 80, required: false, active: true, uploadRequired: false, order: 20 },
      { id: 4, title: 'Gift Message', description: 'Write a small note for the recipient.', type: 'textarea', choices: [], price: 0, required: false, active: true, uploadRequired: false, order: 40, maxLength: 250, placeholder: 'Your message' }
    ],
    orders: [],
    nextOrderNumber: 10001,
    nextOptionId: 5
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

function readDb() {
  if (!fs.existsSync(DB_FILE)) writeDb(seed());
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  let changed = false;
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
  if (ensureDemoAdmin(data)) changed = true;
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
  const beforeOptionCount = data.options.length;
  data.options = data.options.filter(option => option.title !== 'Name to Print');
  if (data.options.length !== beforeOptionCount) changed = true;
  const seeded = seed().product;
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
  if (changed) writeDb(data);
  return data;
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
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
  return file ? `/uploads/${file.filename}` : '';
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
  return String(value || '').replace(/[^\p{L}\p{N}\s.,'&()/-]/gu, '').replace(/\s+/g, ' ').trim();
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

function requireOptionType(value) {
  const type = String(value || '').trim();
  if (!['checkbox', 'file', 'text', 'textarea', 'select'].includes(type)) throw new Error('Choose a valid customization type.');
  return type;
}

function cleanLines(value = '') {
  return String(value || '').split(/\r?\n/).map(cleanPlainText).filter(Boolean);
}

function orderUploads(order) {
  return (order.items || []).flatMap(item => (item.customizations || []).filter(c => c.uploadedPath));
}

function orderUploadPreview(order, compact = true) {
  const uploads = orderUploads(order);
  if (!uploads.length) return '<span class="muted">No image</span>';
  const first = uploads[0];
  const more = uploads.length > 1 ? `<small>+${uploads.length - 1}</small>` : '';
  return `<a class="${compact ? 'order-image-link' : 'upload-preview'}" href="${esc(first.uploadedPath)}" target="_blank" rel="noopener"><img src="${esc(first.uploadedPath)}" alt="${esc(first.title)} upload"><span>${compact ? 'View' : 'Open uploaded image'}</span>${more}</a>`;
}

function statusOptions(current) {
  return statuses.map(s => `<option value="${esc(s)}" ${current === s ? 'selected' : ''}>${esc(s)}</option>`).join('');
}

function appendEmailOutbox(order, previousStatus, nextStatus) {
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
  order.emailNotifications.unshift({
    at,
    to: event.to,
    status: nextStatus,
    result: event.to ? 'queued' : 'skipped',
    message: event.to ? 'Email notification queued in storage/logs/email-outbox.jsonl.' : 'Customer email missing.'
  });
  if (event.to) fs.appendFileSync(path.join(LOG_DIR, 'email-outbox.jsonl'), `${JSON.stringify(event)}\n`);
  return order.emailNotifications[0];
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
  return settings.freeShippingEnabled && subtotal >= Number(settings.freeShippingMinimum || 0) ? 0 : Number(settings.shippingFee || 0);
}

function cartTotals(req) {
  const db = readDb();
  const subtotal = cart(req).reduce((sum, item) => sum + item.lineTotal, 0);
  const ship = subtotal > 0 ? shipping(db.settings, subtotal) : 0;
  return { subtotal, shipping: ship, total: subtotal + ship };
}

function assertCsrf(req) {
  if (req.body._csrf !== req.session.csrf) throw new Error('Security check failed. Please refresh and try again.');
}

function page(req, title, body, admin = false) {
  const db = readDb();
  const cartCount = cart(req).length;
  const whatsapp = whatsappUrl(db.settings, 'Hi Chocomedley, I need help with an order.');
  const whatsappLink = whatsapp ? `<a class="support-link" href="${esc(whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : '';
  const nav = admin ? '' : `<header class="site-header"><nav class="nav"><a class="menu-link" href="#details" aria-label="Product details"><span></span><span></span><span></span></a><a class="brand center-brand" href="/"><img src="${esc(db.settings.logoPath)}" alt="${esc(db.settings.storeName)} logo"></a><div class="nav-actions">${whatsappLink}<a class="track-link" href="/track">Track Order</a><a class="cart-link" href="/cart"><span>Cart</span><strong>${cartCount}</strong></a></div></nav></header>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | ${esc(db.settings.storeName)}</title><meta name="description" content="Order the Rakhi Chocolate Hamper with custom image, extra almonds, and Cash on Delivery."><meta property="og:title" content="${esc(db.product.name)}"><meta property="og:description" content="${esc(db.product.shortDescription)}"><link rel="stylesheet" href="/assets/styles.css?v=${ASSET_VERSION}"><script defer src="/assets/app.js?v=${ASSET_VERSION}"></script></head><body>${nav}${body}</body></html>`;
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
  const required = opt.required ? 'required' : '';
  const max = opt.maxLength ? `maxlength="${Number(opt.maxLength)}" data-counted` : '';
  const placeholder = opt.placeholder ? `placeholder="${esc(opt.placeholder)}"` : '';
  if (opt.type === 'checkbox') {
    control = `<label class="choice-card add-on-card"><input type="checkbox" name="${name}" value="1"><span><b>Add</b><strong>${esc(opt.title)}</strong><small>${Number(opt.price) ? `+${money(opt.price)}` : 'Included'}</small></span></label>`;
  } else if (opt.type === 'file') {
    control = `<label class="upload-box"><input type="file" name="${name}" accept="image/jpeg,image/png,image/webp" ${required}><span class="upload-icon">Upload</span><span><strong>Choose photo</strong><small>JPG, PNG or WEBP up to 5 MB</small></span><em data-file-name>No file selected</em></label>`;
  } else if (opt.type === 'textarea') {
    control = `<label class="field-wrap"><textarea name="${name}" ${required} ${max} ${placeholder}></textarea>${opt.maxLength ? `<small class="counter"><span data-count-for="${name}">0</span>/${Number(opt.maxLength)}</small>` : ''}</label>`;
  } else if (opt.type === 'select') {
    control = `<div class="choice-grid">${(opt.choices || []).map(choice => `<label class="choice-card"><input type="radio" name="${name}" value="${esc(choice)}" ${required}><span><strong>${esc(choice)}</strong><small>${Number(opt.price) ? `+${money(opt.price)}` : 'Included'}</small></span></label>`).join('')}</div>`;
  } else {
    control = `<label class="field-wrap"><input name="${name}" ${required} ${max} ${placeholder}>${opt.maxLength ? `<small class="counter"><span data-count-for="${name}">0</span>/${Number(opt.maxLength)}</small>` : ''}</label>`;
  }
  return `<section class="config-option" data-option data-title="${esc(opt.title)}" data-price="${Number(opt.price)}"><div class="config-head"><div><span class="config-label">${esc(opt.title)}${opt.required ? ' *' : ''}</span><p>${esc(opt.description)}</p></div><strong>${Number(opt.price) ? `+${money(opt.price)}` : 'Free'}</strong></div>${control}</section>`;
}

app.get('/', (req, res) => {
  const db = readDb();
  if (!db.product.active) return res.status(503).send(page(req, 'Unavailable', `<main class="container"><section class="panel pad"><h1>Rakhi Hamper is unavailable</h1></section></main>`));
  const base = Number(db.product.offerPrice || db.product.basePrice);
  const initialTotal = base + shipping(db.settings, base);
  const gallery = [db.product.imagePath, ...(db.product.galleryPaths || [])].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index);
  const thumbs = gallery.map((src, index) => `<button type="button" data-thumb data-src="${esc(src)}" aria-label="View image ${index + 1}"><img src="${esc(src)}" alt="${esc(db.product.name)} view ${index + 1}"></button>`).join('');
  const body = `<main class="storefront">${flashHtml(req)}<section class="product-section"><div class="product-shell"><div class="product-media"><div class="gallery-main"><button class="gallery-arrow" type="button" data-gallery-prev aria-label="Previous image">‹</button><img data-main-image src="${esc(gallery[0])}" alt="${esc(db.product.name)}"><button class="gallery-arrow next" type="button" data-gallery-next aria-label="Next image">›</button></div><div class="thumbs">${thumbs}</div></div><form class="product-panel configurator" method="post" action="/cart/add" enctype="multipart/form-data" data-product-form data-base-price="${base}" data-shipping="${shipping(db.settings, base)}">${csrfField(req)}<div class="product-title-block"><span class="panel-kicker">Personalized Chocolate Hamper</span><h2>${esc(db.product.name)}</h2><div class="rating-line"><span>★★★★★</span><strong>4.9</strong><small>Made fresh for gifting</small></div><p>${esc(db.product.shortDescription)}</p><div class="mini-trust"><span>COD available</span><span>Dispatch in 1-2 days</span><span>Photo print</span></div></div><div class="price-strip"><strong>${money(base)}</strong><small>Base price</small></div><div class="config-stack"><section class="config-option quantity-option"><div class="config-head"><div><span class="config-label">Quantity</span><p>Select hamper count</p></div></div><span class="qty"><button type="button" data-qty="-1" aria-label="Decrease quantity">-</button><input name="quantity" value="1" readonly aria-label="Quantity"><button type="button" data-qty="1" aria-label="Increase quantity">+</button></span></section>${activeOptions(db).map(optionField).join('')}</div><div class="checkout-dock"><div class="total-row"><span>Total</span><strong data-live-total>${money(initialTotal)}</strong></div><div class="actions"><button type="submit" class="btn primary" formaction="/cart/add">Add to Cart</button><button type="submit" class="btn dark" formaction="/buy-now">Buy Now</button></div><div class="breakdown" data-breakdown></div></div></form></div></section>${bottomContent(db)}</main>${cartDrawer(req, req.query.cart === 'open')}<div class="mobile-bar"><strong data-live-total>${money(initialTotal)}</strong><button type="button" class="btn primary" onclick="document.querySelector('[data-product-form] button[formaction=&quot;/cart/add&quot;]').click()">Add to Cart</button></div>`;
  res.send(page(req, db.product.name, body));
});

function cartDrawer(req, open = false) {
  const totals = cartTotals(req);
  const lines = cart(req).map(item => `<div class="drawer-line"><img src="${esc(item.productImage)}" alt="${esc(item.productName)}"><div><strong>${esc(item.productName)}</strong><small><span class="info-label">Qty:</span> ${item.quantity}</small>${item.customizations.map(c => `<small><span class="info-label">${esc(c.title)}:</span> ${esc(c.value)}</small>`).join('')}</div><b>${money(item.lineTotal)}</b></div>`).join('');
  const empty = !cart(req).length ? '<p class="muted">Your cart is empty.</p>' : lines;
  return `<aside class="cart-drawer ${open ? 'is-open' : ''}" aria-label="Cart"><a class="drawer-scrim" href="/"></a><div class="drawer-panel"><div class="drawer-head"><h2>Your Cart</h2><a href="/" aria-label="Close cart">×</a></div>${empty}<div class="drawer-total"><span>Total</span><strong>${money(totals.total)}</strong></div><a class="btn primary" href="/checkout">Checkout</a><a class="btn ghost" href="/">Continue Shopping</a></div></aside>`;
}

function bottomContent(db) {
  const faqs = String(db.product.faq || '').split(/\r?\n/).map(line => {
    const [q, ...rest] = line.split('|');
    return q && rest.length ? `<details><summary>${esc(q)}</summary><p>${esc(rest.join('|'))}</p></details>` : '';
  }).join('');
  return `<section id="details" class="content-bands"><div class="detail-grid"><article><p class="eyebrow">Product details</p><h2>Built for gifts that feel personal.</h2><p>${esc(db.product.details)}</p></article><article><p class="eyebrow">Ingredients</p><h2>Rich, handmade, carefully packed.</h2><p>${esc(db.product.ingredients)}</p></article><article><p class="eyebrow">Care</p><h2>Keep it beautiful till it is opened.</h2><p>${esc(db.product.care)}</p></article></div><div class="faq-block"><p class="eyebrow">FAQs</p><h2>Before you order</h2>${faqs}</div></section>`;
}

function selectedCustomizations(req, files, db) {
  return activeOptions(db).map(opt => {
    const value = req.body[`option_${opt.id}`];
    const file = files.find(f => f.fieldname === `option_${opt.id}`);
    let chosen = false;
    let text = '';
    let uploadedPath = '';
    let originalName = '';
    if (opt.type === 'checkbox') { chosen = value === '1'; text = chosen ? 'Yes' : ''; }
    else if (opt.type === 'file') { chosen = Boolean(file); text = file ? file.originalname : ''; uploadedPath = file ? `/uploads/${file.filename}` : ''; originalName = file ? file.originalname : ''; }
    else { text = String(value || '').trim(); chosen = text.length > 0; }
    if (opt.required && !chosen) throw new Error(`${opt.title} is required.`);
    return chosen ? { optionId: opt.id, title: opt.title, type: opt.type, value: text, price: Number(opt.price || 0), uploadedPath, originalName } : null;
  }).filter(Boolean);
}

function addLine(req, files) {
  const db = readDb();
  if (!db.product.active) throw new Error('Product unavailable.');
  const quantity = Math.max(1, Math.min(99, Number(String(req.body.quantity || 1).replace(/\D/g, '') || 1)));
  const customizations = selectedCustomizations(req, files, db);
  const basePrice = Number(db.product.offerPrice || db.product.basePrice);
  const customizationTotal = customizations.reduce((sum, c) => sum + c.price, 0);
  const lineTotal = (basePrice + customizationTotal) * quantity;
  return { key: crypto.randomBytes(8).toString('hex'), productId: db.product.id, productName: db.product.name, productImage: db.product.imagePath, basePrice, quantity, customizations, customizationTotal, lineTotal };
}

app.post('/cart/add', upload.any(), (req, res) => {
  try { assertCsrf(req); cart(req).push(addLine(req, req.files || [])); res.redirect('/?cart=open'); }
  catch (e) { flash(req, 'error', e.message); res.redirect('/'); }
});

app.post('/buy-now', upload.any(), (req, res) => {
  try { assertCsrf(req); req.session.cart = [addLine(req, req.files || [])]; res.redirect('/checkout'); }
  catch (e) { flash(req, 'error', e.message); res.redirect('/'); }
});

app.get('/cart', (req, res) => {
  const totals = cartTotals(req);
  const lines = cart(req).map(item => `<form class="cart-line" method="post" action="/cart/update">${csrfField(req)}<input type="hidden" name="key" value="${esc(item.key)}"><img src="${esc(item.productImage)}" alt="${esc(item.productName)}"><div class="cart-line-body"><h3>${esc(item.productName)}</h3>${item.customizations.map(c => `<p class="muted"><span class="info-label">${esc(c.title)}:</span> ${esc(c.value)} (+${money(c.price)})</p>`).join('')}<span class="cart-qty-label">Quantity</span><div class="cart-qty-control" aria-label="Quantity controls"><button type="submit" name="qtyDelta" value="-1" aria-label="Decrease quantity">-</button><input name="quantity" value="${item.quantity}" readonly aria-label="Quantity"><button type="submit" name="qtyDelta" value="1" aria-label="Increase quantity">+</button></div><div class="cart-actions"><button type="submit" class="btn danger" name="remove" value="1">Remove</button></div></div><strong class="cart-line-price">${money(item.lineTotal)}</strong></form>`).join('');
  const empty = !cart(req).length ? `<p class="lead">Your cart is empty.</p><a class="btn primary" href="/">Order Rakhi Hamper</a>` : '';
  res.send(page(req, 'Cart', `<main class="container page-grid"><section class="panel pad"><h1>Your Cart</h1>${flashHtml(req)}${empty}${lines}</section><aside class="panel pad"><h2>Order Summary</h2>${summary(totals)}${cart(req).length ? '<a class="btn primary" href="/checkout">Checkout</a>' : ''}</aside></main>`));
});

app.post('/cart/update', (req, res) => {
  try { assertCsrf(req); } catch (e) { flash(req, 'error', e.message); return res.redirect('/cart'); }
  const removed = Boolean(req.body.remove);
  let updated = false;
  req.session.cart = cart(req).filter(item => item.key !== req.body.key || !removed).map(item => {
    if (item.key === req.body.key) {
      const delta = Number(req.body.qtyDelta || 0);
      const currentQuantity = Math.max(1, Number(item.quantity || 1));
      const requestedQuantity = delta ? currentQuantity + delta : Number(String(req.body.quantity || currentQuantity).replace(/\D/g, '') || currentQuantity);
      const nextQuantity = Math.max(1, Math.min(99, requestedQuantity));
      updated = item.quantity !== nextQuantity;
      item.quantity = nextQuantity;
      item.lineTotal = (Number(item.basePrice) + Number(item.customizationTotal)) * item.quantity;
    }
    return item;
  });
  flash(req, 'success', removed ? 'Item removed from cart.' : updated ? 'Cart quantity updated.' : 'Cart is already up to date.');
  res.redirect('/cart');
});

function summary(t) {
  return `<div class="summary-line"><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div><div class="summary-line"><span>Shipping</span><strong>${money(t.shipping)}</strong></div><div class="summary-line"><span>Total</span><strong>${money(t.total)}</strong></div>`;
}

app.get('/checkout', (req, res) => {
  if (!cart(req).length) return res.redirect('/');
  const db = readDb();
  const totals = cartTotals(req);
  const stateOptions = INDIA_STATES.map(state => `<option value="${esc(state)}">${esc(state)}</option>`).join('');
  const form = `<form class="panel grid pad" method="post" action="/checkout" data-once data-checkout-form novalidate>${csrfField(req)}<h1>Checkout</h1>${flashHtml(req)}<div class="grid two"><label>Full Name<input name="customerName" autocomplete="name" data-clean="person" data-rule="person" required><small class="field-error" data-error-for="customerName"></small></label><label>Mobile Number<input name="mobile" inputmode="numeric" autocomplete="tel" maxlength="10" data-clean="digits" data-rule="mobile" required><small class="field-error" data-error-for="mobile"></small></label></div><div class="grid two"><label>Alternate Mobile<input name="alternateMobile" inputmode="numeric" autocomplete="tel" maxlength="10" data-clean="digits" data-rule="optionalMobile"><small class="field-error" data-error-for="alternateMobile"></small></label><label>Email<input type="email" name="email" autocomplete="email" data-rule="optionalEmail"><small class="field-error" data-error-for="email"></small></label></div><label>Address Line 1<input name="addressLine1" autocomplete="address-line1" data-clean="address" data-rule="requiredText" required><small class="field-error" data-error-for="addressLine1"></small></label><label>Address Line 2<input name="addressLine2" autocomplete="address-line2" data-clean="address"></label><div class="grid two"><label>Landmark<input name="landmark" data-clean="address"><small class="field-error" data-error-for="landmark"></small></label><label>PIN Code<input name="pinCode" inputmode="numeric" autocomplete="postal-code" maxlength="6" data-clean="digits" data-rule="pin" required><small class="field-error" data-error-for="pinCode"></small></label></div><div class="grid two"><label>City<input name="city" autocomplete="address-level2" data-clean="person" data-rule="person" required><small class="field-error" data-error-for="city"></small></label><label>State<select name="state" required data-rule="requiredSelect"><option value="">Select state or union territory</option>${stateOptions}</select><small class="field-error" data-error-for="state"></small></label></div><label>Order Notes<textarea name="customerNotes" data-clean="address"></textarea></label><div class="notice"><strong>Payment:</strong> Cash on Delivery. Payment status remains Pending until collected.</div><button type="submit" class="btn primary" data-loading="Placing order...">Place COD Order</button></form>`;
  res.send(page(req, 'Checkout', `<main class="container page-grid">${form}<aside class="panel pad checkout-side"><h2>Total</h2>${summary(totals)}</aside></main>`));
});

app.post('/checkout', (req, res) => {
  const db = readDb();
  const items = cart(req);
  if (!items.length) return res.redirect('/');
  const nameOk = /^[A-Za-z][A-Za-z ]{1,59}$/.test(String(req.body.customerName || '').trim());
  const mobileOk = /^[6-9]\d{9}$/.test(req.body.mobile || '');
  const alternateOk = !req.body.alternateMobile || /^[6-9]\d{9}$/.test(req.body.alternateMobile || '');
  const pinOk = /^\d{6}$/.test(req.body.pinCode || '');
  const cityOk = /^[A-Za-z][A-Za-z ]{1,59}$/.test(String(req.body.city || '').trim());
  if (!nameOk || !req.body.addressLine1 || !cityOk || !req.body.state || !mobileOk || !alternateOk || !pinOk) {
    flash(req, 'error', 'Please enter a valid name, mobile number, address, city, state, and PIN code.');
    return res.redirect('/checkout');
  }
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const ship = shipping(db.settings, subtotal);
  const orderId = `RAKHI-${db.nextOrderNumber++}`;
  const now = new Date().toISOString();
  const order = {
    id: crypto.randomUUID(), orderId, createdAt: now, updatedAt: now,
    customerName: cleanPlainText(req.body.customerName), mobile: req.body.mobile.trim(), alternateMobile: req.body.alternateMobile || '', email: req.body.email || '',
    addressLine1: cleanPlainText(req.body.addressLine1), addressLine2: cleanPlainText(req.body.addressLine2), landmark: cleanPlainText(req.body.landmark), city: cleanPlainText(req.body.city), state: req.body.state.trim(), pinCode: req.body.pinCode.trim(),
    customerNotes: cleanPlainText(req.body.customerNotes), adminNotes: '', paymentMethod: 'Cash on Delivery', paymentStatus: 'Pending', orderStatus: 'New Order',
    courier: '', trackingNumber: '', trackingUrl: '', shippingDate: '', estimatedDeliveryDate: '',
    items: JSON.parse(JSON.stringify(items)), subtotal, shippingAmount: ship, total: subtotal + ship,
    statusHistory: [{ status: 'New Order', at: now }]
  };
  db.orders.unshift(order);
  writeDb(db);
  req.session.cart = [];
  req.session.lastOrder = orderId;
  res.redirect('/success');
});

app.get('/success', (req, res) => {
  const db = readDb();
  const order = db.orders.find(o => o.orderId === req.session.lastOrder);
  if (!order) return res.redirect('/');
  const whatsappCard = `<section class="whatsapp-panel success-whatsapp"><p class="eyebrow">Stay updated</p><h2>Thank you for ordering your chocolates.</h2><p>Your hamper is now with Chocomedley. Meanwhile, join us on WhatsApp for tracking help, delivery updates, and quick support.</p>${whatsappCta(db.settings, 'Join WhatsApp for Updates', `Hi Chocomedley, I placed order ${order.orderId}. Please keep me updated on tracking and delivery.`, 'wide')}</section>`;
  res.send(page(req, 'Order Placed', `<main class="container"><section class="panel pad success-panel"><p class="eyebrow">Thank you</p><h1>Your Order Has Been Placed.</h1><p class="lead"><span class="info-label">Order ID:</span> <strong>${esc(order.orderId)}</strong></p><div class="info-list"><p><span class="info-label">Payment:</span> Cash on Delivery</p><p><span class="info-label">Total:</span> <strong>${money(order.total)}</strong></p><p><span class="info-label">Mobile:</span> ${esc(order.mobile)}</p></div><div class="actions"><a class="btn primary" href="/track">Track Order</a></div>${whatsappCard}</section></main>`));
});

app.get('/track', (req, res) => {
  const db = readDb();
  const lookup = req.session.trackLookup;
  delete req.session.trackLookup;
  const matches = lookup ? db.orders.filter(o => o.mobile === lookup.mobile && (!lookup.orderId || o.orderId.toLowerCase() === lookup.orderId.toLowerCase())) : [];
  const cards = matches.map(order => `<article class="track-card"><div><p class="eyebrow">${esc(order.orderId)}</p><h2>${esc(order.orderStatus)}</h2><p><span class="info-label">Customer:</span> ${esc(order.customerName)}</p><p><span class="info-label">Order total:</span> ${money(order.total)}</p></div><div class="track-meta"><p><span class="info-label">Courier:</span> <strong>${esc(order.courier || 'Not assigned yet')}</strong></p><p><span class="info-label">Tracking:</span> <strong>${esc(order.trackingNumber || 'Pending')}</strong></p><p><span class="info-label">Estimated delivery:</span> <strong>${esc(order.estimatedDeliveryDate || 'To be updated')}</strong></p></div><div class="actions">${order.trackingUrl ? `<a class="btn primary" href="${esc(order.trackingUrl)}" target="_blank" rel="noopener">Open Courier Tracking</a>` : ''}${whatsappCta(db.settings, 'Ask on WhatsApp', `Hi Chocomedley, I want an update for order ${order.orderId}.`)}</div></article>`).join('');
  const result = lookup && !matches.length ? `<p class="notice error">No matching order found for that Mobile Number${lookup.orderId ? ' and Order ID' : ''}.</p>${whatsappCta(db.settings, 'Get Help on WhatsApp', 'Hi Chocomedley, I cannot find my order tracking details. Please help.')}` : matches.length ? cards : `<p class="lead">Enter your Mobile Number to see live order status. Add Order ID if you want to narrow the result.</p>${whatsappCta(db.settings, 'Chat With Support', 'Hi Chocomedley, I need help tracking my order.')}`;
  res.send(page(req, 'Track Order', `<main class="container page-grid"><form class="panel grid pad" method="post" action="/track" autocomplete="off">${csrfField(req)}<h1>Track Order</h1>${flashHtml(req)}<label>Mobile Number<input name="mobile" pattern="[6-9][0-9]{9}" value="" autocomplete="off" required></label><label>Order ID <span class="muted">Optional</span><input name="orderId" placeholder="RAKHI-10001" value="" autocomplete="off"></label><button type="submit" class="btn primary">Check Live Status</button></form><aside class="panel pad track-results">${result}</aside></main>`));
});

app.post('/track', (req, res) => {
  try { assertCsrf(req); } catch (e) { flash(req, 'error', e.message); return res.redirect('/track'); }
  const mobile = String(req.body.mobile || '').replace(/\D/g, '');
  const orderId = String(req.body.orderId || '').trim().toUpperCase();
  req.session.trackLookup = { orderId, mobile };
  flash(req, 'success', 'Tracking checked. Latest result is shown on the right.');
  res.redirect('/track');
});

function requireAdmin(req, res, next) {
  req.session.adminId = req.session.adminId || 'demo-open-admin';
  next();
}

function adminPage(req, title, content) {
  return page(req, title, `<div class="admin-layout"><aside class="admin-side"><h2>Chocomedley</h2><a href="/admin">Dashboard</a><a href="/admin/orders">Orders</a><a href="/admin/product">Product</a><a href="/admin/customizations">Customizations</a><a href="/admin/settings">Settings</a></aside><main class="admin-main">${flashHtml(req)}${content}</main></div>`, true);
}

app.get('/setup-admin', (req, res) => {
  const db = readDb();
  if (process.env.ADMIN_SETUP_ENABLED !== 'true' || db.admins.length) return res.status(403).send('Admin setup disabled.');
  res.send(page(req, 'Create Admin', `<main class="auth-shell"><form class="panel auth-card" method="post" action="/setup-admin">${csrfField(req)}<img class="auth-logo" src="${esc(db.settings.logoPath)}" alt="Logo"><h1>Create Admin</h1>${flashHtml(req)}<label>Name<input name="name" required></label><label>Email<input type="email" name="email" required></label><label>Password<input type="password" name="password" minlength="10" required></label><button class="btn primary">Create secure admin</button></form></main>`, true));
});

app.post('/setup-admin', async (req, res) => {
  const db = readDb();
  if (process.env.ADMIN_SETUP_ENABLED !== 'true' || db.admins.length) return res.status(403).send('Admin setup disabled.');
  if (!req.body.name || !req.body.email || String(req.body.password || '').length < 10) {
    flash(req, 'error', 'Use a valid name, email, and password with at least 10 characters.');
    return res.redirect('/setup-admin');
  }
  db.admins.push({ id: crypto.randomUUID(), name: req.body.name.trim(), email: req.body.email.trim().toLowerCase(), passwordHash: await bcrypt.hash(req.body.password, 12), createdAt: new Date().toISOString() });
  writeDb(db);
  res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
  req.session.adminId = 'demo-open-admin';
  res.redirect('/admin');
});

app.post('/admin/login', async (req, res) => {
  req.session.regenerate(() => { req.session.adminId = 'demo-open-admin'; res.redirect('/admin'); });
});

app.get('/admin/logout', (req, res) => req.session.destroy(() => res.redirect('/admin')));

app.get('/admin', requireAdmin, (req, res) => {
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);
  const ordersToday = db.orders.filter(o => o.createdAt.slice(0, 10) === today);
  const stat = (label, value) => `<div class="panel stat"><p class="muted">${label}</p><h2>${value}</h2></div>`;
  const recentRows = db.orders.slice(0, 8).map(o => `<tr><td>${orderUploadPreview(o)}</td><td><a href="/admin/orders/${esc(o.orderId)}">${esc(o.orderId)}</a><small class="muted">${esc(o.createdAt.slice(0, 10))}</small></td><td><span class="info-label">Customer:</span> ${esc(o.customerName)}<small class="muted"><span class="info-label">Mobile:</span> ${esc(o.mobile)}</small></td><td>${money(o.total)}</td><td><span class="status-pill">${esc(o.orderStatus)}</span></td><td><form class="quick-status-form" method="post" action="/admin/orders/${esc(o.orderId)}/status">${csrfField(req)}<select name="orderStatus">${statusOptions(o.orderStatus)}</select><label class="inline-check"><input type="checkbox" name="notifyEmail" value="1" checked> Email</label><button type="submit" class="btn">Save</button></form></td></tr>`).join('') || '<tr><td colspan="6">No orders yet.</td></tr>';
  res.send(adminPage(req, 'Dashboard', `<h1>Dashboard</h1><div class="stats">${stat('Orders Today', ordersToday.length)}${stat('Revenue Today', money(ordersToday.reduce((s, o) => s + o.total, 0)))}${stat('Total Orders', db.orders.length)}${stat('Total Revenue', money(db.orders.reduce((s, o) => s + o.total, 0)))}</div><section class="admin-section"><div class="admin-section-head"><h2>Recent Orders</h2><a class="btn ghost" href="/admin/orders">View all</a></div><table><tr><th>Image</th><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th><th>Quick Update</th></tr>${recentRows}</table></section>`));
});

const statuses = ['New Order', 'Confirmed', 'Preparing', 'Ready to Ship', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

app.get('/admin/orders', requireAdmin, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const status = String(req.query.status || '');
  const orders = readDb().orders.filter(o => (!q || [o.orderId, o.customerName, o.mobile].some(v => String(v).toLowerCase().includes(q))) && (!status || o.orderStatus === status));
  const rows = orders.map(o => `<tr><td>${orderUploadPreview(o)}</td><td><a href="/admin/orders/${esc(o.orderId)}">${esc(o.orderId)}</a></td><td>${esc(o.createdAt.slice(0, 10))}</td><td><span class="info-label">Customer:</span> ${esc(o.customerName)}</td><td><span class="info-label">Mobile:</span> ${esc(o.mobile)}</td><td>${money(o.total)}</td><td>${esc(o.paymentStatus)}</td><td><form class="quick-status-form" method="post" action="/admin/orders/${esc(o.orderId)}/status">${csrfField(req)}<select name="orderStatus">${statusOptions(o.orderStatus)}</select><label class="inline-check"><input type="checkbox" name="notifyEmail" value="1" checked> Email</label><button type="submit" class="btn">Save</button></form></td><td>${esc(o.trackingNumber || 'Pending')}</td></tr>`).join('') || '<tr><td colspan="9">No orders found.</td></tr>';
  res.send(adminPage(req, 'Orders', `<h1>Orders</h1><form class="actions order-filter"><input name="q" placeholder="Search order, customer, mobile" value="${esc(req.query.q || '')}"><select name="status"><option value="">All statuses</option>${statuses.map(s => `<option ${status === s ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="btn">Filter</button></form><table><tr><th>Image</th><th>Order ID</th><th>Date</th><th>Customer</th><th>Mobile</th><th>Amount</th><th>Payment</th><th>Status</th><th>Tracking</th></tr>${rows}</table>`));
});

app.get('/admin/orders/:orderId', requireAdmin, (req, res) => {
  const order = readDb().orders.find(o => o.orderId === req.params.orderId);
  if (!order) return res.send(adminPage(req, 'Order Not Found', '<p class="notice error">Order not found.</p>'));
  const items = order.items.map(item => `<h3>${esc(item.productName)} x ${item.quantity}</h3><p><span class="info-label">Base:</span> ${money(item.basePrice)} | <span class="info-label">Line:</span> ${money(item.lineTotal)}</p>${item.customizations.map(c => `<div class="order-customization"><p><span class="info-label">${esc(c.title)}:</span> ${esc(c.value)} (+${money(c.price)})</p>${c.uploadedPath ? orderUploadPreview({ items: [{ customizations: [c] }] }, false) : ''}</div>`).join('')}`).join('');
  const notifications = (order.emailNotifications || []).slice(0, 4).map(n => `<li><strong>${esc(n.status)}</strong> ${esc(n.result)} ${n.to ? `to ${esc(n.to)}` : ''}<small>${esc(n.at)}</small></li>`).join('') || '<li class="muted">No status emails triggered yet.</li>';
  const form = `<form class="panel grid pad" method="post" action="/admin/orders/${esc(order.orderId)}">${csrfField(req)}<h2>Fulfilment</h2><label>Order Status<select name="orderStatus">${statusOptions(order.orderStatus)}</select></label><label class="inline-check"><input type="checkbox" name="notifyEmail" value="1" checked> Trigger customer email when status changes</label><label>Payment Status<select name="paymentStatus">${['Pending', 'Collected', 'Failed', 'Refunded'].map(s => `<option ${order.paymentStatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label>Courier<input name="courier" value="${esc(order.courier)}"></label><label>Tracking Number<input name="trackingNumber" value="${esc(order.trackingNumber)}"></label><label>Tracking URL<input name="trackingUrl" value="${esc(order.trackingUrl)}"></label><div class="grid two"><label>Shipping Date<input type="date" name="shippingDate" value="${esc(order.shippingDate)}"></label><label>Estimated Delivery<input type="date" name="estimatedDeliveryDate" value="${esc(order.estimatedDeliveryDate)}"></label></div><label>Admin Notes<textarea name="adminNotes">${esc(order.adminNotes)}</textarea></label><button type="submit" class="btn primary">Save Order</button></form>`;
  res.send(adminPage(req, order.orderId, `<h1>${esc(order.orderId)}</h1><div class="page-grid"><section class="panel pad"><h2>Customer</h2><p>${esc(order.customerName)}<br>${esc(order.mobile)}<br>${esc(order.email)}</p><p>${esc(order.addressLine1)}, ${esc(order.addressLine2)}<br>${esc(order.city)}, ${esc(order.state)} ${esc(order.pinCode)}</p><h2>Uploaded Image</h2>${orderUploadPreview(order, false)}<h2>Items</h2>${items}<h2>Pricing</h2>${summary({ subtotal: order.subtotal, shipping: order.shippingAmount, total: order.total })}</section><div class="grid">${form}<section class="panel pad"><h2>Email Triggers</h2><ul class="email-log">${notifications}</ul></section></div></div>`));
});

app.post('/admin/orders/:orderId', requireAdmin, (req, res) => {
  const db = readDb();
  const order = db.orders.find(o => o.orderId === req.params.orderId);
  if (order) {
    const previousStatus = order.orderStatus;
    if (previousStatus !== req.body.orderStatus) {
      order.statusHistory.push({ status: req.body.orderStatus, at: new Date().toISOString() });
      if (req.body.notifyEmail) appendEmailOutbox(order, previousStatus, req.body.orderStatus);
    }
    Object.assign(order, { orderStatus: req.body.orderStatus, paymentStatus: req.body.paymentStatus, courier: req.body.courier || '', trackingNumber: req.body.trackingNumber || '', trackingUrl: req.body.trackingUrl || '', shippingDate: req.body.shippingDate || '', estimatedDeliveryDate: req.body.estimatedDeliveryDate || '', adminNotes: req.body.adminNotes || '', updatedAt: new Date().toISOString() });
    writeDb(db);
    flash(req, 'success', previousStatus !== req.body.orderStatus && req.body.notifyEmail ? 'Order updated and email trigger queued.' : 'Order updated.');
  }
  res.redirect(`/admin/orders/${req.params.orderId}`);
});

app.post('/admin/orders/:orderId/status', requireAdmin, (req, res) => {
  const db = readDb();
  const order = db.orders.find(o => o.orderId === req.params.orderId);
  if (order && statuses.includes(req.body.orderStatus)) {
    const previousStatus = order.orderStatus;
    if (previousStatus !== req.body.orderStatus) {
      order.orderStatus = req.body.orderStatus;
      order.updatedAt = new Date().toISOString();
      order.statusHistory.push({ status: req.body.orderStatus, at: order.updatedAt });
      if (req.body.notifyEmail) appendEmailOutbox(order, previousStatus, req.body.orderStatus);
      writeDb(db);
      flash(req, 'success', req.body.notifyEmail ? `Status changed to ${req.body.orderStatus}; email trigger queued.` : `Status changed to ${req.body.orderStatus}.`);
    } else {
      flash(req, 'success', 'Status already up to date.');
    }
  }
  res.redirect(req.get('referer') || '/admin/orders');
});

app.get('/admin/product', requireAdmin, (req, res) => {
  const p = readDb().product;
  const galleryPreview = (p.galleryPaths || []).filter(Boolean).map(src => `<img src="${esc(src)}" alt="Gallery image">`).join('');
  res.send(adminPage(req, 'Product', `<h1>Product Settings</h1><form class="panel grid pad" method="post" action="/admin/product" enctype="multipart/form-data" data-admin-form>${csrfField(req)}<label>Name<input name="name" value="${esc(p.name)}" data-clean="name" data-admin-rule="name" required><small class="field-error" data-error-for="name"></small></label><label>Short Description<textarea name="shortDescription" data-clean="text" data-admin-rule="text">${esc(p.shortDescription)}</textarea><small class="field-error" data-error-for="shortDescription"></small></label><label>Long Description<textarea name="longDescription" data-clean="text" data-admin-rule="text">${esc(p.longDescription)}</textarea><small class="field-error" data-error-for="longDescription"></small></label><div class="grid two"><label>Base Price<input name="basePrice" value="${esc(p.basePrice)}" inputmode="numeric" maxlength="7" data-clean="digits" data-admin-rule="money" required><small class="field-error" data-error-for="basePrice"></small></label><label>Offer Price<input name="offerPrice" value="${esc(p.offerPrice)}" inputmode="numeric" maxlength="7" data-clean="digits" data-admin-rule="optionalMoney"><small class="field-error" data-error-for="offerPrice"></small></label></div><section class="admin-image-tools"><div><span class="config-label">Main Image</span>${p.imagePath ? `<img class="admin-image-preview" src="${esc(p.imagePath)}" alt="Current main product image">` : ''}</div><label>Upload New Main Image<input type="file" name="imageUpload" accept="image/jpeg,image/png,image/webp"></label><label>Main Image Path<input name="imagePath" value="${esc(p.imagePath)}"></label></section><section class="admin-image-tools"><div><span class="config-label">Gallery Images</span><div class="admin-gallery-preview">${galleryPreview}</div></div><label>Add Gallery Images<input type="file" name="galleryUploads" accept="image/jpeg,image/png,image/webp" multiple></label><label>Gallery Image Paths, one per line<textarea name="galleryPaths">${esc((p.galleryPaths || []).join('\n'))}</textarea></label></section><label>Delivery Text<input name="deliveryText" value="${esc(p.deliveryText)}" data-clean="text" data-admin-rule="text"><small class="field-error" data-error-for="deliveryText"></small></label><label>Product Details<textarea name="details" data-clean="text">${esc(p.details || '')}</textarea></label><label>Ingredients<textarea name="ingredients" data-clean="text">${esc(p.ingredients || '')}</textarea></label><label>Care / Storage<textarea name="care" data-clean="text">${esc(p.care || '')}</textarea></label><label>FAQs, one per line as Question|Answer<textarea name="faq">${esc(p.faq || '')}</textarea></label><label><input type="checkbox" name="active" value="1" ${p.active ? 'checked' : ''}> Product active</label><label><input type="checkbox" name="codAvailable" value="1" ${p.codAvailable ? 'checked' : ''}> COD available</label><button type="submit" class="btn primary">Save Product</button></form>`));
});

app.post('/admin/product', requireAdmin, upload.fields([{ name: 'imageUpload', maxCount: 1 }, { name: 'galleryUploads', maxCount: 12 }]), (req, res) => {
  try { assertCsrf(req); } catch (e) { flash(req, 'error', e.message); return res.redirect('/admin/product'); }
  const db = readDb();
  try {
    const mainUpload = req.files?.imageUpload?.[0];
    const galleryUploads = req.files?.galleryUploads || [];
    const typedGallery = String(req.body.galleryPaths || '').split(/\r?\n/).map(normalizePublicPath).filter(Boolean);
    const uploadedGallery = galleryUploads.map(uploadedPublicPath);
    const name = requireName(req.body.name, 'Product name');
    Object.assign(db.product, { name, shortDescription: cleanPlainText(req.body.shortDescription), longDescription: cleanPlainText(req.body.longDescription), basePrice: parseMoneyField(req.body.basePrice, 'Base Price', true), offerPrice: parseMoneyField(req.body.offerPrice, 'Offer Price'), imagePath: uploadedPublicPath(mainUpload) || normalizePublicPath(req.body.imagePath), galleryPaths: [...typedGallery, ...uploadedGallery].filter((value, index, arr) => arr.indexOf(value) === index), active: Boolean(req.body.active), codAvailable: Boolean(req.body.codAvailable), deliveryText: cleanPlainText(req.body.deliveryText), details: cleanPlainText(req.body.details), ingredients: cleanPlainText(req.body.ingredients), care: cleanPlainText(req.body.care), faq: req.body.faq });
    writeDb(db);
    flash(req, 'success', 'Product updated.');
  } catch (e) {
    flash(req, 'error', e.message);
  }
  res.redirect('/admin/product');
});

app.get('/admin/customizations', requireAdmin, (req, res) => {
  const db = readDb();
  const typeOptions = value => ['checkbox', 'file', 'text', 'textarea', 'select'].map(type => `<option value="${type}" ${value === type ? 'selected' : ''}>${type}</option>`).join('');
  const editCards = db.options.sort((a, b) => a.order - b.order).map(o => `<form class="panel grid pad option-admin-card" method="post" action="/admin/customizations/update" data-admin-form>${csrfField(req)}<input type="hidden" name="id" value="${o.id}"><div class="admin-card-head"><div><h2>${esc(o.title)}</h2><p class="muted">${esc(o.type)} | ${money(o.price)} | ${o.active ? 'Active' : 'Inactive'}</p></div><button class="btn primary">Save</button></div><div class="grid two"><label>Title<input name="title" value="${esc(o.title)}" data-clean="name" data-admin-rule="name" required><small class="field-error" data-error-for="title"></small></label><label>Type<select name="type">${typeOptions(o.type)}</select></label></div><label>Description<textarea name="description" data-clean="text">${esc(o.description || '')}</textarea></label><div class="grid two"><label>Price<input name="price" value="${esc(o.price)}" inputmode="numeric" maxlength="7" data-clean="digits" data-admin-rule="optionalMoney"><small class="field-error" data-error-for="price"></small></label><label>Display Order<input name="order" value="${esc(o.order)}" inputmode="numeric" maxlength="3" data-clean="digits" data-admin-rule="wholeNumber"><small class="field-error" data-error-for="order"></small></label></div><div class="grid two"><label>Placeholder<input name="placeholder" value="${esc(o.placeholder || '')}" data-clean="text"></label><label>Character Limit<input name="maxLength" value="${esc(o.maxLength || '')}" inputmode="numeric" maxlength="4" data-clean="digits" data-admin-rule="optionalWholeNumber" placeholder="Optional"><small class="field-error" data-error-for="maxLength"></small></label></div><label>Dropdown Choices, one per line<textarea name="choices" data-clean="text">${esc((o.choices || []).join('\n'))}</textarea></label><div class="admin-checks"><label><input type="checkbox" name="active" value="1" ${o.active ? 'checked' : ''}> Active</label><label><input type="checkbox" name="required" value="1" ${o.required ? 'checked' : ''}> Required</label><label><input type="checkbox" name="uploadRequired" value="1" ${o.uploadRequired ? 'checked' : ''}> Upload required</label></div></form><form method="post" action="/admin/customizations/delete" class="delete-row">${csrfField(req)}<input type="hidden" name="id" value="${o.id}"><button class="btn danger" onclick="return confirm('Delete this customization?')">Delete ${esc(o.title)}</button></form>`).join('');
  const form = `<form class="panel grid pad" method="post" action="/admin/customizations" data-admin-form>${csrfField(req)}<h2>Add Customization</h2><label>Title<input name="title" data-clean="name" data-admin-rule="name" required><small class="field-error" data-error-for="title"></small></label><label>Description<textarea name="description" data-clean="text"></textarea></label><div class="grid two"><label>Type<select name="type">${typeOptions('checkbox')}</select></label><label>Price<input name="price" value="0" inputmode="numeric" maxlength="7" data-clean="digits" data-admin-rule="optionalMoney"><small class="field-error" data-error-for="price"></small></label></div><div class="grid two"><label>Placeholder<input name="placeholder" data-clean="text"></label><label>Character Limit<input name="maxLength" inputmode="numeric" maxlength="4" data-clean="digits" data-admin-rule="optionalWholeNumber" placeholder="Optional"><small class="field-error" data-error-for="maxLength"></small></label></div><label>Dropdown Choices, one per line<textarea name="choices" data-clean="text"></textarea></label><label>Display Order<input name="order" value="50" inputmode="numeric" maxlength="3" data-clean="digits" data-admin-rule="wholeNumber"><small class="field-error" data-error-for="order"></small></label><div class="admin-checks"><label><input type="checkbox" name="active" value="1" checked> Active</label><label><input type="checkbox" name="required" value="1"> Required</label><label><input type="checkbox" name="uploadRequired" value="1"> Upload required</label></div><button class="btn primary">Create Customization</button></form>`;
  res.send(adminPage(req, 'Customizations', `<h1>Customizations</h1><p class="lead">Control every field shown in the storefront configurator. Active options appear automatically on the product page in display order.</p><div class="admin-options">${editCards}</div>${form}`));
});

app.post('/admin/customizations', requireAdmin, (req, res) => {
  const db = readDb();
  try {
    const title = requireName(req.body.title, 'Customization title');
    db.options.push({ id: db.nextOptionId++, title, description: cleanPlainText(req.body.description), type: requireOptionType(req.body.type), choices: cleanLines(req.body.choices), price: parseMoneyField(req.body.price, 'Price') || 0, required: Boolean(req.body.required), active: Boolean(req.body.active), uploadRequired: Boolean(req.body.uploadRequired), order: parseWholeNumberField(req.body.order, 'Display Order', 50), maxLength: parseWholeNumberField(req.body.maxLength, 'Character Limit', 0) || '', placeholder: cleanPlainText(req.body.placeholder) });
    writeDb(db);
    flash(req, 'success', 'Customization saved.');
  } catch (e) {
    flash(req, 'error', e.message);
  }
  res.redirect('/admin/customizations');
});

app.post('/admin/customizations/update', requireAdmin, (req, res) => {
  const db = readDb();
  const option = db.options.find(o => String(o.id) === String(req.body.id));
  if (option) {
    try {
      const title = requireName(req.body.title, 'Customization title');
      Object.assign(option, {
        title,
        description: cleanPlainText(req.body.description),
        type: requireOptionType(req.body.type),
        choices: cleanLines(req.body.choices),
        price: parseMoneyField(req.body.price, 'Price') || 0,
        required: Boolean(req.body.required),
        active: Boolean(req.body.active),
        uploadRequired: Boolean(req.body.uploadRequired),
        order: parseWholeNumberField(req.body.order, 'Display Order', 50),
        maxLength: parseWholeNumberField(req.body.maxLength, 'Character Limit', 0) || '',
        placeholder: cleanPlainText(req.body.placeholder)
      });
      writeDb(db);
      flash(req, 'success', 'Customization updated.');
    } catch (e) {
      flash(req, 'error', e.message);
    }
  }
  res.redirect('/admin/customizations');
});

app.post('/admin/customizations/delete', requireAdmin, (req, res) => {
  const db = readDb();
  db.options = db.options.filter(o => String(o.id) !== String(req.body.id));
  writeDb(db);
  flash(req, 'success', 'Customization deleted.');
  res.redirect('/admin/customizations');
});

app.get('/admin/settings', requireAdmin, (req, res) => {
  const s = readDb().settings;
  res.send(adminPage(req, 'Settings', `<h1>Store Settings</h1><form class="panel grid pad" method="post" action="/admin/settings" data-admin-form>${csrfField(req)}<label>Store Name<input name="storeName" value="${esc(s.storeName)}" data-clean="name" data-admin-rule="name" required><small class="field-error" data-error-for="storeName"></small></label><label>Logo Path<input name="logoPath" value="${esc(s.logoPath)}"></label><div class="grid two"><label>Contact Phone<input name="contactPhone" value="${esc(s.contactPhone)}" data-clean="phone" inputmode="tel"></label><label>WhatsApp<input name="whatsappNumber" value="${esc(s.whatsappNumber)}" data-clean="phone" inputmode="tel"></label></div><label>Support Email<input type="email" name="supportEmail" value="${esc(s.supportEmail)}"></label><label>Store Address<textarea name="storeAddress" data-clean="text">${esc(s.storeAddress)}</textarea></label><div class="grid two"><label>Shipping Fee<input name="shippingFee" value="${esc(s.shippingFee)}" inputmode="numeric" maxlength="7" data-clean="digits" data-admin-rule="optionalMoney"><small class="field-error" data-error-for="shippingFee"></small></label><label>Free Shipping Minimum<input name="freeShippingMinimum" value="${esc(s.freeShippingMinimum)}" inputmode="numeric" maxlength="7" data-clean="digits" data-admin-rule="optionalMoney"><small class="field-error" data-error-for="freeShippingMinimum"></small></label></div><label><input type="checkbox" name="freeShippingEnabled" value="1" ${s.freeShippingEnabled ? 'checked' : ''}> Enable free shipping threshold</label><label><input type="checkbox" name="codEnabled" value="1" ${s.codEnabled ? 'checked' : ''}> COD enabled</label><label>Delivery Text<input name="deliveryText" value="${esc(s.deliveryText)}" data-clean="text"></label><button class="btn primary">Save Settings</button></form>`));
});

app.post('/admin/settings', requireAdmin, (req, res) => {
  const db = readDb();
  try {
    const storeName = requireName(req.body.storeName, 'Store name');
    Object.assign(db.settings, { storeName, logoPath: normalizePublicPath(req.body.logoPath), contactPhone: String(req.body.contactPhone || '').replace(/[^\d+\s()-]/g, '').trim(), whatsappNumber: String(req.body.whatsappNumber || '').replace(/[^\d+\s()-]/g, '').trim(), supportEmail: String(req.body.supportEmail || '').trim(), storeAddress: cleanPlainText(req.body.storeAddress), shippingFee: parseMoneyField(req.body.shippingFee, 'Shipping Fee') || 0, freeShippingEnabled: Boolean(req.body.freeShippingEnabled), freeShippingMinimum: parseMoneyField(req.body.freeShippingMinimum, 'Free Shipping Minimum') || 0, codEnabled: Boolean(req.body.codEnabled), deliveryText: cleanPlainText(req.body.deliveryText) });
    writeDb(db);
    flash(req, 'success', 'Settings updated.');
  } catch (e) {
    flash(req, 'error', e.message);
  }
  res.redirect('/admin/settings');
});

app.get('/robots.txt', (_, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n'));
app.get('/sitemap.xml', (_, res) => res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>/</loc></url><url><loc>/track</loc></url></urlset>'));

app.use((req, res) => res.status(404).send(page(req, 'Page Not Found', '<main class="container"><section class="panel pad"><h1>Page not found</h1><a class="btn primary" href="/">Back home</a></section></main>')));

app.listen(PORT, () => {
  console.log(`Chocomedley running at http://localhost:${PORT}`);
});
