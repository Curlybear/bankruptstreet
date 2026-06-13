// Character roster + AI personalities.
// Pure data — usable by engine (bot decisions), server (assignment), and client (picker UI).

export interface BotPersonality {
  cashReserve: number;          // keep at least this much cash before investing / buying stock
  investAmount: number;         // gold invested per own-shop visit
  stockBatch: number;           // shares per stock purchase
  buyoutCashMultiplier: number; // buy out opponents when cash >= buyoutCost × this
  preferThreeStar: boolean;     // build three-star shops on vacant plots when affordable
  sellOnDip: boolean;           // sell stock in PRE_ROLL when price dropped below purchase price
  pathPreference: 'shops' | 'bank' | 'stocks'; // branch-choice bias while suits are incomplete
}

export interface Character {
  id: string;
  name: string;
  emoji: string;
  title: string;          // short personality blurb for the lobby
  personality: BotPersonality;
}

export const DEFAULT_PERSONALITY: BotPersonality = {
  cashReserve: 175,
  investAmount: 175,
  stockBatch: 10,
  buyoutCashMultiplier: 2.5,
  preferThreeStar: true,
  sellOnDip: true,
  pathPreference: 'shops',
};

export const CHARACTERS: Record<string, Character> = {
  erdrick: {
    id: 'erdrick', name: 'Erdrick', emoji: '⚔️', title: 'Balanced Hero',
    personality: { ...DEFAULT_PERSONALITY },
  },
  dragonlord: {
    id: 'dragonlord', name: 'Dragonlord', emoji: '🐉', title: 'Property Tycoon',
    personality: {
      cashReserve: 100, investAmount: 300, stockBatch: 5,
      buyoutCashMultiplier: 1.5, preferThreeStar: true, sellOnDip: true,
      pathPreference: 'shops',
    },
  },
  gwaelin: {
    id: 'gwaelin', name: 'Princess Gwaelin', emoji: '👸', title: 'Stock Baroness',
    personality: {
      cashReserve: 300, investAmount: 50, stockBatch: 20,
      buyoutCashMultiplier: 3.0, preferThreeStar: false, sellOnDip: false,
      pathPreference: 'stocks',
    },
  },
  slime: {
    id: 'slime', name: 'Slime', emoji: '🟢', title: 'Cautious Hoarder',
    personality: {
      cashReserve: 350, investAmount: 100, stockBatch: 5,
      buyoutCashMultiplier: 4.0, preferThreeStar: false, sellOnDip: true,
      pathPreference: 'shops',
    },
  },
  torneko: {
    id: 'torneko', name: 'Torneko', emoji: '🛒', title: 'Merchant Prince',
    personality: {
      cashReserve: 150, investAmount: 200, stockBatch: 10,
      buyoutCashMultiplier: 2.0, preferThreeStar: true, sellOnDip: true,
      pathPreference: 'shops',
    },
  },
  healslime: {
    id: 'healslime', name: 'Healslime', emoji: '✨', title: 'Opportunist',
    personality: {
      cashReserve: 250, investAmount: 100, stockBatch: 15,
      buyoutCashMultiplier: 2.5, preferThreeStar: false, sellOnDip: false,
      pathPreference: 'stocks',
    },
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS);
