// One scroll position -> one complete frame. No timers, inertia or autoplay.
import { CIRCLE_POINTS } from './story-geometry.mjs';

export const NODE_IDS = ['goal', 'milestones', 'network', 'prepare', 'meeting', 'recap', 'follow'];
export const POINTS = [
  [500, 90], [500, 285], ...CIRCLE_POINTS,
];
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const mix = (a, b, t) => a + (b - a) * t;
export const phase = (p, from, to) => clamp((p - from) / (to - from));
export const APPLE_EASE = [0.4, 0, 0.25, 1];
// Solve the Bezier's x coordinate before evaluating y, as CSS easing does.
export function appleEase(input) {
  const x = clamp(Number.isFinite(input) ? input : 0);
  if (x === 0 || x === 1) return x;
  let low = 0, high = 1;
  for (let i = 0; i < 24; i++) {
    const t = (low + high) / 2, u = 1 - t;
    const at = 3 * u * u * t * APPLE_EASE[0] + 3 * u * t * t * APPLE_EASE[2] + t * t * t;
    if (at < x) low = t; else high = t;
  }
  const t = (low + high) / 2;
  return 3 * (1 - t) * t * t + t * t * t;
}
export const ease = appleEase;

export const REVEALS = [0, .085, .21, .535, .615, .695, .775];
export const PATH_WINDOWS = [
  [.025, .145], [.13, .27], [.50, .58], [.58, .66],
  [.66, .74], [.74, .82], [.82, .90],
];
export const SCENE_STARTS = [0, .15, .29, .535, .615, .695, .775, .91];

export function evaluateStory(input, { width, height, compact = false, introProgress = 1, cameraProgress }) {
  const p = clamp(Number.isFinite(input) ? input : 0);
  const entrance = clamp(Number.isFinite(introProgress) ? introProgress : 1);
  // One continuous pull-back: no per-station camera holds or easing restarts.
  const closeScale = Math.min(compact ? 1.08 : 1.34, width / 230, height / 220);
  const overviewScale = Math.min((width - (compact ? 30 : 110)) / 720, (height - 52) / 1040);
  const flight = clamp(Number.isFinite(cameraProgress) ? cameraProgress : p / .5);
  const zoom = ease(flight);
  const scale = mix(closeScale, overviewScale, zoom);
  const translateY = mix(height * .48 - 90 * closeScale, height * .43 - 480 * overviewScale, zoom);
  const opacity = REVEALS.map((start) => ease(phase(p, start, start + .045)));
  // The first flag is already present while the introduction scrolls away.
  opacity[0] = mix(.18, 1, ease(entrance));
  const traces = PATH_WINDOWS.map(([start, end]) => ease(phase(p, start, end)));
  const scene = SCENE_STARTS.reduce((active, start, i) => p >= start ? i : active, 0);
  const captions = SCENE_STARTS.map((start, i) => {
    // Hand off text sequentially so two headings never occupy the same space.
    const enter = i === 0 ? 1 : ease(phase(p, start - .014, start));
    const next = SCENE_STARTS[i + 1];
    const leave = next === undefined ? 1 : 1 - ease(phase(p, next - .028, next - .014));
    return enter * leave;
  });
  return {
    progress: p, entrance, flight, scene, zoom, scale,
    x: width / 2 - 500 * scale,
    // Give the closing caption room in short viewports without shrinking text.
    y: translateY - (height < 500 ? 12 * captions[7] : 0),
    opacity, traces, captions,
    captionLift: (1 - ease(phase(p, .29, .50))) * Math.min(compact ? 120 : 200, height * .28)
      + (compact ? (height <= 336 ? 24 : 20) : 16) * captions[7],
    labelOpacity: ease(phase(p, .045, .24)),
    // Preserve physical text size as the world zooms out, especially on phones.
    labelSize: (compact ? 12 : 14) / scale,
    // Keep a real screen-space gap below each icon at every zoom level.
    labelY: 55 + ((compact ? 6 : 7) + (compact ? 12 : 14) * .93) / scale,
  };
}
