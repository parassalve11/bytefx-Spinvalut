/**
 * Draw modes. Both share the reel and the same selection; only the length of
 * the spin differs. Kept out of `useDraw` so plain components (ModeTabs) can
 * read the labels without pulling in the whole hook.
 */
export const MODES = {
  quick: {
    id: "quick",
    label: "Quick Draw",
    hint: "Fast spin, single winner.",
    duration: 4.8,
    minTravel: 42, // cards to travel, regardless of how small the pool is
  },
  grand: {
    id: "grand",
    label: "Grand Finale",
    hint: "Longer build-up for the headline prize.",
    duration: 7.4,
    minTravel: 84,
  },
};

export default MODES;
