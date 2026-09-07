import { clsx } from "@/lib/clsx";

const BASE =
  "inline-flex items-center justify-center gap-2.5 rounded-full font-semibold transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-from/70 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-bg-base disabled:cursor-not-allowed";

const VARIANTS = {
  primary:
    "bg-accent-gradient text-bg-base shadow-[0_10px_36px_-12px_rgba(16,224,160,0.75)] " +
    "hover:brightness-110 hover:shadow-[0_14px_44px_-12px_rgba(16,224,160,0.9)] " +
    "active:scale-[0.98] disabled:opacity-55 disabled:shadow-none disabled:hover:brightness-100",
  ghost:
    "border border-white/10 bg-white/[0.03] text-text-primary hover:border-accent-from/40 " +
    "hover:bg-white/[0.06] active:scale-[0.98] disabled:opacity-50",
};

const SIZES = {
  md: "px-6 py-2.5 text-sm",
  lg: "px-9 py-4 text-base tracking-wide",
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}) {
  return (
    <button
      className={clsx(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
