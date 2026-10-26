// SQLite persistence (Node's built-in node:sqlite). Sensitive rows are encrypted with AES-256-GCM;
// the audit table is append-only, enforced by database triggers.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type { AppState, AuditEntry, Deposit, Institution, Notice, OutMsg, User, VaultMove } from '../src/lib/types';
import { seed } from '../src/lib/data';
import { todayReal, addDays } from '../src/lib/util';
import { DATA_DIR, decJson, encJson } from './crypto';

export const db = new DatabaseSync(path.join(DATA_DIR, 'sdfp.db'));
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);

const AUDIT_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;`;

db.exec(`
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS institutions (id TEXT PRIMARY KEY, aicte_id TEXT UNIQUE NOT NULL, region TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS deposits (id TEXT PRIMARY KEY, inst_id TEXT NOT NULL REFERENCES institutions(id), bank_code TEXT NOT NULL, number TEXT NOT NULL, data_enc TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS deposits_inst ON deposits(inst_id); CREATE INDEX IF NOT EXISTS deposits_bank ON deposits(bank_code); CREATE INDEX IF NOT EXISTS deposits_number ON deposits(number);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, role TEXT NOT NULL, login_id TEXT UNIQUE COLLATE NOCASE NOT NULL, password_hash TEXT NOT NULL, failed INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, data_enc TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (seq INTEGER PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, role TEXT NOT NULL, action TEXT NOT NULL, ref TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notices (id TEXT PRIMARY KEY, at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vault_moves (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS esign (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, at TEXT NOT NULL, channel TEXT NOT NULL, to_addr TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, ref TEXT, status TEXT NOT NULL, alert_key TEXT);
CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT NOT NULL, owner TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS otps (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, purpose TEXT NOT NULL, ref TEXT NOT NULL, code_hash TEXT NOT NULL, expires INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS cbs_records (number TEXT NOT NULL, ifsc TEXT NOT NULL, amount_lakh REAL NOT NULL, maturity TEXT NOT NULL, lien INTEGER NOT NULL, holder TEXT NOT NULL, PRIMARY KEY (number, ifsc));
${AUDIT_TRIGGERS}`);

const getMeta = (k: string) => (db.prepare('SELECT value FROM meta WHERE key = ?').get(k) as { value: string } | undefined)?.value;
const setMeta = (k: string, v: string) => db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
export const tx = (fn: () => void) => { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };

/* ---------- seeding ---------- */
export function seedIfEmpty(force = false) {
  if (!force && getMeta('seeded')) return;
  const s = seed(todayReal());
  tx(() => {
    db.exec(`DROP TRIGGER IF EXISTS audit_no_update; DROP TRIGGER IF EXISTS audit_no_delete;
      DELETE FROM deposits; DELETE FROM users; DELETE FROM institutions; DELETE FROM audit; DELETE FROM notices; DELETE FROM vault_moves; DELETE FROM esign; DELETE FROM outbox; DELETE FROM otps; DELETE FROM cbs_records; DELETE FROM meta;`);
    db.exec(AUDIT_TRIGGERS);
    const insI = db.prepare('INSERT INTO institutions(id, aicte_id, region, data) VALUES(?,?,?,?)');
    s.institutions.forEach(i => insI.run(i.id, i.aicteId, i.region, JSON.stringify(i)));
    const insC = db.prepare('INSERT OR REPLACE INTO cbs_records(number, ifsc, amount_lakh, maturity, lien, holder) VALUES(?,?,?,?,?,?)');
    s.deposits.forEach(d => {
      upsertDeposit(d);
      // the bank's own system of record (what core banking would return)
      if (d.kind === 'FDR' && d.bankCode !== 'SLCC') { const c = d.confirmed || d.cbs || { amountLakh: d.claimed.amountLakh, maturity: d.claimed.maturity, lien: true }; insC.run(d.number, d.ifsc, c.amountLakh, c.maturity, c.lien ? 1 : 0, s.institutions.find(i => i.id === d.instId)!.name); }
    });
    s.users.forEach(u => insertUser(u, u.password));
    const insA = db.prepare('INSERT INTO audit(seq, at, actor, role, action, ref, prev, hash) VALUES(?,?,?,?,?,?,?,?)');
    s.audit.forEach(a => insA.run(a.seq, a.at, a.actor, a.role, a.action, a.ref, a.prev, a.hash));
    const insV = db.prepare('INSERT INTO vault_moves(data) VALUES(?)'); s.vault.forEach(v => insV.run(JSON.stringify(v)));
    setMeta('baseDate', s.baseDate); setMeta('offset', '0'); setMeta('config', JSON.stringify(s.config)); setMeta('scrutinyClosed', '[]'); setMeta('lastScan', addDays(s.baseDate, -2)); setMeta('seeded', new Date().toISOString());
  });
  console.log(`[sdfp] database seeded: ${s.institutions.length} institutions, ${s.deposits.length} deposits, ${s.users.length} users`);
}

export function insertUser(u: User, plainPassword: string) {
  const { password: _p, ...rest } = u;
  db.prepare('INSERT INTO users(id, role, login_id, password_hash, data_enc) VALUES(?,?,?,?,?)').run(u.id, u.role, u.loginId, bcrypt.hashSync(plainPassword, 10), encJson(rest));
}
export function upsertDeposit(d: Deposit) {
  db.prepare(`INSERT INTO deposits(id, inst_id, bank_code, number, data_enc, updated_at) VALUES(?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET bank_code = excluded.bank_code, number = excluded.number, data_enc = excluded.data_enc, updated_at = excluded.updated_at`).run(d.id, d.instId, d.bankCode, d.number, encJson(d), new Date().toISOString());
}

/* ---------- load the whole state into memory ---------- */
export function loadState(): AppState {
  const institutions = (db.prepare('SELECT data FROM institutions ORDER BY id').all() as { data: string }[]).map(r => JSON.parse(r.data) as Institution);
  const deposits = (db.prepare('SELECT data_enc FROM deposits').all() as { data_enc: string }[]).map(r => decJson<Deposit>(r.data_enc)).sort((a, b) => a.id.localeCompare(b.id));
  const users = (db.prepare('SELECT id, data_enc FROM users').all() as { id: string; data_enc: string }[]).map(r => ({ ...decJson<User>(r.data_enc), password: '' }));
  const audit = db.prepare('SELECT * FROM audit ORDER BY seq').all() as unknown as AuditEntry[];
  const notices = (db.prepare('SELECT data FROM notices ORDER BY at DESC, rowid DESC').all() as { data: string }[]).map(r => JSON.parse(r.data) as Notice);
  const vault = (db.prepare('SELECT data FROM vault_moves ORDER BY id').all() as { data: string }[]).map(r => JSON.parse(r.data) as VaultMove);
  const esign = (db.prepare('SELECT data FROM esign ORDER BY id').all() as { data: string }[]).map(r => JSON.parse(r.data));
  const outbox = (db.prepare('SELECT * FROM outbox ORDER BY at DESC, rowid DESC LIMIT 2000').all() as Record<string, string>[]).map(r => ({ id: r.id, at: r.at, channel: r.channel, to: r.to_addr, subject: r.subject, body: r.body, ref: r.ref, status: r.status, key: r.alert_key }) as OutMsg);
  return {
    version: 3, baseDate: getMeta('baseDate')!, offset: +(getMeta('offset') || 0), institutions, deposits, users, audit, notices, vault,
    config: JSON.parse(getMeta('config')!), esign, scrutinyClosed: JSON.parse(getMeta('scrutinyClosed') || '[]'), outbox, lastScan: getMeta('lastScan'),
  };
}

/* ---------- persist only what an action changed ---------- */
export function saveDiff(before: AppState, after: AppState) {
  tx(() => {
    const prev = new Map(before.deposits.map(d => [d.id, JSON.stringify(d)]));
    after.deposits.forEach(d => { if (prev.get(d.id) !== JSON.stringify(d)) upsertDeposit(d); });
    const prevI = new Map(before.institutions.map(i => [i.id, JSON.stringify(i)]));
    after.institutions.forEach(i => { const j = JSON.stringify(i); if (prevI.get(i.id) !== j) db.prepare('UPDATE institutions SET data = ? WHERE id = ?').run(j, i.id); });
    const insA = db.prepare('INSERT INTO audit(seq, at, actor, role, action, ref, prev, hash) VALUES(?,?,?,?,?,?,?,?)');
    after.audit.slice(before.audit.length).forEach(a => insA.run(a.seq, a.at, a.actor, a.role, a.action, a.ref, a.prev, a.hash));
    const known = new Set(before.notices.map(n => n.id));
    after.notices.filter(n => !known.has(n.id)).forEach(n => db.prepare('INSERT INTO notices(id, at, data) VALUES(?,?,?)').run(n.id, n.at, JSON.stringify(n)));
    after.vault.slice(before.vault.length).forEach(v => db.prepare('INSERT INTO vault_moves(data) VALUES(?)').run(JSON.stringify(v)));
    after.esign.slice(before.esign.length).forEach(e => db.prepare('INSERT INTO esign(data) VALUES(?)').run(JSON.stringify(e)));
    const knownO = new Set((before.outbox || []).map(o => o.id));
    (after.outbox || []).filter(o => !knownO.has(o.id)).reverse().forEach(o => db.prepare('INSERT INTO outbox(id, at, channel, to_addr, subject, body, ref, status, alert_key) VALUES(?,?,?,?,?,?,?,?,?)').run(o.id, o.at, o.channel, o.to, o.subject, o.body, o.ref || '', o.status, o.key || null));
    if (before.offset !== after.offset) setMeta('offset', String(after.offset));
    if (JSON.stringify(before.config) !== JSON.stringify(after.config)) setMeta('config', JSON.stringify(after.config));
    if (JSON.stringify(before.scrutinyClosed) !== JSON.stringify(after.scrutinyClosed)) setMeta('scrutinyClosed', JSON.stringify(after.scrutinyClosed));
    if (after.lastScan && before.lastScan !== after.lastScan) setMeta('lastScan', after.lastScan);
  });
}
export const setOutboxStatus = (id: string, status: string) => db.prepare('UPDATE outbox SET status = ? WHERE id = ?').run(status, id);

/* ---------- demo: an insider editing the audit table directly ---------- */
export function tamperAuditRow(seq: number, newAction: string) {
  db.exec('DROP TRIGGER IF EXISTS audit_no_update');           // an insider with database access bypasses the app
  db.prepare('UPDATE audit SET action = ? WHERE seq = ?').run(newAction, seq);
  db.exec(AUDIT_TRIGGERS);
}
export const auditRows = () => db.prepare('SELECT * FROM audit ORDER BY seq').all() as unknown as AuditEntry[];
