// Vercel Serverless Function — proxy Pix Duck Oficial / Duckfy.
// As chaves ficam SOMENTE aqui (server-side). Nunca expor no frontend.
//
// Endpoints:
//   POST /api/pix?action=create   body: {name,email,document,amount,productId,productName,utms}
//   GET  /api/pix?action=status&id=txn_xxx
//
// Os UTMs e dados do produto vão em `metadata`. A Duckfy já tem integração
// nativa com a Utmify — ela mesma encaminha os pedidos. Não enviamos nada
// direto à Utmify daqui pra evitar pedidos duplicados.
//
// Env vars OBRIGATÓRIAS (Vercel → Settings → Environment Variables):
//   DUCK_PUBLIC_KEY, DUCK_SECRET_KEY, DUCK_WORKSPACE_ID
// Sem essas variáveis o endpoint retorna 500 — nunca deixe credenciais em hardcode aqui.

const DUCK_PUBLIC_KEY   = process.env.DUCK_PUBLIC_KEY;
const DUCK_SECRET_KEY   = process.env.DUCK_SECRET_KEY;
const DUCK_WORKSPACE_ID = process.env.DUCK_WORKSPACE_ID;
const DUCK_BASE_URL     = 'https://app.duckoficial.com/api/v1';

// Splits desativados por padrão. Para dividir o pagamento, troque para um
// array com objetos { workspaceId, type: 'PERCENTAGE'|'FIXED_AMOUNT', value }.
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
  };
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

      // Metadata é repassado pela Duckfy à Utmify (integração nativa do gateway).
      const metadata = {
        productId,
        productName,
        customerIp,
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
      return res.status(status || 502).send(text);
    }

    return res.status(400).json({ error: 'invalid_action', message: 'use ?action=create or ?action=status' });
  } catch (err) {
    return res.status(502).json({ error: 'gateway_error', message: err && err.message ? err.message : String(err) });
  }
}
