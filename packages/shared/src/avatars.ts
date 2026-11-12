export const GAME_AVATAR_IDS = [
  'porro',
  'vermut',
  'cafe',
  'sifo',
  'olives',
  'braves',
  'caliquenyo',
  'pa-amb-tomaquet',
  'anxoves',
  'canya',
  'baralla',
  'cacauets',
] as const;

export type GameAvatarId = (typeof GAME_AVATAR_IDS)[number];

export function isGameAvatarId(value: unknown): value is GameAvatarId {
  return typeof value === 'string' && (GAME_AVATAR_IDS as readonly string[]).includes(value);
}

export function getRandomGameAvatarId(): GameAvatarId {
  const index = Math.floor(Math.random() * GAME_AVATAR_IDS.length);
  return GAME_AVATAR_IDS[index]!;
}
