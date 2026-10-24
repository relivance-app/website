// The five relationship stations and their connectors share one true circle.
export const CIRCLE = { x: 500, y: 750, radius: 270 };
export const STATION_ANGLES = [-90, -18, 54, 126, 198];
export function circlePoint(angle) {
  const radians = angle * Math.PI / 180;
  return [CIRCLE.x + CIRCLE.radius * Math.cos(radians), CIRCLE.y + CIRCLE.radius * Math.sin(radians)];
}

export const CIRCLE_POINTS = STATION_ANGLES.map(circlePoint);

export function circleConnections(labelRects = [], padding = 0) {
  // Equal clearances around each 55-unit icon disc, measured along the circle.
  const trim = 2 * Math.asin(67 / (2 * CIRCLE.radius)) * 180 / Math.PI;
  const intersects = (angle) => {
    const [x, y] = circlePoint(angle);
    return labelRects.some((r) => x >= r.x - padding && x <= r.x + r.width + padding && y >= r.y - padding && y <= r.y + r.height + padding);
  };
  return STATION_ANGLES.map((angle) => {
    const from = angle + trim;
    const to = angle + 72 - trim;
    // Shorten the arc at a label; never bend it away from the common circle.
    // Check its interior as well: large phone labels can cross a middle point
    // even when both original ends are clear.
    let start = from, end = from, runStart = from;
    const count = Math.ceil((to - from) / .25);
    for (let i = 0; i <= count; i++) {
      const at = from + (to - from) * i / count;
      if (intersects(at)) runStart = null;
      else {
        runStart ??= at;
        if (at - runStart > end - start) { start = runStart; end = at; }
      }
    }
    const a = circlePoint(start), b = circlePoint(end);
    return { start, end, d: `M${a[0]} ${a[1]}A270 270 0 0 1 ${b[0]} ${b[1]}` };
  });
}
