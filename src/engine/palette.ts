/**
 * Every world is drawn with exactly four colours, darkest (0) to lightest (3), Game Boy style.
 * All art in the game is stored as palette *indices*, so the same sprite is automatically
 * recoloured when the player travels to a world with a different palette.
 */
export type Palette = readonly [string, string, string, string];

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
