// Заявки з сайту → Telegram-група. type=order — замовлення товару, type=callback — зворотний дзвінок.
// Netlify Function за адресою /api/order.
// Змінні задаються в Netlify: Site configuration → Environment variables
//   TELEGRAM_BOT_TOKEN — токен бота (секрет)
//   TELEGRAM_CHAT_ID   — ID групи заявок

const PHONE = '+38 (099) 452-79-49';
const FAIL = `Не вдалося відправити. Зателефонуйте нам: ${PHONE}`;
const THANKS = {
  order: "Дякуємо! Ми зв'яжемося з вами найближчим часом.",
  callback: 'Дякуємо! Ми передзвонимо вам найближчим часом.',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

function pageUrl(v) {
  try {
    const u = new URL(clean(v, 500));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed' });

  let data;
  try {
    const ct = req.headers.get('content-type') || '';
    data = ct.includes('application/json') ? await req.json() : Object.fromEntries(await req.formData());
  } catch {
    return json(400, { ok: false, message: 'Некоректний запит' });
  }

  // `form` — старе ім'я поля, яке ще можуть надіслати закешовані сторінки.
  const type = (data.type ?? data.form) === 'order' ? 'order' : 'callback';

  // Захист від ботів: приховане поле має бути порожнім, а форма — заповнюватися хоча б 3 секунди.
  // Ботам відповідаємо «успіхом», щоб вони не підбирали обхід.
  const startedAt = Number(data.startedAt);
  if (data.company || (startedAt && Date.now() - startedAt < 3000)) {
    return json(200, { ok: true, message: THANKS[type] });
  }

  const name = clean(data.name, 200);
  const phone = clean(data.phone, 50);
  const product = clean(data.product, 300);
  const variant = clean(data.variant, 100);
  const qty = clean(data.qty, 10);
  const comment = clean(data.comment, 2000);
  const page = pageUrl(data.page);

  if (!phone) return json(400, { ok: false, message: 'Вкажіть номер телефону' });
  if (phone.replace(/\D/g, '').length < 9) return json(400, { ok: false, message: 'Перевірте номер телефону' });
  if (type === 'order' && !name) return json(400, { ok: false, message: "Вкажіть ваше ім'я" });
  if (type === 'order' && !product) return json(400, { ok: false, message: 'Не вказано товар' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('order: TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID не задані');
    return json(500, { ok: false, message: FAIL });
  }

  const time = `Час: ${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}`;
  const amount = variant && qty ? `Варіант / кількість: ${variant} / ${qty}`
    : variant ? `Варіант: ${variant}`
    : qty ? `Кількість: ${qty}`
    : null;

  const lines = type === 'order'
    ? [
        '🌽 Нова заявка з сайту Агро7трейд',
        'Форма: замовлення',
        `Товар: ${product}`,
        amount,
        `Ім'я: ${name}`,
        `Телефон: ${phone}`,
        comment ? `Коментар: ${comment}` : null,
        page ? `Сторінка: ${page}` : null,
        time,
      ]
    : [
        '📞 Запит на зворотний дзвінок — Агро7трейд',
        name ? `Ім'я: ${name}` : null,
        `Телефон: ${phone}`,
        comment ? `Коментар: ${comment}` : null,
        page ? `Сторінка: ${page}` : null,
        time,
      ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.filter(Boolean).join('\n'), disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error('order: Telegram error', res.status, await res.text());
      return json(502, { ok: false, message: FAIL });
    }
  } catch (e) {
    console.error('order: Telegram request failed', e);
    return json(502, { ok: false, message: FAIL });
  }

  return json(200, { ok: true, message: THANKS[type] });
};

export const config = { path: '/api/order' };
