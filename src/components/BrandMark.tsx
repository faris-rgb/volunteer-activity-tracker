/** Logo mark: an eight-pointed Moroccan star (khatam) with a heart, in the flag's green and red. */
export default function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="brandmark-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect x="9" y="9" width="30" height="30" rx="4" fill="url(#brandmark-fill)" />
      <rect x="9" y="9" width="30" height="30" rx="4" fill="url(#brandmark-fill)" transform="rotate(45 24 24)" />
      <path
        d="M24 32.5s-8-4.9-8-10.3A4.4 4.4 0 0 1 24 19.6a4.4 4.4 0 0 1 8 2.6c0 5.4-8 10.3-8 10.3Z"
        fill="#fff7ed"
      />
      <circle cx="24" cy="24.4" r="1.6" fill="#c1272d" />
    </svg>
  );
}
