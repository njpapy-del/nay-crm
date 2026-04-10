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

        {/* Chiffre 26 en gros */}
        <text
          x="20"
          y="27"
          textAnchor="middle"
          fontFamily="'Arial Black', Arial, sans-serif"
          fontWeight="900"
          fontSize="18"
          fill="white"
          letterSpacing="-1"
        >
          26
        </text>

        {/* Trait décoratif bas */}
        <rect x="8" y="31" width="24" height="1.5" rx="0.75" fill="white" opacity="0.25" />
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
      <text
        x="20"
        y="27"
        textAnchor="middle"
        fontFamily="'Arial Black', Arial, sans-serif"
        fontWeight="900"
        fontSize="18"
        fill="white"
        letterSpacing="-1"
      >
        26
      </text>
      <rect x="8" y="31" width="24" height="1.5" rx="0.75" fill="white" opacity="0.25" />
    </svg>
  );
}
