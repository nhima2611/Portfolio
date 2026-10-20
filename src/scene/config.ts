/** Scene tuning in one place: colours, light levels and camera stops. */
export const COLORS = {
  room: '#12151d',
  lamp: '#ffb46b',
  screen: '#7cc7ff',
  lampOff: '#2a2620',
} as const;

/** Physically based light intensities (three r155+). */
export const LIGHTS = {
  hemisphere: 1.1,
  fill: 0.8,
  spot: 7.5,
  lampGlow: 1.6,
  shelf: 1.1,
  screenGlow: 2.2,
} as const;

export interface CameraStop {
  position: [number, number, number];
  target: [number, number, number];
  /** Horizontal view offset as a fraction of width. Negative = object sits right of centre (panel on the left). */
  shift: number;
}

/** One stop per <section data-stop>. Order must match the sections. */
export const STOPS: CameraStop[] = [
  { position: [2.05, 1.8, 2.35], target: [0.12, 0.98, -0.05], shift: -0.12 }, // intro
  { position: [-0.36, 1.02, 0.5], target: [-0.47, 0.88, -0.1], shift: 0.2 }, // laptop
  { position: [0.15, 1.1, 0.6], target: [0.15, 1.08, -0.26], shift: -0.2 }, // monitor
  { position: [0.95, 1.62, 0.8], target: [1.3, 1.58, -0.35], shift: -0.2 }, // bookshelf (both shelves, launcher on top)
  { position: [0.42, 1.02, 0.92], target: [0.92, 0.83, 0.33], shift: -0.2 }, // model jet, parked at the right end of the desk runway
  { position: [0.63, 1.1, 0.34], target: [0.56, 0.78, 0.06], shift: -0.2 }, // phone
];

export const INTRO_CAMERA: [number, number, number] = [3.3, 2.35, 3.9];

/**
 * Airshow camera: one steady wide shot framing the whole flight area (left wall to the base turn on the right, desk to ceiling).
 * It only leans SHOW_TRACKING of the way toward the jet, so the frame stays calm while still feeling alive.
 */
export const SHOW_CAMERA: Pick<CameraStop, 'position' | 'target'> = { position: [0.75, 1.95, 4.6], target: [0.6, 1.35, 0.5] };
export const SHOW_TRACKING = 0.2;

/** Section ids, used by click-to-scroll on objects. */
export const SECTION_IDS = ['intro', 'about', 'experience', 'toolkit', 'off-duty', 'contact'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_LABELS: Record<SectionId, string> = {
  intro: 'Intro',
  about: 'About',
  experience: 'Experience',
  toolkit: 'Toolkit',
  'off-duty': 'Off duty',
  contact: 'Contact',
};

/** Stop index of the model jet; clicking the jet launches it when the camera is already there. */
export const JET_STOP = SECTION_IDS.indexOf('off-duty');

export const DESK_TOP = 0.775;
