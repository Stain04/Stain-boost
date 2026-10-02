// Rank emblem images: the current in-game League emblems (taken from the League client via
// CommunityDragon, Oct 2026; owner-approved), trimmed and compressed into public/img/ranks/.
export const RANK_IMAGES = {
  Iron: 'iron', Bronze: 'bronze', Silver: 'silver', Gold: 'gold', Platinum: 'platinum', Emerald: 'emerald',
  Diamond: 'diamond', Master: 'master', Masters: 'master', Grandmaster: 'grandmaster', Challenger: 'challenger',
};

/** Win-boost price rows map to a visual tier. */
export function tierOfWinRank(name) {
  return name.startsWith('Diamond') ? 'Diamond' : name;
}
