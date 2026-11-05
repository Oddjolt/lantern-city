/**
 * THE UNDERWORKS — flooded sewers and pump works beneath Lantern City.
 *
 * Sections, left to right:
 *   S0  Underworks Station      arrive by train; Rusty the mechanic
 *   S1  Drain Tunnels           rats, a drip slime, a swim pool, grates, a first acid gap
 *   S2  Sentry Gallery          a sentry guards a sluice gate: strike its bolts back to break it
 *   S3  The Cistern             pillar hopping over eels, a dive through a current-swept arch;
 *                               secret: cracked bricks underwater hide a wooden heart
 *   S4  Pump Station            lift, steam updraft, a valve-operated gate, the Ember Wings shrine
 *                               and a practice ledge right after it
 *   S5  Acid Works              double-jump gaps, crumbling bricks, a moving platform, steam
 *   S6  The Outflow             the high climb (jump + wings + dash) to the sector lantern
 *
 * Built with a few helpers so sections are easy to move while tuning; the result is plain ASCII.
 * Legend symbols specific to this world are documented in index.ts.
 */
const W = 320;
const H = 48;

function build(): string[] {
  const g = Array.from({ length: H }, () => Array<string>(W).fill('#'));
  const fill = (x: number, y: number, w: number, h: number, ch: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (j >= 0 && j < H && i >= 0 && i < W) g[j][i] = ch;
  };
  const carve = (x: number, y: number, w: number, h: number) => fill(x, y, w, h, ' ');
  const put = (x: number, y: number, s: string) => {
    for (let i = 0; i < s.length; i++) g[y][x + i] = s[i];
  };

  // ---- S0: Underworks Station (x 1..35) -------------------------------------------------------
  carve(1, 12, 35, 14); // hall: rows 12..25, floor row 26
  fill(1, 12, 2, 2, '#'); // vault corbels
  fill(34, 12, 2, 2, '#');
  put(1, 14, '#');
  put(35, 14, '#');
  put(9, 25, 'T'); // conductor; train drawn to the right (x 11..27)
  put(2, 25, 'k'); // barrel
  put(4, 25, '1'); // sign
  put(7, 12, 'O'); // outfall pouring behind the platform
  put(5, 12, 'L');
  put(18, 12, 'L');
  put(29, 12, 'L');
  put(30, 25, 'N'); // Rusty
  put(33, 25, 'b'); // his workbench
  put(28, 25, 'g'); // gauge
  put(3, 16, '*'); // water shimmer effect (draws over every visible water tile)
  put(12, 12, 'i');
  put(24, 12, 'c');

  // ---- S1: Drain Tunnels (x 36..87) -----------------------------------------------------------
  carve(36, 19, 10, 7); // tunnel A: rows 19..25, floor 26
  put(40, 19, 'q'); // caged lamp
  carve(46, 19, 4, 9); // step down to floor 28
  carve(50, 19, 8, 9); // pool room
  fill(50, 28, 8, 3, '~'); // swim pool: rows 28..30
  put(53, 19, 'd'); // drip slime over the pool
  put(51, 24, 'o');
  put(54, 23, 'o');
  put(56, 24, 'o');
  carve(58, 12, 16, 16); // grate room: rows 12..27, floor 28
  fill(58, 12, 3, 3, '#');
  fill(71, 12, 3, 2, '#');
  put(59, 24, '==='); // first grate is 4 rows up: take the spring (or dash)
  put(60, 27, 'J');
  put(63, 22, '===');
  put(67, 19, '===');
  put(71, 16, '###'); // little ledge with souls
  put(71, 15, 'ooo');
  put(68, 18, 'o');
  put(64, 21, 'o');
  put(62, 27, 'r'); // rat pair
  put(66, 27, 'r');
  put(65, 12, 'L');
  put(58, 27, 'h'); // rats' nest
  carve(74, 24, 14, 7); // lower tunnel: rows 24..30, floor 31
  carve(74, 21, 4, 3);
  fill(78, 31, 3, 1, '%'); // first acid gap (3 wide)
  put(83, 24, 'L');
  put(76, 30, 'g');
  put(82, 30, '2'); // sign: sentry ahead
  put(85, 30, 'C'); // checkpoint 1

  // ---- S2: Sentry Gallery (x 88..129) ---------------------------------------------------------
  carve(88, 21, 19, 10); // gallery: x 88..106, rows 21..30, floor 31
  fill(99, 31, 4, 1, '%'); // acid moat
  put(105, 30, 'Z'); // gate sentry (channel g1), faces left
  fill(107, 27, 1, 4, 'B'); // sluice gate g1
  put(92, 21, 'L');
  put(100, 21, 'L');
  put(89, 30, 'k');
  put(103, 22, 'p'); // dripping pipe
  carve(108, 24, 22, 7); // corridor: x 108..129, rows 24..30, floor 31
  put(112, 24, 'q');
  put(113, 30, 'r');
  put(124, 30, 'r');
  carve(117, 31, 4, 3); // a shallow pit under loose bricks: a safe first taste of crumbling floors
  fill(117, 31, 4, 1, 'K');
  put(124, 24, 'L');
  put(127, 30, 'C'); // checkpoint 2 (cistern)

  // ---- S3: The Cistern (x 130..182) ---------------------------------------------------------------
  carve(130, 18, 47, 26); // x 130..176, rows 18..43, floor 44
  fill(130, 32, 47, 12, '~'); // water rows 32..43
  fill(130, 31, 6, 1, '#'); // entry ledge
  // piers: tops 1 row above the water (you can climb out of the water onto them), the frog's is taller
  for (const [px, top] of [
    [140, 31],
    [147, 31],
    [153, 28],
    [159, 31],
  ]) {
    fill(px, top, 3, 44 - top, '#');
    fill(px, 38, 3, 4, '~'); // underwater arch through the pier
  }
  fill(130, 41, 2, 3, '#'); // rubble by the secret wall
  fill(165, 43, 4, 1, '^'); // rusted spikes on the cistern floor
  fill(144, 43, 2, 1, '^');
  put(144, 35, 'e'); // eels
  put(168, 34, 'e');
  put(148, 18, 'd'); // drips above piers
  put(160, 18, 'd');
  put(154, 27, 'F'); // Old Croaker on the tall pier
  put(136, 18, 'L');
  put(157, 18, 'L');
  put(172, 18, 'p');
  put(141, 30, 'f'); // fungus on the first pier
  // east wall comes down into the water: dive under it through the arch (current pulls you east)
  carve(177, 39, 6, 4);
  fill(175, 39, 8, 4, ')'); // the current starts just in front of the arch and sucks you through
  // secret: cracked bricks underwater -> an air pocket with a wooden heart on a dry ledge.
  // (souls sit > 40px from anywhere outside, or they would drift to you through the wall)
  carve(122, 35, 7, 7); // pocket x 122..128, rows 35..41
  fill(122, 39, 7, 3, '~');
  fill(122, 38, 3, 1, '#'); // dry ledge just above the pocket's water
  fill(129, 39, 1, 3, 'X');
  put(123, 37, 'H');
  put(122, 36, 'o');
  put(124, 36, 'o');
  put(122, 35, '?'); // keeps the pocket hidden until the bricks break

  // ---- S4: Pump Station (x 183..222) --------------------------------------------------------------
  carve(183, 6, 40, 37); // the hall: x 183..222, rows 6..42
  fill(183, 13, 13, 17, '#'); // masonry under the shrine room (x 183..195, rows 13..29)
  fill(183, 36, 8, 7, '~'); // sump: x 183..190, rows 36..42 (the arch from the cistern opens here)
  fill(191, 36, 32, 7, '#'); // hall floor, top at row 36
  put(194, 35, 'C'); // checkpoint 3
  put(192, 35, 'g');
  put(201, 35, 'M'); // the great pump (behind)
  put(186, 30, 'L');
  put(196, 35, 't'); // work lamp
  put(205, 35, 'n'); // lift up to the middle catwalk
  put(205, 25, ';');
  fill(208, 25, 15, 2, '#'); // middle catwalk (x 208..222, top row 25)
  put(214, 24, 'r');
  put(212, 12, 'r'); // rat on the top catwalk
  put(209, 14, 'd'); // drip under the top catwalk, over the middle one
  put(210, 24, '4'); // sign: steam
  fill(218, 10, 3, 15, 'W'); // steam column x 218..220, rows 10..24
  put(219, 24, 'V');
  put(212, 27, 'p'); // dripping pipe under the catwalk
  fill(196, 13, 22, 1, '='); // top catwalk: a grate walkway (x 196..217, row 13)
  put(206, 12, 'a'); // valve (channel g2)
  fill(195, 6, 1, 3, '#');
  fill(195, 9, 1, 4, 'A'); // sluice gate g2 into the shrine room
  put(203, 14, 'p');
  put(199, 14, 'L');
  put(214, 14, 'L');
  put(201, 6, 'q');
  put(212, 6, 'q');
  put(199, 12, 'k');
  // shrine room x 184..194, rows 6..12 (floor row 13); a shaft at its left climbs to the duct
  carve(184, 6, 11, 7);
  fill(183, 6, 1, 7, '#');
  carve(184, 2, 4, 4);
  put(190, 12, 'U'); // Ember Wings
  put(193, 12, 'f');
  // practice: a ledge 4 rows above the shrine floor and the duct 4 rows above that (double jump twice)
  fill(184, 9, 4, 1, '#');
  carve(184, 2, 4, 7);
  put(188, 10, 'o');
  put(186, 7, 'o');
  // service duct over the hall: x 184..226, rows 2..4, floor row 5
  carve(184, 2, 43, 3);
  put(196, 4, 'o');
  put(203, 4, 'o');
  put(210, 4, 'o');
  put(199, 2, 'q');
  put(216, 2, 'q');
  put(186, 4, 'o'); // last soul of the practice climb
  put(192, 8, 'u'); // wall valve on the shrine room's back wall

  // ---- S5: Acid Works (x 223..285) --------------------------------------------------------------
  carve(227, 1, 59, 19); // chamber x 227..285, rows 1..19
  fill(227, 20, 59, 1, '%'); // acid canal, row 20 (visible from the high path)
  fill(227, 5, 3, 15, '#'); // E0: the duct floor runs out onto a pier (x 223..229, top row 5)
  put(228, 4, 'C'); // checkpoint 4
  fill(237, 6, 4, 2, '#'); // P1 — 7 tiles out: double jump
  put(233, 3, 'o');
  fill(243, 10, 8, 1, 'K'); // crumbling brick bridge
  put(247, 1, 'd'); // drip slime over the bridge
  fill(252, 16, 3, 4, '#'); // vent stub in the acid
  fill(252, 4, 3, 12, 'W'); // steam column x 252..254, rows 4..15
  put(253, 15, 'V');
  fill(257, 6, 5, 2, '#'); // P2
  put(259, 5, 'f');
  put(264, 11, 'm'); // moving platform over the canal
  put(273, 11, ';'); // east end leaves a 5-tile gap: the double jump happens in open air, not against the wall
  put(270, 8, 'o');
  fill(279, 6, 7, 15, '#'); // P4 tower x 279..285 (top row 6): 5 up from the platform
  put(284, 5, 's'); // sentry on the tower
  put(240, 1, 'L');
  put(266, 1, 'L');
  put(258, 8, 'p');
  // secret cache in the tower's foot, behind cracked bricks facing the outflow basin
  carve(276, 28, 9, 4); // x 276..284, rows 28..31
  fill(285, 30, 1, 2, 'X');
  put(276, 31, 'o');
  put(277, 30, 'o');
  put(278, 31, 'o');
  put(279, 29, 'o');
  put(276, 28, '?');
  put(281, 31, 'k');

  // ---- S6: The Outflow (x 286..318) -------------------------------------------------------------
  carve(286, 1, 33, 31); // basin x 286..318, rows 1..31, floor row 32
  fill(303, 1, 3, 16, '#'); // curtain wall: the lantern alcove opens only below it (rows 17..20)
  fill(306, 21, 13, 2, '#'); // lantern ledge x 306..318, top row 21 — 11 tiles above the floor
  fill(318, 23, 1, 9, '<'); // rusted spikes on the wall under the ledge (no wall-jumping up)
  put(313, 20, 'E'); // the sector lantern
  put(309, 20, 'f');
  put(316, 20, 'f');
  put(298, 31, 'w'); // Digby
  put(301, 31, '3'); // sign: the high climb
  put(302, 26, 'o');
  put(303, 21, 'o');
  put(289, 31, 'k');
  put(293, 1, 'L');
  put(311, 1, 'L');
  put(296, 1, 'O'); // outfall pouring into the basin
  put(287, 31, 'h');
  put(290, 31, 'r');
  put(295, 31, 'r');

  return g.map((r) => r.join(''));
}

export const UNDERWORKS_MAP = build();
