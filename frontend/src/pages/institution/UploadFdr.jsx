import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFdr } from '../../api/client';
import { useAuth } from '../../auth';

const BANKS = ['State Bank of India', 'Bank of Baroda', 'Canara Bank', 'Punjab National Bank', 'Union Bank of India', 'Indian Overseas Bank', 'Bank of India', 'Indian Bank'];

const EMPTY = { fdrNumber: '', bankName: '', branch: '', ifsc: '', amount: '', issueDate: '', maturityDate: '' };

function validate(v) {
  const e = {};
  if (!v.fdrNumber.trim()) e.fdrNumber = 'Required';
  if (!v.bankName) e.bankName = 'Choose a bank';
  if (v.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.ifsc)) e.ifsc = 'IFSC looks like SBIN0001234';
  if (!(Number(v.amount) > 0)) e.amount = 'Enter an amount in rupees';
  if (!v.issueDate) e.issueDate = 'Required';
  if (!v.maturityDate) e.maturityDate = 'Required';
  if (v.issueDate && v.maturityDate && v.maturityDate <= v.issueDate) e.maturityDate = 'Must be after the issue date';
  return e;
}

export default function UploadFdr() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setValues({ ...values, [k]: k === 'ifsc' ? e.target.value.toUpperCase() : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(values);
    if (!file) errs.file = 'Upload the scanned FDR (PDF or image)';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    await createFdr({ ...values, amount: Number(values.amount), institution: { id: user.institutionId, name: user.name, state: 'Maharashtra' } });
    navigate('/institution/fdrs');
  };

  const input = (k, label, props = {}) => (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input value={values[k]} onChange={set(k)} className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${errors[k] ? 'border-red-400' : 'border-gray-300'}`} {...props} />
      {errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Upload FDR</h1>
        <p className="text-sm text-gray-500">The details you enter are checked against the uploaded document and the bank's records.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2">
          {input('fdrNumber', 'FDR number', { placeholder: 'SBI/FD/0098123' })}
          <div>
            <label className="block text-sm font-medium text-gray-700">Bank</label>
            <select value={values.bankName} onChange={set('bankName')} className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm ${errors.bankName ? 'border-red-400' : 'border-gray-300'}`}>
              <option value="">Select bank</option>
              {BANKS.map((b) => <option key={b}>{b}</option>)}
            </select>
            {errors.bankName && <p className="mt-1 text-xs text-red-600">{errors.bankName}</p>}
          </div>
          {input('branch', 'Branch', { placeholder: 'Andheri East' })}
          {input('ifsc', 'IFSC', { placeholder: 'SBIN0001234', maxLength: 11 })}
          {input('amount', 'Amount (₹)', { type: 'number', min: 1, placeholder: '10000000' })}
          <div className="hidden sm:block" />
          {input('issueDate', 'Issue date', { type: 'date' })}
          {input('maturityDate', 'Maturity date', { type: 'date' })}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <label className="block text-sm font-medium text-gray-700">Scanned FDR</label>
          <label className={`mt-2 flex h-40 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed text-sm ${errors.file ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
            <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files[0] || null)} />
            {file ? (
              <>
                <span className="font-medium text-gray-900">{file.name}</span>
                <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB · click to change</span>
              </>
            ) : (
              <>
                <span className="font-medium text-navy-600">Click to upload</span>
                <span className="text-xs text-gray-500">PDF, JPG or PNG</span>
              </>
            )}
          </label>
          {errors.file && <p className="mt-1 text-xs text-red-600">{errors.file}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm">Cancel</button>
        <button disabled={saving} className="rounded-md bg-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
          {saving ? 'Submitting…' : 'Submit for verification'}
        </button>
      </div>
    </form>
  );
}
