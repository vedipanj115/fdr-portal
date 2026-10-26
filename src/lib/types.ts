export type Role = 'officer' | 'institution' | 'bank';
export type Region = 'Northern' | 'North-West' | 'Western' | 'Central' | 'Eastern' | 'South-Central' | 'Southern' | 'South-West';

export interface Institution {
  id: string; aicteId: string; name: string; type: string; city: string; state: string; region: Region;
  established: number; status: 'Active' | 'Closed' | 'Merged'; intake: number; leased: boolean;
  requiredLakh: number; openComplaints: number; email: string; phone: string;
}

export interface Doc {
  id: string; name: string; kind: 'FDR' | 'Affidavit' | 'Payment receipt' | 'Release request letter' | 'NOC' | 'Bank confirmation';
  uploadedOn: string; by: string; sha256: string; sizeKb: number; generated?: boolean; mime?: string;
}

export interface Note { id: string; on: string; by: string; role: Role; kind: 'Observation' | 'Discrepancy notice' | 'Institution reply' | 'Bank remark'; text: string; }

export interface Confirmation { amountLakh: number; maturity: string; lien: boolean; on: string; by: string; via: string; }

export type Verification = 'Not requested' | 'Awaiting bank' | 'Awaiting checker' | 'Verified' | 'Mismatch' | 'Not found';

export interface ReleaseReq {
  reason: '10-year term completed' | 'Institution closed' | 'Merger' | 'Replaced by online deposit';
  requestedOn: string; status: 'Requested' | 'Approved' | 'Lien released' | 'Rejected';
  approvedOn?: string; approvedBy?: string; nocHash?: string; lienReleasedOn?: string; letter: boolean;
}

export interface Deposit {
  id: string; instId: string; kind: 'FDR' | 'Online';
  number: string; bankCode: string; bankName: string; ifsc: string; branch: string;
  claimed: { amountLakh: number; issue: string; maturity: string };
  confirmed?: Confirmation; maker?: Confirmation;
  verification: Verification; requestedOn?: string;
  submittedOn: string; replaces?: string; replacedBy?: string;
  release?: ReleaseReq;
  custody?: { state: 'In locker' | 'Checked out' | 'In transit to RO'; locker: string; since: string; reason?: string };
  affidavit: boolean; docs: Doc[]; notes: Note[];
  hashStored: string; hashCurrent: string;
  cbs?: { amountLakh: number; maturity: string; lien: boolean };
}

export interface User {
  id: string; role: Role; loginId: string; password: string; name: string; designation: string;
  email: string; mobile: string; instId?: string; bankCode?: string; bankRole?: 'maker' | 'checker'; region?: Region | 'HQ';
}

export interface AuditEntry { seq: number; at: string; actor: string; role: Role | 'system'; action: string; ref: string; prev: string; hash: string; }
export interface Notice { id: string; at: string; to: Role | 'all'; instId?: string; bankCode?: string; title: string; body: string; ref?: string; tone: 'info' | 'good' | 'warn' | 'bad'; }
export interface VaultMove { at: string; depId: string; locker: string; action: 'Checked in' | 'Checked out' | 'Received from institution'; by: string; reason: string; }

export interface Config { reminders: number[]; escalateAfter: number; bankSla: number; bankEscalate: number; seasonLead: number; }

export interface AppState {
  version: number; baseDate: string; offset: number;
  institutions: Institution[]; deposits: Deposit[]; users: User[];
  audit: AuditEntry[]; notices: Notice[]; vault: VaultMove[]; config: Config;
  esign: { at: string; depId: string; number: string; by: string; result: string; hash: string; bankCode: string }[];
  scrutinyClosed: string[];
  outbox?: OutMsg[]; lastScan?: string; summary?: PublicSummary;
}
export interface OutMsg { id: string; at: string; channel: 'Email' | 'SMS'; to: string; subject: string; body: string; ref?: string; status: string; key?: string }
export interface PublicSummary { open: number; held: number; verified: number; total: number; totalVerified: number; life: Record<string, number> }
