import type { RawCrossword } from '../model/types';
import example from './crossword.json';
import miniMonday from './puzzles/mini-monday.json';
import miniTuesday from './puzzles/mini-tuesday.json';
import miniWednesday from './puzzles/mini-wednesday.json';
import miniThursday from './puzzles/mini-thursday.json';
import miniFriday from './puzzles/mini-friday.json';
import miniSaturday from './puzzles/mini-saturday.json';
import miniLunedi from './puzzles/mini-lunedi.json';
import miniMartedi from './puzzles/mini-martedi.json';
import miniMercoledi from './puzzles/mini-mercoledi.json';

/**
 * Puzzles every installation starts with. The server seeds its database from
 * this list on first boot and the offline (localStorage) mode serves them
 * directly, so a fresh deployment always has something to play.
 */
export interface SeedPuzzle {
  id: string;
  data: RawCrossword;
}

export const SEED_PUZZLES: SeedPuzzle[] = [
  { id: 'example-crossword', data: example as RawCrossword },
  { id: 'mini-monday', data: miniMonday as RawCrossword },
  { id: 'mini-tuesday', data: miniTuesday as RawCrossword },
  { id: 'mini-wednesday', data: miniWednesday as RawCrossword },
  { id: 'mini-thursday', data: miniThursday as RawCrossword },
  { id: 'mini-friday', data: miniFriday as RawCrossword },
  { id: 'mini-saturday', data: miniSaturday as RawCrossword },
  { id: 'mini-lunedi', data: miniLunedi as RawCrossword },
  { id: 'mini-martedi', data: miniMartedi as RawCrossword },
  { id: 'mini-mercoledi', data: miniMercoledi as RawCrossword },
];
