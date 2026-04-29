// Vercel Serverless Function — proxy Pix Duck Oficial / Duckfy.

import crypto from 'crypto';

const DUCK_PUBLIC_KEY   = process.env.DUCK_PUBLIC_KEY;
const DUCK_SECRET_KEY   = process.env.DUCK_SECRET_KEY;
const DUCK_WORKSPACE_ID = process.env.DUCK_WORKSPACE_ID;
const DUCK_BASE_URL     = 'https://app.duckoficial.com/api/v1';

const TIKTOK_PIXEL_CODE   = process.env.TIKTOK_PIXEL_CODE;
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

const DUCK_SPLITS = [];

const duckHeaders = {
  'x-public-key': DUCK_PUBLIC_KEY,
  'x-secret-key': DUCK_SECRET_KEY,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

async function forward(method, path, body) {
  const r = await fetch(DUCK_BASE_URL + path, {
    method,
    headers: duckHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { status: r.status, text };
}

function pickUtms(raw) {
  const u = raw || {};
  return {
    utm_source:   String(u.utm_source   || ''),
    utm_campaign: String(u.utm_campaign || ''),
    utm_medium:   String(u.utm_medium   || ''),
    utm_content:  String(u.utm_content  || ''),
    utm_term:     String(u.utm_term     || ''),
    src:          String(u.src          || ''),
    sck:          String(u.sck          || ''),
    ttclid:       String(u.ttclid       || ''),
  };
}

function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

function getTransaction(data) {
  if (!data) return {};
  if (Array.isArray(data)) return data[0] || {};
  if (Array.isArray(data.data)) return data.data[0] || {};
  return data.transaction || data.data || data;
}

function getStatus(tx) {
  return String(tx.status || tx.paymentStatus || tx.transactionStatus || '').toUpperCase();
}

function isPaidStatus(status) {
  return ['COMPLETED', 'PAID', 'APPROVED'].includes(status);
}

async function sendTikTokCompletePayment({ tx, transactionId, req }) {
  if (!TIKTOK_PIXEL_CODE || !TIKTOK_ACCESS_TOKEN) return;

  const amount = Number(tx.amount || tx.value || tx.total || tx.paidAmount || 0) || 0;
  const metadata = tx.metadata || {};
  const client = tx.client || tx.customer || {};

  const customerIp =
    metadata.customerIp ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '';

  const userAgent = req.headers['user-agent'] || '';

  const eventId = `duckfy_${transactionId}`;

  const payload = {
    pixel_code: TIKTOK_PIXEL_CODE,
    event: 'CompletePayment',
    event_id: eventId,
    timestamp: Math.floor(Date.now() / 1000),
    context: {
      page: {
        url: metadata.pageUrl || metadata.url || 'https://super-sim-novoo.vercel.app/10/index.html'
      },
      user: {
        ip: customerIp,
        user_agent: userAgent,
        external_id: sha256(client.document || tx.document || metadata.document),
        email: sha256(client.email || tx.email || metadata.email),
        phone_number: sha256(client.phone || tx.phone || metadata.phone)
      },
      ad: {
        callback: metadata.ttclid || metadata.ttclid || ''
      }
    },
    properties: {
      value: amount,
      currency: 'BRL',
      contents: [
        {
          content_id: metadata.productId || 'seguro-prestamista',
          content_name: metadata.productName || 'Seguro Prestamista',
          content_type: 'product',
          quantity: 1,
          price: amount
        }
      ]
    }
  };

  Object.keys(payload.context.user).forEach((key) => {
    if (!payload.context.user[key]) delete payload.context.user[key];
  });

  const r = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Token': TIKTOK_ACCESS_TOKEN
    },
    body: JSON.stringify(payload)
  });

  const responseText = await r.text();
  console.log('[TikTok Events API]', r.status, responseText);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!DUCK_PUBLIC_KEY || !DUCK_SECRET_KEY) {
    return res.status(500).json({
      error: 'missing_credentials',
      message: 'Configure DUCK_PUBLIC_KEY e DUCK_SECRET_KEY nas Environment Variables da Vercel.'
    });
  }

  const action = (req.query.action || '').toString();

  try {
    if (action === 'create') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'method_not_allowed' });
      }

      const data = req.body || {};
      const name     = String(data.name     || '').trim() || 'Cliente SuperSim';
      const email    = String(data.email    || '').trim();
      const document = String(data.document || '').replace(/\D/g, '') || '00000000000';
      const amount   = Number(data.amount) > 0 ? Number(data.amount) : 28.90;
      const productId   = String(data.productId   || 'supersim').slice(0, 60);
      const productName = String(data.productName || 'SuperSim').slice(0, 120);
      const tracking = pickUtms(data.utms);
      const customerIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '';

      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const finalEmail = validEmail ? email : 'cliente@supersim.com.br';

      const identifier = `supersim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const metadata = {
        productId,
        productName,
        customerIp,
        pageUrl: req.headers.referer || '',
        document,
        email: finalEmail,
        ...tracking
      };

      const body = {
        identifier,
        amount,
        client: { name, email: finalEmail, document },
        metadata
      };
      if (DUCK_SPLITS.length > 0) body.splits = DUCK_SPLITS;

      const { status, text } = await forward('POST', '/gateway/pix/receive', body);
      return res.status(status || 502).send(text);
    }

    if (action === 'status') {
      const id = (req.query.id || '').toString();
      if (!id) return res.status(400).json({ error: 'missing_id' });

      const { status, text } = await forward('GET', `/transactions?id=${encodeURIComponent(id)}`);

      try {
        const parsed = JSON.parse(text);
        const tx = getTransaction(parsed);
        const txStatus = getStatus(tx);

        if (isPaidStatus(txStatus)) {
          await sendTikTokCompletePayment({
            tx,
            transactionId: id,
            req
          });
        }
      } catch (e) {
        console.warn('[TikTok Events API] skip:', e.message);
      }

      return res.status(status || 502).send(text);
    }

    return res.status(400).json({ error: 'invalid_action', message: 'use ?action=create or ?action=status' });
  } catch (err) {
    return res.status(502).json({ error: 'gateway_error', message: err && err.message ? err.message : String(err) });
  }
}
