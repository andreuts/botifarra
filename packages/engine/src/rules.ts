// Import types from the centralized types file
import type {
  Suit,
  Rank,
  Trump,
  Card,
  Player,
  BiddingAction,
  Contract,
  Trick,
  GameState
} from "./types";

// Card values for scoring
const CARD_POINTS: Record<Rank, number> = {
  "9": 5,   // Manilla
  "A": 4,   // As
  "K": 3,   // Rei  
  "C": 2,   // Cavall
  "J": 1,   // Sota
  "8": 0, "7": 0, "6": 0, "5": 0, "4": 0, "3": 0, "2": 0
};

// Card strength for trick winning
const CARD_STRENGTH: Record<Rank, number> = {
  "9": 12,  // Manilla (highest)
  "A": 11,  // As
  "K": 10,  // Rei
  "C": 9,   // Cavall
  "J": 8,   // Sota
  "8": 7, "7": 6, "6": 5, "5": 4, "4": 3, "3": 2, "2": 1
};

const SUITS: Suit[] = ["OROS", "COPES", "ESPASES", "BASTOS"];
const RANKS: Rank[] = ["9", "A", "K", "C", "J", "8", "7", "6", "5", "4", "3", "2"];

// Utility functions
export function nextSeat(seat: number): number {
  return (seat + 1) % 4;
}

export function getTeam(seat: number): "NS" | "EW" {
  return seat % 2 === 0 ? "NS" : "EW";
}

export function getPartnerSeat(seat: number): number {
  return (seat + 2) % 4;
}

