const EASE_OUT = 'easeOut' as const;

/** Shared framer-motion transition — import instead of copying fadeUpTransition in pages. */
export const FADE_UP_TRANSITION = { duration: 0.45, ease: EASE_OUT };

export function fadeUpWithDelay(delay = 0) {
  return { ...FADE_UP_TRANSITION, delay };
}

export function getHeaderMotion(reduceMotion: boolean | null) {
  if (reduceMotion) return {};
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: EASE_OUT },
  };
}

export function getCardMotion(reduceMotion: boolean | null, delay = 0) {
  if (reduceMotion) return {};
  return {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.45, ease: EASE_OUT, delay },
  };
}
