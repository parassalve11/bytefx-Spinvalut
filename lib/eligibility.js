export const DEFAULT_CRITERIA = {
  minNetDeposit: 0,
  minLots: 0,
  fundedOnly: false,
  hideSensitive: false,
};

export function applyCriteria(list, criteria) {
  return list.filter((p) => {
    if (criteria.minNetDeposit > 0 && (p.netDeposit === null || p.netDeposit < criteria.minNetDeposit)) return false;
    if (criteria.minLots > 0 && (p.lots === null || p.lots < criteria.minLots)) return false;
    if (criteria.fundedOnly && p.isFunded !== true) return false;
    return true;
  });
}

export function parseCriteria(input = {}) {
  const result = { ...DEFAULT_CRITERIA };
  for (const [key, max] of [['minNetDeposit', 5000], ['minLots', 50]]) {
    const value = input[key] ?? 0;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw new Error('Invalid eligibility threshold.');
    result[key] = value;
  }
  for (const key of ['fundedOnly', 'hideSensitive']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error('Invalid draw filter.');
    result[key] = input[key] ?? DEFAULT_CRITERIA[key];
  }
  return result;
}
