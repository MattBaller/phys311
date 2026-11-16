# Physics 311 — Slingshot Physics Simulation

## 1. What it is

This project is a browser-based, two-dimensional physics game built for Physics 311. The player uses a slingshot-style launcher to fire projectiles at target bodies ("pigs"). The simulation combines a physics engine with canvas rendering and a user interface.

The project separates physics calculations from drawing and user input. It can be run in a browser, while the physics validation script can be run from the command line.

### Running the project

1. Open the project folder in VS Code.
2. Open `index.html` with the **Live Server** extension.
3. Use the browser page that Live Server opens.

Do not open the module-based `index.html` directly with a `file://` URL. Browser security restrictions can prevent its JavaScript modules from loading.

If the project includes a standalone build, `standalone.html` can be opened directly in a browser.

---

## 2. What physics

The simulation models motion and collisions in two dimensions.

- **Newton's second law:** Forces determine each body's acceleration, which is used to update its velocity and position over time.
- **Gravity:** A constant downward acceleration acts on bodies in the scene.
- **Time integration:** The integrator advances the system in discrete time steps. The timestep control changes the size of each physics step.
- **Collisions:** Bodies are represented by circular collision shapes. When bodies collide, the collision response changes their velocities according to the collision geometry and coefficient of restitution.
- **Restitution:** The fixed restitution value is 0.40. A collision with a restitution below 1 is inelastic, so some kinetic energy is dissipated.
- **Slingshot interaction:** The projectile is pulled away from its launch position and released. The pull determines the projectile's launch velocity.
- **Target removal:** A target is removed when it experiences a sufficiently hard collision.

The interface displays fixed physics parameters: gravity is 9.81 m/s², restitution is 0.40, drag coefficient is 0, and time scale is 1.00×.

---

## 3. How to use

### Simulation controls

| Control | Action |
|---|---|
| **Timestep slider** | Changes the physics timestep used to advance the simulation. Smaller values use more, shorter physics steps; larger values use fewer, longer steps. |
| **Pause** | Pauses the simulation. Press it again to resume. |
| **Step** | Advances the simulation by one physics step while paused. |
| **Reset** | Restores the initial scene and resets the simulation. |
| **Copy Link** | Copies a URL representing the current simulation state, where supported by the current build. |

### Launching a projectile

1. Click and hold the available projectile.
2. Drag it away from its launch position to set the launch direction and pull distance.
3. Release the pointer to launch it.
4. Observe the projectile's motion and its collisions with the targets.

The projectile can be aimed before it is launched. Once released, it is no longer in the aiming state and should not be draggable as though it were still attached to the slingshot.

---

## 4. How you know it's right

The project includes a headless validation script for checking the physics without opening the browser.

From the project root, run:

```bash
node tests/validate.js
```

The validation checks are intended to catch errors in the underlying physics, including:

- **Determinism:** Repeating the same initial conditions and number of steps should produce the same result.
- **Time-step behavior:** The physics should advance according to simulated time, rather than changing its physical speed simply because the browser renders frames at a different rate.
- **Collision response:** Collisions should update body velocities consistently with the collision model and the specified restitution.
- **Momentum behavior:** Momentum should be conserved in an isolated system when no external forces act. Gravity, wall interactions, and user-controlled forces can change the momentum of the bodies being considered.
- **Interaction behavior:** Pointer input should affect the intended body and should not continue to control a projectile after it has been launched.

A passing validation script is evidence that the tested cases behave as expected. It does not prove that every possible scene, timestep, or collision arrangement is error-free. Browser testing is still necessary to check the complete game, its controls, and its rendering.

---

## 5. Known limitations

- **Circular collision shapes:** Bodies use circle-based collision detection and response. The simulation does not model detailed contact between arbitrary shapes.
- **Simplified collision solving:** Collisions are handled with a simplified impulse response. Dense groups of overlapping bodies or several simultaneous impacts may produce jitter or imperfect results.
- **No rotational dynamics:** The current model focuses on translational motion. It does not fully model angular momentum, torque, or spin.
- **Numerical approximation:** Motion is advanced in finite time steps. Large timesteps can make trajectories and collisions less accurate or less stable.
- **Simplified environment:** The game uses a fixed scene and simplified physics parameters rather than a fully configurable physical environment.
- **Not a full rigid-body engine:** The project is an educational simulation. It does not include all of the contact, friction, constraint, and shape-handling features found in a general-purpose physics engine.

---

*Physics 311 — Computational Mechanics.*
