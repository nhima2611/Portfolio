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
  { position: [0.95, 1.55, 0.75], target: [1.3, 1.5, -0.35], shift: -0.2 }, // bookshelf
  { position: [1.08, 1.92, 0.12], target: [1.35, 1.85, -0.38], shift: -0.2 }, // model jet
  { position: [0.36, 1.12, 0.52], target: [0.42, 0.78, 0.22], shift: -0.2 }, // phone
];

export const INTRO_CAMERA: [number, number, number] = [3.3, 2.35, 3.9];

/** Wide shot the camera pulls back to while the model jet laps the room. */
export const FLIGHT_CAMERA: Pick<CameraStop, 'position' | 'target'> = { position: [2.6, 2.25, 2.9], target: [0.4, 1.9, 0] };

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
