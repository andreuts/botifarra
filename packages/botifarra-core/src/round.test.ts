import { describe, it, expect } from 'vitest';
import {
  createRound,
  declareTrump,
  playCard,
  getRoundPhase,
  currentPlayerSeat,
  passDeclaration,
  callContra,
} from './round.js';
import { createDeck, shuffleDeck, dealHands } from './deck.js';
import { legalMoves } from './legal-moves.js';
import type { RoundState, Seat, TrumpDeclaration } from './types.js';

/** Play one legal card for the current player and return the updated round. */
function playLegal(r: RoundState): RoundState {
  const seat = currentPlayerSeat(r) as Seat;
  const legal = legalMoves({
    hand: r.hands[seat],
    currentTrick: r.currentTrick,
    trump: r.trump!,
    playerSeat: seat,
  });
  return playCard(r, seat, legal[0]!);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshRound(dealerSeat: Seat = 0) {
  const hands = dealHands(shuffleDeck(createDeck()));
  return createRound({ dealerSeat, hands });
}

// ---------------------------------------------------------------------------
// createRound
// ---------------------------------------------------------------------------

describe('createRound', () => {
  it('starts in the declaring phase', () => {
    expect(getRoundPhase(freshRound())).toBe('declaring');
  });

  it('declarant is the dealer', () => {
    const r = freshRound(1);
    expect(r.declarantSeat).toBe(1);
  });

  it('no trump is set yet', () => {
    expect(freshRound().trump).toBeNull();
  });

  it('no tricks have been played', () => {
    expect(freshRound().completedTricks).toHaveLength(0);
  });

  it('the leader of the first trick is the player to the right of dealer (dealer+3 mod 4)', () => {
    // In Botifarra play is counter-clockwise, so right of dealer leads
    const r = freshRound(0);
    expect(r.currentLeader).toBe(3);
  });

  it('dealerPassed starts false and contraLevel starts 0', () => {
    const r = freshRound(0);
    expect(r.dealerPassed).toBe(false);
    expect(r.contraLevel).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// declareTrump
// ---------------------------------------------------------------------------

describe('declareTrump', () => {
  it('sets the trump and advances phase to playing', () => {
    const r = declareTrump(freshRound(0), 'oros');
    expect(r.trump).toBe('oros');
    expect(getRoundPhase(r)).toBe('playing');
  });

  it('throws if trump already declared', () => {
    const r = declareTrump(freshRound(), 'copes');
    expect(() => declareTrump(r, 'oros')).toThrow();
  });

  it('accepts all valid declarations', () => {
    const decls: TrumpDeclaration[] = ['oros', 'copes', 'espases', 'bastos', 'botifarra'];
    for (const d of decls) {
      const r = declareTrump(freshRound(), d);
      expect(r.trump).toBe(d);
    }
  });
});

// ---------------------------------------------------------------------------
// playCard
// ---------------------------------------------------------------------------

describe('playCard', () => {
  function roundInPlay(dealerSeat: Seat = 0) {
    return declareTrump(freshRound(dealerSeat), 'oros');
  }

  it('throws when called in declaring phase', () => {
    expect(() => playCard(freshRound(), 0, { suit: 'oros', rank: 1 })).toThrow();
  });

  it('current player can play a legal card from their hand', () => {
    const r = roundInPlay();
    const seat = currentPlayerSeat(r) as Seat;
    const card = r.hands[seat][0]!;
    const r2 = playCard(r, seat, card);
    expect(r2.currentTrick).toHaveLength(1);
    expect(r2.hands[seat]).toHaveLength(11);
  });

  it('throws if wrong player tries to play', () => {
    const r = roundInPlay();
    const seat = currentPlayerSeat(r) as Seat;
    const wrongSeat = ((seat + 1) % 4) as Seat;
    const card = r.hands[wrongSeat][0]!;
    expect(() => playCard(r, wrongSeat, card)).toThrow();
  });

  it('throws if card not in hand', () => {
    const r = roundInPlay();
    const seat = currentPlayerSeat(r) as Seat;
    // Remove a card from the hand model to create a clearly absent card
    const absent = { suit: 'oros' as const, rank: 1 as const };
    const handWithout = r.hands[seat].filter(
      (c) => !(c.suit === absent.suit && c.rank === absent.rank),
    );
    // If the card is already absent this test passes trivially; otherwise verify the error
    if (handWithout.length < r.hands[seat].length) {
      // card was present; try to play it after manually removing it
      // We can verify the validation by using a patched state
      const patched = { ...r, hands: { ...r.hands, [seat]: handWithout } };
      expect(() => playCard(patched, seat, absent)).toThrow(/not found/);
    } else {
      // card not in hand at all — expect throw
      expect(() => playCard(r, seat, absent)).toThrow(/not found/);
    }
  });

  it('completes a trick after 4 cards are played', () => {
    let r = roundInPlay();
    for (let i = 0; i < 4; i++) r = playLegal(r);
    expect(r.completedTricks).toHaveLength(1);
    expect(r.currentTrick).toHaveLength(0);
  });

  it('advances to scoring phase after 12 tricks', () => {
    let r = roundInPlay();
    for (let i = 0; i < 48; i++) r = playLegal(r);
    expect(getRoundPhase(r)).toBe('scoring');
    expect(r.completedTricks).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// currentPlayerSeat
// ---------------------------------------------------------------------------

describe('currentPlayerSeat', () => {
  it('returns null in declaring phase', () => {
    expect(currentPlayerSeat(freshRound())).toBeNull();
  });

  it('returns the leader at the start of a trick', () => {
    const r = declareTrump(freshRound(0), 'copes');
    expect(currentPlayerSeat(r)).toBe(r.currentLeader);
  });

  it('goes counter-clockwise after each card', () => {
    let r = declareTrump(freshRound(0), 'copes');
    const first = currentPlayerSeat(r) as Seat;
    const card = r.hands[first][0]!;
    r = playCard(r, first, card);
    expect(currentPlayerSeat(r)).toBe(((first + 3) % 4) as Seat);
  });
});

// ---------------------------------------------------------------------------
// passDeclaration
// ---------------------------------------------------------------------------

describe('passDeclaration', () => {
  it('moves declarant to partner when dealer passes', () => {
    const r = freshRound(0); // dealer=0, declarant=0, partner=2
    const r2 = passDeclaration(r);
    expect(r2.declarantSeat).toBe(2);
    expect(r2.dealerPassed).toBe(true);
  });

  it('throws if dealer already passed', () => {
    const r = passDeclaration(freshRound(0));
    expect(() => passDeclaration(r)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// callContra
// ---------------------------------------------------------------------------

describe('callContra', () => {
  it('opposing team can call contra after trump is declared', () => {
    // dealer=0, declarant=0 so team 0; trumped. opponents are team 1 (seats 1,3)
    const r = declareTrump(freshRound(0), 'oros');
    const r2 = callContra(r, 1); // seat 1 = team 1
    expect(r2.contraLevel).toBe(1);
  });

  it('declarant team can recontro after contra', () => {
    let r = declareTrump(freshRound(0), 'oros');
    r = callContra(r, 1); // contra by team 1
    r = callContra(r, 0); // recontro by team 0
    expect(r.contraLevel).toBe(2);
  });

  it('opposing team can call sant vicenç after recontro', () => {
    let r = declareTrump(freshRound(0), 'espases');
    r = callContra(r, 1); // contra by team 1
    r = callContra(r, 0); // recontro by team 0
    r = callContra(r, 3); // sant vicenç by team 1 (seat 3)
    expect(r.contraLevel).toBe(3);
  });

  it('throws if same team calls twice in a row', () => {
    let r = declareTrump(freshRound(0), 'oros');
    r = callContra(r, 1);
    expect(() => callContra(r, 3)).toThrow(); // seat 3 is also team 1
  });

  it('throws if called before trump is declared', () => {
    expect(() => callContra(freshRound(0), 1)).toThrow();
  });

  it('throws after maximum contra level (3) is reached', () => {
    let r = declareTrump(freshRound(0), 'bastos');
    r = callContra(r, 1);
    r = callContra(r, 0);
    r = callContra(r, 1);
    expect(() => callContra(r, 0)).toThrow(/Maximum/);
  });

  it('allows contra on botifarra trump', () => {
    let r = declareTrump(freshRound(0), 'botifarra');
    r = callContra(r, 1);
    expect(r.contraLevel).toBe(1);
  });

  it('allows recontro on botifarra trump', () => {
    let r = declareTrump(freshRound(0), 'botifarra');
    r = callContra(r, 1);
    r = callContra(r, 0);
    expect(r.contraLevel).toBe(2);
  });

  it('blocks sant vicenç when trump is botifarra', () => {
    let r = declareTrump(freshRound(0), 'botifarra');
    r = callContra(r, 1);
    r = callContra(r, 0);
    expect(() => callContra(r, 1)).toThrow(/Sant Vicenç/);
  });

  it('throws if called after play has started', () => {
    let r = declareTrump(freshRound(0), 'oros');
    r = playLegal(r); // first card played
    expect(() => callContra(r, 1)).toThrow(/play has started/);
  });

  it('declarant team calling contra (level 1) throws wrong team', () => {
    const r = declareTrump(freshRound(0), 'oros');
    expect(() => callContra(r, 0)).toThrow(/Wrong team/);
    expect(() => callContra(r, 2)).toThrow(/Wrong team/); // seat 2 same team
  });

  it('opposing team calling recontro (level 2) throws wrong team', () => {
    let r = declareTrump(freshRound(0), 'oros');
    r = callContra(r, 1); // contra
    expect(() => callContra(r, 1)).toThrow(/Wrong team/);
    expect(() => callContra(r, 3)).toThrow(/Wrong team/);
  });
});

