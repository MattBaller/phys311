// World.js — owns bodies, forces, the integrator, and the fixed-timestep clock.
// Contains NO reference to canvas, ctx, document, window, or pixels.
import { Vec2 } from './Vec2.js';
import { Body } from './Body.js';
import { INTEGRATORS, Verlet } from './Integrators.js';
import { resolvePair, resolveWalls, SpatialHash } from './Collisions.js';

export class World {
  constructor({ dt = 1 / 240, integrator = 'verlet', restitution = 1.0,
                bounds = null, useHash = false, cell = 1.0 } = {}) {
    this.DT          = dt;               // fixed physics timestep
    this.integrator  = INTEGRATORS[integrator] || Verlet;
    this.restitution = restitution;
    this.bounds      = bounds;           // null = unbounded (isolated system)
    this.useHash     = useHash;
    this.hash        = new SpatialHash(cell);

    this.bodies  = [];
    this.forces  = [];
    this.time    = 0;
    this.steps   = 0;
    this.collisions = 0;
    this.wallHits   = 0;
    this.dissipated = 0;                 // energy removed by drag, cumulative
    this.inelastic  = 0;                 // energy removed by e<1 impacts, cumulative
    this._acc    = 0;                    // leftover accumulator time
    // Is this an ISOLATED system? Only then must total momentum be conserved.
    // Walls, uniform gravity and the pointer spring are all EXTERNAL.
    this.momentumConserved = false;
    this._E0     = null;                 // reference energy, set ONCE
  }

  add(body)        { this.bodies.push(body); return body; }
  addForce(f)      { this.forces.push(f);    return f; }
  find(tag)        { return this.bodies.find(b => b.tag === tag); }
  setIntegrator(n) { this.integrator = INTEGRATORS[n] || this.integrator; }

  accumulateForces() {
    for (const b of this.bodies) b.clearForce();
    for (const f of this.forces) f.apply(this.bodies, this.time);
  }

  step(dt) {
    const drag = this.forces.find(f => f instanceof Object && typeof f.dissipation === 'function');
    if (drag) this.dissipated += drag.dissipation(this.bodies) * dt;

    this.integrator.step(this, dt);

    // Energy ledger: an inelastic impact removes REAL energy. Book it, so the
    // HUD's drift readout measures the INTEGRATOR and not the physics. Without
    // this, e = 0.95 looks identical to a broken solver.
    const Ebefore = this.kinetic() + this.potential();

    const pairs = this.useHash
      ? this.hash.candidatePairs(this.bodies)
      : allPairs(this.bodies);
    for (const [a, b] of pairs) {
  if (resolvePair(a, b, this.restitution)) {
    this.collisions++;
  }
}

// Remove destroyed bodies from the simulation.
this.bodies = this.bodies.filter(b => !b.destroyed);

    if (this.bounds)
      for (const b of this.bodies)
        if (resolveWalls(b, this.bounds, this.restitution)) this.wallHits++;

    this.inelastic += Ebefore - (this.kinetic() + this.potential());

    this.time  += dt;
    this.steps += 1;
  }

  // Fixed-timestep accumulator. Returns alpha in [0,1) for render interpolation.
  advance(frameSeconds, maxSteps = 32) {
  this._acc += Math.max(0, frameSeconds);

  let n = 0;

  while (this._acc >= this.DT && n < maxSteps) {
    this.step(this.DT);
    this._acc -= this.DT;
    n++;
  }

  return { substeps: n, alpha: this._acc / this.DT };
}

  // One deterministic substep, for the Step button while paused.
  stepOnce() { this.step(this.DT); return 1; }

  kinetic()   { return this.bodies.reduce((s, b) => s + b.kinetic(), 0); }
  potential() { return this.forces.reduce((s, f) =>
                  s + (typeof f.energy === 'function' ? f.energy(this.bodies) : 0), 0); }
  energy()    { return this.kinetic() + this.potential()
                     + this.dissipated + this.inelastic; }
  mechanical(){ return this.kinetic() + this.potential(); }
  momentum()  { return this.bodies.reduce((p, b) => p.add(b.momentum()), Vec2.zero()); }

  markReference() { this._E0 = this.energy(); this._p0 = this.momentum(); }
  get E0() { return this._E0; }
  get p0() { return this._p0 || Vec2.zero(); }

