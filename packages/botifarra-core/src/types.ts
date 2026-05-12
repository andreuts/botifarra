/**
 * Botifarra uses the 48-card Catalan deck:
 * 4 suits × 12 ranks (1–12).
 *
 * Spanish/Catalan suit names:
 *   oros   = coins (gold)
 *   copes  = cups
 *   espases = swords
 *   bastos = clubs
 */

// ---------------------------------------------------------------------------
// Primitive game types
// ---------------------------------------------------------------------------

export type Suit = 'oros' | 'copes' | 'espases' | 'bastos';

/** 1–12 where 1 = As, 10 = Sota, 11 = Cavall, 12 = Rei, 9 = Manilla */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

/**
 * Trump declaration.
 *   - A Suit value: that suit is trump.
 *   - 'botifarra': no trump; all suits have equal standing.
 */
export type TrumpDeclaration = Suit | 'botifarra';

// ---------------------------------------------------------------------------
// Players & teams
// ---------------------------------------------------------------------------

/** Seats around the table in clockwise order: 0=N, 1=E, 2=S, 3=W */
export type Seat = 0 | 1 | 2 | 3;

/** Teams: North-South (0,2) vs East-West (1,3) */
export type Team = 0 | 1;

/** Returns the team for a given seat */
export const seatTeam = (seat: Seat): Team => (seat % 2 === 0 ? 0 : 1) as Team;

/** Returns the partner seat */
export const partnerSeat = (seat: Seat): Seat => ((seat + 2) % 4) as Seat;

// ---------------------------------------------------------------------------
// Trick
// ---------------------------------------------------------------------------

export interface TrickCard {
  readonly seat: Seat;
  readonly card: Card;
}

export interface CompletedTrick {
  readonly cards: [TrickCard, TrickCard, TrickCard, TrickCard];
  /** Seat of the player who led */
  readonly leader: Seat;
  /** Seat of the player who won the trick */
  readonly winner: Seat;
}

// ---------------------------------------------------------------------------
// Round / Deal state
// ---------------------------------------------------------------------------

export type Hands = Record<Seat, Card[]>;

/**
 * Contra level: 0=none, 1=contra, 2=recontro, 3=sant vicenç.
 * The scoring multiplier from contra is 2^contraLevel on top of the trump multiplier.
 */
export type ContraLevel = 0 | 1 | 2 | 3;

export interface RoundState {
  readonly dealerSeat: Seat;
  /**
   * Seat responsible for declaring trump.
   * Initially the dealer; set to partner if dealer passes.
   */
  readonly declarantSeat: Seat;
  /** True once the dealer has passed the declaration obligation to their partner. */
  readonly dealerPassed: boolean;
  /** Contra escalation level. 0=none, 1=contra, 2=recontro, 3=sant vicenç. */
  readonly contraLevel: ContraLevel;
  readonly trump: TrumpDeclaration | null; // null = not yet declared
  readonly hands: Hands;
  readonly completedTricks: CompletedTrick[];
  /** Seat to lead the current trick */
  readonly currentLeader: Seat;
  /** Cards already played in the current (open) trick, in play order */
  readonly currentTrick: TrickCard[];
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

export interface RoundScore {
  /**
   * Total points per team: card values (Manilla=5, As=4, Rei=3, Cavall=2, Sota=1)
   * PLUS 1 point per trick won. Grand total is always 72.
   */
  readonly teamPoints: [number, number];
  /** True if one team captured all 12 tricks (capot). */
  readonly capot: boolean;
  /** Match-points awarded to each team this round (after multiplier). */
  readonly matchPoints: [number, number];
  /** The multiplier applied (1, 2, 4, or 8). */
  readonly multiplier: number;
}
