/** Maximum time the table waits for the trick winner to continue. */
export const TRICK_PAUSE_DURATION_MS = 30_000;

/** Keep all played cards visible before collecting them into the won/lost pile. */
export const TRICK_REVEAL_DURATION_MS = 5_000;

/** Duration of the cards' movement from the table to the trick pile. */
export const TRICK_ANIMATION_DURATION_MS = 750;

/** Minimum pause before the trick winner may continue. */
export const TRICK_MIN_PAUSE_MS = TRICK_REVEAL_DURATION_MS + TRICK_ANIMATION_DURATION_MS;
