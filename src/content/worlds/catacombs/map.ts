/**
 * Gloomroot Catacombs — 312 x 50 tiles, carved out of solid rock section by section.
 *
 *   S1  Gloomroot Station (x 0-38)     arrival, Pip, the first brazier
 *   S2  Ossuary Steps & Gallery (39-98) bone shelves, sleeping bats, a crawler, a one-brazier tomb door, C1
 *   S3  Bile Cistern (99-155)           islands and bone bridges over bile, glowcaps, a bone-throwing skeleton
 *   S4  Brazier Hall (156-205)          C2, Digby, three braziers open the great tomb door, the shade, a hidden heart
 *   S5  Root Chasm (206-225)            fireflies and rising spores light a wall-jump climb
 *   S6  Flooded Crypt (226-272)         C3, swim under the crypt walls
 *   S7  Lantern Gauntlet (273-311)      C4, crumbling bridges over bile under a shade, the sector lantern
 *
 * Map symbols beyond the shared ones are in index.ts (legend).
 */
function build(): string[] {
  const W = 312;
  const H = 50;
  const g = Array.from({ length: H }, () => Array<string>(W).fill('#'));
  const fill = (x: number, y: number, w: number, h: number, ch: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = ch;
  };
  const carve = (x: number, y: number, w: number, h: number) => fill(x, y, w, h, ' ');
  const put = (x: number, y: number, ch: string) => (g[y][x] = ch);
  const row = (x: number, y: number, s: string) => [...s].forEach((ch, i) => ch !== '?' && put(x + i, y, ch));

  // ---- S1 Gloomroot Station --------------------------------------------------------------
  carve(1, 8, 38, 10); // hall, floor at row 18
  put(2, 9, '!'); // hazard glimmers (one per map)
  put(4, 17, 'T');
  for (const x of [9, 20, 31]) put(x, 8, 'L');
  put(28, 12, 'w'); // skull niches in the back wall
  put(35, 12, 'w');
  put(24, 17, 'h'); // a coffin waiting on the platform
  put(26, 17, '1');
  put(28, 17, 'N'); // Pip
  put(30, 17, 'i');
  put(33, 17, '2');
  put(36, 17, 'Y'); // first brazier: lights the steps down

  // ---- S2 Ossuary Steps & Gallery ------------------------------------------------------------
  carve(39, 12, 8, 9); // shelf 1, floor 21
  carve(47, 15, 8, 9); // shelf 2, floor 24
  carve(55, 18, 8, 9); // shelf 3, floor 27
  fill(53, 24, 2, 1, '^'); // bone shards between shelves 2 and 3
  put(42, 20, 'j');
  put(44, 12, 'b');
  put(49, 23, 'i');
  put(51, 15, 'R');
  put(58, 18, 'b');
  put(60, 26, 'j');
  carve(63, 21, 36, 9); // the bone gallery, floor 30
  carve(99, 21, 1, 9);
  // secret: a soul cache behind the cracked wall at the gallery's west end
  carve(57, 28, 5, 2);
  fill(62, 28, 1, 2, 'X');
  for (const x of [58, 59, 60]) put(x, 29, 'o');
  put(64, 29, 'j');
  put(66, 25, 'w');
  put(75, 25, 'w');
  put(73, 29, 'h');
  put(66, 29, 'r');
  put(69, 29, '-');
  put(71, 29, 'c'); // skull crawler
  put(76, 29, 'r');
  put(68, 21, 'R');
  put(74, 21, '&');
  // climb to the brazier that feeds the tomb door
  carve(77, 13, 9, 8);
  carve(86, 13, 5, 6);
  fill(86, 19, 5, 2, '#'); // brazier ledge, top row 19
  fill(80, 27, 4, 1, '=');
  fill(84, 24, 4, 1, '=');
  fill(80, 21, 4, 1, '=');
  put(81, 26, 'i');
  put(88, 18, 'z'); // brazier (group crypt)
  put(79, 13, '&');
  put(84, 13, 'R');
  fill(92, 21, 2, 5, '#'); // lintel above the door
  put(92, 29, 'Q'); // tomb door (group crypt)
  put(90, 29, '3');
  put(94, 29, 't');
  put(96, 29, 'C'); // C1
  put(95, 21, 'L');

  // ---- S3 Bile Cistern --------------------------------------------------------------------------
  carve(100, 18, 56, 24);
  fill(99, 30, 5, 12, '#'); // entry ledge, top row 30
  fill(104, 39, 34, 3, '%'); // the bile lake
  fill(138, 29, 18, 13, '#'); // exit ledge, top row 29
  fill(107, 34, 3, 8, '#'); // I1
  fill(110, 34, 4, 1, 'K');
  fill(114, 34, 2, 8, '#'); // I2
  fill(119, 32, 3, 10, '#'); // I3
  fill(122, 32, 5, 1, 'K');
  fill(127, 32, 2, 10, '#'); // I4
  fill(132, 34, 5, 8, '#'); // I5
  put(135, 33, 'J'); // glowcap up to the exit ledge
  put(133, 33, 'F');
  fill(119, 28, 3, 1, '='); // roots up to the skeleton's shelf (double jump)
  fill(123, 25, 7, 1, '#'); // skeleton shelf
  put(126, 24, 'k');
  put(124, 24, 'o');
  put(128, 24, 'o');
  put(101, 29, '4');
  put(103, 29, 'i');
  put(108, 33, 'i');
  put(120, 31, 'j');
  put(112, 18, 'b');
  put(117, 18, '&');
  put(131, 18, 'R');
  put(142, 28, 'i');
  put(146, 28, 't');
  put(149, 28, '-');
  put(151, 28, 'M'); // Digby the gravedigger
  put(153, 28, 'F');
  carve(156, 23, 4, 6); // passage into the hall, floor 29
  put(157, 28, 'C'); // C2

  // ---- S4 Brazier Hall ----------------------------------------------------------------------------
  carve(160, 8, 44, 32); // the hall, floor 40
  fill(160, 29, 8, 2, '#'); // entry ledge L0, top row 29
  fill(175, 39, 15, 1, '^'); // bone-shard pit in the middle of the floor
  put(164, 39, 'a'); // brazier 1: the floor below the entry
  put(161, 39, 'r');
  put(167, 39, '-');
  put(170, 39, 'h');
  put(173, 39, 'r');
  put(192, 39, 'r');
  put(196, 39, '-');
  put(193, 16, 'w');
  fill(167, 37, 4, 1, '=');
  fill(171, 34, 4, 1, '=');
  fill(168, 31, 3, 1, '=');
  fill(170, 26, 4, 1, '=');
  fill(175, 23, 4, 1, '=');
  fill(180, 21, 6, 1, '#'); // high platform
  put(182, 20, 'a'); // brazier 2
  fill(190, 23, 4, 1, 'K');
  fill(197, 25, 7, 1, '#'); // east ledge
  put(201, 24, 'a'); // brazier 3
  put(198, 24, 'i');
  // ways back up on the east side
  fill(198, 37, 3, 1, '=');
  fill(194, 34, 3, 1, '=');
  fill(198, 31, 3, 1, '=');
  fill(193, 28, 3, 1, '=');
  carve(204, 36, 2, 4);
  put(204, 39, 'A'); // the great tomb door (group hall)
  put(184, 30, 's'); // the shade haunting the hall
  put(196, 8, 'b');
  put(162, 28, 'i');
  put(166, 8, '&');
  put(187, 8, 'R');
  put(178, 8, '&');
  // secret: hollow west wall high up → wooden heart
  fill(175, 18, 4, 1, '=');
  fill(168, 16, 4, 1, '=');
  fill(161, 15, 5, 1, '=');
  fill(158, 13, 2, 2, 'X');
  carve(151, 11, 7, 4);
  put(153, 13, 'H');
  put(155, 14, 'o');
  put(156, 14, 'o');
  put(152, 14, 'j');

  // ---- S5 Root Chasm --------------------------------------------------------------------------------
  carve(206, 36, 8, 4);
  carve(214, 9, 12, 31); // floor 40
  put(208, 39, '5');
  put(210, 37, 'f'); // fireflies
  put(219, 36, 'f');
  put(215, 39, 'u'); // lumen pod: spores rise
  fill(221, 39, 5, 1, '^');
  fill(219, 37, 5, 1, '=');
  fill(214, 34, 4, 1, '=');
  fill(220, 31, 6, 1, '=');
  fill(214, 20, 4, 9, '#'); // chimney: west pillar, top 20
  fill(222, 21, 4, 8, '#'); // chimney: east pillar, top 21
  put(216, 33, 'i');
  put(224, 20, '$'); // big glowcap
  put(215, 19, 'u');
  put(217, 19, 'i');
  fill(214, 17, 3, 1, '=');
  fill(218, 14, 4, 1, '=');
  put(220, 9, 'b');
  put(223, 9, '&');

  // ---- S6 Flooded Crypt --------------------------------------------------------------------------------
  carve(226, 9, 14, 4); // floor 13
  put(230, 12, 'C'); // C3
  put(233, 9, 'L');
  carve(240, 9, 33, 26); // floor 35
  fill(240, 24, 26, 11, '~');
  fill(240, 13, 5, 1, '#'); // W1
  put(243, 12, '6');
  fill(246, 18, 4, 1, '#'); // W2: drop off its east end into the water
  fill(252, 9, 3, 20, '#'); // first crypt wall: dive under
  fill(261, 9, 3, 22, '#'); // second, deeper
  fill(266, 22, 7, 13, '#'); // way out, top row 22
  put(250, 34, 'F');
  put(243, 34, 'h');
  put(255, 34, 't');
  put(258, 34, 'F');
  put(264, 34, 'F');
  put(257, 21, 'f');
  put(245, 9, '&');
  put(256, 9, 'R');
  put(265, 9, '&');
  put(267, 21, 'g');
  put(269, 21, 'c'); // a crawler waits where you climb out
  put(271, 21, 'j');

  // ---- S7 Lantern Gauntlet ----------------------------------------------------------------------------------
  carve(273, 15, 6, 6); // floor 21: one step up, so the crawler below turns back
  put(275, 20, 'C'); // C4
  carve(279, 15, 22, 17); // floor 32
  fill(279, 29, 18, 3, '%');
  fill(279, 22, 5, 1, 'K');
  fill(286, 20, 3, 1, '='); // then an 8-tile gap: dash or Ember Wings
  fill(297, 22, 4, 10, '#'); // landing
  for (const x of [281, 288, 295]) put(x, 15, 'L');
  put(298, 21, 'i');
  put(291, 17, 'q'); // a second shade, keeping to the bile chasm
  put(284, 15, 'b');
  carve(301, 12, 10, 10); // the lantern chamber, floor 22
  put(301, 21, 'i');
  put(303, 21, '@');
  put(305, 21, 'Z'); // Pip, once the lantern burns
  put(308, 21, 'E');
  put(302, 12, '&');
  put(310, 21, 'j');

  void row;
  return g.map((r) => r.join(''));
}

export const CATACOMBS_MAP = build();
