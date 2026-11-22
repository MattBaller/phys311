// World.js — owns bodies, forces, the integrator, and the fixed-timestep clock.
// Contains NO reference to canvas, ctx, document, window, or pixels.
import { Vec2 } from './Vec2.js';
import { Body } from './Body.js';
import { INTEGRATORS, Verlet } from './Integrators.js';
import { resolvePair, resolveWalls, SpatialHash } from './Collisions.js';

export class World {
  constructor({ dt = 1 / 240, integrator = 'verlet', restitution = 1.0,
                bounds = null, useHash = false, cell = 1.0,
                contactFriction = null, restitutionThreshold = 0, solverIterations = 1 } = {}) {
    this.DT          = dt;               // fixed physics timestep
    this.integrator  = INTEGRATORS[integrator] || Verlet;
    this.restitution = restitution;
    this.contactFriction = contactFriction;
    this.restitutionThreshold = restitutionThreshold;
    this.solverIterations = solverIterations;
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
    this.inelastic  = 0;                 // net energy change from contact resolution, cumulative
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
    for (const f of this.forces) {
      if (typeof f.dissipation === 'function') this.dissipated += f.dissipation(this.bodies) * dt;
    }

    this.integrator.step(this, dt);

    // Energy ledger: an inelastic impact removes REAL energy. Book it, so the
    // HUD's drift readout measures the INTEGRATOR and not the physics. Without
    // this, e = 0.95 looks identical to a broken solver.
    const Ebefore = this.kinetic() + this.potential();

    const countedPairs = new Set();
    const countedWalls = new Set();
    for (let i = 0; i < this.solverIterations; i++) {
      const pairs = this.useHash
        ? this.hash.candidatePairs(this.bodies)
        : allPairs(this.bodies);
      const e = i === 0 ? this.restitution : 0;
      for (const [a, b] of pairs) {
        if (resolvePair(a, b, e, this.contactFriction,
                        this.restitutionThreshold)) {
          const key = `${Math.min(a.id,b.id)},${Math.max(a.id,b.id)}`;
          if (!countedPairs.has(key)) {
            countedPairs.add(key);
            this.collisions++;
          }
        }
      }
      this.bodies = this.bodies.filter(b => !b.destroyed);
      if (this.bounds) {
        for (const b of this.bodies) {
          if (resolveWalls(b, this.bounds, e, this.contactFriction,
                           this.restitutionThreshold, this.solverIterations > 1 ? 0.001 : 0)) {
            if (!countedWalls.has(b)) {
              countedWalls.add(b);
              this.wallHits++;
            }
          }
        }
      }
    }

    this.inelastic += Ebefore - (this.kinetic() + this.potential());

    this.time  += dt;
    this.steps += 1;
  }

