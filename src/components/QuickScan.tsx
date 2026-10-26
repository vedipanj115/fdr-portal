import { useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, ScanLine } from 'lucide-react';
import { useApp, instOf } from '../lib/store';
import { decodeFrom, parseSticker, qrDataUrl, stickerCode } from '../lib/qr';
import { life, today, type Life } from '../lib/rules';
import type { Deposit } from '../lib/types';
import { fmtDate, inr, canDownload } from '../lib/util';
import { Badge, LifeDot, Modal, VerifBadge } from './ui';

type Pub = { number: string; inst: string; city: string; life: Life };
type Res = { kind: 'genuine' | 'typed'; d: Deposit } | { kind: 'public'; p: Pub } | { kind: 'forged'; claimed?: string } | { kind: 'none'; msg: string } | null;

export default function QuickScan() {
  const { s, user, nav, act } = useApp();
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState<string>(''); const [cam, setCam] = useState(false);
  const [res, setRes] = useState<Res>(null); const [q, setQ] = useState('');
  const stream = useRef<MediaStream | null>(null); const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => { const h = () => { setOpen(true); setRes(null); setImg(''); setQ(''); }; window.addEventListener('sdfp-scan', h); return () => window.removeEventListener('sdfp-scan', h); }, []);
  const stop = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setCam(false); };
  const close = () => { stop(); setOpen(false); };
  const log = (action: string, ref = '') => void act('audit.log', { action, ref }, { quiet: true });

  const visible = (d: Deposit) => !user || user.role === 'officer' || (user.role === 'bank' ? d.bankCode === user.bankCode : true);
  const judge = (text: string | null) => {
    if (!text) { setRes({ kind: 'none', msg: 'No QR code found. Try a sharper photo, or type the number.' }); return false; }
    const p = parseSticker(text);
    if (!p) { setRes({ kind: 'forged' }); return true; }
    void act<{ genuine: boolean; claimed?: string; depId?: string } & Partial<Pub>>('scan.verify', { code: text }).then(r => {
      if (!r) return; const x = r.result;
      if (!x.genuine) { setRes({ kind: 'forged', claimed: x.claimed }); return; }
      const d = s.deposits.find(z => z.id === x.depId);
      setRes(d && visible(d) ? { kind: 'genuine', d } : { kind: 'public', p: x as Pub });
    });
    return true;
  };
  const demo = (fake: boolean) => {
    stop();
    const pool = s.deposits.filter(d => d.kind === 'FDR' && d.custody && visible(d) && !d.replacedBy);
    const d = pool[Math.floor(Math.random() * pool.length)]; if (!d) return;
    let code = stickerCode(d); if (fake) code = code.replace(/\|[0-9a-f]{12}$/, '|' + Math.random().toString(16).slice(2, 14).padEnd(12, '0'));
    const url = qrDataUrl(code); setImg(url);
    const im = new Image(); im.onload = () => judge(decodeFrom(im, im.naturalWidth, im.naturalHeight)); im.src = url;
  };
  const upload = (f: File) => { stop(); const url = URL.createObjectURL(f); setImg(url); const im = new Image(); im.onload = () => judge(decodeFrom(im, im.naturalWidth, im.naturalHeight)); im.src = url; };
  const startCam = async () => {
    try { stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch { setRes({ kind: 'none', msg: 'The camera is not available here. Upload a photo instead.' }); return; }
    setImg(''); setCam(true);
    requestAnimationFrame(async () => {
      const v = vid.current; if (!v || !stream.current) return; v.srcObject = stream.current; await v.play();
      const tick = () => { if (!stream.current || !vid.current) return; if (v.videoWidth) { const t = decodeFrom(v, v.videoWidth, v.videoHeight); if (t) { judge(t); stop(); return; } } requestAnimationFrame(tick); };
      tick();
    });
  };
  const lookup = (e: React.FormEvent) => { e.preventDefault(); const k = q.trim().toUpperCase(); const d = s.deposits.find(x => x.number.toUpperCase() === k || x.id.toUpperCase() === k); if (d && visible(d)) { setRes({ kind: 'typed', d }); log(`Quick Scan: looked up ${d.number}`, d.id); } else setRes({ kind: 'none', msg: 'No deposit with that number.' }); };
  if (!open) return null;
  const canCam = !!navigator.mediaDevices?.getUserMedia && canDownload();

  const result = () => {
    if (!res) return <div className="hint">The result shows here: whether the sticker is genuine, the deposit's status and where the original is kept.</div>;
    if (res.kind === 'none') return <div className="verdict bad"><b>Nothing found</b><span>{res.msg}</span></div>;
    if (res.kind === 'public') { const ok = res.p.life === 'Active' || res.p.life === 'Expiring'; return <div className="col"><div className="verdict good"><b>Sticker genuine</b><span>Matches {res.p.number} in the register.</span></div><div className="panel"><div className="pb col"><b className="mono" style={{ color: 'var(--ink)' }}>{res.p.number}</b><div className="muted">{res.p.inst}, {res.p.city}</div><Badge tone={ok ? 'good' : 'bad'} icon>{ok ? 'Security deposit valid' : 'Not valid right now'}</Badge><div className="hint">Full details are visible only to the institution, its bank and AICTE.</div></div></div></div>; }
    if (res.kind === 'forged') return <div className="verdict bad"><b>Not recognised</b><span>This sticker{res.claimed ? ` claims FDR ${res.claimed}, but it` : ''} does not match any record. Do not accept the document; report it to the Regional Office.</span></div>;
    const d = res.d; const inst = instOf(s, d.instId); const l = life(d, s, today(s));
    const publicOnly = !user || (user.role === 'institution' && d.instId !== user.instId);
    return (
      <div className="col">
        {res.kind === 'genuine' && <div className="verdict good"><b>Sticker genuine</b><span>Matches {d.number} in the register.</span></div>}
        <div className="panel"><div className="pb col">
          <div className="row" style={{ justifyContent: 'space-between' }}><b className="mono" style={{ fontSize: '1.07rem', color: 'var(--ink)' }}>{d.number}</b><LifeDot l={l} /></div>
          <div className="muted">{inst.name}, {inst.city}</div>
          {publicOnly ? <Badge tone={l === 'Active' || l === 'Expiring' ? 'good' : 'bad'} icon>{l === 'Active' || l === 'Expiring' ? 'Security deposit valid' : 'Not valid right now'}</Badge> : <>
            <dl className="kv"><dt>Bank</dt><dd>{d.bankName}</dd><dt>Amount</dt><dd>{inr(d.claimed.amountLakh)}</dd><dt>Matures</dt><dd>{fmtDate(d.claimed.maturity)}</dd><dt>Bank check</dt><dd><VerifBadge v={d.verification} /></dd><dt>Original</dt><dd>{d.custody ? `${d.custody.state}, locker ${d.custody.locker}` : 'Digital (online payment)'}</dd></dl>
            <div className="row"><button className="btn primary sm" onClick={() => { close(); nav('deposit', d.id); }}>Open record</button>{user?.role === 'officer' && d.custody && <button className="btn sm" onClick={() => { close(); nav('vault', d.id); }}>Show in vault</button>}{user?.role === 'bank' && <button className="btn sm" onClick={() => { close(); nav('desk', d.id); }}>Open in confirmation desk</button>}</div>
          </>}
        </div></div>
      </div>
    );
  };
  return (
    <Modal title="Quick Scan" sub="Scan the QR sticker on an original FDR, upload a photo of it, or type the number." onClose={close} width={860}>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="col">
          <div className="scanview">{cam ? <><video ref={vid} playsInline muted /><div className="aim" /></> : img ? <img src={img} alt="Scanned sticker" /> : <div className="muted" style={{ display: 'grid', justifyItems: 'center', gap: 6 }}><ScanLine width={36} height={36} aria-hidden />Sticker preview</div>}</div>
          <div className="row">
            {canCam && <button className="btn primary sm" onClick={startCam}><Camera aria-hidden />Use camera</button>}
            <label className={`btn sm ${canCam ? '' : 'primary'}`}><ImageUp aria-hidden />Upload photo<input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && upload(e.target.files[0])} /></label>
          </div>
          <form className="row" onSubmit={lookup} style={{ flexWrap: 'nowrap' }}><input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="FDR or reference number" aria-label="FDR or reference number" /><button className="btn sm" type="submit">Look up</button></form>
          <div className="row" style={{ fontSize: '.857rem' }}><span className="muted">No sticker at hand?</span><button className="btn sm" onClick={() => demo(false)}>Genuine sticker</button><button className="btn sm" onClick={() => demo(true)}>Forged sticker</button></div>
        </div>
        <div>{result()}</div>
      </div>
    </Modal>
  );
}
