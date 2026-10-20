import { experience, profile, toolkit } from '../content/profile';
import { monthsSince } from '../lib/date';
import { blip } from '../lib/sound';
import { launchJetWithSound } from './interaction';
import { sceneState, toggleLamp } from './state';

/**
 * The laptop terminal: a tiny shell the About panel's input types into.
 * The laptop redraws its screen whenever `terminal.version` changes.
 */
export type Line = [color: string, text: string];

const PROMPT = '#7cc7ff';
const TEXT = '#eceae4';
const DIM = '#9aa0ad';
const OK = '#c3e88d';
const WARN = '#ffb46b';

function bootLines(): Line[] {
  const years = (monthsSince(profile.startedAt.year, profile.startedAt.month) / 12).toFixed(1);
  return [
    [PROMPT, '$ whoami'],
    [TEXT, profile.name],
    [DIM, `${profile.title} · HCMC`],
    ['', ''],
    [PROMPT, '$ cat focus.txt'],
    ...profile.focus.map((f): Line => [TEXT, f]),
    ['', ''],
    [PROMPT, '$ uptime'],
    [OK, `${years} years building for the web`],
  ];
}

export const terminal = {
  lines: bootLines(),
  input: '',
  version: 0,
  /** Keys pressed on the 3D keyboard: instance index → press time (ms). */
  pressed: new Map<number, number>(),
};

/** Prints lines without a command, e.g. when something on the desk is clicked. */
export function say(lines: Line[]) {
  terminal.lines = [...terminal.lines, ...lines].slice(-60);
  terminal.version++;
}

export function setTerminalInput(value: string) {
  terminal.input = value;
  terminal.version++;
}

const COMMANDS = 'help whoami experience toolkit contact lamp jet date clear';

function respond(cmd: string, args: string): Line[] | 'clear' {
  switch (cmd) {
    case '':
      return [];
    case 'help':
    case 'ls':
      return [[DIM, 'commands:'], [TEXT, 'whoami  experience  toolkit  contact'], [TEXT, 'lamp  jet  date  clear']];
    case 'whoami':
      return [[TEXT, profile.name], [DIM, `${profile.title} · ${profile.location}`]];
    case 'experience':
      return experience.map((j): Line => [TEXT, `${j.from.slice(0, 4)}–${j.to ? j.to.slice(0, 4) : 'now '}  ${j.company}`]);
    case 'toolkit':
      return [[OK, toolkit.flatMap((g) => g.items.filter((t) => t.core).map((t) => t.name)).join(' · ')], [DIM, '+ more on the bookshelf']];
    case 'contact':
    case 'hire':
    case 'hire-me':
      return [[OK, profile.email], [DIM, profile.linkedin.replace('https://www.', '')]];
    case 'lamp':
      blip('switch');
      return [[WARN, `lamp: ${toggleLamp() ? 'on' : 'off'}`]];
    case 'jet':
    case 'launch':
      if (sceneState.reducedMotion) return [[DIM, 'reduced motion is on; the jet stays parked']];
      if (!launchJetWithSound()) return [[DIM, 'already airborne']];
      return [[WARN, '✈ cleared for takeoff'], [DIM, 'watch for the falling leaf']];
    case 'date':
      return [[TEXT, new Date().toLocaleString('en-GB', { timeZone: profile.timeZone, dateStyle: 'medium', timeStyle: 'short' })]];
    case 'sudo':
      return [[WARN, `nice try. ${args ? `"${args}" ` : ''}needs an interview first`], [DIM, 'try: contact']];
    case 'clear':
      return 'clear';
    default:
      return [[WARN, `command not found: ${cmd.slice(0, 24)}`], [DIM, `try: ${COMMANDS.split(' ').slice(0, 4).join(', ')}…`]];
  }
}

/** Runs a command, updates the screen and returns the output as plain text (for a live region). */
export function runCommand(raw: string): string {
  const input = raw.trim();
  const [cmd = '', ...rest] = input.split(/\s+/);
  const out = respond(cmd.toLowerCase(), rest.join(' '));
  blip('enter');
  if (out === 'clear') {
    terminal.lines = [];
  } else {
    terminal.lines = [...terminal.lines, [PROMPT, `$ ${input}`] as Line, ...out].slice(-60);
  }
  terminal.input = '';
  terminal.version++;
  return out === 'clear' ? 'Cleared' : out.map(([, t]) => t).join('. ');
}

/* Keyboard layout of the 3D laptop: rows from the back (numbers) to the front (space bar). */
const ROW_KEYS = ['1234567890-=', 'qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./'];
export const KEY_COLS = 13;
export const KEY_ROWS = 5;
export const SPACE_FROM = 4;
export const SPACE_TO = 8;

/** Instance index in the keyboard InstancedMesh for grid cell (r, c); the space bar is the last instance. */
export function keyIndex(r: number, c: number): number {
  return r * KEY_COLS + c;
}
export const SPACE_INDEX = keyIndex(KEY_ROWS - 1, 0) + SPACE_FROM;

function keyFor(key: string): number {
  if (key === ' ') return SPACE_INDEX;
  if (key === 'Enter') return keyIndex(2, 12);
  if (key === 'Backspace') return keyIndex(0, 12);
  const k = key.toLowerCase();
  for (let r = 0; r < ROW_KEYS.length; r++) {
    const c = ROW_KEYS[r].indexOf(k);
    if (c >= 0) return keyIndex(r, c);
  }
  return keyIndex(KEY_ROWS - 1, key.length % SPACE_FROM);
}

export function pressKey(key: string) {
  if (key.length > 1 && key !== 'Enter' && key !== 'Backspace' && key !== ' ') return;
  terminal.pressed.set(keyFor(key), performance.now());
  if (key !== 'Enter') blip('key');
}
