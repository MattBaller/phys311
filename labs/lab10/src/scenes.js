// scenes.js — every scene is a pure function (state) -> World.
// Deterministic by construction: the RNG is seeded from the state, so
// "Reset" reproduces the identical run and a permalink reproduces it on
// someone else's machine. (Math.random() here would break both.)
import { World, Body, Vec2 } from './engine/World.js';
import { UniformGravity, QuadraticDrag, Spring, NewtonGravity, PointerSpring }
  from './engine/Forces.js';

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

export const SCENE_LIST = [
  ['billiards',  'Billiards in a box'],
  ['chain',      'Spring chain'],
  ['orbits',     'N-body orbits'],
  ['projectile', 'Projectile (control case)'],
  ['pendulums',  'Pendulum row']
  ['spaceLauncher', 'Space Launcher']
];

export { mulberry32 };
