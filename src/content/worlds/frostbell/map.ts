/**
 * Frostbell Spire — a frozen clocktower climbed from the station courtyard to the summit lantern.
 *
 *   S1  Courtyard (x 1-53, bottom)       station, Bellringer Hoot, frozen pond, yeti, the door bell
 *   S2  Base Hall (rows 107-127)          icicle run, spike pit, owl, ice shaft, crumbling bridge
 *   S3  Gearworks (rows 85-103)           gear platforms over spikes, gear lifts, secret heart
 *   S4  Windward Gallery (rows 63-81)     headwind, updraft through a crosswind, crumbling bridge
 *   S5  Bell Chamber (rows 41-59)         bell gate, pogo bells over spikes, sealed vent
 *   S6  Blizzard Crown (rows 0-37)        roof, gale-swept east flank, tunnel, west flank, lantern
 *
 * The level is carved out of solid masonry. `room` carves interior air (the tower's back wall is
 * painted behind it by the ambience entity), `sky` carves exterior air (the backdrop shows).
 */
const W = 124;
const H = 132;

const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('#'));
const inside: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('0'));

function fill(x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (j >= 0 && j < H && i >= 0 && i < W) g[j][i] = ch;
}
function mark(x: number, y: number, w: number, h: number, v: '0' | '1') {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) inside[j][i] = v;
}
function room(x: number, y: number, w: number, h: number) {
  fill(x, y, w, h, '.');
  mark(x, y, w, h, '1');
}
function sky(x: number, y: number, w: number, h: number) {
  fill(x, y, w, h, ' ');
  mark(x, y, w, h, '0');
}
const put = (x: number, y: number, ch: string) => (g[y][x] = ch);
/** Fill the open cells (air only) of a rectangle with a field symbol such as a gust. */
function field(x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j][i] === '.' || g[j][i] === ' ') g[j][i] = ch;
}

// ---- the shell ------------------------------------------------------------------------------
sky(1, 0, 53, 128); // courtyard and the open sky west of the tower
sky(1, 0, 122, 38); // sky above the tower roof
room(59, 107, 61, 21); // S2 base hall
room(59, 85, 61, 19); // S3 gearworks
room(59, 63, 61, 19); // S4 windward gallery
room(59, 41, 61, 19); // S5 bell chamber
room(54, 125, 5, 3); // the tower door
put(1, 0, '@'); // ambience: back wall + snowfall (must be the first entity in the map)

// =============================================================================================
// S1 — COURTYARD (floor row 128). Arrive by train, meet Hoot, slide the pond, ring the door bell.
// =============================================================================================
fill(1, 117, 5, 2, '#'); // station canopy
put(3, 119, 'L');
put(5, 127, 'T');
put(25, 127, 'r');
put(27, 127, '1');
put(30, 127, 'h');
put(32, 127, 'c');
put(34, 127, 's');
// the frozen pond: a shallow dip of ice
sky(36, 128, 10, 1);
fill(36, 129, 10, 1, 'I');
put(38, 126, 'o');
put(40, 125, 'o');
put(42, 126, 'o');
put(47, 127, 'w');
put(50, 127, 'Y');
// porch awning with banners and a lamp
fill(47, 120, 7, 1, '=');
put(48, 121, 'a');
put(51, 121, 'L');
put(53, 121, 'a');
put(52, 127, '2');
// the door bell and its gate (stays open once rung)
put(55, 125, 'b');
for (let y = 125; y <= 127; y++) put(57, y, 'g');

