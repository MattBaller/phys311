// Collisions.js — 2D rigid-body collisions.
// Supports circles, rotating rectangles, angular impulses, contact friction, and walls.
// Walls/fixed bodies are external constraints; total body momentum need not be conserved.
import { Vec2 } from './Vec2.js';

const EPS = 1e-10;
const SLOP = 0.001;
const CORRECTION = 0.8;

function cross(a, b) { return a.x * b.y - a.y * b.x; }
function rotate(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function isRect(b) { return b.shape === 'rectangle'; }
function invMass(b) { return b.fixed || b.locked ? 0 : b.invMass; }
function invInertia(b) { return b.fixed || b.locked ? 0 : (b.invI ?? 0); }
function velocityAt(b, r) {
  const w = b.omega ?? 0;
  return b.vel.add(new Vec2(-w * r.y, w * r.x));
}

function vertices(b) {
  const x = b.width / 2, y = b.height / 2;
  return [new Vec2(-x,-y), new Vec2(x,-y), new Vec2(x,y), new Vec2(-x,y)]
    .map(v => b.pos.add(rotate(v, b.angle ?? 0)));
}
function axes(b) {
  const angle = b.angle ?? 0;
  return [rotate(new Vec2(1,0), angle), rotate(new Vec2(0,1), angle)];
}
function project(poly, axis) {
  const dots = poly.map(p => p.dot(axis));
  return { min: Math.min(...dots), max: Math.max(...dots) };
}

function circleCircle(a, b) {
  const d = b.pos.sub(a.pos), distance = d.len();
  const radius = a.radius + b.radius;
  if (distance >= radius) return null;
  const normal = distance > EPS ? d.mul(1 / distance) : new Vec2(1, 0);
  const penetration = radius - distance;
  const contact = a.pos.add(normal.mul(a.radius - penetration / 2));
  return { normal, penetration, contact };
}

// Normal always points from circle A toward rectangle B.
function circleRectangle(circle, rect) {
  const angle = rect.angle ?? 0;
  const local = rotate(circle.pos.sub(rect.pos), -angle);
  const hw = rect.width / 2, hh = rect.height / 2;
  let nearest = new Vec2(clamp(local.x, -hw, hw), clamp(local.y, -hh, hh));
  const delta = nearest.sub(local);
  const distance = delta.len();
  if (distance >= circle.radius) return null;

  let normalLocal, penetration;
  if (distance > EPS) {
    normalLocal = delta.mul(1 / distance);
    penetration = circle.radius - distance;
  } else {
    // Center is inside/on rectangle: choose nearest exit face.
    const dx = hw - Math.abs(local.x);
    const dy = hh - Math.abs(local.y);
    if (dx < dy) {
      const sign = local.x >= 0 ? 1 : -1;
      nearest = new Vec2(sign * hw, local.y);
      normalLocal = new Vec2(-sign, 0);
      penetration = circle.radius + dx;
    } else {
      const sign = local.y >= 0 ? 1 : -1;
      nearest = new Vec2(local.x, sign * hh);
      normalLocal = new Vec2(0, -sign);
      penetration = circle.radius + dy;
    }
  }
  return {
    normal: rotate(normalLocal, angle),
    penetration,
    contact: rect.pos.add(rotate(nearest, angle))
  };
}

// Clip a convex polygon to the half-plane to the LEFT of each CCW edge.
function polygonIntersection(subject, clip) {
  let output = subject;
  for (let i = 0; i < clip.length && output.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const edge = b.sub(a);
    const inside = p => cross(edge, p.sub(a)) >= -EPS;
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length];
      const inP = inside(p), inQ = inside(q);
      if (inP) output.push(p);
      if (inP !== inQ) {
        const segment = q.sub(p);
        const denom = cross(edge, segment);
        if (Math.abs(denom) > EPS) {
          const t = cross(edge, a.sub(p)) / denom;
          output.push(p.add(segment.mul(clamp(t, 0, 1))));
        }
      }
    }
  }
  return output;
}
function meanPoint(points) {
  let sum = new Vec2(0, 0);
  for (const p of points) sum = sum.add(p);
  return sum.mul(1 / points.length);
}

