// Visual identity for each tier (original geometric emblems — not Riot artwork).
export const TIER_STYLE = {
  Iron:     { color: '#9aa3b5', shape: '24,4 42,14 42,34 24,44 6,34 6,14' },
  Bronze:   { color: '#d08a4c', shape: '24,3 40,11 44,26 34,42 14,42 4,26 8,11' },
  Silver:   { color: '#c9d4e6', shape: '24,3 43,13 38,37 24,45 10,37 5,13' },
  Gold:     { color: '#f5a623', shape: '24,2 30,12 42,10 38,22 44,32 32,34 24,46 16,34 4,32 10,22 6,10 18,12' },
  Platinum: { color: '#2dd4bf', shape: '24,2 36,13 46,24 36,35 24,46 12,35 2,24 12,13' },
  Emerald:  { color: '#34d399', shape: '24,2 41,24 24,46 7,24' },
  Diamond:  { color: '#7cc4ff', shape: '14,6 34,6 45,18 24,45 3,18' },
  Masters:  { color: '#e879f9', shape: '24,2 30,10 40,5 38,18 46,24 36,34 24,46 12,34 2,24 10,18 8,5 18,10' },
};

/** Win-boost price rows map to a visual tier. */
export function tierOfWinRank(name) {
  return name.startsWith('Diamond') ? 'Diamond' : name;
}
