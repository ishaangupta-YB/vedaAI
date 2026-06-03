/** Decorative "no assignments" illustration from the Figma empty state. */
export function EmptyIllustration({ className }: { className?: string }): React.ReactNode {
  return (
    <svg
      viewBox="0 0 340 260"
      className={className}
      fill="none"
      role="img"
      aria-label="No assignments illustration"
    >
      <circle cx="180" cy="128" r="92" fill="#efeff1" />

      {/* squiggle accent */}
      <path
        d="M70 96c18-26 36 4 18 16-14 9-26-8-10-18"
        stroke="#1c1c1e"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* floating mini card */}
      <g>
        <rect x="226" y="70" width="64" height="34" rx="8" fill="#fff" />
        <rect x="226" y="70" width="64" height="34" rx="8" stroke="#e6e6ea" strokeWidth="1.4" />
        <circle cx="240" cy="87" r="4" fill="#cfcfd6" />
        <rect x="250" y="84" width="30" height="6" rx="3" fill="#d9d9df" />
      </g>

      {/* document */}
      <g>
        <rect x="118" y="62" width="92" height="118" rx="10" fill="#fff" />
        <rect x="118" y="62" width="92" height="118" rx="10" stroke="#e6e6ea" strokeWidth="1.4" />
        <rect x="134" y="82" width="42" height="9" rx="4.5" fill="#1c1c1e" />
        <rect x="134" y="104" width="60" height="6" rx="3" fill="#e2e2e7" />
        <rect x="134" y="118" width="60" height="6" rx="3" fill="#e2e2e7" />
        <rect x="134" y="132" width="44" height="6" rx="3" fill="#e2e2e7" />
        <rect x="134" y="146" width="52" height="6" rx="3" fill="#e2e2e7" />
      </g>

      {/* magnifier */}
      <g>
        <circle cx="196" cy="146" r="42" fill="#fff" fillOpacity="0.55" />
        <circle cx="196" cy="146" r="42" stroke="#b9b4e6" strokeWidth="7" />
        <path d="M226 178l24 24" stroke="#b9b4e6" strokeWidth="11" strokeLinecap="round" />
        <path
          d="M182 132l28 28M210 132l-28 28"
          stroke="#e5484d"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>

      {/* sparkle + dot */}
      <path
        d="M120 178c0-7 7 0 7 0s-7 0-7 7c0-7-7 0-7 0s7 0 7-7z"
        fill="#3b82f6"
      />
      <circle cx="268" cy="150" r="5" fill="#3b6fb5" />
    </svg>
  );
}
