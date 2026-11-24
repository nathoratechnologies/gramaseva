// Gramaseva free WhatsApp login (Cloudflare Worker, free plan).
//
// How it works (no SMS, no OTP cost):
//  1. The app calls POST /start → gets a short code and a signed session.
//  2. The person taps "Open WhatsApp": WhatsApp opens with "GRAMASEVA LOGIN <code>" ready to send to our
//     business number. They press Send. Messages FROM users TO a business are free on the WhatsApp Cloud API.
//  3. Meta calls POST /webhook with the message. We check Meta's signature, so the sender's number is real,
//     and remember "code → +91 number" for 10 minutes.
//  4. The app keeps calling POST /check. Once the number is known we return a Firebase custom token,
//     and the app signs in with it. We never send a WhatsApp message, so nothing is billed.
//
// Secrets / vars: see wrangler.toml and README.md.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const TTL_SEC = 600;
const enc = new TextEncoder();

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === '/start' && req.method === 'POST') return json(await start(env), cors);
      if (url.pathname === '/check' && req.method === 'POST') return json(await check(await req.json().catch(() => ({})), env), cors);
      if (url.pathname === '/webhook' && req.method === 'GET') return verifyWebhook(url, env);
      if (url.pathname === '/webhook' && req.method === 'POST') return await webhook(req, env);
      return new Response('Gramaseva WhatsApp login', { status: 200 });
    } catch (e) {
      console.error(e);
      return json({ error: 'server' }, cors, 500);
    }
  },
};

// ---------- App side ----------

async function start(env) {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  const expiresAt = Date.now() + TTL_SEC * 1000;
  // Stateless session: nothing is stored until the WhatsApp message arrives (keeps us inside the free KV limits).
  const payload = `${code}.${expiresAt}`;
  const session = `${payload}.${b64url(await hmac(env.SESSION_SECRET, payload))}`;
  return { session, code, text: `GRAMASEVA LOGIN ${code}`, waNumber: String(env.WA_NUMBER).replace(/\D/g, ''), expiresAt };
}

async function check(body, env) {
  const parts = String(body.session ?? '').split('.');
  if (parts.length !== 3) return { status: 'expired' };
  const [code, exp, sig] = parts;
  const key = await crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const good = await crypto.subtle.verify('HMAC', key, fromB64url(sig), enc.encode(`${code}.${exp}`));
  if (!good || Date.now() > Number(exp)) return { status: 'expired' };
  const phone = await env.LOGINS.get('c:' + code);
  if (!phone) return { status: 'waiting' };
  const uid = await uidFor(phone, env);
  return { status: 'ok', token: await customToken(uid, phone, env) };
}

// ---------- Meta (WhatsApp Cloud API) webhook ----------

function verifyWebhook(url, env) {
  const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env.META_VERIFY_TOKEN;
  return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('forbidden', { status: 403 });
}

async function webhook(req, env) {
  const raw = await req.text();
  // Only Meta knows the app secret: a good signature proves the message (and its sender number) is real.
  const want = 'sha256=' + hex(await hmac(env.META_APP_SECRET, raw));
  const got = req.headers.get('x-hub-signature-256') ?? '';
  if (!safeEqual(want, got)) return new Response('bad signature', { status: 401 });

  const body = JSON.parse(raw);
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        const text = msg.type === 'text' ? msg.text?.body ?? '' : '';
        const m = /GRAMASEVA\s+LOGIN\s+([A-Z0-9]{6})/i.exec(text);
        const from = String(msg.from ?? '');
        // The app works with Indian mobile numbers (+91 and 10 digits starting 6–9).
        if (!m || !/^91[6-9]\d{9}$/.test(from)) continue;
        const code = m[1].toUpperCase();
        if (await env.LOGINS.get('c:' + code)) continue; // first sender wins
        await env.LOGINS.put('c:' + code, '+' + from, { expirationTtl: TTL_SEC });
      }
    }
  }
  return new Response('ok', { status: 200 }); // always 200, or Meta keeps re-sending
}

// ---------- Firebase ----------

const privateKey = (env) => String(env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n');

/** Same Firebase user as before when this number already logged in with SMS OTP; otherwise a fixed id made from the number. */
async function uidFor(phone, env) {
  try {
    const token = await accessToken(env);
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:lookup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: [phone] }),
    });
    if (r.ok) {
      const j = await r.json();
      if (j.users?.[0]?.localId) return j.users[0].localId;
    } else console.error('lookup', r.status, await r.text());
  } catch (e) { console.error('lookup failed', e); }
  // Not the raw number: user ids show up in public places (reviews), phone numbers must not.
  return 'wa' + hex(await hmac(env.UID_SALT, phone)).slice(0, 26);
}

let cachedAccess = null;
async function accessToken(env) {
  if (cachedAccess && cachedAccess.exp > Date.now() + 60000) return cachedAccess.token;
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({
    iss: env.FIREBASE_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/identitytoolkit',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }, privateKey(env));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
  });
  if (!r.ok) throw new Error('oauth ' + r.status + ' ' + (await r.text()));
  const j = await r.json();
  cachedAccess = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cachedAccess.token;
}

/** Firebase custom token (what the Admin SDK's createCustomToken makes), signed with the service account key. */
function customToken(uid, phone, env) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    iss: env.FIREBASE_CLIENT_EMAIL, sub: env.FIREBASE_CLIENT_EMAIL,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 3600, uid,
    // The app and the security rules read the verified number from these claims.
    claims: { phone_number: phone, wa_phone: phone },
  }, privateKey(env));
}

async function signJwt(payload, pem) {
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

// ---------- Small helpers ----------

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, enc.encode(data));
}
function b64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  try {
    const t = s.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
  } catch { return new Uint8Array(); }
}
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function corsHeaders(req, env) {
  const allowed = String(env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': !allowed.length ? '*' : allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}
function json(data, headers, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
