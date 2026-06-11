// One district → color mapping for the whole client (board tiles, desks,
// pills, sidebar). Known districts get hand-picked themed colors; districts
// from future boards fall back to a distinct palette assigned by their
// position in the board's sorted district list, so colors never collapse
// to a single default.

const NAMED: Record<string, number> = {
  // Alefgard
  tantegel: 0x3b82f6, // royal blue
  garinham: 0x10b981, // forest green
  kol:      0x06b6d4, // cyan
  domdora:  0xf59e0b, // amber
  cantlin:  0xef4444, // crimson
  rimuldar: 0x8b5cf6, // violet
  charlock: 0xec4899, // magenta
  bridges:  0x64748b, // steel gray
  garin_pass: 0x84cc16, // lime
  hauksness:  0xf97316, // burnt orange
  galenholm:  0xe879f9, // orchid
  // Torland
  lianport:   0x06b6d4, // cyan
  cannock:    0x10b981, // green
  hamlin:     0xf59e0b, // amber
  beran:      0xef4444, // crimson
  zahan:      0x8b5cf6, // violet
  moonbrooke: 0x3b82f6, // blue
  tuhn:       0xec4899, // magenta
  rapids:     0x14b8a6, // teal
};

const FALLBACK = [
  0x3b82f6, 0x10b981, 0xf59e0b, 0xef4444, 0x8b5cf6, 0x06b6d4,
  0xec4899, 0x84cc16, 0xf97316, 0x14b8a6, 0xe879f9, 0x64748b,
];

export function districtColor(districtId: string, allDistricts?: Record<string, unknown>): number {
  const named = NAMED[districtId];
  if (named !== undefined) return named;
  const ids = allDistricts ? Object.keys(allDistricts).sort() : [];
  const idx = Math.max(0, ids.indexOf(districtId));
  return FALLBACK[idx % FALLBACK.length];
}

export function districtColorHex(districtId: string, allDistricts?: Record<string, unknown>): string {
  return `#${districtColor(districtId, allDistricts).toString(16).padStart(6, '0')}`;
}
