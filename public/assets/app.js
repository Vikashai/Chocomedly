const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;

function initProduct() {
  const form = document.querySelector('[data-product-form]');
  if (!form) return;
  const base = Number(form.dataset.basePrice);
  const shipping = Number(form.dataset.shipping);
  const qtyInput = form.querySelector('[name="quantity"]');
  const totalEls = document.querySelectorAll('[data-live-total]');
  const breakdown = document.querySelector('[data-breakdown]');

  function selectedOptions() {
    return [...form.querySelectorAll('[data-option]')].filter(box => {
      const checked = box.querySelector('input[type="checkbox"]:checked, input[type="radio"]:checked');
      const file = box.querySelector('input[type="file"]');
      const text = box.querySelector('textarea, input:not([type]), input[type="text"]');
      if (checked) return true;
      if (file) return file.files.length > 0;
      if (text) return String(text.value || '').trim() !== '';
      return false;
    }).map(box => ({ title: box.dataset.title, price: Number(box.dataset.price) }));
  }

  function recalc() {
    const qty = Math.max(1, Number(qtyInput.value || 1));
    qtyInput.value = qty;
    const options = selectedOptions();
    const perUnit = base + options.reduce((sum, item) => sum + item.price, 0);
    const subtotal = perUnit * qty;
    const total = subtotal + shipping;
    totalEls.forEach(el => el.textContent = money(total));
    if (breakdown) {
      breakdown.innerHTML = [
        `<span>Base hamper</span><strong>${money(base)}</strong>`,
        ...options.map(item => `<span>${item.title}</span><strong>${money(item.price)}</strong>`),
        `<span>Quantity</span><strong>${qty}</strong>`,
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
      const name = event.target.files[0]?.name || 'No file selected';
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
    qtyInput.value = Math.max(1, Number(qtyInput.value || 1) + Number(btn.dataset.qty));
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
  recalc();
}

function initCheckout() {
  const checkoutForm = document.querySelector('[data-checkout-form]');
  if (checkoutForm) {
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
  return input.closest('label')?.querySelector('.field-error') || document.querySelector(`[data-error-for="${input.name}"]`);
}

function setFieldError(input, message = '') {
  input.classList.toggle('is-invalid', Boolean(message));
  const error = fieldMessage(input);
  if (error) error.textContent = message;
}

function validateCheckout(form) {
  const rules = {
    person: input => /^[A-Za-z][A-Za-z ]{1,59}$/.test(input.value.trim()) ? '' : 'Use letters only.',
    mobile: input => /^[6-9]\d{9}$/.test(input.value.trim()) ? '' : 'Enter a valid 10-digit mobile number.',
    optionalMobile: input => !input.value.trim() || /^[6-9]\d{9}$/.test(input.value.trim()) ? '' : 'Enter a valid 10-digit mobile number.',
    optionalEmail: input => !input.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()) ? '' : 'Enter a valid email address.',
    requiredText: input => input.value.trim().length >= 4 ? '' : 'This field is required.',
    pin: input => /^\d{6}$/.test(input.value.trim()) ? '' : 'Enter a 6-digit PIN code.',
    requiredSelect: input => input.value ? '' : 'Select an option.'
  };
  let firstInvalid = null;
  form.querySelectorAll('[data-rule]').forEach(input => {
    const message = rules[input.dataset.rule]?.(input) || '';
    setFieldError(input, message);
    if (message && !firstInvalid) firstInvalid = input;
  });
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

function initAdminValidation() {
  const cleaners = {
    name: value => value.replace(/[^\p{L}\p{N}\s&()/-]/gu, '').replace(/\s{2,}/g, ' '),
    text: value => value.replace(/[^\p{L}\p{N}\s.,'&()/-]/gu, '').replace(/\s{2,}/g, ' '),
    phone: value => value.replace(/[^\d+\s()-]/g, ''),
    person: value => value.replace(/[^A-Za-z ]/g, '').replace(/\s{2,}/g, ' '),
    digits: value => value.replace(/\D/g, ''),
    address: value => value.replace(/[^\p{L}\p{N}\s.,'&()/-]/gu, '').replace(/\s{2,}/g, ' ')
  };
  document.querySelectorAll('[data-clean]').forEach(input => {
    const clean = cleaners[input.dataset.clean];
    if (!clean) return;
    input.addEventListener('input', () => {
      const next = clean(input.value);
      if (input.value !== next) input.value = next;
      if (input.dataset.rule) setFieldError(input);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initProduct();
  initCheckout();
  initAdminValidation();
});
