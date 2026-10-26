import { jsPDF } from 'jspdf';
import type { Deposit, Doc, Institution } from './types';
import { fmtDMY, fmtDate } from './util';

export interface FdrFields { bank: string; branch: string; ifsc: string; number: string; depositor: string; amountLakh: number; issue: string; maturity: string; }
export function specimenFdrPdf(f: FdrFields): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFillColor(246, 248, 250); doc.rect(36, 36, 523, 470, 'F');
  doc.setDrawColor(40, 70, 110); doc.setLineWidth(1.2); doc.rect(36, 36, 523, 470);
  doc.setTextColor(230, 234, 238); doc.setFont('helvetica', 'bold'); doc.setFontSize(56); doc.text('SPECIMEN', 310, 470, { angle: 28, align: 'center' });
  doc.setTextColor(20, 40, 70); doc.setFontSize(18); doc.text(f.bank, 60, 76);
  doc.setFontSize(13); doc.text('FIXED DEPOSIT RECEIPT', 60, 98);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 100, 115);
  doc.text('Specimen generated for the SDFP prototype. Not a bank document.', 60, 114);
  const rows: [string, string][] = [['FDR Number', f.number], ['Branch', f.branch], ['IFSC Code', f.ifsc], ['Depositor', f.depositor],
    ['In favour of', 'Member Secretary, AICTE (lien marked)'], ['Amount', 'Rs. ' + Math.round(f.amountLakh * 1e5).toLocaleString('en-IN')],
    ['Date of Issue', fmtDMY(f.issue)], ['Date of Maturity', fmtDMY(f.maturity)], ['Rate of Interest', '7.10% p.a.']];
  doc.setFontSize(12); doc.setTextColor(20, 30, 45);
  rows.forEach((r, k) => { doc.setFont('helvetica', 'bold'); doc.text(r[0] + ':', 60, 150 + k * 28); doc.setFont('helvetica', 'normal'); doc.text(r[1], 205, 150 + k * 28); });
  doc.setFontSize(9); doc.setTextColor(90, 100, 115);
  doc.text('Not transferable. Premature withdrawal only with a No Objection Certificate from AICTE.', 60, 430);
  doc.text('Authorised signatory (specimen)', 60, 480);
  return new Uint8Array(doc.output('arraybuffer'));
}

function simpleDoc(title: string, lines: string[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setDrawColor(40, 70, 110); doc.rect(36, 36, 523, 420);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20, 40, 70); doc.text(title, 60, 76);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(30, 40, 55);
  let y = 110; lines.forEach(l => { const parts = doc.splitTextToSize(l, 470); doc.text(parts, 60, y); y += parts.length * 15 + 6; });
  doc.setFontSize(8.5); doc.setTextColor(120, 128, 140); doc.text('Specimen generated for the SDFP prototype.', 60, 440);
  return new Uint8Array(doc.output('arraybuffer'));
}
export function generatedDoc(doc: Doc, d: Deposit, inst: Institution): Uint8Array {
  if (doc.kind === 'FDR') return specimenFdrPdf({ bank: d.bankName, branch: d.branch, ifsc: d.ifsc, number: d.number, depositor: inst.name + ' (Trust / Society)', amountLakh: d.claimed.amountLakh, issue: d.claimed.issue, maturity: d.claimed.maturity });
  if (doc.kind === 'Payment receipt') return simpleDoc('Payment receipt: AICTE security deposit', [`Reference: ${d.number}`, `Institution: ${inst.name}, ${inst.city}`, `Amount: Rs. ${Math.round(d.claimed.amountLakh * 1e5).toLocaleString('en-IN')}`, `Paid on: ${fmtDate(d.claimed.issue)}`, 'Mode: Net banking through the payment gateway']);
  if (doc.kind === 'Affidavit') return simpleDoc('Affidavit (Format 2): Security deposit', [`I, the authorised signatory of the Trust / Society running ${inst.name}, ${inst.city}, state that the security deposit described as ${d.number} has been created in favour of the Member Secretary, AICTE and shall not be withdrawn or pledged without the Council's No Objection Certificate.`, 'Sworn before the Notary Public (specimen).']);
  if (doc.kind === 'Release request letter') return simpleDoc('Request for release of security deposit', ['To the Member Secretary, AICTE', `${inst.name} requests release of the security deposit ${d.number} (${d.bankName}).`, `Reason: ${d.release?.reason || '—'}`, 'Enclosures: copy of FDR, affidavit, NOC from affiliating body (specimen).']);
  return simpleDoc(doc.name, [`Document for ${d.number}`, inst.name]);
}

