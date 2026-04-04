'use client';

import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
  campaignId: string;
  onClose: () => void;
  onImported: () => void;
}

export function LeadImportModal({ campaignId, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) { alert('Fichier CSV requis'); return; }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(`/leads/import?campaignId=${campaignId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.created > 0) onImported();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Import CSV de leads</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <p className="text-xs text-gray-500">
          Colonnes attendues : <code className="bg-gray-100 px-1 rounded">firstName</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">lastName</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">email</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">phone</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">company</code>
        </p>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors">
          <Upload size={32} className="mx-auto text-gray-400 mb-2" />
          {file ? (
            <p className="text-sm font-medium text-primary-600">{file.name}</p>
          ) : (
            <p className="text-sm text-gray-500">Glissez un fichier CSV ou cliquez</p>
          )}
          <input ref={inputRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle size={16} /> {result.created} leads importés
            </div>
            {result.errors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-red-500 text-xs">
                <AlertCircle size={14} className="shrink-0 mt-0.5" /> {e}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Fermer</button>
          <button onClick={handleImport} disabled={!file || loading} className="btn-primary px-5">
            {loading ? 'Import...' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}