// Deck operations
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  const result = [...arr];
  let rng = seed ?? Date.now();
  
  for (let i = result.length - 1; i > 0; i--) {
    rng = (rng * 9301 + 49297) % 233280;
    const j = Math.floor((rng / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

export function dealCards(deck: Card[]): Card[][] {
  const hands: Card[][] = [[], [], [], []];
  
  // Deal 12 cards to each player (48 cards total)
  for (let i = 0; i < 48; i++) {
    hands[i % 4].push(deck[i]);
  }
  
  return hands;
}

// Game initialization
export function chooseDealerByLift(seed?: number): { dealer: number; card: Card } {
  const deck = shuffle(createDeck(), seed);
  const rng = seed ?? Date.now();
  const cardIndex = Math.floor((rng % 1000) / 1000 * deck.length);
  const card = deck[cardIndex];
  const dealer = SUITS.indexOf(card.suit);
  return { dealer, card };
}

export function startNewHand(prevDealer?: number, seed?: number): GameState {
  const deck = shuffle(createDeck(), seed);
  const hands = dealCards(deck);
  const dealer = prevDealer !== undefined ? nextSeat(prevDealer) : 0;
  
  return {
    phase: "bidding",
    dealer,
    turn: nextSeat(dealer),
    deal: { hands },
    bidding: {
      doubles: 0,
      passes: []
    },
    completedTricks: [],
    scores: { NS: 0, EW: 0 }
  };
}

// Bidding logic
export function canBid(state: GameState, seat: number): boolean {
  if (state.phase !== "bidding" || state.turn !== seat) return false;
  return state.bidding?.bidder === undefined;
}

export function canPass(state: GameState, seat: number): boolean {
  if (state.phase !== "bidding" || state.turn !== seat) return false;
  return state.bidding?.bidder === undefined;
}

export function canDouble(state: GameState, seat: number, level: "CONTRAR" | "RECONTRAR" | "SANT_VICENS"): boolean {
  if (state.phase !== "bidding" || !state.bidding) return false;
  
  const bidding = state.bidding;
  if (bidding.bidder === undefined) return false;
  
  const bidderTeam = getTeam(bidding.bidder);
  const myTeam = getTeam(seat);
  
  switch (level) {
    case "CONTRAR":
      return bidding.doubles === 0 && myTeam !== bidderTeam;
    case "RECONTRAR":
      return bidding.doubles === 1 && myTeam === bidderTeam;
    case "SANT_VICENS":
      return bidding.doubles === 2 && myTeam !== bidderTeam;
    default:
      return false;
  }
}

export function applyBiddingAction(state: GameState, seat: number, action: BiddingAction): GameState {
  if (state.phase !== "bidding" || !state.bidding) return state;
  
  const newState = { ...state, bidding: { ...state.bidding } };
  
  switch (action.type) {
    case "bid":
      if (!canBid(state, seat)) return state;
      newState.bidding.bidder = seat;
      newState.bidding.trump = action.trump;
      newState.bidding.delegate = action.delegate;
      newState.turn = nextSeat(seat);
      break;
      
    case "pass":
      if (!canPass(state, seat)) return state;
      newState.bidding.passes.push(seat);
      newState.turn = nextSeat(seat);
      break;
      
    case "double":
      if (!canDouble(state, seat, action.level)) return state;
      const doubleMap = { "CONTRAR": 1, "RECONTRAR": 2, "SANT_VICENS": 3 } as const;
      newState.bidding.doubles = doubleMap[action.level];
      newState.turn = nextSeat(seat);
      break;
  }
  
  // Check if bidding is complete
  if (isBiddingComplete(newState)) {
    return startPlaying(newState);
  }
  
  return newState;
}

function isBiddingComplete(state: GameState): boolean {
  if (!state.bidding || state.bidding.bidder === undefined) return false;
  
  // Bidding ends when:
  // 1. Sant Vicenç is reached (doubles = 3)
  // 2. All other players have passed after the bid
  return state.bidding.doubles === 3 || 
         state.bidding.passes.length === 3;
}

function startPlaying(state: GameState): GameState {
  if (!state.bidding || state.bidding.bidder === undefined) return state;
  
  const contract: Contract = {
    trump: state.bidding.trump!,
    bidder: state.bidding.bidder,
    delegated: state.bidding.delegate || false,
    doubles: state.bidding.doubles
  };
  
  return {
    ...state,
    phase: "playing",
    contract,
    turn: nextSeat(nextSeat(nextSeat(state.dealer))), // Player to the right of dealer leads
    currentTrick: undefined
  };
}

// Playing logic
export function getLegalPlays(state: GameState, seat: number): Card[] {
  if (state.phase !== "playing" || state.turn !== seat) return [];
  
  const hand = state.deal.hands[seat];
  if (!hand) return [];
  
  // First card of trick - can play anything
  if (!state.currentTrick || state.currentTrick.plays.length === 0) {
    return [...hand];
  }
  
  const ledSuit = state.currentTrick.plays[0].card.suit;
  const suitCards = hand.filter(card => card.suit === ledSuit);
  
  // Must follow suit if possible
  if (suitCards.length > 0) {
    return suitCards;
  }
  
  // No suit cards - can play anything
  return [...hand];
}

export function calculateTrickWinner(trick: { plays: Array<{ seat: number; card: Card }> }, trump?: Trump): number {
  const plays = trick.plays;
  if (plays.length === 0) return -1;
  
  const ledSuit = plays[0].card.suit;
  let winner = plays[0];
  
  for (let i = 1; i < plays.length; i++) {
    const current = plays[i];
    
    // Trump beats non-trump (except in BOTIFARRA where there's no trump)
    if (trump && trump !== "BOTIFARRA") {
      const currentIsTrump = current.card.suit === trump;
      const winnerIsTrump = winner.card.suit === trump;
      
      if (currentIsTrump && !winnerIsTrump) {
        winner = current;
        continue;
      }
      if (!currentIsTrump && winnerIsTrump) {
        continue;
      }
    }
    
    // Same suit comparison or both trump
    if (current.card.suit === winner.card.suit) {
      if (CARD_STRENGTH[current.card.rank] > CARD_STRENGTH[winner.card.rank]) {
        winner = current;
      }
    } else if (current.card.suit === ledSuit && winner.card.suit !== ledSuit && (!trump || trump === "BOTIFARRA")) {
      // Following led suit beats off-suit when no trump involved
      winner = current;
    }
  }
  
  return winner.seat;
}

export function calculateTrickPoints(trick: { plays: Array<{ card: Card }> }): number {
  let points = 1; // Base point for winning the trick
  for (const play of trick.plays) {
    points += CARD_POINTS[play.card.rank];
  }
  return points;
}

export function playCard(state: GameState, seat: number, card: Card): GameState {
  if (state.phase !== "playing" || state.turn !== seat) return state;
  
  const hand = state.deal.hands[seat];
  const cardIndex = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
  if (cardIndex === -1) return state;
  
  // Remove card from hand
  const newHands = state.deal.hands.map((h, i) => 
    i === seat ? h.filter((_, idx) => idx !== cardIndex) : h
  );
  
  // Add play to current trick
  let currentTrick = state.currentTrick || { leader: seat, plays: [] };
  const newPlays = [...currentTrick.plays, { seat, card }];
  
  const newState: GameState = {
    ...state,
    deal: { hands: newHands },
    currentTrick: { ...currentTrick, plays: newPlays }
  };
  
  // Check if trick is complete
  if (newPlays.length === 4) {
    const winner = calculateTrickWinner({ plays: newPlays }, state.contract?.trump);
    const points = calculateTrickPoints({ plays: newPlays });
    
    const completedTrick: Trick = {
      leader: currentTrick.leader,
      plays: newPlays,
      winner,
      points
    };
    
    newState.completedTricks = [...state.completedTricks, completedTrick];
    newState.currentTrick = undefined;
    newState.turn = winner;
    
    // Check if hand is complete (8 tricks played)
    if (newState.completedTricks.length === 8) {
      return finishRound(newState);
    }
  } else {
    newState.turn = nextSeat(seat);
  }
  
  return newState;
}

// Scoring
function finishRound(state: GameState): GameState {
  const roundPoints = { NS: 0, EW: 0 };
  
  // Calculate points from tricks
  for (const trick of state.completedTricks) {
    const team = getTeam(trick.winner);
    roundPoints[team] += trick.points;
  }
  
  // Apply contract and doubles
  let nsScore = roundPoints.NS;
  let ewScore = roundPoints.EW;
  
  if (state.contract) {
    let multiplier = 1;
    
    // Botifarra doubles the score
    if (state.contract.trump === "BOTIFARRA") {
      multiplier *= 2;
    }
    
    // Apply doubles
    multiplier *= Math.pow(2, state.contract.doubles);
    
    nsScore *= multiplier;
    ewScore *= multiplier;
  }
  
  const newScores = {
    NS: state.scores.NS + nsScore,
    EW: state.scores.EW + ewScore
  };
  
  return {
    ...state,
    phase: newScores.NS >= 101 || newScores.EW >= 101 ? "finished" : "round_finished",
    roundPoints,
    scores: newScores
  };
}

export function startNextRound(state: GameState): GameState {
  if (state.phase !== "round_finished") return state;
  return startNewHand(state.dealer);
}

// Export the consolidated engine
export const BotifarraEngine = {
  // Game setup
  createDeck,
  shuffle,
  dealCards,
  chooseDealerByLift,
  startNewHand,
  
  // Bidding
  canBid,
  canPass,
  canDouble,
  applyBiddingAction,
  
  // Playing
  getLegalPlays,
  calculateTrickWinner,
  calculateTrickPoints,
  playCard,
  
  // Utility
  nextSeat,
  getTeam,
  getPartnerSeat,
  
  // Round management
  startNextRound
};
