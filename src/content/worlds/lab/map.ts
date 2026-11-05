/**
 * Mechanics lab: one of everything, for testing the engine (?world=lab).
 * Built with a tiny helper so features are easy to move around while testing.
 */
function build(): string[] {
  const W = 150;
  const H = 24;
  const g = Array.from({ length: H }, () => Array<string>(W).fill(' '));
  const fill = (x: number, y: number, w: number, h: number, ch: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = ch;
  };
  const put = (x: number, y: number, ch: string) => (g[y][x] = ch);

  fill(0, 0, W, 1, '#');
  fill(0, 0, 1, H, '#');
  fill(W - 1, 0, 1, H, '#');
  fill(0, 20, W, 4, '#');

  put(3, 19, 'P');
  put(6, 19, '1');
  put(10, 19, 'N');
  put(13, 19, 'M');
  fill(15, 20, 3, 1, ' ');
  fill(15, 21, 3, 1, '^');
  put(21, 19, 'C');
  put(23, 19, '2');
  fill(25, 17, 3, 3, '#');
  // chimney
  fill(31, 12, 2, 8, '#');
  fill(35, 8, 2, 12, '#');
  put(39, 19, '3');
  put(42, 19, 'b');
  // water pool
  fill(46, 20, 6, 2, '~');
  // crumble bridge over thorns
  fill(55, 20, 6, 1, 'K');
  fill(55, 21, 6, 1, '^');
  // spring to a high ledge with souls
  put(64, 19, 'J');
  fill(62, 9, 9, 1, '=');
  put(63, 8, 'o');
  put(66, 8, 'o');
  put(69, 8, 'o');
  // acid pit crossed by a moving platform
  fill(72, 20, 13, 1, '%');
  put(72, 18, 'm');
  put(84, 18, ';');
  // updraft over thorns to a high ledge with the dash shrine
  fill(88, 20, 3, 1, '^');
  fill(88, 6, 3, 14, 'W');
  fill(91, 6, 7, 2, '#');
  put(95, 5, 'D');
  // secret behind a cracked wall
  fill(100, 16, 4, 1, '#');
  fill(100, 17, 1, 3, 'X');
  fill(103, 17, 1, 3, '#');
  put(102, 19, 'H');
  // ice
  fill(106, 20, 9, 1, 'I');
  put(120, 19, 'T');
  put(145, 19, 'E');
  put(50, 12, 'w');
  put(80, 10, 'w');
  for (const x of [9, 30, 58, 86, 118]) put(x, 1, 'L');
  return g.map((r) => r.join(''));
}

export const LAB_MAP = build();
