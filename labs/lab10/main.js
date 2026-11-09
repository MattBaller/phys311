// main.js — the only file that wires engine + render + ui together.
// Everything DOM-related lives at or below this file; engine/ stays pure.
import { Camera }       from './render/Camera.js';
import { Renderer }     from './render/Renderer.js';
import { HUD }          from './render/HUD.js';
import { Controls }     from './ui.js';
import { PointerInput } from './input.js';
import { KeyboardInput } from './input.js';
import { eventToWorld } from './input.js';
import { StateURL }     from './ui.js';
import { SCENES } from './engine/World.js';
import { Body, Vec2 }   from './engine/World.js';

const DEFAULTS = {
  scene: 'spaceLauncher',
  integrator: 'verlet',
  dt: 1 / 167,
  restitution: 0.4,
  G: 1,
  drag: 0.0,
  speed: 1.0,
  showtrails: true,
  showForce: false,
  showVelocity: false,
  spawnMode: false
};

const canvas = document.getElementById('sim');
const live   = document.getElementById('live');       // aria-live announcer
const cam    = new Camera();
const render = new Renderer(canvas, cam);
const hud    = new HUD(document.getElementById('hud'));

// Respect the OS "reduce motion" setting: no trails, no flashing.
render.reducedMotion =
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

// ---- state: URL hash wins over defaults, so a shared link reproduces a run ----
const state = { ...DEFAULTS, ...StateURL.decode(location.hash, DEFAULTS) };

// Keep physics parameters fixed regardless of URL settings.
Object.assign(state, {
  dt: 1 / 167,
  gravity: 9.81,
  restitution: 0.4,
  drag: 0.0,
  speed: 1.0
});

let world = null, view = null, paused = false, gameWon = false, lastSubsteps = 0;
let pointer = null, keyboard = null, cursor = null;

function announce(msg) { live.textContent = msg; }

function build() {
  const made = SCENES[state.scene] ? SCENES[state.scene](state) : SCENES.billiards(state);
  gameWon = false;
  document.getElementById('win-message').style.display = 'none';
  world = made.world; view = made.view;
  world.setIntegrator(state.integrator);
  render.clearTrails();
  render.resize();
  cam.fit(...view);
  // Rebuilding replaces `world`, so re-point the input objects at the new one.
  if (pointer)  { pointer.world  = world; pointer.spring  = world.pointer; }
  if (keyboard) { keyboard.world = world; keyboard.spring = world.pointer;
                  keyboard.selected = null; }
  StateURL.write(state);
  announce(`${state.scene} scene loaded with ${world.bodies.length} bodies, ` +
           `integrator ${state.integrator}`);
}

// Live parameter edits that must NOT restart the simulation.
function applyLive() {
  if (!world) return;

  world.setIntegrator(state.integrator);
  world.DT = state.dt;
  world.restitution = state.restitution;

  for (const f of world.forces) {
    if (f.constructor.name === 'NewtonGravity') {
      f.G = state.G;
    }

    if (f.constructor.name === 'QuadraticDrag') {
      f.c = state.drag;
    }
  }

  render.showForce = state.showForce;
  render.showVelocity = state.showVelocity;
  render.showTrails = state.showTrails;
  if (!state.showTrails) render.clearTrails();

  if (pointer) pointer.spawnMode = state.spawnMode;

  StateURL.write(state);
}

function spawn(x, y) {
  if (world.bodies.length >= 400) { announce('Body limit reached'); return; }
  world.add(new Body({ pos: new Vec2(x, y), vel: new Vec2(0, 0),
                       mass: 1, radius: 0.26, color: '#58a6ff' }));
  world.markReference();          // new body => new reference energy, honestly
  announce(`Body added at ${x.toFixed(1)}, ${y.toFixed(1)} metres`);
}

const actions = {
  togglePause() {
  paused = !paused;
  controls.setPlayLabel(paused);

  if (!gameWon) {
    announce(paused ? 'Paused' : 'Running');
  }
},
stepOnce() {
  if (gameWon) return;

  if (!paused) actions.togglePause();

  world.stepOnce();
  render.recordTrails(world);
  announce(`Stepped to t = ${world.time.toFixed(3)} seconds`);
},
  reset()       { build(); announce('Simulation reset'); },
  toggleTrails(){ state.showTrails = !state.showTrails; controls.syncToDOM(); applyLive(); },
  preset(i)     { const s = SCENE_LIST[i]; if (!s) return;
                  state.scene = s[0]; controls.syncToDOM(); build(); },
  copyLink() {
    const url = location.origin + location.pathname + StateURL.encode(state);
    navigator.clipboard?.writeText(url)
      .then(() => announce('Permalink copied to clipboard'))
      .catch(() => announce('Copy failed; the URL bar already holds the link'));
  }
};

const controls = new Controls(state, {
  onChange : applyLive,
  onRebuild: build,
  onAction : (k) => actions[k] && actions[k]()
});

build();

pointer = new PointerInput(canvas, cam, world, world.pointer, {
  onSpawn: spawn
});

keyboard = new KeyboardInput(world, world.pointer, cam, {
  ...actions,
  announce
});

pointer.spawnMode = state.spawnMode;

// Track cursor position in physics (world) coordinates.
canvas.addEventListener('pointermove', event => {
  cursor = eventToWorld(event, canvas, cam);
});

canvas.addEventListener('pointerleave', () => {
  cursor = null;
});

window.addEventListener('resize', () => {
  render.resize();
  cam.fit(...view);
});


// ---- the frame loop: fixed physics step, variable render rate ----
let last = performance.now();
function frame(now) {
  hud.tick(now);
  let dtFrame = (now - last) / 1000;      // ms -> s, ONCE, here
  last = now;
  if (!Number.isFinite(dtFrame) || dtFrame < 0) dtFrame = 0;

  if (!paused && !gameWon) {
    const r = world.advance(dtFrame * state.speed, 32);
    lastSubsteps = r.substeps;
    render.recordTrails(world);

    // Check whether all pigs have been defeated.
    const pigs = world.bodies.filter(b => b.tag === 'pig');

    if (pigs.length > 0 && pigs.every(b => b.defeated)) {
      gameWon = true;
      console.log('YOU WIN!');
      document.getElementById('win-message').style.display = 'block';
      document.getElementById('live').textContent = 'YOU WIN!';
    }

  } else lastSubsteps = 0;

  render.draw(world, {
    grabbed: world.pointer.grabbed,
    target : world.pointer.active ? world.pointer.target : null, cursor
  });
  hud.update(world, { substeps: lastSubsteps, paused, cursor });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Pause when the tab is hidden, so returning does not dump a huge dt in.
document.addEventListener('visibilitychange', () => { last = performance.now(); });

window.addEventListener('hashchange', () => {
  Object.assign(state, StateURL.decode(location.hash, DEFAULTS));
  controls.syncToDOM(); build();
});

