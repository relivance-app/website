import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { evaluateStory, REVEALS, PATH_WINDOWS, SCENE_STARTS, POINTS } from '../how-it-works/story-motion.mjs';
import { CIRCLE, CIRCLE_POINTS, circleConnections, circlePoint } from '../how-it-works/story-geometry.mjs';

const desktop = { width: 1240, height: 724 };
const phone = { width: 320, height: 294, compact: true };

test('all relationship stations and connectors lie on one circle, including when trimmed for labels', () => {
  const distance = ([x, y]) => Math.hypot(x - CIRCLE.x, y - CIRCLE.y);
  for (const point of CIRCLE_POINTS) assert.ok(Math.abs(distance(point) - CIRCLE.radius) < 1e-9);
  const normal = circleConnections();
  const trimmed = circleConnections([{ x: 710, y: 720, width: 120, height: 80 }], 5);
  assert.ok(trimmed[1].start > normal[1].start, 'prepare label should shorten the arc');
  for (const connection of [...normal, ...trimmed]) {
    assert.ok(connection.end > connection.start);
    assert.match(connection.d, /A270 270 0 0 1/);
    for (let angle = connection.start; angle <= connection.end; angle += .5) {
      assert.ok(Math.abs(distance(circlePoint(angle)) - CIRCLE.radius) < 1e-9);
    }
  }
});

test('one scroll position reproduces the same frame after arbitrary forward and reverse seeks', () => {
  const stops = [0, .04, .15, .19, .29, .33, .46, .57, .65, .73, .81, .88, .95, 1];
  const forward = stops.map((p) => evaluateStory(p, desktop));
  for (let i = stops.length - 1; i >= 0; i--) assert.deepEqual(evaluateStory(stops[i], desktop), forward[i]);
});

test('goal, milestones, network precede the surrounding relationship stations', () => {
  const network = evaluateStory(.345, desktop);
  assert.equal(network.scene, 2);
  assert.equal(network.opacity[2], 1);
  assert.deepEqual(network.opacity.slice(3), [0, 0, 0, 0]);
  assert.deepEqual(network.traces.slice(2), [0, 0, 0, 0, 0]);
  const complete = evaluateStory(.95, desktop);
  assert.deepEqual(complete.opacity, Array(7).fill(1));
  assert.deepEqual(complete.traces, Array(7).fill(1));
  assert.equal(complete.scene, 7);
});

test('each clockwise connector starts after the preceding one and reveals its next station', () => {
  for (let i = 2; i < PATH_WINDOWS.length; i++) {
    const [start, end] = PATH_WINDOWS[i];
    const before = evaluateStory(start, desktop);
    assert.equal(before.traces[i], 0);
    const halfway = evaluateStory((start + end) / 2, desktop);
    assert.ok(Math.abs(halfway.traces[i] - .5) < 1e-12);
    assert.ok(halfway.traces.slice(i + 1).every((n) => n === 0));
    if (i < 6) assert.ok(REVEALS[i + 1] >= start && REVEALS[i + 1] < end);
  }
});

test('camera motion and caption crossfades have no jumps at scene and zoom boundaries', () => {
  for (const boundary of [...SCENE_STARTS, .075, .205, .215, .345, .365, .5]) {
    const a = evaluateStory(boundary - 1e-7, desktop);
    const b = evaluateStory(boundary + 1e-7, desktop);
    for (const field of ['x', 'y', 'scale', 'captionLift']) assert.ok(Math.abs(a[field] - b[field]) < .01, `${boundary}: ${field}`);
    for (let i = 0; i < a.captions.length; i++) assert.ok(Math.abs(a.captions[i] - b.captions[i]) < .001);
  }
});

test('the complete system fits both a desktop and a short phone viewport', () => {
  for (const size of [desktop, phone, { width: 390, height: 570, compact: true }]) {
    const state = evaluateStory(1, size);
    for (const [x, y] of POINTS) {
      assert.ok(state.x + (x - 55) * state.scale >= 0);
      assert.ok(state.x + (x + 55) * state.scale <= size.width);
      assert.ok(state.y + (y - 55) * state.scale >= 0);
      assert.ok(state.y + (y + state.labelY) * state.scale <= size.height);
    }
    assert.ok(Math.abs(state.labelSize * state.scale - (size.compact ? 12 : 14)) < 1e-10);
  }
});

test('state is finite and bounded, including out-of-range or invalid scroll values', () => {
  for (const p of [-2, 0, NaN, .02, .41, .9, 1, 8]) {
    const state = evaluateStory(p, phone);
    for (const n of [state.x, state.y, state.scale, state.labelSize, state.labelY]) assert.ok(Number.isFinite(n));
    for (const n of [...state.opacity, ...state.captions, ...state.traces, state.progress]) assert.ok(n >= 0 && n <= 1);
    assert.ok(Math.abs(state.captions.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  }
});

test('the page keeps seven readable steps, optional goals and the original CTA without the removed overview', () => {
  const page = readFileSync(new URL('../how-it-works/index.html', import.meta.url), 'utf8');
  for (const id of ['goal', 'milestones', 'network', 'prepare', 'meeting', 'recap', 'follow']) assert.match(page, new RegExp(`id="step-${id}"`));
  assert.match(page, /Start with a goal—or simply stay connected/);
  assert.match(page, /Relivance is in pre-beta/);
  assert.equal((page.match(/data-step-dot/g) || []).length, 7);
  assert.doesNotMatch(page, /Read the overview|How does Relivance actually work|The whole picture|Scroll to continue|story-progress/);
  assert.match(page, /href="\/#access-heading"/);
  assert.match(page, /<link rel="canonical" href="https:\/\/relivance.app\/how-it-works\/"/);
  assert.doesNotMatch(page, /cdn\.|unpkg|<video|<canvas/);
  for (const format of ['svg', 'pdf', 'png']) {
    const name = format === 'png' ? 'relivance-product-lifecycle-3600px.png' : `relivance-product-lifecycle.${format}`;
    assert.ok(existsSync(new URL(`../assets/how-it-works/${name}`, import.meta.url)));
  }
});
