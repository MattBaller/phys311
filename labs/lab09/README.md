# Physics 311 — Block 3, Week 9
## Reference project: *Structuring a JS Physics Engine*

A complete, runnable JavaScript physics engine demonstrating every idea from the
Week 9 lesson. Study it, run it, break it — then build your own for Lab 9.

---

## Running the simulation

### 1. `index.html`
- **VS Code:** install the **Live Server** extension, right-click
  `index.html` → *Open with Live Server*.
- **Any terminal with Python:** `python -m http.server 8000`, then open
  <http://localhost:8000>.

> If you open `index.html` by double-clicking, the page will be blank and the
> console will say *"Cross origin requests are only supported for http"*.
> That is the `file://` restriction, not a bug in the code.

### 3. Headless — no browser at all
```
node tests/validate.js
```
Runs the same 6 checks and exits non-zero on failure. **This is the payoff
for the layering rule** (below): because `engine/` never mentions the DOM,
your physics runs anywhere.

---

## Layout

```
index.html          page + controls
standalone.html     single-file build (no server needed)
styles.css
main.js             the ONLY file that knows about both layers

engine/             pure physics - no DOM, ever
  Vec2.js           2D vector; returns new objects by default
  Body.js           state of one disc (pos, vel, theta, omega, I)
  Forces.js         UniformGravity, NewtonGravity, Spring, QuadraticDrag
  Integrators.js    Euler, EulerCromer, VelocityVerlet
  Collision.js      broad phase, narrow phase, impulse response, BoxBounds
  World.js          owns bodies + forces; step(dt); diagnostics
  Accumulator.js    fixed physics timestep, variable frame rate

render/             drawing only - reads the world, never changes it
  Camera.js         world <-> screen; the ONLY place the y-flip lives
  Renderer.js       discs, trails, vectors, grid, bounds
  HUD.js            live conservation readout

scenes/scenes.js    3 scenes; each returns a fresh World
tests/validate.js   6 headless checks (Node + in-page)
```


## Verified reference values

Produced by `node tests/validate.js`

| Check | Expected |
|---|---|
| Projectile range, v₀ = 25 m/s at 45° | **63.710499 m** (err 4.5e-9) |
| Spring, 10 periods, dt = 0.01, max \|ΔE\|/E₀ | Euler **1.18**, EC **2.04e-1**, Verlet **5.06e-3** |
| Verlet convergence, error ratio on dt halving | **4.00, 4.00** (second order) |
| Isolated collisions (walls off), \|Δp\|/\|p₀\| | **< 1.5e-16** at every e |
| Isolated box KE kept, e = 1 / 0.9 / 0.5 / 0 | **100 / 86.7 / 58.8 / 45.7 %** |
| Box **with** walls, e = 1 | ΔE/E₀ = **2e-16**, but \|Δp\|/\|p₀\| = **1.36** |
| Figure-eight, 4 periods, dt = 1e-4 | ΔE/E₀ = **-1.0e-15**, \|p\| = **5.7e-14** |
| Brute force vs spatial hash, N = 120 | **7140** vs **5** checks/step, position difference **exactly 0** |
| Separating overlapped pair | no impulse applied |

---

## Five things to look for in the code

1. **Equal-and-opposite on consecutive lines.** In `Forces.js`, every internal
   force does `a.applyForce(F); b.applyForce(F.neg());` back to back. That is
   why momentum conservation is *structural* — `World` never checks it.

2. **The separating guard.** `Collision.js` has `if (vn > 0) return;`. Delete
   it and overlapping-but-separating pairs get re-resolved every frame,
   pumping energy in. Try it — the box will heat up and explode.

3. **Positional correction splits by inverse mass**, so pushing bodies apart
   adds no net momentum. A heavy body barely moves.

4. **The baseline is captured once**, in `buildScene()`, not inside the frame
   callback. Move `captureBaseline()` into `frame()` and the HUD will read
   0.0000 % drift forever — an instrument measuring itself.

5. **The accumulator clamps.** `maxFrame = 0.25 s`. Switch tabs for two
   seconds without the clamp and the next frame tries 480 physics steps,
   which takes longer than a frame, which makes the next frame worse: the
   spiral of death.

---

## Things to try

## Scenes

**Scene 1 – Collisions in a Box**
- Simulates 20 moving balls inside a bounded box.
- Includes a stationary central mass that the balls can collide with.
- Demonstrates elastic and inelastic collisions, momentum transfer, and energy changes.

**Scene 2 – Galaxy / Whirlpool**
- Simulates a four-body gravitational system.
- Bodies follow coordinated orbital paths to create a galaxy or whirlpool-like motion.
- Demonstrates gravitational interactions and multi-body dynamics.

**Scene 3 – Spring-Mass Chain**
- Simulates a chain of masses connected by springs.
- Demonstrates coupled oscillations and the transfer of energy between connected masses.

## Controls

- **Scene Selector:** Switch between the three available simulations.
- **Play / Pause:** Start or pause the simulation.
- **Reset:** Restart the selected scene and restore its initial conditions.
- **Simulation Parameters:** Adjust any available scene-specific settings using the controls provided in the interface.

Select a scene from the scene selector to load it, then use the playback controls to run or pause the simulation.
