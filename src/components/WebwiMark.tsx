import { useId } from 'react';

export function WebwiMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  const raw = useId().replace(/:/g, '');
  const gid = `webwi-${raw}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`rounded-xl shrink-0 ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gid})`} />
      <path
        d="M7 22.2 11.2 9.8 16 19.4 20.8 9.8 25 22.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WebwiWordmark({
  subtitle,
  markSize = 44,
  titleClassName = 'text-xl font-bold tracking-tight text-neutral-900 leading-none',
}: {
  subtitle?: string;
  markSize?: number;
  titleClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <WebwiMark size={markSize} />
      <div>
        <p className={titleClassName}>
          Webw<span className="text-accent-500">i</span>
        </p>
        {subtitle ? <p className="text-xs text-neutral-400 mt-1">{subtitle}</p> : null}
      </div>
    </div>
  );
}
