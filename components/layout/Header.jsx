/** Page masthead. All copy is passed in so the draw can be re-themed per event. */
export default function Header({
  eyebrow = "ByteFX SpinVault Exclusive",
  title = "Grand Draw",
  tagline = ["One Draw", "One Winner", "Provably Fair"],
}) {
  return (
    <header className="flex flex-col items-center gap-5 text-center">
      <p className="brand-wordmark text-xs font-semibold uppercase tracking-[0.32em] text-text-primary/90">{eyebrow}</p>

      <h1 className="font-display text-[42px] font-bold uppercase leading-[1.05] tracking-[-0.04em] text-text-primary sm:text-6xl">
        {title}
      </h1>

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-text-muted">
        {tagline.map((part, i) => (
          <span key={part} className="flex items-center gap-3">
            {i > 0 ? <span className="h-1 w-1 rounded-full bg-accent-from/60" /> : null}
            {part}
          </span>
        ))}
      </p>
    </header>
  );
}
