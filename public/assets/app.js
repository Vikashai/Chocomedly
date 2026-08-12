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
  document.querySelectorAll('form[data-once]').forEach(form => form.addEventListener('submit', () => {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = btn.dataset.loading || 'Saving...';
    }
  }));
}

document.addEventListener('DOMContentLoaded', () => {
  initProduct();
  initCheckout();
});
