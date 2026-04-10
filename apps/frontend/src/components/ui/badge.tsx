import { clsx } from 'clsx';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const VARIANTS: Record<Variant, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-600',
};

const STATUS_VARIANT: Record<string, Variant> = {
  PROSPECT: 'info',
  ACTIVE:   'success',
  INACTIVE: 'neutral',
  DNC:      'danger',
};

export function Badge({ label, variant }: { label: string; variant?: Variant }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', VARIANTS[variant ?? 'neutral'])}>
      {label}
    </span>
  );
}

export function ClientStatusBadge({ status }: { status: string }) {
  const LABELS: Record<string, string> = {
    PROSPECT: 'Prospect',
    ACTIVE:   'Actif',
    INACTIVE: 'Inactif',
    DNC:      'DNC',
  };
  return <Badge label={LABELS[status] ?? status} variant={STATUS_VARIANT[status]} />;
}

const QUAL_STYLES: Record<string, string> = {
  RDV:     'bg-blue-100 text-blue-700 border border-blue-300',
  FACTURE: 'bg-orange-100 text-orange-700 border border-orange-300',
  VENDU:   'bg-green-100 text-green-700 border border-green-300',
};
const QUAL_LABELS: Record<string, string> = {
  RDV:     'RDV',
  FACTURE: 'Facturé',
  VENDU:   'Vendu',
};

export function ClientQualificationBadge({ qualification }: { qualification?: string | null }) {
  if (!qualification) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">—</span>;
  }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', QUAL_STYLES[qualification] ?? 'bg-gray-100 text-gray-600')}>
      {QUAL_LABELS[qualification] ?? qualification}
    </span>
  );
}
