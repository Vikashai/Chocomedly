const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;

function initProduct() {
  const form = document.querySelector('[data-product-form]');
  if (!form) return;
  const maxQuantity = 20;
  const base = Number(form.dataset.basePrice);
  const shipping = Number(form.dataset.shipping);
  const qtyInput = form.querySelector('[name="quantity"]');
  const totalEls = document.querySelectorAll('[data-live-total]');
  const breakdown = document.querySelector('[data-breakdown]');

  function quantity() {
    const qty = Math.max(1, Math.min(maxQuantity, Number(qtyInput.value || 1)));
    qtyInput.value = qty;
    return qty;
  }

  function clampAddons(qty) {
    form.querySelectorAll('[data-addon-quantity]').forEach(box => {
      const input = box.querySelector('[data-addon-input]');
      const display = box.querySelector('[data-addon-display]');
      const next = Math.max(0, Math.min(qty, Number(input.value || 0)));
      input.value = next;
      if (display) display.textContent = String(next);
    });
  }

  function syncUploadLimits(qty) {
    form.querySelectorAll('input[type="file"][multiple]').forEach(input => {
      const title = input.closest('.upload-box')?.querySelector('[data-upload-title]');
      if (title) title.textContent = `Attach up to ${qty} image${qty === 1 ? '' : 's'}`;
    });
  }

  function selectedOptions() {
    return [...form.querySelectorAll('[data-option]')].filter(box => {
      const checked = box.querySelector('input[type="checkbox"]:checked, input[type="radio"]:checked');
      const file = box.querySelector('input[type="file"]');
      const countedAddon = box.querySelector('[data-addon-input]');
      const text = box.querySelector('textarea, input:not([type]), input[type="text"]');
      if (countedAddon) return Number(countedAddon.value || 0) > 0;
      if (checked) return true;
      if (file) return file.files.length > 0;
      if (text) return String(text.value || '').trim() !== '';
      return false;
    }).map(box => {
      const price = Number(box.dataset.price);
      const file = box.querySelector('input[type="file"]');
      const countedAddon = box.querySelector('[data-addon-input]');
      if (countedAddon) {
        const count = Number(countedAddon.value || 0);
        return { title: `${box.dataset.title} x ${count}`, price: price * count };
      }
      if (file) {
        const count = Math.min(quantity(), file.files.length);
        return { title: `${box.dataset.title} x ${count}`, price: price * count };
      }
      return { title: box.dataset.title, price };
    });
  }

  function recalc() {
    const qty = quantity();
    clampAddons(qty);
    syncUploadLimits(qty);
    const options = selectedOptions();
    const addons = options.reduce((sum, item) => sum + item.price, 0);
    const subtotal = (base * qty) + addons;
    const total = subtotal + shipping;
    totalEls.forEach(el => el.textContent = money(total));
    if (breakdown) {
      breakdown.innerHTML = [
        `<span>Base hamper x ${qty}</span><strong>${money(base * qty)}</strong>`,
        ...options.map(item => `<span>${item.title}</span><strong>${money(item.price)}</strong>`),
        `<span>Shipping</span><strong>${money(shipping)}</strong>`,
      ].join('');
    }
    form.querySelectorAll('.choice-card').forEach(card => {
      card.classList.toggle('is-selected', Boolean(card.querySelector('input:checked')));
    });
  }

  form.addEventListener('input', recalc);
  form.addEventListener('change', event => {
    if (event.target.type === 'file') {
      const qty = quantity();
      if (event.target.files.length > qty) {
        const transfer = new DataTransfer();
        [...event.target.files].slice(0, qty).forEach(file => transfer.items.add(file));
        event.target.files = transfer.files;
      }
      const count = event.target.files.length;
      const name = count ? `${count} photo${count === 1 ? '' : 's'} selected` : 'No photos selected';
      event.target.closest('.upload-box')?.querySelector('[data-file-name]')?.replaceChildren(document.createTextNode(name));
    }
    recalc();
  });
  form.querySelectorAll('[data-counted]').forEach(input => {
    const target = form.querySelector(`[data-count-for="${input.name}"]`);
    const update = () => { if (target) target.textContent = String((input.value || '').length); };
    input.addEventListener('input', update);
    update();
  });
  document.querySelectorAll('[data-qty]').forEach(btn => btn.addEventListener('click', () => {
    qtyInput.value = Math.max(1, Math.min(maxQuantity, quantity() + Number(btn.dataset.qty)));
    recalc();
  }));
  form.querySelectorAll('[data-addon-delta]').forEach(btn => btn.addEventListener('click', () => {
    const input = btn.closest('[data-addon-quantity]')?.querySelector('[data-addon-input]');
    if (!input) return;
    input.value = Math.max(0, Math.min(quantity(), Number(input.value || 0) + Number(btn.dataset.addonDelta)));
    recalc();
  }));
  document.querySelectorAll('[data-thumb]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelector('[data-main-image]').src = btn.dataset.src;
  }));
  const thumbs = [...document.querySelectorAll('[data-thumb]')];
  const mainImage = document.querySelector('[data-main-image]');
  const shiftGallery = step => {
    if (!thumbs.length || !mainImage) return;
    const current = thumbs.findIndex(btn => btn.dataset.src === mainImage.src || mainImage.src.endsWith(btn.dataset.src.replaceAll(' ', '%20')));
    const next = (Math.max(0, current) + step + thumbs.length) % thumbs.length;
    mainImage.src = thumbs[next].dataset.src;
  };
  document.querySelector('[data-gallery-prev]')?.addEventListener('click', () => shiftGallery(-1));
  document.querySelector('[data-gallery-next]')?.addEventListener('click', () => shiftGallery(1));
  document.querySelector('[data-mobile-add]')?.addEventListener('click', () => {
    form.querySelector('button[formaction="/cart/add"]')?.click();
  });
  recalc();
}

