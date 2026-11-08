// Collisions.js — circle/circle detection + impulse response, and wall bounces.
// Walls are EXTERNAL: they break momentum conservation on purpose.
import { Vec2 } from './Vec2.js';

export function resolvePair(a, b, e) {
  if (a.destroyed || b.destroyed) return false;

  const d  = b.pos.sub(a.pos);
  const L  = d.len();
  const R  = a.radius + b.radius;

  if (L >= R || L < 1e-12) return false;

  const n  = d.mul(1 / L);
  const rv = b.vel.sub(a.vel).dot(n);

  if (rv > 0) return false;

  // Impact speed along the collision normal.
  const impactSpeed = -rv;

  // Render breakable bodies as defeated.
if (a.breakable && impactSpeed >= a.breakThreshold) {
  a.defeated = true;
}

if (b.breakable && impactSpeed >= b.breakThreshold) {
  b.defeated = true;
}

  // Locked and fixed bodies behave as immovable collision participants.
  const invA = (a.fixed || a.locked) ? 0 : a.invMass;
  const invB = (b.fixed || b.locked) ? 0 : b.invMass;

  const invSum = invA + invB;
  if (invSum === 0) return false;

  const j = -(1 + e) * rv / invSum;
  const J = n.mul(j);

  a.vel.addTo(J.mul(-invA));
  b.vel.addTo(J.mul(invB));

  const corr = n.mul((R - L) / invSum * 0.8);

  a.pos.addTo(corr.mul(-invA));
  b.pos.addTo(corr.mul(invB));

  return true;
}

export function resolveWalls(body, bounds, e) {
  if (body.fixed || body.locked) return false;

  let hit = false;
  const { xmin, xmax, ymin, ymax } = bounds;
  const r = body.radius;

  if (body.pos.x - r < xmin) {
    body.pos.x = xmin + r;
    body.vel.x = -body.vel.x * e;
    hit = true;
  }

  if (body.pos.x + r > xmax) {
    body.pos.x = xmax - r;
    body.vel.x = -body.vel.x * e;
    hit = true;
  }

  if (body.pos.y - r < ymin) {
    body.pos.y = ymin + r;
    body.vel.y = -body.vel.y * e;
    hit = true;
  }

  if (body.pos.y + r > ymax) {
    body.pos.y = ymax - r;
    body.vel.y = -body.vel.y * e;
    hit = true;
  }

  return hit;
}

export class SpatialHash {
  constructor(cell = 1.0) { this.cell = cell; this.map = new Map(); }
  _key(ix, iy) { return ix + ',' + iy; }
  rebuild(bodies) {
    this.map.clear();
    for (const b of bodies) {
      const ix = Math.floor(b.pos.x / this.cell);
      const iy = Math.floor(b.pos.y / this.cell);
      const k = this._key(ix, iy);
      if (!this.map.has(k)) this.map.set(k, []);
      this.map.get(k).push(b);
    }
  }
  candidatePairs(bodies) {
    this.rebuild(bodies);
    const pairs = [];
    const seen = new Set();
    for (const b of bodies) {
      const ix = Math.floor(b.pos.x / this.cell);
      const iy = Math.floor(b.pos.y / this.cell);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const nb = this.map.get(this._key(ix + dx, iy + dy));
          if (!nb) continue;
          for (const o of nb) {
            if (o.id <= b.id) continue;
            const key = b.id * 100000 + o.id;
            if (seen.has(key)) continue;
            seen.add(key);
            pairs.push([b, o]);
          }
        }
    }
    return pairs;
  }
}
