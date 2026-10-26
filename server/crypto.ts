// AES-256-GCM encryption for data at rest (database fields and stored documents).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.SDFP_DATA_DIR || path.join(process.cwd(), 'data'));
fs.mkdirSync(path.join(DATA_DIR, 'files'), { recursive: true });

function loadKey(name: string, envName: string): Buffer {
  const env = process.env[envName];
  if (env) { const b = Buffer.from(env, env.length === 64 ? 'hex' : 'base64'); if (b.length !== 32) throw new Error(`${envName} must be 32 bytes (64 hex chars)`); return b; }
  const f = path.join(DATA_DIR, name);
  if (!fs.existsSync(f)) { fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 }); console.warn(`[sdfp] generated ${name}; set ${envName} in production`); }
  return Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'hex');
}
const KEY = loadKey('master.key', 'SDFP_ENC_KEY');
export const JWT_SECRET = loadKey('jwt.key', 'SDFP_JWT_SECRET');

export function encrypt(plain: Buffer | string): Buffer {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(typeof plain === 'string' ? Buffer.from(plain, 'utf8') : plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);   // 12-byte IV | 16-byte tag | ciphertext
}
export function decrypt(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12), tag = blob.subarray(12, 28), enc = blob.subarray(28);
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]);
}
export const encJson = (o: unknown) => encrypt(JSON.stringify(o)).toString('base64');
export const decJson = <T,>(s: string): T => JSON.parse(decrypt(Buffer.from(s, 'base64')).toString('utf8'));
export const sha256hex = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex');
export const randomCode = () => String(crypto.randomInt(100000, 1000000));
export const randomId = (p: string) => p + crypto.randomBytes(5).toString('hex').toUpperCase();
