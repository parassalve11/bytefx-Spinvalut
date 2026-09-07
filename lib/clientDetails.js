/** Real account references, with no fabricated fallback client identifier. */
export function normalizeAccounts(value) {
  if (value === null || value === undefined) return [];
  const values = Array.isArray(value) ? value : String(value).split(/[,;|\s]+/);
  return [...new Set(values.map(v => String(v).trim()).filter(Boolean))];
}

/** Only explicit API states become active/inactive. Missing is never inactive. */
export function normalizeClientStatus(value) {
  if (value === true || value === 1 || value === '1') return 'active';
  if (value === false || value === 0 || value === '0') return 'inactive';
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (status === 'active' || status === 'inactive') return status;
  return null;
}

let regionNames;
export function countryDetails(value) {
  if (!value || typeof value !== 'string') return null;
  const country = value.trim();
  regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
  let code = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null;
  if (!code) {
    // Resolve names from the runtime's country data instead of guessing from a phone number.
    for (let a = 65; a <= 90 && !code; a++) {
      for (let b = 65; b <= 90; b++) {
        const candidate = String.fromCharCode(a, b);
        const name = regionNames.of(candidate);
        if (name !== candidate && name.toLowerCase() === country.toLowerCase()) { code = candidate; break; }
      }
    }
  }
  const name = code ? regionNames.of(code) : country;
  if (code && name === code) code = null;
  return { name, code, flag: code ? [...code].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('') : null };
}
