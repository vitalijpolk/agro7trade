const FAIL = 'Не вдалося відправити. Зателефонуйте нам: +38 (099) 452-79-49';

// Sends a site form to /api/order. Expects the form to contain hidden `company` (honeypot)
// and `startedAt` inputs, a submit button, and a [role=status] element for the result text.
export function wireLeadForm(form: HTMLFormElement, extra: () => Record<string, string>) {
  const startedAt = form.querySelector<HTMLInputElement>('input[name="startedAt"]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const note = form.querySelector<HTMLElement>('[role="status"]');
  const stamp = () => { if (startedAt) startedAt.value = String(Date.now()); };
  stamp();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = { ...Object.fromEntries(fd) as Record<string, string>, ...extra(), page: location.href };

    if (button) button.disabled = true;
    if (note) { note.textContent = 'Надсилаємо…'; note.classList.remove('is-error'); }

    let ok = false;
    let message = FAIL;
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      ok = res.ok && data.ok === true;
      message = data.message || (ok ? "Дякуємо! Ми зв'яжемося з вами найближчим часом." : FAIL);
    } catch {
      /* network error → FAIL */
    }

    if (note) { note.textContent = message; note.classList.toggle('is-error', !ok); }
    if (ok) {
      form.reset();
      form.querySelectorAll('select').forEach((s) => s.dispatchEvent(new Event('change')));
      stamp();
    }
    if (button) button.disabled = false;
  });
}
