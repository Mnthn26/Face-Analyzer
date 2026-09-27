// MediaPipe's six eye-contour points, in EAR order. Coordinates must be
// converted to pixels: normalized coordinates distort distances on wide video.
export const LEFT_EYE = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function eyeAspectRatio(points, indices, width = 1, height = 1) {
  const p = indices.map(i => ({ x: points[i].x * width, y: points[i].y * height }));
  const horizontal = distance(p[0], p[3]);
  return horizontal ? (distance(p[1], p[5]) + distance(p[2], p[4])) / (2 * horizontal) : 0;
}

// Wall-clock duration, not frame count. A gap, loss of tracking, or invalid
// pose breaks continuity: missing frames must never count as closed eyes.
export class ClosureTracker {
  constructor() { this.reset(); }
  reset() { this.since = null; this.last = null; this.closed = false; }
  update(ear, now, valid, threshold = .22, duration = 2000) {
    if (!valid || !Number.isFinite(ear)) { this.reset(); return { closedMs: 0, alarm: false }; }
    if (this.last !== null && now - this.last > 500) { this.since = null; this.closed = false; }
    this.last = now;
    // Hysteresis prevents noisy measurements around the threshold from chattering.
    this.closed = ear < threshold || (this.closed && ear < threshold + .025);
    if (!this.closed) this.since = null;
    else if (this.since === null) this.since = now;
    const closedMs = this.since === null ? 0 : now - this.since;
    return { closedMs, alarm: closedMs >= duration };
  }
}

export function expressionScores(categories = [], ear = .3) {
  const b = Object.fromEntries(categories.map(c => [c.categoryName, c.score]));
  const avg = (a, c) => ((b[a] || 0) + (b[c] || 0)) / 2;
  // These are transparent blendshape rules, NOT a trained emotion classifier
  // or calibrated probabilities. Multiple expressions may coexist.
  const happy = avg('mouthSmileLeft', 'mouthSmileRight');
  const sad = (avg('mouthFrownLeft', 'mouthFrownRight') + (b.browInnerUp || 0)) / 2;
  const angry = avg('browDownLeft', 'browDownRight');
  const surprised = ((b.jawOpen || 0) + avg('eyeWideLeft', 'eyeWideRight')) / 2;
  const tired = Math.max(0, Math.min(1, (.3 - ear) / .18)) * .8;
  const stressed = (angry + avg('mouthPressLeft', 'mouthPressRight')) / 2;
  return { Neutral: Math.max(.05, 1 - Math.max(happy, sad, angry, surprised, tired)), Happy: happy, Sad: sad, Stressed: stressed, Tired: tired, Angry: angry, Surprised: surprised };
}

export function validPose(p) {
  if (!p?.[454]) return false;
  const span = Math.abs(p[454].x - p[234].x);
  const center = (p[454].x + p[234].x) / 2;
  const roll = Math.abs(p[33].y - p[263].y) / Math.max(.001, Math.abs(p[33].x - p[263].x));
  return span > .12 && Math.abs(p[1].x - center) / span < .24 && roll < .35;
}