function initCheckout() {
  const checkoutForm = document.querySelector('[data-checkout-form]');
  if (checkoutForm) {
    checkoutForm.querySelectorAll('[data-rule]').forEach(input => {
      input.addEventListener('input', () => refreshCheckoutField(input));
      input.addEventListener('change', () => refreshCheckoutField(input));
      input.addEventListener('blur', () => validateCheckoutField(input));
    });
    checkoutForm.addEventListener('submit', event => {
      if (!validateCheckout(checkoutForm)) {
        event.preventDefault();
        return;
      }
      setLoading(checkoutForm);
    });
  }
  document.querySelectorAll('form[data-once]:not([data-checkout-form])').forEach(form => form.addEventListener('submit', () => setLoading(form)));
}

function setLoading(form) {
  const btn = form.querySelector('button[type="submit"], button:not([type])');
  if (btn) {
    btn.disabled = true;
    btn.textContent = btn.dataset.loading || 'Saving...';
  }
}

function fieldMessage(input) {
  return document.querySelector(`[data-error-for="${input.name}"]`) || input.closest('label')?.querySelector('.field-error');
}

function setFieldError(input, message = '') {
  input.classList.toggle('is-invalid', Boolean(message));
  const error = fieldMessage(input);
  if (error) error.textContent = message;
}

const checkoutRules = {
  person: input => /^[\p{L}][\p{L} ]{1,59}$/u.test(input.value.trim()) ? '' : 'Use letters only.',
  mobile: input => /^[6-9]\d{9}$/.test(input.value.trim()) ? '' : 'Enter a valid 10-digit mobile number.',
  optionalMobile: input => {
    const value = input.value.trim();
    const main = input.form?.querySelector('[name="mobile"]')?.value.trim();
    if (!value) return '';
    if (!/^[6-9]\d{9}$/.test(value)) return 'Enter a valid 10-digit mobile number.';
    return value === main ? 'Use a different alternate mobile number.' : '';
  },
  optionalEmail: input => !input.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()) ? '' : 'Enter a valid email address.',
  requiredText: input => input.value.trim().length >= 4 ? '' : 'This field is required.',
  pin: input => /^\d{6}$/.test(input.value.trim()) ? '' : 'Enter a 6-digit PIN code.',
  requiredSelect: input => input.value ? '' : 'Select an option.',
  confirmation: input => input.checked ? '' : 'Confirm the order before continuing.'
};

function validateCheckoutField(input) {
  const message = checkoutRules[input.dataset.rule]?.(input) || '';
  setFieldError(input, message);
  return !message;
}

