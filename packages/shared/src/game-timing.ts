/** Duration of the cards' movement from the table to the trick pile. */
export const TRICK_ANIMATION_DURATION_MS = 750;

/** Total time to review a completed trick, including the collection animation. */
export const TRICK_PAUSE_DURATION_MS = 5_000;

/** Keep the completed cards visible before the collection animation begins. */
export const TRICK_REVEAL_DURATION_MS = TRICK_PAUSE_DURATION_MS - TRICK_ANIMATION_DURATION_MS;
