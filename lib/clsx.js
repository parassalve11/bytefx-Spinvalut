/** Minimal class-name joiner — avoids pulling in a dependency for this. */
export function clsx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default clsx;
