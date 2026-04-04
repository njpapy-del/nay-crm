interface LogoProps {
  size?: number;
  showText?: boolean;
  variant?: 'full' | 'icon';
  dark?: boolean;
}

export function Logo({ size = 40, showText = true, variant = 'full', dark = false }: LogoProps) {
  return (
    <div className="flex items-center gap-3 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Fond */}
        <rect width="40" height="40" rx="10" fill="url(#logoGrad)" />
        <rect width="40" height="20" rx="10" fill="url(#glowGrad)" />

        {/* Lettre L */}
        <path d="M10 10 L10 26 L20 26 L20 23 L13 23 L13 10 Z" fill="white" opacity="0.95" />

        {/* Symbole 666 — trois cercles en triangle discrets */}
        {/* cercle haut-centre */}
        <circle cx="25" cy="26.5" r="2" fill="none" stroke="#93c5fd" strokeWidth="1.2" opacity="0.6" />
        {/* cercle bas-gauche */}
        <circle cx="22" cy="32" r="2" fill="none" stroke="#93c5fd" strokeWidth="1.2" opacity="0.6" />
        {/* cercle bas-droite */}
        <circle cx="28" cy="32" r="2" fill="none" stroke="#93c5fd" strokeWidth="1.2" opacity="0.6" />
        {/* liens entre cercles — triquetra minimaliste */}
        <line x1="25" y1="28.5" x2="22.8" y2="30.2" stroke="#93c5fd" strokeWidth="0.6" opacity="0.35" />
        <line x1="25" y1="28.5" x2="27.2" y2="30.2" stroke="#93c5fd" strokeWidth="0.6" opacity="0.35" />
        <line x1="24" y1="32" x2="26" y2="32" stroke="#93c5fd" strokeWidth="0.6" opacity="0.35" />
      </svg>

      {(showText || variant === 'full') && (
        <div className="leading-none">
          <span className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
            LNAY<span className="text-primary-500">CRM</span>
          </span>
          <div className={`text-[10px] font-mono tracking-widest mt-0.5 ${dark ? 'text-blue-300/50' : 'text-gray-300'}`}>
            ⬡⬡⬡
          </div>
        </div>
      )}
    </div>
  );
}

export function LogoSVG({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#g1)" />
      <path d="M10 10 L10 26 L20 26 L20 23 L13 23 L13 10 Z" fill="white" opacity="0.95" />
      <circle cx="25" cy="26.5" r="2" fill="none" stroke="#93c5fd" strokeWidth="1.2" opacity="0.6" />
      <circle cx="22" cy="32" r="2" fill="none" stroke="#93c5fd" strokeWidth="1.2" opacity="0.6" />
      <circle cx="28" cy="32" r="2" fill="none" stroke="#93c5fd" strokeWidth="1.2" opacity="0.6" />
      <line x1="25" y1="28.5" x2="22.8" y2="30.2" stroke="#93c5fd" strokeWidth="0.6" opacity="0.35" />
      <line x1="25" y1="28.5" x2="27.2" y2="30.2" stroke="#93c5fd" strokeWidth="0.6" opacity="0.35" />
      <line x1="24" y1="32" x2="26" y2="32" stroke="#93c5fd" strokeWidth="0.6" opacity="0.35" />
    </svg>
  );
}