  driftE() {
    if (this._E0 === null || Math.abs(this._E0) < 1e-12) return 0;
    return (this.energy() - this._E0) / Math.abs(this._E0);
  }
  driftP() {
    const p0 = this.p0.len();
    if (p0 < 1e-12) return this.momentum().len();
    return this.momentum().sub(this.p0).len() / p0;
  }

  // Pick the nearest body whose disc contains (x,y). Pure geometry: the UI
  // layer converts pixels to world coordinates before calling this.
  pick(x, y, slack = 0.0) {
    let best = null, bestD = Infinity;
    for (const b of this.bodies) {
      const d = Math.hypot(b.pos.x - x, b.pos.y - y);
      if (d <= b.radius + slack && d < bestD) { best = b; bestD = d; }
    }
    return best;
  }
}

function allPairs(bodies) {
  const out = [];
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) out.push([bodies[i], bodies[j]]);
  return out;
}

export { Body, Vec2 };


import { UniformGravity, QuadraticDrag, Spring, NewtonGravity, PointerSpring }
  from './Forces.js';

function mulberry32(seed) {                 // 8-line deterministic PRNG
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = ['#ff8200', '#58a6ff', '#7ee787', '#f778ba', '#ffd866', '#c792ea'];

function base(state, opts) {
  const w = new World({
    dt: state.dt, integrator: state.integrator,
    restitution: state.restitution, ...opts
  });
  return w;
}

function attachCommon(w, state, { gravity = true } = {}) {
  if (gravity) w.addForce(new UniformGravity(state.gravity));
  w.addForce(new QuadraticDrag(state.drag));
  const ps = new PointerSpring();
  w.addForce(ps);                           // input, as a force, like any other
  w.pointer = ps;
  return w;
}

export const SCENES = {

    // Angry Bird Style Game
  spaceLauncher(state) {
    Body.resetIds();

    const w = base(state, { bounds: null });

    // First fixed celestial body
    w.add(new Body({
      pos: new Vec2(12, 2),
      vel: new Vec2(0, 0),
      mass: 700,
      radius: 1.0,
      fixed: true,
      color: '#eceff1',
      tag: 'planet1'
    }));

    // Projectiles launched toward the gravitational bodies
    // Projectile 1
    w.add(new Body({
      pos: new Vec2(-12, -0),
      vel: new Vec2(0, 0),
      mass: 0.001,
      radius: 0.5,
      locked: true,
      color: '#ff0000',
      tag: 'projectile'
    }));

    // Projectile 2
    w.add(new Body({
      pos: new Vec2(-13, -0),
      vel: new Vec2(0, 0),
      mass: 0.001,
      radius: 0.5,
      locked: true,
      color: '#ff0000',
      tag: 'projectile'
    }));

    // Projectile 3
    w.add(new Body({
      pos: new Vec2(-14, -0),
      vel: new Vec2(0, 0),
      mass: 0.001,
      radius: 0.5,
      locked: true,
      color: '#ff0000',
      tag: 'projectile'
    }));

    // Pig 1
    w.add(new Body({
      pos: new Vec2(12, 9),
      vel: new Vec2(-Math.sqrt(700/7), 0),
      mass: 0.0001,
      radius: 0.4,
      breakable: true,
      breakThreshold: 5,
      color: '#38f048',
      tag: 'pig'
    }));

    // Pig 2
    w.add(new Body({
      pos: new Vec2(12, -1),
      vel: new Vec2(-Math.sqrt(700/3), 0),
      mass: 0.0001,
      radius: 0.4,
      breakable: true,
      breakThreshold: 5,
      color: '#38f048',
      tag: 'pig'
    }));

    // Gravitational attraction; no uniform gravity or background drag
    w.addForce(new NewtonGravity(1.0, 0.00));

    // Enable slingshot aiming without applying a physical spring force.
    const ps = new PointerSpring();
    ps.slingshotMode = true;
    w.addForce(ps);
    w.pointer = ps;

    w.momentumConserved = false; // Fixed bodies act as external sources.
    w.markReference();

    return {
      world: w,
      view: [-13, 13, -9, 9]
    };
  }
};

export { mulberry32 };
