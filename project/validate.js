// validate.js — headless validation. Run:  node project/validate.js
// Everything here runs in plain Node with NO browser, which is only possible
// because engine/ never touches the DOM. That is the Week 9 layering rule
// paying its final dividend.
import { World, Body, Vec2 } from './engine/World.js';
import { UniformGravity, Spring, NewtonGravity, PointerSpring } from './engine/Forces.js';
import { Camera }   from './render/Camera.js';
import { StateURL } from './ui.js';
import { SCENES }   from './engine/World.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, name, detail = '') => {
  c ? pass++ : fail++;
  console.log(`${c ? '  PASS' : '  FAIL'}  ${name}${detail ? '   ' + detail : ''}`);
};
const H = t => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

const ST = { scene:'traditionalLauncher', integrator:'verlet', dt:1/240, restitution:0.95,
             G:1, drag:0, speed:1, showTrails:true, showForce:false, showVelocity:false, spawnMode:false };
const snap = w => w.bodies.map(b => [b.pos.x, b.pos.y, b.vel.x, b.vel.y, b.angle ?? 0, b.omega ?? 0, Number(b.defeated)]);
const maxdiff = (A, B) => Math.max(...A.flat().map((v, i) => Math.abs(v - B.flat()[i])));

// ---------------------------------------------------------------- 1
H('1. Camera: pixels <-> world is an exact inverse');
{
  const cam = new Camera({ cx: 1.7, cy: -0.4, scale: 37.5 });
  cam.resize(961, 517);                       // deliberately odd, non-square
  let worst = 0;
  for (let i = 0; i < 400; i++) {
    const x = (i * 37 % 23) - 11.5, y = (i * 61 % 17) - 8.5;
    const [px, py] = cam.toScreen(x, y);
    const [wx, wy] = cam.toWorld(px, py);
    worst = Math.max(worst, Math.abs(wx - x), Math.abs(wy - y));
  }
  ok(worst < 1e-12, 'round trip error < 1e-12', `worst = ${worst.toExponential(2)}`);
  const [, topPy] = cam.toScreen(0, 10), [, botPy] = cam.toScreen(0, -10);
  ok(topPy < botPy, 'world +y maps to smaller canvas y (the flip)',
     `y=+10 -> ${topPy.toFixed(1)} px, y=-10 -> ${botPy.toFixed(1)} px`);
}

// ---------------------------------------------------------------- 2
H('2. Determinism: Reset reproduces the run exactly');
{
  const a = SCENES.traditionalLauncher(ST).world, b = SCENES.traditionalLauncher(ST).world;
  for (let i = 0; i < 3000; i++) { a.step(a.DT); b.step(b.DT); }
  ok(maxdiff(snap(a), snap(b)) === 0, 'two builds agree bit-for-bit after 3000 steps',
     `collisions = ${a.collisions}`);
  const code = readFileSync(join(ROOT, 'project/engine/World.js'), 'utf8')
                 .replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/Math\.random/.test(code), 'seeded PRNG only: no Math.random in scene code',
     'Math.random would break both Reset and permalinks');
}

// ---------------------------------------------------------------- 3
H('3. Step button: N single steps == one N-step run');
{
  const a = SCENES.traditionalLauncher(ST).world, b = SCENES.traditionalLauncher(ST).world;
  for (let i = 0; i < 1500; i++) a.stepOnce();
  for (let i = 0; i < 1500; i++) b.step(b.DT);
  ok(maxdiff(snap(a), snap(b)) === 0, 'pausing changes nothing about the physics',
     `t = ${a.time.toFixed(4)} s`);
}

