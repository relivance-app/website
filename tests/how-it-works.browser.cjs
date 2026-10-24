// Optional real-browser QA. Requires Playwright as a local development tool.
// No waitlist submissions, third-party calls, or production writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.HOW_PREVIEW_URL || 'http://127.0.0.1:5173';
const output = process.env.HOW_QA_OUTPUT || path.join(require('node:os').tmpdir(), 'relivance-how-it-works-qa');
fs.mkdirSync(output, { recursive: true });
const frame = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function seek(page, progress) {
  await page.evaluate((p) => {
    const root = document.querySelector('[data-story]');
    const stage = root.querySelector('.story-sticky');
    const start = root.getBoundingClientRect().top + scrollY - document.querySelector('.how-nav').offsetHeight;
    scrollTo(0, start + (root.offsetHeight - stage.offsetHeight) * p);
  }, progress);
  await frame(page);
}
async function snapshot(page) {
  return page.locator('[data-story]').evaluate((root) => ({
    progress: root.dataset.progress,
    scene: root.dataset.scene,
    camera: root.querySelector('[data-world]').getAttribute('transform'),
    paths: [...root.querySelectorAll('[data-trace]')].map((p) => p.style.strokeDashoffset),
    pathOpacity: [...root.querySelectorAll('[data-trace]')].map((p) => p.style.opacity),
    heads: [...root.querySelectorAll('[data-arrowhead]')].map((p) => [p.style.opacity, p.getAttribute('transform')]),
    nodes: [...root.querySelectorAll('[data-node]')].map((node) => node.style.opacity),
    captions: [...root.querySelectorAll('.scene-caption')].map((node) => node.style.opacity),
  }));
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
async function verifyFinalCTA(page) {
  const placement = await page.locator('.how-button').evaluate((button) => {
    const box = button.getBoundingClientRect();
    const paragraph = button.previousElementSibling.getBoundingClientRect();
    const heading = button.parentNode.querySelector('h2').getBoundingClientRect();
    const labelBottom = Math.max(...[...document.querySelectorAll('.node-label')].map((label) => label.getBoundingClientRect().bottom));
    return { gap: box.top - paragraph.bottom, graphicGap: heading.top - labelBottom, bottom: box.bottom, viewport: innerHeight, compactButton: matchMedia('(max-width: 600px) and (max-height: 600px)').matches, inert: button.inert };
  });
  assert.ok(Math.abs(placement.gap - (placement.compactButton ? 14 : 18)) < 1, 'Final CTA is not directly below its paragraph');
  assert.ok(placement.bottom <= placement.viewport - 6, 'Final CTA is clipped');
  assert.ok(placement.graphicGap >= (placement.compactButton ? 19 : 28), 'Closing caption crowds the diagram');
  assert.equal(placement.inert, false);
}
async function verifyVisibleLabels(page) {
  const result = await page.locator('.story-art').evaluate((svg) => {
    const box = svg.getBoundingClientRect();
    const labels = [...svg.querySelectorAll('.node-label')].map((label) => ({
      text: label.textContent, rect: label.getBoundingClientRect().toJSON(),
      gap: label.classList.contains('spine-label') ? null : label.getBoundingClientRect().top - label.parentNode.querySelector('.node-disc').getBoundingClientRect().bottom,
    }));
    const outside = labels.filter(({ rect: r }) => r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1);
    const overlaps = [];
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i].rect, b = labels[j].rect;
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlaps.push([labels[i].text, labels[j].text]);
    }
    const arrowCollisions = [];
    for (const path of svg.querySelectorAll('[data-trace]')) {
      const length = path.getTotalLength();
      const matrix = path.getScreenCTM();
      for (let i = 0; i <= 100; i++) {
        const point = path.getPointAtLength(length * i / 100);
        const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        const hit = labels.find(({ rect }) => screen.x > rect.left - 2 && screen.x < rect.right + 2 && screen.y > rect.top - 2 && screen.y < rect.bottom + 2);
        if (hit) { arrowCollisions.push([path.dataset.trace, hit.text]); break; }
      }
    }
    const crowded = labels.filter(({ gap }) => gap !== null && (gap < 5 || gap > 9));
    return { outside, overlaps, crowded, arrowCollisions };
  });
  assert.deepEqual(result, { outside: [], overlaps: [], crowded: [], arrowCollisions: [] });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.HOW_CHROME_PATH ? { executablePath: process.env.HOW_CHROME_PATH } : {}),
  });
  const errors = [];
  const prepare = async (options = {}) => {
    const context = await browser.newContext(options);
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin || url.protocol === 'data:') return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    return { context, page };
  };
  try {
    for (const [name, width, height] of [['desktop', 1440, 1000], ['short-desktop', 1024, 700], ['phone', 390, 844], ['small-phone', 320, 568]]) {
      const { context, page } = await prepare({ viewport: { width, height } });
      const response = await page.goto(`${base}/how-it-works/`);
      assert.equal(response.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      await frame(page);
      assert.equal(await page.locator('[data-story]').getAttribute('data-enhanced'), '');
      assert.ok(await page.locator('.how-intro').evaluate((intro) => {
        const box = intro.getBoundingClientRect();
        return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('.how-intro') === intro;
      }), 'The opening stage covers the introduction');
      const openingOpacity = Number(await page.locator('[data-node="goal"]').evaluate((node) => node.style.opacity));
      assert.ok(openingOpacity > 0 && openingOpacity < 1, 'The opening flag is invisible');
      await page.screenshot({ path: path.join(output, `${name}-opening-0.png`) });
      await page.evaluate(() => scrollTo(0, 80));
      await frame(page);
      const early = await snapshot(page);
      assert.ok(Number(early.nodes[0]) > openingOpacity, 'The flag waits for pinning before fading in');
      await page.waitForTimeout(120);
      assert.deepEqual(await snapshot(page), early, 'The opening continued without scrolling');
      await page.screenshot({ path: path.join(output, `${name}-opening-80.png`) });
      await page.evaluate(() => scrollTo(0, 160));
      await frame(page);
      assert.equal(Number(await page.locator('[data-node="goal"]').evaluate((node) => node.style.opacity)), 1);
      assert.ok(await page.locator('#step-goal h2').evaluate((heading) => heading.getBoundingClientRect().bottom <= innerHeight), 'Set your goal arrives too late');
      await page.screenshot({ path: path.join(output, `${name}-opening-160.png`) });
      await page.evaluate(() => scrollTo(0, 80));
      await frame(page);
      assert.deepEqual(await snapshot(page), early, 'The opening did not reverse precisely');
      const snapshots = new Map();
      const stops = [.04, .19, .33, .46, .57, .65, .73, .81, .88, .95];
      for (const p of stops) {
        await seek(page, p);
        snapshots.set(p, await snapshot(page));
        await noOverflow(page);
        if (p === .04) assert.equal(await page.locator('.how-button').evaluate((button) => { button.focus(); return document.activeElement === button; }), false, 'Hidden CTA received focus');
        if (p === .19) {
          const tipGap = await page.locator('[data-trace]').first().evaluate((path) => {
            const length = path.getTotalLength();
            const end = path.getPointAtLength(length * (1 - Number(path.style.strokeDashoffset)));
            const tip = document.querySelector('[data-arrowhead]').transform.baseVal.consolidate().matrix;
            return Math.hypot(tip.e - end.x, tip.f - end.y);
          });
          assert.ok(tipGap > 6 && tipGap < 8, 'Arrow shaft extends through its tip');
        }
        if (p === .33) {
          const hidden = await page.locator('[data-trace]').evaluateAll((paths) => paths.slice(2).map((path) => getComputedStyle(path).opacity));
          assert.deepEqual(hidden, Array(5).fill('0'), 'Undrawn connectors leave blue dots');
        }
        if ([.04, .19, .33, .57, .81, .95].includes(p)) await page.screenshot({ path: path.join(output, `${name}-${p}.png`) });
      }
      await verifyVisibleLabels(page);
      await verifyFinalCTA(page);
      for (const selector of ['.nav-access', '.how-button']) assert.equal(await page.locator(selector).evaluate((button) => getComputedStyle(button).color), 'rgb(255, 255, 255)');
      for (const p of [...stops].reverse()) {
        await seek(page, p);
        assert.deepEqual(await snapshot(page), snapshots.get(p), `${name}: reverse mismatch at ${p}`);
      }
      await seek(page, .73);
      const before = await snapshot(page);
      await page.waitForTimeout(250);
      assert.deepEqual(await snapshot(page), before, 'Animation continued after scrolling stopped');
      await page.reload();
      await page.evaluate(() => document.fonts.ready);
      await frame(page);
      assert.ok(Math.abs(Number((await snapshot(page)).progress) - Number(before.progress)) < .002, 'Reload lost scroll position');
      await page.goto(`${base}/privacy/`);
      await page.goBack();
      await page.evaluate(() => document.fonts.ready);
      await frame(page);
      assert.ok(Math.abs(Number((await snapshot(page)).progress) - Number(before.progress)) < .002, 'Back navigation lost scroll position');
      await page.setViewportSize({ width: Math.max(320, width - 50), height: height - 40 });
      await frame(page);
      assert.equal(await page.locator('[data-story]').getAttribute('data-enhanced'), '');
      await seek(page, .95);
      await verifyVisibleLabels(page);
      await verifyFinalCTA(page);
      await noOverflow(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await frame(page);
      assert.equal(await page.locator('[data-story]').getAttribute('data-enhanced'), null);
      assert.ok(await page.locator('#step-prepare').isVisible());
      assert.ok(await page.locator('[data-story]').evaluate((root) => root.offsetHeight < 3500));
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await frame(page);
      assert.equal(await page.locator('[data-story]').getAttribute('data-enhanced'), '');
      await seek(page, .95);
      await page.locator('.how-button').click();
      await page.waitForURL('**/#access-heading');
      await context.close();
      console.log(`PASS ${name}: forward/reverse, no autoplay, labels, reload/back, resize, reduced-motion toggle`);
    }

    for (const mode of ['reduced', 'no-js', 'failed-module']) {
      const { context, page } = await prepare({ viewport: { width: 390, height: 844 }, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference', javaScriptEnabled: mode !== 'no-js' });
      if (mode === 'failed-module') await page.route('**/how-it-works.mjs', (route) => route.abort());
      await page.goto(`${base}/how-it-works/`);
      assert.equal(await page.locator('[data-story]').getAttribute('data-enhanced'), null);
      for (const id of ['goal', 'milestones', 'network', 'prepare', 'meeting', 'recap', 'follow']) assert.ok(await page.locator(`#step-${id}`).isVisible());
      await noOverflow(page);
      await page.screenshot({ path: path.join(output, `${mode}.png`), fullPage: true });
      await context.close();
      console.log(`PASS ${mode}: full readable static content`);
    }

    const { context, page } = await prepare({ viewport: { width: 390, height: 844 } });
    for (const route of ['/', '/privacy/', '/terms/', '/impressum/']) {
      assert.equal((await page.goto(`${base}${route}`)).status(), 200);
      await noOverflow(page);
    }
    await page.goto(`${base}/`);
    assert.equal(await page.locator('.how-it-works-link').getAttribute('href'), '/how-it-works/');
    assert.equal(await page.locator('.access-form').count(), 1);
    assert.ok(await page.locator('.access-submit').isDisabled());
    await page.locator('.how-it-works-link').click();
    await page.waitForURL('**/how-it-works/');
    await page.locator('.nav-access').click();
    await page.waitForURL('**/#access-heading');
    await context.close();
    assert.deepEqual(errors, []);
    console.log('PASS homepage, legal routes, discovery link and existing waitlist CTA; no page errors');
    console.log(`Screenshots: ${output}`);
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
