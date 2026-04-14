// ── /api/prices — server-side price tables (single source of truth) ──
// Prices are defined HERE only. The frontend fetches them; it never defines them.

const WIN_PRICES = {
  'Iron':           { solo: 1.50,  duo: 2.50  },
  'Bronze':         { solo: 2.00,  duo: 3.00  },
  'Silver':         { solo: 2.50,  duo: 3.50  },
  'Gold':           { solo: 3.50,  duo: 5.00  },
  'Platinum':       { solo: 5.00,  duo: 6.50  },
  'Emerald':        { solo: 5.50,  duo: 8.00  },
  'Diamond IV-III': { solo: 8.00,  duo: 12.00 },
  'Diamond II-I':   { solo:10.00,  duo: 16.00 },
  'Masters':        { solo:15.00,  duo: 20.00 },
};

const RB_DIV_PRICE = {
  Iron:     { solo: 7.00,  duo: 11.50 },
  Bronze:   { solo: 9.00,  duo: 14.00 },
  Silver:   { solo: 12.00, duo: 17.00 },
  Gold:     { solo: 16.50, duo: 23.50 },
  Platinum: { solo: 23.50, duo: 31.00 },
  Emerald:  { solo: 26.50, duo: 38.00 },
  DiamondL: { solo: 37.00, duo: 57.00 },
  DiamondH: { solo: 47.00, duo: 72.00 },
};

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res.status(200).json({ winPrices: WIN_PRICES, rbDivPrice: RB_DIV_PRICE });
}
