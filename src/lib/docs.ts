import { useEffect, useState } from 'react';
import type { Deposit, Doc } from './types';
import { useApp } from './store';

/** Loads a document's bytes: from the server (access-checked, decrypted) or, offline, from memory / generated from the record. */
export function useDocFile(doc?: Doc | null, d?: Deposit | null) {
  const { fetchDoc } = useApp();
  const [f, setF] = useState<{ bytes: Uint8Array; mime: string } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let on = true; setF(null); setErr('');
    if (doc && d) fetchDoc(doc, d).then(x => { if (on) setF(x); }).catch(e => { if (on) setErr((e as Error).message); });
    return () => { on = false; };
  }, [doc?.id, d?.id, fetchDoc]); // eslint-disable-line react-hooks/exhaustive-deps
  return { file: f, err };
}
