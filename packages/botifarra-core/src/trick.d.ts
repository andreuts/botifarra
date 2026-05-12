import type { CompletedTrick, TrickCard, TrumpDeclaration } from './types.js';
/**
 * Resolves which seat wins a completed 4-card trick.
 *
 * Rules:
 * 1. The first card played defines the led suit.
 * 2. A trump card always beats a non-trump card.
 * 3. Among trump cards, highest trump power wins.
 * 4. Among non-trump cards of the led suit, highest suit power wins.
 * 5. Off-suit non-trump cards can never win.
 */
export declare function resolveTrick(cards: [TrickCard, TrickCard, TrickCard, TrickCard], trump: TrumpDeclaration): CompletedTrick;