// ---------------------------------------------------------------- 4
H('4. Accumulator: wall-clock jitter does not change the physics');
{
  const run = (frames) => {
    const w = SCENES.traditionalLauncher(ST).world;
    for (const f of frames) w.advance(f, 64);
    return w;
  };
  const N = 600;
  const smooth60  = Array(N).fill(1 / 60);
  const smooth144 = Array(Math.round(N * 144 / 60)).fill(1 / 144);
  const rnd = (() => { let s = 7; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
  const jitter = []; let tot = 0;
  while (tot < N / 60) { const f = Math.min(N / 60 - tot, 0.004 + rnd() * 0.028); jitter.push(f); tot += f; }
  const A = run(smooth60), B = run(smooth144), C = run(jitter);
  ok(Math.abs(A.time - B.time) < 1e-9 && Math.abs(A.time - C.time) < 0.02,
     'all three frame patterns reach the same simulated time',
     `60Hz ${A.time.toFixed(4)}s | 144Hz ${B.time.toFixed(4)}s | jittery ${C.time.toFixed(4)}s`);
  ok(A.steps === B.steps, 'identical substep count at 60 Hz and 144 Hz',
     `${A.steps} vs ${B.steps} steps`);
  const stall = SCENES.traditionalLauncher(ST).world;
  const r = stall.advance(2.0, 64);           // a 2-second tab freeze
  ok(r.substeps === 64, 'clamp caps a 2 s stall at 64 substeps (no spiral of death)',
     `unclamped would be ${Math.round(2.0 / stall.DT)}`);
     console.log('Actual substeps:', r.substeps);
}

// ---------------------------------------------------------------- 5
H('5. Input is a Force: inactive PointerSpring contributes exactly nothing');
{
  const w1 = SCENES.traditionalLauncher(ST).world;        // already carries a PointerSpring
  const w2 = new World({ dt: ST.dt, integrator: 'verlet' });
  Body.resetIds();
  const ref = SCENES.traditionalLauncher(ST).world;
  ref.forces = ref.forces.filter(f => !(f instanceof PointerSpring));  // remove it
  for (let i = 0; i < 2000; i++) { w1.step(w1.DT); ref.step(ref.DT); }
  ok(maxdiff(snap(w1), snap(ref)) === 0,
     'with and without the pointer force: bit-identical while released');
}

// ---------------------------------------------------------------- 6
H('6. External pointer force and momentum conservation');
{
  const { world } = SCENES.conservative(ST);
  const p0 = world.momentum();
  for (let i = 0; i < 1200; i++) world.step(world.DT);
  const before = world.momentum().sub(p0).len();
  ok(before < 1e-12, 'isolated momentum error', before.toExponential(2));
  world.pointer.enabled = true;
  world.pointer.slingshotMode = false;
  const b = world.bodies[0];
  world.pointer.grab(b, b.pos.x - 1.2, b.pos.y + 0.8);
  for (let i = 0; i < 60; i++) world.step(world.DT);
  const kick = world.momentum().sub(p0).len();
  ok(kick > 1e-3, 'external pointer changes momentum', kick.toExponential(2));
  world.pointer.release();
  const released = world.momentum();
  for (let i = 0; i < 1200; i++) world.step(world.DT);
  const after = world.momentum().sub(released).len();
  ok(after < 1e-12, 'absolute momentum error after release', after.toExponential(2));
}

H('7. Analytical projectile and conservative orbit');
{
  const dt = ST.dt, t = 5, g = 9.81;
  for (const integrator of ['euler', 'ec', 'verlet']) {
    const w = new World({ dt, integrator });
    const b = w.add(new Body({pos:new Vec2(0,100), vel:new Vec2(3,0), mass:1}));
    w.addForce(new UniformGravity(g));
    for(let i=0;i<1200;i++) w.step(dt);
    const error = Math.hypot(b.pos.x-3*t,b.pos.y-(100-0.5*g*t*t));
    const expected = integrator === 'verlet' ? 0 : 0.5*g*t*dt;
    ok(Math.abs(error-expected)<1e-9, `${integrator}: projectile position error agrees with theory`, error.toExponential(3));
  }
  const drift = integrator => {
    const {world:w} = SCENES.conservative({...ST,integrator});
    const E0=w.mechanical(); let worst=0;
    for(let i=0;i<1200;i++){w.step(w.DT); worst=Math.max(worst,Math.abs((w.mechanical()-E0)/E0));}
    console.log(`  ${integrator}: max relative mechanical energy error = ${worst.toExponential(6)}`);
    return worst;
  };
  const e=drift('euler'), ec=drift('ec'), v=drift('verlet');
  ok(v<ec && v<1e-3,'Verlet outperforms Euler-Cromer and stays below 0.1%');
  ok(e/Math.max(v,1e-18)>1e3,'Euler error >1000x Verlet error');
}

// ---------------------------------------------------------------- 8
H('8. Permalink: encode/decode round trip');
{
  const s = { scene:'traditionalLauncher', integrator:'ec', dt:1/180, restitution:0.37,
              G:3.71, drag:0.012, speed:1.45, showTrails:false, showForce:true, showVelocity:true, spawnMode:false };
  const back = StateURL.decode(StateURL.encode(s), ST);
  const same = Object.keys(s).every(k => Math.abs((back[k] ?? 0) - s[k]) < 1e-9 || back[k] === s[k]);
  ok(same, 'every control survives the URL hash', StateURL.encode(s).slice(0, 72) + '...');
  const partial = StateURL.decode('#scene=traditionalLauncher&int=verlet', ST);
  ok(partial.scene === 'traditionalLauncher' && partial.dt === ST.dt,
     'a hand-edited or truncated hash falls back to defaults, no crash');
}

// ---------------------------------------------------------------- 9
H('9. Layering audit: engine/ is free of the DOM');
{
  const bad = [];
  for (const f of readdirSync(join(ROOT, 'project/engine'))) {
    const project = readFileSync(join(ROOT, 'project/engine', f), 'utf8');
    for (const t of ['document', 'window', 'canvas', 'getContext', 'ctx.', 'addEventListener'])
      if (new RegExp(`\\b${t.replace('.', '\\.')}`).test(project.replace(/\/\/.*$/gm, '')))
        bad.push(`${f}: ${t}`);
  }
  ok(bad.length === 0, 'no DOM identifiers in project/engine/', bad.join(', ') || 'clean');
}


H('10. Isolated collision and energy ledger');
{
  for(const restitution of [1,.95,.5,0]){
    const w=new World({dt:ST.dt,restitution,integrator:'verlet'});
    w.add(new Body({pos:new Vec2(-1,0),vel:new Vec2(2,0),mass:1,radius:.5}));
    w.add(new Body({pos:new Vec2(1,0),vel:new Vec2(-2,0),mass:1,radius:.5}));
    w.markReference();
    for(let i=0;i<240;i++) w.step(w.DT);
    const expected=4*restitution**2;
    ok(w.collisions>0 && Math.abs(w.kinetic()-expected)<1e-9 && Math.abs(w.inelastic-(4-expected))<1e-9 && Math.abs(w.driftE())<1e-12 && w.momentum().len()<1e-12,
      `e=${restitution}: analytical KE, energy loss, ledger and momentum`, `KE=${w.kinetic().toFixed(6)} J; loss=${w.inelastic.toFixed(6)} J; drift=${w.driftE().toExponential(2)}`);
  }
}

// ---------------------------------------------------------------- 11
H('11. Original proposal validation (A4)');
{
  // A4.1: isolated circular two-body orbit, no contact or external forces.
  const dt = 1 / 240;
  const w = new World({dt, integrator:'verlet'});
  const v = 0.25; // sqrt(G*m/(4*r)), r=2, G=m=1
  w.add(new Body({pos:new Vec2(-2,0),vel:new Vec2(0,v),mass:1,radius:.25}));
  w.add(new Body({pos:new Vec2(2,0),vel:new Vec2(0,-v),mass:1,radius:.25}));
  w.addForce(new NewtonGravity(1,0));
  const E0 = w.mechanical();
  let worst = 0;
  for (let i=0; i<28800; i++) {
    w.step(dt);
    worst = Math.max(worst, Math.abs((w.mechanical()-E0)/E0));
  }
  ok(worst < .003 && w.collisions === 0 && Math.abs(w.time-120)<1e-8,
     'A4.1: 120 s conservative energy drift < 0.3%, no collisions',
     `t=${w.time.toFixed(6)} s; E0=${E0.toFixed(9)}; max drift=${(100*worst).toExponential(6)}%; collisions=${w.collisions}`);
}
{
  // A4.2: nonzero initial momentum makes relative error well-defined.
  const w = new World({dt:1/240,integrator:'verlet',restitution:.6});
  w.add(new Body({pos:new Vec2(-1,0),vel:new Vec2(3,0),mass:1,radius:.5}));
  w.add(new Body({pos:new Vec2(1,0),vel:new Vec2(-1,0),mass:1,radius:.5}));
  const p0=w.momentum(), K0=w.kinetic();
  for(let i=0;i<240;i++) w.step(w.DT);
  const err=w.momentum().sub(p0).len()/p0.len(), Kf=w.kinetic();
  ok(w.collisions>0 && err<1e-9,'A4.2: e=0.6 relative momentum error < 1e-9',
     `|p0|=${p0.len().toFixed(6)}; relative error=${err.toExponential(6)}`);
  ok(w.collisions>0 && Kf<K0,'A4.2: e=0.6 kinetic energy strictly decreases',
     `initial=${K0.toFixed(6)}; final=${Kf.toFixed(6)}; loss=${(K0-Kf).toFixed(6)}`);
}
{
  // A4.3: identical projectile launches in uniform gravity, no wind or drag.
  // No wall impulse: interpolate velocity at the first downward crossing
  // of y=radius (the ground-contact height).
  const landing = dt => {
    const w=new World({dt,integrator:'verlet'});
    const b=w.add(new Body({pos:new Vec2(0,2),vel:new Vec2(8,6),mass:1,radius:.5}));
    w.addForce(new UniformGravity(9.81));
    for(let i=0;i<Math.ceil(20/dt);i++) {
      const y=b.pos.y, vx=b.vel.x, vy=b.vel.y;
      w.step(dt);
      if(y>=b.radius && b.pos.y<b.radius && b.vel.y<0) {
        const f=(y-b.radius)/(y-b.pos.y);
        return Math.hypot(vx+f*(b.vel.x-vx),vy+f*(b.vel.y-vy));
      }
    }
    return NaN;
  };
  const coarse=landing(1/120), fine=landing(1/240);
  const diff=Math.abs(coarse-fine)/fine;
  ok(Number.isFinite(diff) && fine>0 && diff<.005,
     'A4.3: landing speed difference < 0.5%',
     `dt=1/120: ${coarse.toFixed(9)}; dt=1/240: ${fine.toFixed(9)}; difference=${(100*diff).toExponential(6)}%`);
}

console.log(`\n${'='.repeat(58)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(58)}`);
process.exit(fail ? 1 : 0);
