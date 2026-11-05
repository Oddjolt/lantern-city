/**
 * Ember Foundry — the Barons' furnace works, the last sector of Lantern City.
 *
 * Built with a small helper (like the Outskirts) so rooms are easy to move around.
 * Rooms, left → right:
 *   A  station yard      (open sky, smokestacks)                       x   2-35
 *   B  slag channels     (slag pits, flame imps, crane ferry)          x  36-89   checkpoint 1
 *   C  conveyor hall     (belts, flame jets, furnace bot, drone, K)    x  90-139  checkpoint 2
 *   D  steam stack       (updraft, spring, chimney climb, secret)      x 140-167
 *   E  crusher gallery   (three presses on a wave rhythm)              x 168-195  checkpoint 3
 *   E2 crucible pit      (drop onto a catwalk, hop vertical cranes)    x 196-214
 *   F  smithy            (Smith Anvil, last checkpoint)                x 215-235  checkpoint 4
 *   G  warden's arena    (IRON WARDEN, gates on both sides)            x 236-275
 *   H  lantern chamber   (sector lantern, chained spirit)              x 276-297
 */
export const FOUNDRY_W = 300;
export const FOUNDRY_H = 46;
/** Main floor row: the top surface most rooms stand on. */
const FL = 40;

function build(): string[] {
  const W = FOUNDRY_W;
  const H = FOUNDRY_H;
  const g = Array.from({ length: H }, () => Array<string>(W).fill(' '));
  const fill = (x: number, y: number, w: number, h: number, ch: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = ch;
  };
  const put = (x: number, y: number, ch: string) => (g[y][x] = ch);
  /** A slag trench in the main floor: one row of air, then `depth` rows of slag. */
  const pit = (x: number, w: number, depth = 2) => {
    fill(x, FL, w, 1, ' ');
    fill(x, FL + 1, w, depth, '%');
  };

  // frame: bedrock, side walls
  fill(0, FL, W, H - FL, '#');
  fill(0, 0, 2, H, '#');
  fill(W - 2, 0, 2, H, '#');
  put(2, 0, '!'); // ambient embers, ash and slag glow (one per map)

  // ---- A: station yard -------------------------------------------------------------------
  put(4, FL - 1, 's'); // smokestack behind the platform
  put(6, FL - 1, 'T'); // 18 flat tiles + 6 tiles of headroom to the right for the train
  put(27, FL - 1, 'e');
  put(29, FL - 1, '1');
  put(32, FL - 1, 'N');

  // ---- B: slag channels (hall ceiling rows 0-25) -------------------------------------------
  fill(36, 0, 54, 26, '#');
  fill(36, 26, 2, 8, '#'); // facade; the doorway is rows 34-39
  put(40, FL - 1, 'u');
  put(44, 26, 'L');
  pit(42, 3);
  put(47, FL - 1, 'c');
  put(51, FL - 1, 'i');
  pit(54, 4);
  put(58, 26, 'L');
  put(60, FL - 1, 'i');
  put(62, FL - 1, 'e');
  // the slag river, ferried by two crane platforms with an island between them
  fill(64, FL, 20, 1, ' ');
  fill(64, FL + 1, 20, 3, '%');
  fill(72, 38, 3, H - 38, '#');
  put(64, 37, 'm');
  put(71, 37, ';');
  put(75, 37, 'm');
  put(83, 37, ';');
  put(67, 26, 'a');
  put(79, 26, 'a');
  put(67, 34, 'o');
  put(79, 34, 'o');
  // optional high catwalk over the island (jump + wings)
  fill(70, 33, 7, 1, '=');
  put(71, 32, 'o');
  put(73, 32, 'o');
  put(75, 32, 'o');
  put(73, 26, 'R');
  put(86, FL - 1, 'C');
  put(88, 26, 'L');

  // ---- C: conveyor hall (ceiling rows 0-27) --------------------------------------------------
  fill(90, 0, 50, 28, '#');
  put(92, FL - 1, '2');
  put(97, 28, 'L');
  // belt 1 pushes right, towards a slag trench
  for (let x = 94; x <= 101; x++) put(x, FL, 'r');
  put(98, 31, 'g');
  pit(102, 4);
  // a safe landing, then two flame jets firing in turn (wait between them); a drone overhead
  put(108, FL - 1, 'c');
  put(113, FL - 1, 'f');
  put(116, FL - 1, 'F');
  put(115, 31, 'd');
  put(114, 28, 'L');
  // belt 2 pushes left, against you: a furnace bot trudges on it like a treadmill.
  // hop the bumper, or take the catwalk and drop on its back
  put(118, FL - 1, '#');
  for (let x = 119; x <= 128; x++) put(x, FL, 'l');
  fill(121, 36, 6, 1, '=');
  put(124, FL - 1, 'b');
  put(127, 28, 'L');
  put(122, 30, 'w');
  // crumbling catwalk over slag
  fill(129, FL, 6, 1, 'K');
  fill(129, FL + 1, 6, 2, '%');
  put(137, FL - 1, 'C');

  // ---- D: the steam stack (shaft x 140-167, open rows 6-39) -----------------------------------
  fill(140, 0, 28, 6, '#');
  put(141, FL - 1, '3');
  fill(144, 26, 3, 14, 'W'); // steam column
  fill(140, 27, 4, 2, '#'); // ledge by the cracked wall
  // secret: cracked wall → sealed alcove with a wooden heart
  fill(136, 24, 3, 3, ' ');
  fill(139, 24, 1, 3, 'X');
  put(137, 25, 'H');
  put(136, 26, 'o');
  put(138, 26, 'o');
  fill(147, 28, 7, 2, '#'); // ledge 1
  put(152, 27, 'J');
  put(150, FL - 1, 'c');
  put(158, FL - 1, 'u');
  put(162, FL - 1, 'i');
  put(156, 6, 'a');
  put(152, 16, 'd');
  fill(150, 22, 18, 1, '='); // catwalk 2: spring up through it, wings over it
  fill(163, 6, 1, 13, '#'); // chimney pillar (wall-jump up between it and the gallery)
  put(158, 21, 'o');
  put(160, 6, 'L');
  put(149, 6, 'L');

  // ---- E: crusher gallery (open rows 9-14, floor row 15) --------------------------------------
  fill(168, 0, 28, 9, '#');
  fill(168, 15, 28, FL - 15, '#');
  put(170, 14, 'C');
  put(173, 14, '4');
  put(175, 9, 'p');
  put(181, 9, 'k');
  put(187, 9, 'q');
  put(178, 9, 'L');
  put(184, 9, 'L');
  put(192, 9, 'L');
  put(193, 14, 't');

  // secret 2: the stokers' cubby, behind a cracked wall below the gallery
  fill(186, 29, 9, 4, ' ');
  fill(195, 30, 1, 3, 'X');
  put(189, 32, 'u');
  put(190, 29, 'L');
  put(186, 32, 'e');
  put(187, 31, 'o');
  put(192, 31, 'o');
  put(194, 31, 'o');
  put(193, 32, '5');

  // ---- E2: crucible pit (open rows 9-39) ------------------------------------------------------
  fill(196, 0, 19, 9, '#');
  fill(197, 23, 8, 1, '=');
  put(201, 22, 'b');
  fill(196, 33, 4, 2, '#'); // a ledge by the cubby's cracked wall (drop off the catwalk's end)
  fill(196, FL, 19, 1, ' ');
  fill(196, FL + 1, 19, 2, '%');
  put(205, 33, 'n');
  put(205, 27, ';');
  put(210, 37, 'n');
  put(210, 31, ';');
  put(200, 9, 'a');
  put(208, 9, 'a');
  put(212, 18, 'o');
  put(206, 22, 'o');

  // ---- F: smithy (open rows 30-39) ------------------------------------------------------------
  fill(215, 0, 21, 30, '#');
  put(218, FL - 1, 'u');
  put(222, FL - 1, 'A');
  put(225, FL - 1, 'z');
  put(228, FL - 1, 'c');
  put(224, 30, 'L');
  put(231, FL - 1, 'C');
  put(234, 30, 'R');

  // ---- G: the Warden's arena (40 wide = one screen; open rows 22-39) ---------------------------
  fill(236, 0, 40, 22, '#');
  fill(236, 22, 1, 15, '#');
  fill(236, 37, 1, 3, 'G');
  fill(275, 22, 1, 15, '#');
  fill(275, 37, 1, 3, 'G');
  put(263, FL - 1, 'B');
  put(244, 22, 'L');
  put(256, 22, 'L');
  put(267, 22, 'L');
  put(240, 22, 'a');
  put(250, 22, 'a');
  put(261, 22, 'a');
  put(271, 22, 'a');
  put(239, FL - 1, 'u');
  put(272, FL - 1, 'u');

  // ---- H: lantern chamber (open rows 30-39) ----------------------------------------------------
  fill(276, 0, 22, 30, '#');
  put(280, FL - 1, 'Z');
  put(284, 30, 'L');
  put(290, FL - 1, 'E');
  put(295, FL - 1, 't');
  put(286, FL - 1, 'c');

  return g.map((r) => r.join(''));
}

export const FOUNDRY_MAP = build();
