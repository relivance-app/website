import { evaluateStory, NODE_IDS } from './story-motion.mjs';

const story = document.querySelector('[data-story]');
const media = matchMedia('(prefers-reduced-motion: reduce)');
let teardown = () => {};
let disposed = false;

function enhance() {
  teardown();
  if (disposed || media.matches || !CSS.supports('position', 'sticky')) return;

  const stage = story.querySelector('.story-sticky');
  const viewport = story.querySelector('.story-viewport');
  const svg = story.querySelector('.story-art');
  const world = story.querySelector('[data-world]');
  const nodes = NODE_IDS.map((id) => story.querySelector(`[data-node="${id}"]`));
  const labels = [...story.querySelectorAll('.node-label')];
  const captions = [...story.querySelectorAll('.scene-caption')];
  const captionGroup = story.querySelector('.story-captions');
  const paths = [...story.querySelectorAll('[data-trace]')];
  const heads = [...story.querySelectorAll('[data-arrowhead]')];
  const dots = [...story.querySelectorAll('[data-step-dot]')];
  let raf = 0;
  let pendingMeasure = false;
  let geometry;
  let lastProgress = -1;
  let lastScene = -1;
  let dead = false;
  let observer;
  let samples;

  // Cache on measurement only. Scroll frames perform no geometry reads.
  const samplePath = (path) => {
    const length = path.getTotalLength();
    const points = Array.from({ length: 201 }, (_, i) => {
      const at = length * i / 200;
      const a = path.getPointAtLength(Math.max(0, at - .5));
      const b = path.getPointAtLength(Math.min(length, at + .5));
      const point = path.getPointAtLength(at);
      return { x: point.x, y: point.y, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
    });
    return { length, points };
  };

  function restore(preservePresentation = false) {
    dead = true;
    cancelAnimationFrame(raf);
    observer?.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pageshow', onResize);
    // Keep document geometry stable while the browser saves navigation history.
    if (preservePresentation) return;
    story.removeAttribute('data-enhanced');
    story.removeAttribute('data-scene');
    story.removeAttribute('data-progress');
    story.removeAttribute('style');
    captions.forEach((caption) => caption.removeAttribute('style'));
    captionGroup.removeAttribute('style');
    dots.forEach((dot) => dot.removeAttribute('data-state'));
  }

  function measure() {
    const box = viewport.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) throw new Error('Animation stage is unavailable');
    const header = document.querySelector('.how-nav').getBoundingClientRect().height;
    const compact = box.width < 600;
    const travel = Math.max(2400, Math.min(4800, stage.offsetHeight * (compact ? 5.6 : 5.2)));
    story.style.height = `${stage.offsetHeight + travel}px`;
    geometry = {
      width: box.width, height: box.height, compact,
      start: story.getBoundingClientRect().top + window.scrollY - header, travel,
    };
    // In short viewports labels retain their physical size while icons shrink.
    // Keep the two lower side arcs clear of those labels at the complete view.
    const overview = evaluateStory(1, geometry);
    const clearanceY = Math.max(790, 660 + overview.labelY + overview.labelSize * .25 + 6 / overview.scale);
    const rise = 907 - clearanceY;
    paths[3].setAttribute('d', `M770 ${clearanceY}C770 ${clearanceY + (904 - clearanceY) * .5} 740 880 706 904`);
    paths[5].setAttribute('d', `M285 907C231 ${907 - rise * .35} 210 ${clearanceY + rise * .5} 210 ${clearanceY}`);
    samples = paths.map(samplePath);
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    lastProgress = -1;
  }

  function render() {
    raf = 0;
    if (dead) return;
    try {
      if (pendingMeasure) { pendingMeasure = false; measure(); }
      const state = evaluateStory((window.scrollY - geometry.start) / geometry.travel, geometry);
      if (state.progress === lastProgress) return;
      lastProgress = state.progress;
      world.setAttribute('transform', `translate(${state.x} ${state.y}) scale(${state.scale})`);
      nodes.forEach((node, i) => {
        node.style.opacity = state.opacity[i];
        const strength = state.scene === i ? 1 : .94;
        node.querySelector('.node-disc').style.opacity = strength;
        node.querySelector('.node-glyph').setAttribute('transform', `scale(${.94 + .06 * state.opacity[i]})`);
      });
      labels.forEach((label) => {
        label.style.opacity = state.labelOpacity;
        label.style.fontSize = `${state.labelSize}px`;
        if (!label.classList.contains('spine-label')) label.setAttribute('y', state.labelY);
      });
      captionGroup.style.transform = `translateY(${-state.captionLift}px)`;
      captions.forEach((caption, i) => {
        caption.style.opacity = state.captions[i];
        caption.style.transform = `translateY(${(1 - state.captions[i]) * 7}px)`;
      });
      state.traces.forEach((amount, i) => {
        // Stop the rounded shaft inside the head, never beyond its tip.
        // A fully hidden path must not leave a round-cap dot at its origin.
        const shaft = Math.max(0, amount - 7 / samples[i].length);
        paths[i].style.strokeDashoffset = 1 - shaft;
        paths[i].style.opacity = shaft > 0 ? 1 : 0;
        heads[i].style.opacity = amount * samples[i].length > 7 ? 1 : 0;
        const sample = samples[i].points[Math.round(amount * 200)];
        heads[i].setAttribute('transform', `translate(${sample.x} ${sample.y}) rotate(${sample.angle})`);
      });
      if (lastScene !== state.scene) {
        lastScene = state.scene;
        dots.forEach((dot, i) => { dot.dataset.state = i < state.scene ? 'complete' : i === state.scene ? 'current' : 'upcoming'; });
        story.dataset.scene = state.scene === 7 ? 'complete' : NODE_IDS[state.scene];
      }
      story.dataset.progress = state.progress.toFixed(5);
    } catch {
      restore(); // Static semantic content remains available if enhancement fails.
    }
  }
  function schedule() { if (!raf && !dead) raf = requestAnimationFrame(render); }
  function onScroll() { schedule(); }
  function onResize() { pendingMeasure = true; schedule(); }

  try {
    story.setAttribute('data-enhanced', '');
    measure();
    render();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('pageshow', onResize);
    observer = new ResizeObserver(onResize);
    observer.observe(viewport);
    document.fonts?.ready.then(() => { if (!dead) onResize(); });
    teardown = restore;
  } catch { restore(); }
}

if (story) {
  try { enhance(); } catch { story.removeAttribute('data-enhanced'); }
  media.addEventListener('change', enhance);
  // pagehide fires for ordinary navigation and bfcache. Recreate on restoration.
  window.addEventListener('pagehide', () => { disposed = true; teardown(true); });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) { disposed = false; enhance(); }
  });
}
