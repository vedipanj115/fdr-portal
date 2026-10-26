import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useApp } from '../lib/store';
import { Logo } from './ui';

export function GovStrip({ wide }: { wide?: boolean }) {
  const [fs, setFs] = useState(() => { try { return +(localStorage.getItem('sdfp-fs') || 14.5); } catch { return 14.5; } });
  useEffect(() => { document.documentElement.style.setProperty('--fs', fs + 'px'); try { localStorage.setItem('sdfp-fs', String(fs)); } catch { /* */ } }, [fs]);
  return (
    <div className="gstrip"><div className="in" style={wide ? { maxWidth: 'none', paddingInline: 28 } : undefined}>
      <span><b>Prototype</b> built for the AICTE Regulation Bureau · Smart India Hackathon 2026 · PS SIH26265 · Not an official AICTE website</span>
      <span className="fs" role="group" aria-label="Text size"><button onClick={() => setFs(13.5)} aria-label="Smaller text">A-</button><button onClick={() => setFs(14.5)} aria-label="Default text size">A</button><button onClick={() => setFs(16)} aria-label="Larger text">A+</button></span>
    </div></div>
  );
}

export function Brand({ onClick, light }: { onClick?: () => void; light?: boolean }) {
  return (
    <button className="brand" onClick={onClick} aria-label="SDFP home">
      <Logo light={light} />
      <div><div className="t1">सुरक्षा जमा एवं एफडीआर पोर्टल</div><div className="t2">AICTE <span>SDFP</span></div><div className="t3">Streamlined Deposit &amp; FDR Portal</div></div>
    </button>
  );
}

export function GovChrome({ right }: { right?: ReactNode }) {
  const { nav } = useApp();
  return (
    <>
      <a className="skip" href="#main">Skip to main content</a>
      <GovStrip />
      <div className="tricolor" />
      <header className="ghead"><div className="in">
        <Brand onClick={() => nav('home')} />
        <div className="grow" />
        {right}
      </div></header>
    </>
  );
}

export function GovFooter({ compact }: { compact?: boolean }) {
  return (
    <footer className={`gfoot ${compact ? 'compact' : ''}`}>
      <div className="in cols">
        <div><h4>AICTE SDFP</h4><p>A single, verified record of every security deposit and Fixed Deposit Receipt held by the AICTE Regulation Bureau, from submission to release.</p></div>
        <div><h4>Portals</h4><ul><li>Institution portal</li><li>AICTE officer portal</li><li>Bank confirmation desk</li><li>Check a college's deposit</li></ul></div>
        <div><h4>Help</h4><ul><li>Helpdesk: sdfp-help@example.in</li><li>Mon–Fri, 9:30 to 6:00</li><li>User guide (PDF)</li></ul></div>
        <div><h4>About</h4><ul><li>SIH 2026 · PS SIH26265</li><li>Theme: Smart Automation</li><li>Category: Software</li></ul></div>
      </div>
      <div className="bot"><div className="in">
        <span><b>Prototype</b> for Smart India Hackathon 2026. Not affiliated with or endorsed by AICTE.</span>
        <span>All institutions, deposits, officers and bank records are fictional demo data.</span>
      </div></div>
    </footer>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return <div className="toasts" aria-live="polite">{toasts.map(t => <div key={t.id} className={`toast ${t.tone}`}>{t.tone === 'bad' ? <XCircle aria-hidden /> : t.tone === 'info' ? <Info aria-hidden /> : <CheckCircle2 aria-hidden />}<span>{t.text}</span></div>)}</div>;
}
