import React, { useRef, useState } from 'react';
import { Database, Download, Upload, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { exportDb, importDb, resetDb, saveDbNow } from '../core/db';

/**
 * ბაზა ინახება ამ ბრაუზერში (IndexedDB).
 * ამიტომ სარეზერვო ასლის გაკეთება და აღდგენა კრიტიკულად მნიშვნელოვანია.
 */
export const DatabaseBackupPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const notify = (type: 'ok' | 'err', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 6000);
  };

  const handleExport = async () => {
    try {
      setBusy(true);
      await saveDbNow();
      const data = exportDb();
      const blob = new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playroom-backup-${new Date().toISOString().split('T')[0]}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('ok', 'სარეზერვო ასლი ჩამოიტვირთა.');
    } catch (err: any) {
      notify('err', err.message || 'ექსპორტი ვერ მოხერხდა.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('არსებული მონაცემები ჩანაცვლდება ფაილის შიგთავსით. გავაგრძელოთ?')) {
      e.target.value = '';
      return;
    }

    try {
      setBusy(true);
      const buffer = await file.arrayBuffer();
      await importDb(new Uint8Array(buffer));
      notify('ok', 'ბაზა აღდგა. გვერდი განახლდება...');
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      notify('err', err.message || 'ფაილის წაკითხვა ვერ მოხერხდა.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleReset = async () => {
    if (!window.confirm('ყველა მონაცემი წაიშლება და ბაზა თავიდან შეიქმნება. ეს შეუქცევადია. გავაგრძელოთ?')) return;
    if (!window.confirm('დაადასტურეთ კიდევ ერთხელ: ყველა სესია, ტრანზაქცია და ჩანაწერი წაიშლება.')) return;

    try {
      setBusy(true);
      await resetDb();
      localStorage.removeItem('playroom_token');
      window.location.reload();
    } catch (err: any) {
      notify('err', err.message || 'განულება ვერ მოხერხდა.');
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">მონაცემთა ბაზა & სარეზერვო ასლი</h3>
          <p className="text-[11px] text-slate-400">
            ბაზა ინახება ამ ბრაუზერში. რეგულარულად გადმოწერეთ ასლი.
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
          message.type === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {message.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          მონაცემები ამ კომპიუტერის ბრაუზერშია. ბრაუზერის მონაცემების გასუფთავება
          ან სხვა მოწყობილობაზე გახსნა ნიშნავს, რომ ჩანაწერები იქ არ იქნება —
          გადატანა ხდება სარეზერვო ფაილის საშუალებით.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>ასლის გადმოწერა</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-50 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>ასლიდან აღდგენა</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".sqlite,.db,application/octet-stream"
          onChange={handleImport}
          className="hidden"
        />

        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-semibold disabled:opacity-50 cursor-pointer ml-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>ბაზის განულება</span>
        </button>
      </div>
    </div>
  );
};