function rectangleRectangle(a, b) {
  const va = vertices(a), vb = vertices(b);
  let minOverlap = Infinity, normal = null;
  for (const axis of [...axes(a), ...axes(b)]) {
    const pa = project(va, axis), pb = project(vb, axis);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= 0) return null;
    if (overlap < minOverlap) {
      minOverlap = overlap;
      normal = axis;
    }
  }
  if (b.pos.sub(a.pos).dot(normal) < 0) normal = normal.mul(-1);
  const intersection = polygonIntersection(va, vb);
  // A single representative contact is an approximation for broad face contacts.
  const contact = intersection.length
    ? meanPoint(intersection)
    : a.pos.add(b.pos).mul(0.5);
  return { normal, penetration: minOverlap, contact };
}

function detect(a, b) {
  if (!isRect(a) && !isRect(b)) return circleCircle(a, b);
  if (!isRect(a)) return circleRectangle(a, b);
  if (!isRect(b)) {
    const hit = circleRectangle(b, a);
    if (hit) hit.normal = hit.normal.mul(-1);
    return hit;
  }
  return rectangleRectangle(a, b);
}

export function resolvePair(a, b, e, friction = null, restitutionThreshold = 0) {
  if (a.destroyed || b.destroyed) return false;
  const hit = detect(a, b);
  if (!hit) return false;
  const { normal, penetration, contact } = hit;
  const ma = invMass(a), mb = invMass(b);
  const ia = invInertia(a), ib = invInertia(b);
  if (ma + mb <= 0) return false;

  const ra = contact.sub(a.pos), rb = contact.sub(b.pos);
  const relative = velocityAt(b, rb).sub(velocityAt(a, ra));
  const vn = relative.dot(normal);
  if (vn < -EPS) {
    const impactSpeed = -vn;
    if (a.breakable && impactSpeed >= a.breakThreshold) a.defeated = true;
    if (b.breakable && impactSpeed >= b.breakThreshold) b.defeated = true;

    const rna = cross(ra, normal), rnb = cross(rb, normal);
    const denom = ma + mb + rna * rna * ia + rnb * rnb * ib;
    if (denom > EPS) {
      const effectiveE = Math.abs(vn) < restitutionThreshold ? 0 : clamp(e, 0, 1);
      const j = -(1 + effectiveE) * vn / denom;
      const impulse = normal.mul(j);
      a.vel.addTo(impulse.mul(-ma));
      b.vel.addTo(impulse.mul(mb));
      a.omega = (a.omega ?? 0) - cross(ra, impulse) * ia;
      b.omega = (b.omega ?? 0) + cross(rb, impulse) * ib;

      // Recompute slip after the normal impulse, including rotation.
      if (friction) {
        const t = new Vec2(-normal.y, normal.x);
        const vt = velocityAt(b, rb).sub(velocityAt(a, ra)).dot(t);
        const rta = cross(ra, t), rtb = cross(rb, t);
        const kt = ma + mb + rta * rta * ia + rtb * rtb * ib;
        const jt = friction.impulse(vt, j, kt);
        const Jt = t.mul(jt);
        a.vel.addTo(Jt.mul(-ma));
        b.vel.addTo(Jt.mul(mb));
        a.omega -= cross(ra, Jt) * ia;
        b.omega += cross(rb, Jt) * ib;
        // Rolling resistance for circular pigs; equal and opposite couple.
        const pig = [a, b].find(body => body.tag === 'pig' && !isRect(body));
        if (pig && friction.rollingImpulse) {
          const L = friction.rollingImpulse(b.omega - a.omega, j, ia + ib, pig.radius);
          a.omega -= L * ia;
          b.omega += L * ib;
        }
      }
    }
  }

  const correction = normal.mul(CORRECTION * Math.max(penetration - SLOP, 0) / (ma + mb));
  a.pos.addTo(correction.mul(-ma));
  b.pos.addTo(correction.mul(mb));
  return true;
}

// Wall normal points INTO the playable region; limit is the wall's plane.
function wallContact(body, normal, limit) {
  if (!isRect(body)) {
    const point = body.pos.sub(normal.mul(body.radius));
    const penetration = limit - point.dot(normal);
    return penetration > 0 ? { point, penetration } : null;
  }
  const v = vertices(body);
  const dots = v.map(p => p.dot(normal));
  const min = Math.min(...dots);
  const penetration = limit - min;
  if (penetration <= 0) return null;
  const deepest = v.filter((p, i) => Math.abs(dots[i] - min) < 1e-7);
  return { point: meanPoint(deepest), penetration };
}

