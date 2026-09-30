// Logo de Juliette : un J calligraphié, comme écrit à la craie sur l'ardoise du jour.
export default function Marque({ taille = 32, className }: { taille?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={taille}
      height={taille}
      className={`brand-mark${className ? ` ${className}` : ""}`}
      role="img"
      aria-label="Juliette"
    >
      <rect width="100" height="100" rx="24" fill="#4b36a8" />
      <path
        d="M40 27 C52 22 70 22 72 27 M62 25 C62 44 60 60 54 70 C48 80 34 80 30 70 C27 63 36 60 42 66"
        fill="none"
        stroke="#fff"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="71" cy="72" r="4" fill="#c9bdf7" />
    </svg>
  );
}
