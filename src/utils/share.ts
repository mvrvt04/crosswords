import type { Puzzle } from '../model/types';
import type { Mark } from '../state/reducer';

export interface ShareInput {
  puzzle: Puzzle;
  /** Already translated: "Solved in 4:12 · 0 checks · 0 reveals". */
  headline: string;
  marks: Record<number, Mark>;
  url?: string;
}

/**
 * The text a player can paste anywhere after solving: a headline, the stats
 * and a small emoji map of the grid (revealed squares in amber). Grids wider
 * than 15 are summarised in one line to keep the paste readable.
 */
export function buildShareText({ puzzle, marks, headline, url }: ShareInput): string {
  const lines = [`Apollo Crossword · ${puzzle.title}`, headline];
  if (puzzle.width <= 15) {
    lines.push('');
    for (let row = 0; row < puzzle.height; row++) {
      let line = '';
      for (let col = 0; col < puzzle.width; col++) {
        const cell = puzzle.cells[row * puzzle.width + col];
        line += cell.block ? '⬛' : marks[cell.id] === 'revealed' ? '🟧' : '🟩';
      }
      lines.push(line);
    }
  }
  if (url) lines.push('', url);
  return lines.join('\n');
}

/** Copy text to the clipboard, with a fallback for older browsers and insecure origins. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
