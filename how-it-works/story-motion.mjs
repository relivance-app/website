// One scroll position -> one complete frame. No timers, inertia or autoplay.
import { CIRCLE_POINTS } from './story-geometry.mjs';

export const NODE_IDS = ['goal', 'milestones', 'network', 'prepare', 'meeting', 'recap', 'follow'];
export const POINTS = [
  [500, 90], [500, 285], ...CIRCLE_POINTS,
];
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const mix = (a, b, t) => a + (b - a) * t;
export const phase = (p, from, to) => clamp((p - from) / (to - from));
export const ease = (t) => t * t * (3 - 2 * t);

export const REVEALS = [0, .15, .29, .535, .615, .695, .775];
export const PATH_WINDOWS = [
  [.075, .185], [.215, .325], [.50, .58], [.58, .66],
  [.66, .74], [.74, .82], [.82, .90],
];
export const SCENE_STARTS = [0, .15, .29, .535, .615, .695, .775, .91];

export function evaluateStory(input, { width, height, compact = false }) {
  const p = clamp(Number.isFinite(input) ? input : 0);
  // A readable close-up is shared by A/B/C; D reveals the wider system.
  const closeScale = Math.min(compact ? 1.08 : 1.34, width / 230, height / 220);
  const overviewScale = Math.min((width - (compact ? 30 : 110)) / 720, (height - 52) / 1040);
  let cy = 90;
  cy = mix(cy, 285, ease(phase(p, .075, .205)));
  cy = mix(cy, 480, ease(phase(p, .215, .345)));
  const zoom = ease(phase(p, .365, .50));
  const scale = mix(closeScale, overviewScale, zoom);
  // Keep the same network icon as the zoom anchor. It moves only slightly
  // upward, leaving room for the circle while the goal spine stays visible.
  const anchorY = mix(height * .48, height * .43, zoom);
  const translateY = mix(height * .48 - cy * scale, anchorY - 480 * scale, zoom);
  const opacity = REVEALS.map((start) => ease(phase(p, start, start + .045)));
  const traces = PATH_WINDOWS.map(([start, end]) => phase(p, start, end));
  const scene = SCENE_STARTS.reduce((active, start, i) => p >= start ? i : active, 0);
  const captions = SCENE_STARTS.map((start, i) => {
    const enter = i === 0 ? 1 : ease(phase(p, start - .012, start + .018));
    const next = SCENE_STARTS[i + 1];
    const leave = next === undefined ? 1 : 1 - ease(phase(p, next - .012, next + .018));
    return enter * leave;
  });
  return {
    progress: p, scene, zoom, scale,
    x: width / 2 - 500 * scale,
    // Give the closing caption room in short viewports without shrinking text.
    y: translateY - (height < 500 ? 12 * captions[7] : 0),
    opacity, traces, captions,
    captionLift: (1 - zoom) * Math.min(compact ? 120 : 200, height * .28) + 32 * captions[7],
    labelOpacity: ease(phase(p, .405, .50)),
    // Preserve physical text size as the world zooms out, especially on phones.
    labelSize: (compact ? 12 : 14) / scale,
    // Keep a real screen-space gap below each icon at every zoom level.
    labelY: 55 + ((compact ? 6 : 7) + (compact ? 12 : 14) * .93) / scale,
  };
}
