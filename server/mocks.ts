// Simulated external systems, exposed as separate HTTP APIs. The SDFP server talks to them over HTTP,
// exactly as it would talk to a real bank's core-banking API, the AICTE approval portal and a payment gateway.
// Each needs its own API key, so swapping in a real endpoint is a configuration change.
import express from 'express';
import crypto from 'node:crypto';
import { db } from './db';

export const MOCK_KEYS = { cbs: process.env.CBS_API_KEY || 'demo-cbs-key', aicte: process.env.AICTE_API_KEY || 'demo-aicte-key', pg: process.env.PG_API_KEY || 'demo-pg-key' };
const needKey = (k: string): express.RequestHandler => (req, res, next) => (req.header('x-api-key') === k ? next() : res.status(401).json({ error: 'invalid api key' }));
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const mocks = express.Router();
mocks.use(express.json());

/* Bank core banking (CBS): FDR lookup and lien release */
mocks.get('/cbs/v1/fdr', needKey(MOCK_KEYS.cbs), async (req, res) => {
  await delay(250 + Math.random() * 300);
  const number = String(req.query.number || '').toUpperCase(), ifsc = String(req.query.ifsc || '').toUpperCase();
  const r = db.prepare('SELECT * FROM cbs_records WHERE number = ? AND ifsc = ?').get(number, ifsc) as { amount_lakh: number; maturity: string; lien: number; holder: string } | undefined;
  if (!r) return res.json({ found: false, number, ifsc });
  res.json({ found: true, number, ifsc, amount: Math.round(r.amount_lakh * 1e5), maturity_date: r.maturity, lien_marked_to: r.lien ? 'Member Secretary, AICTE' : null, holder: r.holder, source: 'CBS' });
});
mocks.post('/cbs/v1/fdr', needKey(MOCK_KEYS.cbs), (req, res) => {   // used only by the demo specimen generator
  const b = req.body; db.prepare('INSERT OR REPLACE INTO cbs_records(number, ifsc, amount_lakh, maturity, lien, holder) VALUES(?,?,?,?,?,?)').run(String(b.number).toUpperCase(), String(b.ifsc).toUpperCase(), +b.amountLakh, String(b.maturity), b.lien ? 1 : 0, String(b.holder || ''));
  res.json({ ok: true });
});
mocks.post('/cbs/v1/lien/release', needKey(MOCK_KEYS.cbs), (req, res) => res.json({ released: true, number: req.body?.number, at: new Date().toISOString() }));

/* AICTE approval portal: institution master */
mocks.get('/aicte/v1/institutions/:aicteId', needKey(MOCK_KEYS.aicte), async (req, res) => {
  await delay(150);
  const r = db.prepare('SELECT data FROM institutions WHERE aicte_id = ?').get(req.params.aicteId) as { data: string } | undefined;
  if (!r) return res.status(404).json({ error: 'not found' });
  const i = JSON.parse(r.data); res.json({ permanent_id: i.aicteId, name: i.name, city: i.city, state: i.state, region: i.region, status: i.status, programme: i.type, intake: i.intake });
});

/* Payment gateway: create order, pay, settle */
const orders = new Map<string, { amount: number; ref: string; status: string; txnId?: string }>();
mocks.post('/pg/v1/orders', needKey(MOCK_KEYS.pg), (req, res) => { const id = 'ord_' + crypto.randomBytes(6).toString('hex'); orders.set(id, { amount: +req.body.amount, ref: String(req.body.ref), status: 'CREATED' }); res.json({ order_id: id, status: 'CREATED' }); });
mocks.post('/pg/v1/orders/:id/pay', needKey(MOCK_KEYS.pg), async (req, res) => {
  const o = orders.get(req.params.id); if (!o) return res.status(404).json({ error: 'no order' });
  await delay(400); o.status = 'SETTLED'; o.txnId = 'TXN' + crypto.randomBytes(5).toString('hex').toUpperCase();
  res.json({ order_id: req.params.id, status: o.status, txn_id: o.txnId, amount: o.amount, settled_to: 'AICTE security deposit account' });
});
