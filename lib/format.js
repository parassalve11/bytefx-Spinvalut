/**
 * Display helpers.
 *
 * ByteFX does not supply every field for every client. A missing value is
 * `null` and must read as unavailable — never as zero, which would look like a
 * real figure and would quietly change how a card compares to its neighbours.
 */

export const UNAVAILABLE = "—";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMoney(value, currency = "USD") {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNAVAILABLE;
  if (currency && currency !== "USD") {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
    } catch {
      return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;
    }
  }
  return money.format(value);
}

export function formatLots(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return UNAVAILABLE;
  return value.toFixed(2);
}

/** "1 · 2 · 5" for the level badges on a card. */
export function formatLevels(levels) {
  if (!Array.isArray(levels) || !levels.length) return UNAVAILABLE;
  return levels.join(" · ");
}
