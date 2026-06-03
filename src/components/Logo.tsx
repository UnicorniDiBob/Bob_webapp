// Wordmark BOB: maiuscolo, peso 900, con puntino accent giallo.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline font-sans text-2xl font-black tracking-tight text-bob-indigo ${className}`}
      aria-label="BOB"
    >
      BOB
      <span
        aria-hidden
        className="ml-0.5 inline-block h-2 w-2 translate-y-[1px] rounded-full bg-bob-yellow"
      />
    </span>
  );
}
