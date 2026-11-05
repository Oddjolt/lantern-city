import type { WorldDef } from '../../game/registry';

/**
 * World registry. Every folder in src/content/worlds/<id>/index.ts that default-exports a
 * WorldDef is picked up automatically — adding a world never touches shared code.
 * A world that fails to load is skipped (and logged) instead of breaking the game.
 */
const modules = import.meta.glob<{ default: WorldDef }>('./*/index.ts');

let worlds: WorldDef[] = [];

export async function loadWorlds(): Promise<WorldDef[]> {
  const loaded = await Promise.all(
    Object.entries(modules).map(async ([path, load]) => {
      try {
        return (await load()).default;
      } catch (err) {
        console.error(`World ${path} failed to load and was skipped:`, err);
        return null;
      }
    }),
  );
  worlds = loaded.filter((w): w is WorldDef => !!w).sort((a, b) => a.order - b.order);
  return worlds;
}

/** Worlds on the train map (dev-only worlds excluded). */
export function allWorlds(): WorldDef[] {
  return worlds.filter((w) => !w.hidden);
}

/** Any world, including dev-only ones. */
export function worldById(id: string): WorldDef | undefined {
  return worlds.find((w) => w.id === id);
}
