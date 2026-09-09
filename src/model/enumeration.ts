import type { Separator } from './types';

/**
 * Turn an enumeration such as "(5,2)" or "(5-4)" into the list of word
 * breaks inside the answer, so the grid can draw them.
 *
 * If the enumeration does not add up to the answer length we return no
 * separators rather than drawing them in the wrong place.
 */
export function parseEnumeration(enumeration: string, answerLength?: number): Separator[] {
  const tokens = enumeration.match(/\d+|[,-]/g) ?? [];
  const separators: Separator[] = [];
  let position = 0;

  for (const token of tokens) {
    if (token === ',' || token === '-') {
      if (position > 0) {
        separators.push({ after: position - 1, kind: token === ',' ? 'space' : 'hyphen' });
      }
    } else {
      position += Number.parseInt(token, 10);
    }
  }

  if (answerLength !== undefined && position !== answerLength) return [];
  return separators;
}
