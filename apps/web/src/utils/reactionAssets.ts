import type { ReactionMood } from '@botifarra/shared';

const PNG_REACTIONS: ReadonlySet<ReactionMood> = new Set<ReactionMood>(['cheers', 'love']);

export function reactionAssetPath(reaction: ReactionMood): string {
  const extension = PNG_REACTIONS.has(reaction) ? 'png' : 'gif';
  return `/reactions/${reaction}.${extension}`;
}

export function reactionAssetClass(reaction: ReactionMood): string {
  return `reaction-art reaction-art--${reaction}`;
}
