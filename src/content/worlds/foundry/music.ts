import type { MusicDef } from '../../../engine/audio';

/**
 * Ember Foundry: E phrygian dominant over a hammering bass — E, E, C(aug), F.
 * The melody strikes repeated notes like a smith at an anvil.
 */
export const foundryMusic: MusicDef = {
  bpm: 100,
  root: 52,
  scale: [0, 1, 4, 5, 7, 8, 10],
  bars: [0, 0, 5, 1, 0, 0, 5, 1],
  melody: [
    '0.0.3...2.1.0...',
    '0.0.3...4.5.4...',
    '4...2...0.....1.',
    '2.1.0...6.....5.',
    '7.7.5...4.3.4...',
    '0.0.3...4.5.7...',
    '4...6...4.2.1...',
    '2.1.0.......0...',
  ],
  lead: 'square',
  bass: 'triangle',
  sparkle: 0.04,
  drums: 'soft',
};

/** IRON WARDEN: A harmonic minor at a gallop — Am, Am, F, E — with a sawtooth lead. */
export const wardenMusic: MusicDef = {
  bpm: 152,
  root: 57,
  scale: [0, 2, 3, 5, 7, 8, 11],
  bars: [0, 0, 5, 4, 0, 0, 5, 4],
  melody: [
    '0.0.2.0.4.0.2.3.',
    '4.4.5.4.3.2.1.2.',
    '0.0.2.0.4.0.2.4.',
    '0.2.4.7.6...4...',
    '7.7.6.4.5.4.3.2.',
    '4.4.5.4.7.6.4.2.',
    '2.4.5.4.2.0.2.4.',
    '6.6.4.2.1.2.4...',
  ],
  lead: 'sawtooth',
  bass: 'square',
  drums: 'driving',
};
