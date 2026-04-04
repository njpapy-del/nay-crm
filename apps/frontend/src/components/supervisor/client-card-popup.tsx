'use client';

import { X, Phone, Mail, Building2, Clock, FileText, Receipt } from 'lucide-react';
import { clsx } from 'clsx';

interface ClientCard {
  id: string;
  callerNumber: string;
  direction: string;
  status: string;
  startedAt: string;
  client?: {
    id: string; firstName: string; lastName: string; company?: string;
    email?: string; phone: string; status: string; notes?: string;
    quotes:   { id: string; number: string; total: number; status: string }[];
    invoices: { id: string; number: string; total: number; status: string }[];
  } | null;
  lead?: {
    id: string; firstName: string; lastName: string; company?: string;
    email?: string; phone?: string; status: string; notes?: string;
    campaign: { id: string; name: string };
  } | null;
}

interface Props {
  card: ClientCard;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  PROSPECT: 'bg-blue-100 text-blue-700',
  ACTIVE:   'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  DNC:      'bg-red-100 text-red-700',
  NEW:       'bg-gray-100 text-gray-600',
  CONTACTED: 'bg-blue-100 text-blue-700',
  QUALIFIED: 'bg-yellow-100 text-yellow-700',
  CONVERTED: 'bg-green-100 text-green-700',
  LOST:      'bg-red-100 text-red-600',
};

function ElapsedTimer({ since }: { since: string }) {
  const s = Math.floor((Date.now() - new Date(since).getTime()) / 1000);
  const m = Math.floor(s / 60);
  return <span className="font-mono">{String(m).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</span>;
}

export function ClientCardPopup({ card, onClose }: Props) {
  const entity = card.client ?? card.lead;
  if (!entity) return null;

  const name    = `${entity.firstName} ${entity.lastName}`;
  const company = entity.company;
  const status  = entity.status;
  const isLead  = !card.client && !!card.lead;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase opacity-80 mb-0.5">
              {card.direction === 'INBOUND' ? '📞 Appel entrant' : '📤 Appel sortant'}
            </p>
            <h3 className="font-bold text-lg leading-tight">{name}</h3>
            {company && <p className="text-white/80 text-xs mt-0.5">{company}</p>}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white ml-2">
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-white/80">
          <span className="flex items-center gap-1"><Clock size={11} /> <ElapsedTimer since={card.startedAt} /></span>
          <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[status] ?? 'bg-white/20 text-white')}>
            {isLead ? 'Lead' : 'Client'} — {status}
          </span>
        </div>
      </div>

      {/* Infos de contact */}
      <div className="p-4 space-y-2 border-b border-gray-100">
        {entity.phone && (
          <a href={`tel:${entity.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600">
            <Phone size={14} className="text-gray-400" /> {entity.phone}
          </a>
        )}
        {entity.email && (
          <a href={`mailto:${entity.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600 truncate">
            <Mail size={14} className="text-gray-400" /> {entity.email}
          </a>
        )}
        {company && (
          <p className="flex items-center gap-2 text-sm text-gray-700">
            <Building2 size={14} className="text-gray-400" /> {company}
          </p>
        )}
        {isLead && card.lead?.campaign && (
          <p className="text-xs text-primary-600 font-medium">📣 {card.lead.campaign.name}</p>
        )}
      </div>

      {/* Notes */}
      {entity.notes && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
          <p className="text-xs text-gray-700 line-clamp-3">{entity.notes}</p>
        </div>
      )}

      {/* Historique (client uniquement) */}
      {!isLead && card.client && (
        <div className="p-4 space-y-3">
          {card.client.quotes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                <FileText size={11} /> Devis récents
              </p>
              {card.client.quotes.map((q) => (
                <div key={q.id} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gray-600">{q.number}</span>
                  <span className="text-xs font-medium text-gray-900">{q.total.toFixed(0)} €</span>
                </div>
              ))}
            </div>
          )}
          {card.client.invoices.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                <Receipt size={11} /> Factures récentes
              </p>
              {card.client.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gray-600">{inv.number}</span>
                  <span className="text-xs font-medium text-gray-900">{inv.total.toFixed(0)} €</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
