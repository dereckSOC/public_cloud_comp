/**
 * Shared CSS animation strings for injection via <style> tags in components.
 * Previously duplicated in questcard.js and feedbackCard.js.
 */

/** Gentle floating animation used on quest and feedback cards. */
export const FLOAT_ANIMATION_CSS = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
  }
  .float-animation {
    animation: float 3s ease-in-out infinite;
  }
`;
