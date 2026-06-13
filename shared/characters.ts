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
  aldric: {
    id: 'aldric', name: 'Aldric', emoji: '⚔️', title: 'Balanced Hero',
    personality: { ...DEFAULT_PERSONALITY },
  },
  tyrant: {
    id: 'tyrant', name: 'The Tyrant', emoji: '🐉', title: 'Property Tycoon',
    personality: {
      cashReserve: 100, investAmount: 300, stockBatch: 5,
      buyoutCashMultiplier: 1.5, preferThreeStar: true, sellOnDip: true,
      pathPreference: 'shops',
    },
  },
  baroness: {
    id: 'baroness', name: 'Lady Mirelle', emoji: '👸', title: 'Stock Baroness',
    personality: {
      cashReserve: 300, investAmount: 50, stockBatch: 20,
      buyoutCashMultiplier: 3.0, preferThreeStar: false, sellOnDip: false,
      pathPreference: 'stocks',
    },
  },
  miser: {
    id: 'miser', name: 'The Miser', emoji: '🟢', title: 'Cautious Hoarder',
    personality: {
      cashReserve: 350, investAmount: 100, stockBatch: 5,
      buyoutCashMultiplier: 4.0, preferThreeStar: false, sellOnDip: true,
      pathPreference: 'shops',
    },
  },
  merrick: {
    id: 'merrick', name: 'Merrick', emoji: '🛒', title: 'Merchant Prince',
    personality: {
      cashReserve: 150, investAmount: 200, stockBatch: 10,
      buyoutCashMultiplier: 2.0, preferThreeStar: true, sellOnDip: true,
      pathPreference: 'shops',
    },
  },
  oracle: {
    id: 'oracle', name: 'The Oracle', emoji: '✨', title: 'Opportunist',
    personality: {
      cashReserve: 250, investAmount: 100, stockBatch: 15,
      buyoutCashMultiplier: 2.5, preferThreeStar: false, sellOnDip: false,
      pathPreference: 'stocks',
    },
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS);