export function resolveWalls(body, bounds, e, friction = null, restitutionThreshold = 0, restingSlop = 0) {
  if (body.fixed || body.locked) return false;
  const m = invMass(body), invI = invInertia(body);
  const walls = [
    { normal: new Vec2(1, 0), limit: bounds.xmin },
    { normal: new Vec2(-1, 0), limit: -bounds.xmax },
    { normal: new Vec2(0, 1), limit: bounds.ymin },
    { normal: new Vec2(0, -1), limit: -bounds.ymax }
  ];
  let hit = false;
  for (const wall of walls) {
    if (!Number.isFinite(wall.limit)) continue;
    const contact = wallContact(body, wall.normal, wall.limit);
    if (!contact) continue;
    const r = contact.point.sub(body.pos);
    const vn = velocityAt(body, r).dot(wall.normal);
    if (vn < -EPS) {
      const rn = cross(r, wall.normal);
      const denom = m + rn * rn * invI;
      if (denom > EPS) {
        const effectiveE = Math.abs(vn) < restitutionThreshold ? 0 : clamp(e, 0, 1);
        const j = -(1 + effectiveE) * vn / denom;
        const impulse = wall.normal.mul(j);
        body.vel.addTo(impulse.mul(m));
        body.omega = (body.omega ?? 0) + cross(r, impulse) * invI;

        if (friction) {
          const t = new Vec2(-wall.normal.y, wall.normal.x);
          const vt = velocityAt(body, r).dot(t);
          const rt = cross(r, t);
          const kt = m + rt * rt * invI;
          const Jt = t.mul(friction.impulse(vt, j, kt));
          body.vel.addTo(Jt.mul(m));
          body.omega += cross(r, Jt) * invI;
          if (body.tag === 'pig' && !isRect(body) && friction.rollingImpulse) {
            body.omega += friction.rollingImpulse(body.omega, j, invI, body.radius) * invI;
          }
        }
      }
    }
    body.pos.addTo(wall.normal.mul(Math.max(0, contact.penetration - restingSlop)));
    hit = true;
  }
  return hit;
}

// Spatial hash indexes all grid cells overlapped by each shape's AABB.
// This avoids missing collisions involving long rectangular beams.
function boundsOf(b) {
  if (!isRect(b)) {
    return { xmin: b.pos.x - b.radius, xmax: b.pos.x + b.radius,
             ymin: b.pos.y - b.radius, ymax: b.pos.y + b.radius };
  }
  const v = vertices(b);
  return { xmin: Math.min(...v.map(p => p.x)), xmax: Math.max(...v.map(p => p.x)),
           ymin: Math.min(...v.map(p => p.y)), ymax: Math.max(...v.map(p => p.y)) };
}

export class SpatialHash {
  constructor(cell = 1.0) { this.cell = cell; this.map = new Map(); }
  _key(ix, iy) { return ix + ',' + iy; }
  rebuild(bodies) {
    this.map.clear();
    for (const b of bodies) {
      const box = boundsOf(b);
      for (let ix = Math.floor(box.xmin / this.cell); ix <= Math.floor(box.xmax / this.cell); ix++) {
        for (let iy = Math.floor(box.ymin / this.cell); iy <= Math.floor(box.ymax / this.cell); iy++) {
          const key = this._key(ix, iy);
          if (!this.map.has(key)) this.map.set(key, []);
          this.map.get(key).push(b);
        }
      }
    }
  }
  candidatePairs(bodies) {
    this.rebuild(bodies);
    const pairs = [], seen = new Set();
    for (const occupants of this.map.values()) {
      for (let i = 0; i < occupants.length; i++) {
        for (let j = i + 1; j < occupants.length; j++) {
          const a = occupants[i], b = occupants[j];
          const lo = Math.min(a.id, b.id), hi = Math.max(a.id, b.id);
          const key = `${lo},${hi}`;
          if (seen.has(key)) continue;
          seen.add(key);
          pairs.push(a.id < b.id ? [a, b] : [b, a]);
        }
      }
    }
    return pairs;
  }
}