// =============================================================================================
// S2 — BASE HALL (rows 107-127). Tier 1 runs east under a low ceiling, the east shaft climbs,
// tier 2 runs back west over a crumbling bridge, the west shaft climbs into the gearworks.
// =============================================================================================
fill(63, 117, 46, 2, '#'); // tier-2 floor / tier-1 ceiling (x 63-108)
put(61, 127, 'C');
put(64, 119, 'a');
put(66, 119, 'L');
put(76, 122, 'F');
// icicle run
put(71, 119, 'i');
put(76, 119, 'i');
put(81, 119, 'i');
// spike pit
room(85, 128, 5, 2);
fill(85, 129, 5, 1, '^');
put(87, 125, 'o');
// owl perched high at the far end
fill(105, 121, 3, 1, '#');
put(106, 120, 'O');
put(95, 119, 'a');
put(98, 119, 'L');
put(93, 127, 'k');
// east shaft
fill(110, 125, 4, 1, '=');
fill(116, 122, 4, 1, 'I');
fill(109, 119, 5, 1, '=');
put(118, 120, 'o');
put(111, 116, 'o');
// secret: a cracked wall at the foot of the east shaft
room(121, 125, 2, 3);
fill(120, 125, 1, 3, 'X');
mark(120, 125, 1, 3, '1');
put(121, 127, 'o');
put(122, 127, 'o');
put(122, 126, 'o');
// tier 2, east to west
put(104, 107, 'L');
put(101, 116, 'k');
fill(88, 117, 12, 1, 'I'); // slick floor
fill(89, 107, 4, 1, 'v');
put(94, 107, 'i');
put(80, 107, 'B');
put(85, 116, 'c');
put(77, 110, 'Z');
put(74, 107, 'L');
fill(65, 117, 6, 1, 'K'); // crumbling bridge over a hole into tier 1
room(65, 118, 6, 1);
put(68, 113, 'o');
// west shaft up into the gearworks
room(59, 104, 4, 3);
fill(59, 114, 4, 1, '=');
fill(59, 111, 4, 1, '=');
fill(59, 108, 4, 1, '=');
fill(59, 105, 4, 1, '=');

// =============================================================================================
// S3 — GEARWORKS (rows 85-103, floor 104). Gear platforms over spikes, then a stair of lifts.
// =============================================================================================
fill(59, 85, 11, 11, '#'); // masonry block hiding the secret chamber
room(60, 89, 8, 3);
fill(68, 90, 2, 2, 'X');
mark(68, 90, 2, 2, '1');
put(61, 91, 'H');
put(64, 91, 'o');
put(66, 90, 'o');
fill(70, 92, 6, 1, '#'); // ledge before the cracked wall
put(66, 103, 'C');
put(64, 98, 'Z');
// spike pit crossed on gear platforms
room(73, 104, 24, 2);
fill(73, 105, 24, 1, '^');
put(74, 101, 'm');
put(84, 101, ';');
put(87, 99, 'M');
put(95, 99, ';');
put(80, 99, 'o');
put(91, 97, 'o');
// upper walkway: crumbling ice then beams, leading back west to the secret
fill(76, 92, 10, 1, 'K');
fill(86, 92, 23, 1, '=');
put(92, 93, 'B');
put(80, 88, 'z');
put(100, 88, 'z');
put(89, 87, 'Z');
put(104, 98, 'Z');
put(72, 99, 'z');
put(78, 85, 'L');
put(97, 85, 'L');
// a stair of gear lifts up into the gallery
put(106, 103, 'n');
put(106, 97, ';');
put(110, 99, 'N');
put(110, 92, ';');
put(114, 94, 'n');
put(114, 85, ';');
room(114, 82, 4, 3); // hole in the ceiling
fill(119, 87, 1, 7, '<');
put(102, 103, 'k');
put(117, 103, 'c');
put(107, 95, 'o');
put(111, 90, 'o');

// =============================================================================================
// S4 — WINDWARD GALLERY (rows 63-81, floor 82). Broken windows let the blizzard in.
// =============================================================================================
sky(98, 64, 5, 5); // broken windows
sky(80, 64, 4, 4);
sky(62, 73, 3, 5);
put(110, 81, 'C');
put(106, 81, '3');
// headwind on safe floor
field(91, 74, 14, 8, '}');
fill(95, 70, 3, 1, '#');
put(96, 69, 'O');
put(108, 63, 'j');
put(104, 63, 'L');
put(112, 63, 'a');
put(86, 63, 'a');
put(70, 63, 'j');
put(88, 63, 'j');
put(92, 63, 'L');
// spike pit under an updraft, a crosswind over its top, then a crumbling bridge
room(70, 82, 13, 2);
fill(70, 83, 13, 1, '^');
fill(74, 66, 4, 17, 'W');
fill(59, 69, 6, 1, '#');
fill(65, 69, 8, 1, 'K');
field(62, 63, 21, 6, '}');
put(84, 81, 'o');
put(75, 72, 'o');
put(75, 68, 'o');
// lower west nook, where a tumble from the bridge lands
put(61, 81, 'k');
put(66, 81, 'o');
put(68, 81, 'c');
// west shaft up into the bell chamber
room(59, 60, 4, 3);
fill(59, 66, 3, 1, '=');
fill(59, 63, 3, 1, '=');
fill(59, 61, 4, 1, '=');

