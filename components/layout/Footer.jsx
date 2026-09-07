/** Closing note. The fairness claim is deliberately scoped to what we do today. */
export default function Footer() {
  return (
    <footer className="flex flex-col items-center gap-3 border-t border-white/[0.06] pt-8 text-center">
      <p className="max-w-lg text-xs leading-relaxed text-text-muted">
        Every winner is drawn on the server from a frozen snapshot of your own
        clients, using a CSPRNG with rejection sampling so each entry has an
        identical chance. The result is recorded before the reel moves — the
        animation only replays a decision already made.
      </p>

      <nav className="flex items-center gap-5 text-xs text-text-muted">
        <span className="font-semibold text-text-primary/70">SpinVault</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span>Fairness</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span>Terms</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span>Support</span>
      </nav>

      <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted/60">
        ByteFX Partner Draw
      </p>
    </footer>
  );
}
