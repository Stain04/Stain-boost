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
  'Diamond II-I':   { solo: 10.00, duo: 16.00 },
  'Masters':        { solo: 15.00, duo: 20.00 },
};

const RB_DIV_PRICE = {
  Iron:     { solo: 6.00,  duo: 10.00 },
  Bronze:   { solo: 8.00,  duo: 12.00 },
  Silver:   { solo: 10.00, duo: 14.00 },
  Gold:     { solo: 14.00, duo: 20.00 },
  Platinum: { solo: 20.00, duo: 26.00 },
  Emerald:  { solo: 22.00, duo: 32.00 },
  DiamondL: { solo: 32.00, duo: 48.00 },
  DiamondH: { solo: 40.00, duo: 64.00 },
};

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res.status(200).json({ winPrices: WIN_PRICES, rbDivPrice: RB_DIV_PRICE });
}