// ---------- documents the portal produces ----------
function frame(doc: jsPDF, title: string, sub: string) {
  doc.setFillColor(18, 45, 84); doc.rect(0, 0, 595, 64, 'F');
  doc.setFillColor(232, 130, 30); doc.rect(0, 64, 198, 3, 'F'); doc.setFillColor(255, 255, 255); doc.rect(198, 64, 199, 3, 'F'); doc.setFillColor(19, 136, 54); doc.rect(397, 64, 198, 3, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Streamlined Deposit & FDR Portal (SDFP)', 36, 30);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Prototype for the AICTE Regulation Bureau, SIH 2026 (PS SIH26265). Not an official AICTE document.', 36, 46);
  doc.setTextColor(18, 30, 50); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(title, 36, 100);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(90, 100, 115); doc.text(sub, 36, 116);
}
function footer(doc: jsPDF, hash: string) {
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFontSize(7.5); doc.setTextColor(120, 128, 140); doc.text(`Audit hash ${hash.slice(0, 32)}…   Page ${p} of ${n}`, 36, 820); }
}
export function table(doc: jsPDF, y: number, head: string[], rows: string[][], widths: number[]) {
  const x0 = 36; const rowH = 17;
  const drawHead = () => { doc.setFillColor(234, 239, 245); doc.rect(x0, y - 11, 523, rowH, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(40, 55, 80); let x = x0 + 4; head.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; }); y += rowH; };
  drawHead(); doc.setFont('helvetica', 'normal'); doc.setTextColor(25, 35, 50);
  rows.forEach((r, k) => {
    if (y > 790) { doc.addPage(); y = 50; drawHead(); doc.setFont('helvetica', 'normal'); doc.setTextColor(25, 35, 50); }
    if (k % 2) { doc.setFillColor(248, 250, 252); doc.rect(x0, y - 11, 523, rowH, 'F'); }
    let x = x0 + 4; r.map(c => String(c).replace(/₹/g, 'Rs. ')).forEach((c, i) => { const max = widths[i] - 8; let s = c; while (s.length > 3 && doc.getTextWidth(s) > max) s = s.slice(0, -2); if (s !== c) s = s.slice(0, -1) + '…'; doc.setFontSize(8); doc.text(s, x, y); x += widths[i]; });
    y += rowH;
  });
  return y;
}
export function makeReport(title: string, sub: string, sections: { heading: string; head: string[]; rows: string[][]; widths: number[]; summary?: string }[], hash: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' }); frame(doc, title, sub);
  let y = 146;
  sections.forEach(sec => {
    if (y > 720) { doc.addPage(); y = 50; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(18, 45, 84); doc.text(sec.heading, 36, y); y += 14;
    if (sec.summary) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 90, 105); doc.text(sec.summary, 36, y); y += 16; }
    y = sec.rows.length ? table(doc, y + 4, sec.head, sec.rows, sec.widths) + 14 : (doc.setFontSize(9), doc.text('None.', 36, y + 4), y + 22);
  });
  footer(doc, hash);
  return new Uint8Array(doc.output('arraybuffer'));
}
export function nocPdf(o: { inst: string; city: string; number: string; bank: string; amount: string; issue: string; maturity: string; reason: string; checks: { ok: boolean; label: string }[]; approver: string; on: string; hash: string; ref: string }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' }); frame(doc, 'No Objection Certificate', `Release of security deposit · Ref. ${o.ref} · ${fmtDate(o.on)}`);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(25, 35, 50);
  const body = `This is to certify that the Council has no objection to the release of the lien marked in favour of the Member Secretary, AICTE on the instrument described below, held as security deposit by ${o.inst}, ${o.city}. The bank may release the lien and pay the principal to the registered account of the Trust / Society.`;
  doc.text(doc.splitTextToSize(body, 520), 36, 146);
  let y = table(doc, 222, ['Particular', 'Value'], [['Instrument', o.number], ['Issuing bank', o.bank], ['Amount', o.amount], ['Date of issue', fmtDate(o.issue)], ['Date of maturity', fmtDate(o.maturity)], ['Reason for release', o.reason]], [160, 363]);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text('Conditions verified before approval', 36, y + 14); y += 30;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  o.checks.forEach(c => { doc.text(`${c.ok ? '[x]' : '[ ]'}  ${c.label}`, 44, y); y += 16; });
  doc.text(`Approved by ${o.approver} with OTP authentication on ${fmtDate(o.on)}.`, 36, y + 18);
  doc.text('Digital signature (DSC) would be applied in production.', 36, y + 34);
  footer(doc, o.hash);
  return new Uint8Array(doc.output('arraybuffer'));
}
