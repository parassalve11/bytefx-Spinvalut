import { clsx } from "@/lib/clsx";

/** Small outlined pill used for section eyebrows. */
export default function Badge({ className, children }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border border-accent-from/30 bg-accent-from/5",
        "px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-from",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent-from shadow-[0_0_8px_rgba(16,224,160,0.9)]" />
      {children}
    </span>
  );
}
