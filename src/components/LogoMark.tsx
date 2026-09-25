export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path
        d="M32,4 L56.25,18 L56.25,46 L32,60 L7.75,46 L7.75,18 Z"
        fill="#e31337"
        stroke="#e31337"
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <circle cx={24} cy={30} r={3.4} fill="#fff" />
      <circle cx={40} cy={30} r={3.4} fill="#fff" />
      <path d="M22,38 Q32,47 42,38" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
    </svg>
  )
}