function refreshCheckoutField(input) {
  const message = checkoutRules[input.dataset.rule]?.(input) || '';
  if (input.classList.contains('is-invalid') || !message) {
    setFieldError(input, message);
  }
}

function validateCheckout(form) {
  let firstInvalid = null;
  form.querySelectorAll('[data-rule]').forEach(input => {
    if (!validateCheckoutField(input) && !firstInvalid) firstInvalid = input;
  });
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

function initAdminValidation() {
  const cleaners = {
    name: value => value.replace(/[^\p{L}\s]/gu, '').replace(/\s{2,}/g, ' '),
    text: value => value.replace(/[^\p{L}\p{N}\s.,'&()/-]/gu, '').replace(/\s{2,}/g, ' '),
    phone: value => value.replace(/[^\d+\s()-]/g, ''),
    person: value => value.replace(/[^\p{L} ]/gu, '').replace(/\s{2,}/g, ' '),
    digits: value => value.replace(/\D/g, ''),
    decimal: value => {
      const cleaned = value.replace(/[^\d.]/g, '');
      const [whole = '', ...fractions] = cleaned.split('.');
      return fractions.length ? `${whole}.${fractions.join('').slice(0, 2)}` : whole;
    },
    address: value => value.replace(/[^\p{L}\p{N}\s.,'&()/-]/gu, '').replace(/\s{2,}/g, ' ')
  };
  document.querySelectorAll('[data-clean]').forEach(input => {
    const clean = cleaners[input.dataset.clean];
    if (!clean) return;
    input.addEventListener('input', () => {
      const next = clean(input.value);
      if (input.value !== next) input.value = next;
      if (input.dataset.rule) refreshCheckoutField(input);
      if (input.dataset.adminRule) refreshAdminField(input);
    });
  });
  document.querySelectorAll('[data-admin-rule]').forEach(input => {
    input.addEventListener('input', () => refreshAdminField(input));
    input.addEventListener('change', () => refreshAdminField(input));
    input.addEventListener('blur', () => validateAdminField(input));
  });
  document.querySelectorAll('[data-admin-form]').forEach(form => {
    form.addEventListener('submit', event => {
      if (!validateAdminForm(form)) {
        event.preventDefault();
        return;
      }
      setLoading(form);
    });
  });
  document.querySelectorAll('[name="freeShippingEnabled"]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const threshold = toggle.form?.querySelector('[name="freeShippingMinimum"]');
      if (threshold) refreshAdminField(threshold);
    });
  });
  document.querySelectorAll('[data-option-editor]').forEach(editor => {
    const select = editor.querySelector('[data-option-type]');
    if (!select) return;
    const sync = () => {
      const type = select.value;
      editor.querySelectorAll('[data-option-fields]').forEach(group => {
        const visible = group.dataset.optionFields.split(/\s+/).includes(type);
        group.hidden = !visible;
        group.querySelectorAll('input, textarea, select').forEach(field => { field.disabled = !visible; });
      });
    };
    select.addEventListener('change', sync);
    sync();
  });
  document.querySelectorAll('[data-confirm]').forEach(button => {
    button.addEventListener('click', event => {
      if (!window.confirm(button.dataset.confirm)) event.preventDefault();
    });
  });
}

function initStoreActivity() {
  const activity = document.querySelector('[data-store-activity]');
  if (!activity) return;
  const refresh = async () => {
    try {
      const response = await fetch('/store-activity', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      const orders = activity.querySelector('[data-recent-orders]');
      const orderLabel = activity.querySelector('[data-order-label]');
      const visitors = activity.querySelector('[data-active-visitors]');
      const updateNumber = (element, nextValue) => {
        if (!element || element.textContent === String(nextValue)) return;
        element.classList.remove('is-updating');
        void element.offsetWidth;
        element.textContent = String(nextValue);
        element.classList.add('is-updating');
      };
      updateNumber(orders, data.recentOrders);
      if (orderLabel) orderLabel.textContent = data.recentOrders === 1 ? 'order' : 'orders';
      updateNumber(visitors, data.activeVisitors);
    } catch (_) {
      // Keep the server-rendered figures when the activity refresh is unavailable.
    }
  };
  window.setTimeout(refresh, 2500);
  window.setInterval(refresh, 20000);
}

const adminRules = {
  name: input => /^[\p{L}][\p{L}\s]{1,79}$/u.test(input.value.trim()) ? '' : 'Use letters only.',
  text: input => !input.value.trim() || input.value.trim().length >= 4 ? '' : 'Enter at least 4 characters.',
  requiredText: input => input.value.trim().length >= 4 ? '' : 'Enter at least 4 characters.',
  money: input => /^\d+(\.\d{1,2})?$/.test(input.value.trim()) ? '' : 'Use a valid amount.',
  positiveMoney: input => /^\d+(\.\d{1,2})?$/.test(input.value.trim()) && Number(input.value) > 0 ? '' : 'Enter an amount greater than zero.',
  optionalMoney: input => !input.value.trim() || /^\d+(\.\d{1,2})?$/.test(input.value.trim()) ? offerPriceMessage(input) : 'Use a valid amount.',
  wholeNumber: input => /^\d+$/.test(input.value.trim()) ? '' : 'Use numbers only.',
  optionalWholeNumber: input => !input.value.trim() || /^\d+$/.test(input.value.trim()) ? '' : 'Use numbers only.',
  displayOrder: input => /^\d+$/.test(input.value.trim()) && Number(input.value) <= 999 ? '' : 'Use a whole number from 0 to 999.',
  characterLimit: input => !input.value.trim() || (/^\d+$/.test(input.value.trim()) && Number(input.value) > 0 && Number(input.value) <= 1000) ? '' : 'Use a whole number from 1 to 1000.',
  phone: input => { const count = input.value.replace(/\D/g, '').length; return count >= 10 && count <= 15 ? '' : 'Enter 10 to 15 digits.'; },
  email: input => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()) ? '' : 'Enter a valid email address.',
  imagePath: input => /^\/(img|catalog)\/[\w .()\-/%]+$/i.test(input.value.trim()) ? '' : 'Use an /img/ or /catalog/ path.',
  imagePaths: input => input.value.trim().split(/\r?\n/).filter(Boolean).every(value => /^\/(img|catalog)\/[\w .()\-/%]+$/i.test(value.trim())) ? '' : 'Every line must use an /img/ or /catalog/ path.',
  faq: input => input.value.trim().split(/\r?\n/).filter(Boolean).length > 0 && input.value.trim().split(/\r?\n/).filter(Boolean).every(line => { const index = line.indexOf('|'); return index >= 3 && index < line.length - 1; }) ? '' : 'Use Question|Answer on every line.',
  choices: input => input.value.trim().split(/\r?\n/).map(value => value.trim()).filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).length >= 2 ? '' : 'Add at least two unique choices.',
  shippingThreshold: input => {
    const enabled = input.form?.querySelector('[name="freeShippingEnabled"]')?.checked;
    if (!enabled && !input.value.trim()) return '';
    return /^\d+(\.\d{1,2})?$/.test(input.value.trim()) && (!enabled || Number(input.value) > 0) ? '' : 'Enter an amount greater than zero.';
  }
};

function offerPriceMessage(input) {
  if (input.name !== 'offerPrice' || !input.value.trim()) return '';
  const base = input.form?.querySelector('[name="basePrice"]');
  return base && Number(input.value) >= Number(base.value || 0) ? 'Offer Price must be lower than Base Price.' : '';
}

function validateAdminField(input) {
  const message = adminRules[input.dataset.adminRule]?.(input) || '';
  setFieldError(input, message);
  return !message;
}

function refreshAdminField(input) {
  const message = adminRules[input.dataset.adminRule]?.(input) || '';
  if (input.classList.contains('is-invalid') || !message) {
    setFieldError(input, message);
  }
}

function validateAdminForm(form) {
  let firstInvalid = null;
  form.querySelectorAll('[data-admin-rule]').forEach(input => {
    if (!validateAdminField(input) && !firstInvalid) firstInvalid = input;
  });
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

document.addEventListener('DOMContentLoaded', () => {
  initProduct();
  initCheckout();
  initAdminValidation();
  initStoreActivity();
});
