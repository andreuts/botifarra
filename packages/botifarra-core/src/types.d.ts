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
/** Seats around the table in clockwise order: 0=N, 1=E, 2=S, 3=W */
export type Seat = 0 | 1 | 2 | 3;
/** Teams: North-South (0,2) vs East-West (1,3) */
export type Team = 0 | 1;
/** Returns the team for a given seat */
export declare const seatTeam: (seat: Seat) => Team;
/** Returns the partner seat */
export declare const partnerSeat: (seat: Seat) => Seat;
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
export type Hands = Record<Seat, Card[]>;
export interface RoundState {
    readonly dealerSeat: Seat;
    /** Seat that declares trump (partner of dealer) */
    readonly declarantSeat: Seat;
    readonly trump: TrumpDeclaration | null;
    readonly hands: Hands;
    readonly completedTricks: CompletedTrick[];
    /** Seat to lead the current trick */
    readonly currentLeader: Seat;
    /** Cards already played in the current (open) trick, in play order */
    readonly currentTrick: TrickCard[];
}
export interface RoundScore {
    /** Card points per team [team0, team1] */
    readonly cardPoints: [number, number];
    /** 1 if a team wins all 12 tricks (capot) */
    readonly capot: boolean;
    /** Final match-points per team [team0, team1] */
    readonly matchPoints: [number, number];
}
