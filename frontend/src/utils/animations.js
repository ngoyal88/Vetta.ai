/**
 * Centralized motion variants and transition config.
 * All durations respect prefers-reduced-motion when used with Framer Motion's useReducedMotion().
 */

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.25, ease: 'easeOut' },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

export const slidePhase = {
  voice: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.2 },
  },
  dsa: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { duration: 0.2 },
  },
};

/** Page transition: fade + slight Y. Use with AnimatePresence on route change. */
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

/** Hover: 150ms. Use for scale(1.02) or border glow, not both. */
export const hoverTransition = { duration: 0.15, ease: 'easeOut' };

/** Accordion: height auto for expand/collapse. Use with AnimatePresence + motion.div. */
export const accordionVariants = {
  closed: { height: 0, opacity: 0 },
  open: { height: 'auto', opacity: 1 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
};

/** Score reveal: use with custom hook or motion.value for count-up 0 → value over 800ms. */
export const scoreRevealDuration = 0.8;
export const scoreRevealEase = [0.4, 0, 0.2, 1];
