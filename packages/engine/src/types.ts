export type Suit = "OROS" | "COPES" | "ESPASES" | "BASTOS";
export type Rank = "9" | "A" | "K" | "C" | "J" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
export type Trump = Suit | "BOTIFARRA";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Player {
  id: string;
  name: string;
}

// Bidding actions
export interface BidAction {
  type: "bid";
  trump: Trump;
  delegate?: boolean;
}

export interface PassAction {
  type: "pass";
}

export interface DoubleAction {
  type: "double";
  level: "CONTRAR" | "RECONTRAR" | "SANT_VICENS";
}

export type BiddingAction = BidAction | PassAction | DoubleAction;

export interface Contract {
  trump: Trump;
  bidder: number;
  delegated: boolean;
  doubles: 0 | 1 | 2 | 3;
}

export interface Trick {
  leader: number;
  plays: Array<{ seat: number; card: Card }>;
  winner: number;
  points: number;
}

export interface GameState {
  phase: "bidding" | "playing" | "round_finished" | "finished";
  dealer: number;
  turn: number;
  
  // Deal - always present after game starts
  deal: {
    hands: Card[][];
  };
  
  // Bidding - present during bidding phase
  bidding?: {
    bidder?: number;
    trump?: Trump;
    delegate?: boolean;
    doubles: 0 | 1 | 2 | 3;
    passes: number[];
  };
  
  // Playing - present during playing phase
  contract?: Contract;
  currentTrick?: {
    leader: number;
    plays: Array<{ seat: number; card: Card }>;
  };
  completedTricks: Trick[];
  
  // Scoring
  roundPoints?: { NS: number; EW: number };
  scores: { NS: number; EW: number };
}

