'use client';

import { useState } from 'react';
import { Download, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface PdfViewerProps {
  endpoint: string;        // ex: /quotes/abc/pdf
  filename: string;        // ex: devis-DEV-2026-0001.pdf
  onClose: () => void;
}

export function PdfViewer({ endpoint, filename, onClose }: PdfViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Charge le PDF dès le montage
  useState(() => {
    api.get(endpoint, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        setUrl(URL.createObjectURL(blob));
      })
      .catch(() => setError('Impossible de charger le PDF'))
      .finally(() => setLoading(false));
  });

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900/80 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white shrink-0">
        <span className="text-sm font-medium">{filename}</span>
        <div className="flex items-center gap-3">
          <button onClick={handleDownload} disabled={!url}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50">
            <Download size={14} /> Télécharger
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        {loading && <Loader2 size={32} className="text-white animate-spin" />}
        {error && <p className="text-red-400">{error}</p>}
        {url && (
          <iframe
            src={url}
            className="w-full h-full"
            title={filename}
          />
        )}
      </div>
    </div>
  );
}
