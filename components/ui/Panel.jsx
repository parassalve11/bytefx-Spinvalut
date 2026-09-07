import { clsx } from "@/lib/clsx";

/** Glass panel: the base surface every section sits on. */
export default function Panel({ as: Tag = "section", className, children, ...rest }) {
  return (
    <Tag
      className={clsx(
        "relative rounded-2xl border border-white/5 bg-bg-panel/80 backdrop-blur-xl",
        "shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)]",
        className,
      )}
      {...rest}
    >
      {/* Hairline accent along the top edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent-from/40 to-transparent"
      />
      {children}
    </Tag>
  );
}
