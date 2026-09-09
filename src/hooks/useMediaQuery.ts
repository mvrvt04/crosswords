import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    // Some environments change emulated device metrics without firing a
    // media-query change event; a resize always follows, so re-check then.
    window.addEventListener('resize', update);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, [query]);
  return matches;
}

/**
 * Touch-first devices: phones and tablets without a hardware keyboard.
 * `pointer: coarse` is the primary signal; touch points on a narrow screen
 * cover browsers that emulate touch without changing the pointer type.
 */
export function useCoarsePointer(): boolean {
  const coarse = useMediaQuery('(pointer: coarse)');
  const narrow = useMediaQuery('(max-width: 900px)');
  const touchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return coarse || (narrow && touchPoints);
}