  // Fixed-timestep accumulator. Excess wall-clock time is discarded to prevent a simulation backlog.
  advance(frameSeconds, maxSteps = 32) {
    const safeFrameSeconds = Number.isFinite(frameSeconds)
      ? Math.max(0, frameSeconds)
      : 0;

    // Never accumulate more time than can be processed this frame.
    const maxAccumulatedTime = this.DT * maxSteps;

    this._acc = Math.min(
      this._acc + safeFrameSeconds,
      maxAccumulatedTime
    );

    let n = 0;

  const tolerance = this.DT * 1e-10;

    while (this._acc + tolerance >= this.DT && n < maxSteps) {
    this.step(this.DT);
    this._acc = Math.max(0, this._acc - this.DT);
    n++;
    }

    return {
      substeps: n,
      alpha: this._acc / this.DT
    };
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


import { UniformGravity, QuadraticDrag, ContactFriction, Spring, NewtonGravity, PointerSpring }
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


traditionalLauncher(state) {

  Body.resetIds();

  const g = 9.81;

  const w = new World({
    dt: state.dt,
    integrator: state.integrator,
    restitution: state.restitution,
    contactFriction: new ContactFriction(0.6, 0.4, 0.05),
    restitutionThreshold: 0.2,
    solverIterations: 6,

    bounds: {
      xmin: -20,
      xmax: 20,
      ymin: 0,
      ymax: 25
    }
  });


  // ---------- Birds ----------

  for (let i = 0; i < 3; i++) {

    w.add(new Body({
      shape: 'circle',
      pos: new Vec2(-12 - i * 1.2, 2),
      vel: new Vec2(0, 0),

      mass: 1.0,
      radius: 0.5,

      fixed: false,
      locked: true,

      color: '#ff0000',
      tag: 'projectile'
    }));
  }


  // ---------- Rectangular structure ----------

  const blocks = [

    // Left vertical column
    { x: 6, y: 1.5, width: 0.8, height: 3.0 },

    // Right vertical column
    { x: 10, y: 1.5, width: 0.8, height: 3.0 },

    // Horizontal beam
    { x: 8, y: 3.4, width: 5.5, height: 0.8 }

  ];

  for (const block of blocks) {

    w.add(new Body({
      shape: 'rectangle',

      pos: new Vec2(block.x, block.y),
      vel: new Vec2(0, 0),

      mass: 2.0,
      width: block.width,
      height: block.height,

      angle: 0,
      omega: 0,

      fixed: false,
      locked: false,

      color: '#a67c52',
      tag: 'obstacle'
    }));
  }


  // ---------- Pigs ----------

  const pigs = [

    // On top of the beam
    [8, 4.3],

    // Underneath the beam
    [8, 0.5],

    // Outside the structure
    [13, 0.5]

  ];

  for (const [x, y] of pigs) {

    w.add(new Body({
      shape: 'circle',

      pos: new Vec2(x, y),
      vel: new Vec2(0, 0),

      mass: 0.5,
      radius: 0.5,

      fixed: false,
      locked: false,

      breakable: true,
      breakThreshold: 5,

      color: '#38f048',
      tag: 'pig'
    }));
  }


  // ---------- Forces ----------

  w.addForce(new UniformGravity(g));


  // ---------- Slingshot ----------

  const ps = new PointerSpring();

  ps.slingshotMode = true;

  w.addForce(ps);
  w.pointer = ps;


  // ---------- Conservation diagnostics ----------

  // Gravity and walls provide external forces.
  w.momentumConserved = false;

  w.markReference();


  // ---------- Camera ----------

  return {
    world: w,
    view: [-18, 18, -1, 19]
  };

},




conservativeLauncher(state) {
  Body.resetIds();

  const w = new World({
    dt: state.dt,
    integrator: state.integrator,
    restitution: 1.0,
    bounds: null
  });

  const G = 1.0;
  const M = 700;

  // Planet: free to move
  w.add(new Body({
    pos: new Vec2(12, 2),
    vel: new Vec2(0, 0),
    mass: M,
    radius: 1.0,
    fixed: false,
    color: '#eceff1',
    tag: 'planet1'
  }));

  // Three projectiles
  for (let i = 0; i < 3; i++) {
    w.add(new Body({
      pos: new Vec2(-12 - i * 1.2, 0),
      vel: new Vec2(0, 0),
      mass: 0.001,
      radius: 0.5,
      locked: false,
      color: '#ff0000',
      tag: 'projectile'
    }));
  }

  // Pig 1
  w.add(new Body({
    pos: new Vec2(12, 9),
    vel: new Vec2(-Math.sqrt(G * M / 7), 0),
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
    vel: new Vec2(Math.sqrt(G * M / 3), 0),
    mass: 0.0001,
    radius: 0.4,
    breakable: true,
    breakThreshold: 5,
    color: '#38f048',
    tag: 'pig'
  }));

  // Set initial total momentum to zero
  const planet = w.find('planet1');
  const P = w.momentum();

  planet.vel.addTo(P.mul(-1 / M));

  // Mutual gravitational attraction
  w.addForce(new NewtonGravity(G, 0.0));

  // Slingshot
  const ps = new PointerSpring();
  ps.slingshotMode = true;

  w.addForce(ps);
  w.pointer = ps;

  // Isolated system between launches
  w.momentumConserved = true;

  w.markReference();

  return {
    world: w,
    view: [-17, 17, -11, 11]
  };
},

 
// Conservative Scene. No physics break.
conservative(state) {
  Body.resetIds();

  const w = new World({
    dt: state.dt,
    integrator: state.integrator,
    restitution: 1.0,
    bounds: null
  });

  const v = Math.sqrt(1 / 8);

  w.add(new Body({
    pos: new Vec2(-2, 0),
    vel: new Vec2(0, v),
    mass: 1,
    radius: 0.25,
    color: '#ff8200'
  }));

  w.add(new Body({
    pos: new Vec2(2, 0),
    vel: new Vec2(0, -v),
    mass: 1,
    radius: 0.25,
    color: '#58a6ff'
  }));

  w.addForce(new NewtonGravity(1.0, 0.0));

  const ps = new PointerSpring();
  ps.enabled = false;

  w.addForce(ps);
  w.pointer = ps;

  w.momentumConserved = true;
  w.markReference();

  return {
    world: w,
    view: [-5, 5, -4, 4]
  };
},

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
