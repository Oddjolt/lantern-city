/** Where the player (re)appears when a world loads. */
export type SpawnPoint = { kind: 'start' } | { kind: 'station' } | { kind: 'checkpoint'; id: string };

/**
 * The persistent avatar: everything that travels with the character between worlds.
 * In a multi-world "metaverse" this is the part that would live on a server.
 */
export interface Profile {
  /** Which spirit topper the avatar wears (see AVATARS in art/player.ts). */
  avatar: string;
  hp: number;
  maxHp: number;
  souls: number;
  abilities: { dash: boolean; doubleJump: boolean };
  worldId: string;
  spawn: SpawnPoint;
  /** Persistent world state: collected items, broken walls, defeated bosses, relit lanterns… */
  flags: Record<string, true>;
  /** Worlds reachable by train. */
  unlocked: string[];
  deaths: number;
  playTime: number;
}

const KEY = 'lantern-city-save-v1';

export function newProfile(): Profile {
  return {
    avatar: 'sprout',
    hp: 5,
    maxHp: 5,
    souls: 0,
    abilities: { dash: false, doubleJump: false },
    worldId: 'outskirts',
    spawn: { kind: 'start' },
    flags: {},
    unlocked: ['outskirts'],
    deaths: 0,
    playTime: 0,
  };
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...newProfile(), ...(JSON.parse(raw) as Profile) } : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode): progress just isn't kept */
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
