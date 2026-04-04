import { clsx } from 'clsx';

type Variant = 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'purple';

const VARIANTS: Record<Variant, string> = {
  gray:   'bg-gray-100 text-gray-600',
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  purple: 'bg-purple-100 text-purple-700',
};

const QUOTE_MAP: Record<string, [string, Variant]> = {
  DRAFT:    ['Brouillon', 'gray'],
  SENT:     ['Envoyé', 'blue'],
  ACCEPTED: ['Accepté', 'green'],
  REJECTED: ['Refusé', 'red'],
  EXPIRED:  ['Expiré', 'yellow'],
};

const INVOICE_MAP: Record<string, [string, Variant]> = {
  DRAFT:     ['Brouillon', 'gray'],
  SENT:      ['Envoyée', 'blue'],
  PAID:      ['Payée', 'green'],
  OVERDUE:   ['En retard', 'red'],
  CANCELLED: ['Annulée', 'purple'],
};

const CAMPAIGN_MAP: Record<string, [string, Variant]> = {
  DRAFT:     ['Brouillon', 'gray'],
  ACTIVE:    ['Active', 'green'],
  PAUSED:    ['En pause', 'yellow'],
  COMPLETED: ['Terminée', 'blue'],
  CANCELLED: ['Annulée', 'red'],
};

const APPOINTMENT_MAP: Record<string, [string, Variant]> = {
  SCHEDULED: ['Planifié', 'blue'],
  CONFIRMED: ['Confirmé', 'green'],
  CANCELLED: ['Annulé', 'red'],
  DONE:      ['Effectué', 'gray'],
};

interface Props { status: string; type?: 'quote' | 'invoice' | 'campaign' | 'appointment'; }

export function StatusBadge({ status, type = 'quote' }: Props) {
  const maps = { quote: QUOTE_MAP, invoice: INVOICE_MAP, campaign: CAMPAIGN_MAP, appointment: APPOINTMENT_MAP };
  const map = maps[type];
  const [label, variant] = map[status] ?? [status, 'gray'];
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', VARIANTS[variant])}>
      {label}
    </span>
  );
}
