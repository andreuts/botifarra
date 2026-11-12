import type { GameAvatarId } from '@botifarra/shared';

export function avatarImageSrc(avatarId: GameAvatarId | null | undefined): string {
  return avatarId ? `/avatars/${avatarId}.jpg` : '/player-placeholder.svg';
}
