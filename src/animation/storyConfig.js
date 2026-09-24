/**
 * The six chapters of the story, as ranges of the single normalised value
 * `storyProgress` (0 → 1). Transformation, assembly and the final
 * presentation get the most room. Titles and captions live in
 * src/i18n/strings.js (scene.<id>.title / scene.<id>.caption).
 */
export const SCENES = [
  { id: 'ingredients', num: '01', caption: true, start: 0.0, end: 0.1 },
  { id: 'fruit', num: '02', caption: true, start: 0.1, end: 0.25 },
  { id: 'transformation', num: '03', caption: true, start: 0.25, end: 0.5 },
  { id: 'cream', num: '04', caption: true, start: 0.5, end: 0.64 },
  { id: 'assembly', num: '05', caption: true, start: 0.64, end: 0.82 },
  { id: 'fruttino', num: '06', caption: false, start: 0.82, end: 1.0 },
];

/**
 * Seconds for the autoplay to run the whole story once. Paced so that even
 * even the shortest chapter keeps its title fully readable for ~2.8 seconds.
 */
export const AUTOPLAY_DURATION = 30;

/** Pause on the opening composition before the story starts playing. */
export const AUTOPLAY_START_DELAY = 700;

/** Chapter captions: fade length and margins, in story progress units. */
export const CAPTION_TIMING = { fade: 0.005, lead: 0.002, tail: 0.004 };

/** Keyframe times of the camera shots (see CameraController.SHOTS). */
export const SHOT_TIMES = [0.012, 0.075, 0.2, 0.3, 0.4, 0.47, 0.585, 0.665, 0.8, 0.915, 1.0];

/** Story channels: [name, start, end, ease]. Each goes 0 → 1 inside its window. */
export const CHANNELS = [
  ['light', 0.012, 0.075, 'power2.inOut'],   // flat illustration → studio light
  ['spin', 0.1, 0.4, 'sine.inOut'],          // halves turn to show their volume
  ['emerge', 0.105, 0.235, 'none'],
  ['scoop', 0.11, 0.27, 'none'],             // the spoon scoops all the pulp out of both halves          // icons become 3D ingredients, pulp emerges
  ['converge', 0.25, 0.43, 'none'],          // ingredients flow to the centre
  ['approach', 0.27, 0.45, 'sine.inOut'],    // halves come closer
  ['split', 0.425, 0.465, 'none'],           // the mass divides in three
  ['absorb', 0.46, 0.5, 'none'],             // each volume fills a half
  ['morph', 0.475, 0.56, 'none'],            // citrus halves → Fruttino caps
  ['churn', 0.465, 0.545, 'none'],           // the core of the pulp (sugar mixed in) is worked until white and creamy
  ['cream', 0.535, 0.62, 'none'],            // the white pulp spreads into the creamy band
  ['compress', 0.655, 0.765, 'none'],        // caps close on the cream
  ['warm', 0.8, 0.9, 'sine.inOut'],          // sky → beige still life
  ['settle', 0.84, 0.905, 'none'],           // lands on the surface
  ['orange', 0.845, 0.95, 'none'],           // the whole fruit joins the scene
];
