import { experience, profile } from '../content/profile';
import { formatPeriod } from '../lib/date';
import { terminal } from './terminal';
import { roundRect } from './useCanvasTexture';

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SANS = '"Instrument Sans", system-ui, sans-serif';
const DISPLAY = '"Familjen Grotesk", system-ui, sans-serif';

type Token = [color: string, text: string];
const K = '#c792ea';
const S = '#c3e88d';
const P = '#82aaff';
const C = '#5f6a80';
const T = '#e6e9f2';
const CURSOR = '#ffb46b';

/** Editor lines are generated from `experience`, so the monitor never drifts from the content file. */
function editorLines(): Token[][] {
  const lines: Token[][] = [
    [[C, '// building for the web since ' + profile.startedAt.year]],
    [[K, 'export const '], [P, 'experience'], [T, ' = [']],
  ];
  for (const job of experience) {
    lines.push([[T, '  { '], [P, 'company'], [T, ': '], [S, `"${job.company}"`], [T, ',']]);
    lines.push([[T, '    '], [P, 'role'], [T, ': '], [S, `"${job.role}"`], [T, ',']]);
    lines.push([[T, '    '], [P, 'period'], [T, ': '], [S, `"${formatPeriod(job.from, job.to)}"`], [T, ' },']]);
  }
  lines.push([[T, '] '], [K, 'as const'], [T, ';']]);
  lines.push([[T, '']]);
  lines.push([[K, 'export const '], [P, 'focus'], [T, ' = ['], [S, '"Micro Frontends"'], [T, ', '], [S, '"Performance"'], [T, '];']]);
  return lines;
}

let totalChars = 0;

/** Number of characters in the editor, so the monitor knows when typing is finished. */
export function editorLength(): number {
  if (!totalChars) totalChars = editorLines().reduce((n, line) => n + line.reduce((m, [, t]) => m + t.length, 0), 0);
  return totalChars;
}

/** Draws the editor; `chars` limits how much has been "typed" so far (Infinity = all of it). */
export function drawEditor(ctx: CanvasRenderingContext2D, W: number, H: number, cursor: boolean, chars = Infinity) {
  ctx.fillStyle = '#0f1420';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#161c2b';
  ctx.fillRect(0, 0, W, 38);
  ctx.font = `400 17px ${MONO}`;
  ctx.fillStyle = '#9aa0ad';
  ctx.fillText('experience.ts', 64, 25);
  for (const [x, color] of [[20, '#ff6b6b'], [38, '#ffd36b']] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, 19, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const lines = editorLines();
  const lineH = Math.min(35, (H - 70) / lines.length);
  ctx.font = `400 ${Math.round(lineH * 0.6)}px ${MONO}`;
  const typing = chars < editorLength();
  let budget = chars;
  for (let i = 0; i < lines.length; i++) {
    const y = 72 + i * lineH;
    let x = 70;
    ctx.fillStyle = '#3a4357';
    ctx.textAlign = 'right';
    ctx.fillText(String(i + 1), 46, y);
    ctx.textAlign = 'left';
    for (const [color, text] of lines[i]) {
      const shown = text.slice(0, Math.max(0, budget));
      budget -= text.length;
      ctx.fillStyle = color;
      ctx.fillText(shown, x, y);
      x += ctx.measureText(shown).width;
      if (budget <= 0) break;
    }
    const last = typing ? budget <= 0 : i === lines.length - 1;
    if (last && (cursor || typing)) {
      ctx.fillStyle = CURSOR;
      ctx.fillRect(x + 3, y - lineH * 0.52, lineH * 0.28, lineH * 0.66);
    }
    if (typing && budget <= 0) break;
  }
}

const TERM_LINE = 40;
const TERM_ROWS = 12;

/** Terminal history from `terminal.ts`, newest at the bottom, with the live prompt last. */
export function drawTerminal(ctx: CanvasRenderingContext2D, W: number, H: number, cursor: boolean) {
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, W, H);
  ctx.font = `400 22px ${MONO}`;
  const rows = Math.min(TERM_ROWS, Math.floor((H - 24) / TERM_LINE));
  const history = terminal.lines.slice(-(rows - 1));
  history.forEach(([color, text], i) => {
    if (!text) return;
    ctx.fillStyle = color;
    ctx.fillText(text, 28, 48 + i * TERM_LINE, W - 56);
  });

  const y = 48 + history.length * TERM_LINE;
  const prompt = '$ ';
  const maxChars = Math.floor((W - 90) / ctx.measureText('m').width) - prompt.length;
  const input = terminal.input.length > maxChars ? '…' + terminal.input.slice(-(maxChars - 1)) : terminal.input;
  ctx.fillStyle = '#7cc7ff';
  ctx.fillText(prompt, 28, y);
  ctx.fillStyle = '#eceae4';
  ctx.fillText(input, 28 + ctx.measureText(prompt).width, y);
  if (cursor) {
    ctx.fillStyle = CURSOR;
    ctx.fillRect(28 + ctx.measureText(prompt + input).width + 2, y - 20, 12, 26);
  }
}

export function drawPhone(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#050608';
  roundRect(ctx, 0, 0, W, H, 44);
  ctx.fill();

  ctx.save();
  roundRect(ctx, 9, 9, W - 18, H - 18, 36);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1d2540');
  g.addColorStop(1, '#3a2a3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#050608';
  ctx.beginPath();
  ctx.arc(W / 2, 34, 9, 0, Math.PI * 2);
  ctx.fill();

  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: profile.timeZone });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eceae4';
  ctx.font = `700 96px ${DISPLAY}`;
  ctx.fillText(time, W / 2, 200);
  ctx.font = `400 22px ${SANS}`;
  ctx.fillStyle = '#c9ccd6';
  ctx.fillText(profile.location, W / 2, 240);

  ctx.fillStyle = 'rgba(255,255,255,.14)';
  roundRect(ctx, 24, 300, W - 48, 150, 24);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = CURSOR;
  ctx.font = `600 20px ${MONO}`;
  ctx.fillText('NEW MESSAGE', 48, 345);
  ctx.fillStyle = '#eceae4';
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText('Got a complex problem?', 48, 385);
  ctx.fillStyle = '#c9ccd6';
  ctx.font = `400 21px ${SANS}`;
  ctx.fillText(profile.email, 48, 422);

  ctx.fillStyle = 'rgba(255,255,255,.6)';
  roundRect(ctx, W / 2 - 60, H - 34, 120, 6, 3);
  ctx.fill();
  ctx.restore();
}

export function drawSpine(ctx: CanvasRenderingContext2D, W: number, H: number, label: string, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(0, 30, W, 4);
  ctx.fillRect(0, H - 34, W, 4);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#f3efe6';
  ctx.font = `600 30px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 2, H - 90);
  ctx.restore();
}