// =============================================================================================
// S5 — BELL CHAMBER (rows 41-59, floor 60). Ring bells to lift ice gates; bounce across bells.
// =============================================================================================
put(65, 59, 'f');
put(63, 41, 'A');
put(68, 59, '4');
put(71, 59, 'Y');
// bell gate A
put(74, 55, 'd');
fill(79, 41, 2, 15, '#');
for (let y = 56; y <= 59; y++) put(80, y, 'e');
put(77, 59, 'c');
// pogo bells over spikes
room(85, 60, 19, 2);
fill(85, 61, 19, 1, '^');
put(89, 57, 'Q');
put(95, 56, 'Q');
put(101, 56, 'Q');
fill(106, 41, 2, 15, '#');
for (let y = 56; y <= 59; y++) put(107, y, 'q');
put(92, 41, 'a');
put(98, 41, 'a');
put(84, 41, 'L');
put(104, 41, 'L');
// sealed vent: spring into an updraft, ring the grate bell, ride up onto the roof
put(116, 59, 'J');
fill(115, 33, 4, 22, 'W');
room(115, 38, 4, 3);
fill(115, 38, 4, 2, 'W');
for (let x = 115; x <= 118; x++) put(x, 40, 'u');
put(114, 41, 'p');
put(110, 59, '5');
put(112, 59, 's');
put(119, 59, 'r');

// =============================================================================================
// S6 — BLIZZARD CROWN (rows 0-37, roof row 38)
// =============================================================================================
fill(54, 14, 3, 24, '#'); // west buttress: the gale can't fling you off the tower
fill(120, 22, 3, 16, '#'); // east buttress
put(110, 37, 'C');
put(106, 37, 'r');
put(113, 37, '6');
// spire core with a tunnel through its middle and a crawlway at its foot
fill(82, 11, 13, 27, '#');
room(82, 24, 13, 2);
room(82, 36, 13, 2);
put(88, 25, 'o');
put(86, 37, 'o');
put(88, 17, 'V'); // the great frozen clock, set into the spire
put(88, 31, 'V');
// east flank: ledges in an outward gale
fill(100, 35, 5, 1, '#');
fill(106, 32, 5, 1, 'I');
put(110, 31, '#'); // parapet: stops a slide off the icy ledge
fill(100, 29, 5, 1, '#');
fill(95, 27, 3, 1, '#');
field(96, 27, 17, 8, ')');
fill(111, 25, 3, 1, '#');
put(112, 24, 'O');
put(108, 30, 'o');
put(102, 27, 'o');
// west flank: balcony, updraft through a westerly gale, crumbling bridge, spring to the crown
fill(66, 26, 16, 1, '#');
fill(60, 15, 3, 11, 'W');
fill(57, 19, 1, 4, '>');
fill(63, 16, 11, 1, 'K');
fill(74, 16, 5, 1, '#');
put(76, 15, 'J');
field(57, 13, 25, 9, '{');
put(61, 19, 'o');
put(68, 14, 'o');
put(77, 8, 'o');
// recovery ladder from the west roof back up to the balcony
fill(61, 35, 3, 1, '=');
fill(65, 32, 3, 1, '=');
fill(61, 29, 3, 1, '=');
put(70, 37, 'k');
put(74, 37, 'w');
// the crown: lantern platform with battlements and a great bell under its eave
fill(79, 10, 22, 1, '#');
put(79, 9, '#');
put(100, 9, '#');
put(88, 9, 'E');
put(97, 11, 'A');
put(80, 11, 'a');
put(83, 9, 'c');
put(93, 9, 'c');

export const FROSTBELL_MAP: string[] = g.map((r) => r.join(''));
/**
 * Back-wall mask: '1' interior air, '2' interior but solid (back wall painted, no windows there),
 * '0' outdoors (the sky backdrop shows).
 */
export const FROSTBELL_INTERIOR: string[] = inside.map((r, y) => r.map((v, x) => (v === '1' && (g[y][x] === '#' || g[y][x] === 'I') ? '2' : v)).join(''));
