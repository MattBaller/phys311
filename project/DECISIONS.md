# Physics-Based Projectile Launcher — Implementation Decisions

## 1. Project Overview

The original project proposal outlined the development of an interactive physics-based projectile launcher in which users launch projectiles to collide with targets under different gravitational conditions. During development, several implementation decisions were made to improve numerical accuracy, physical realism, structural stability, computational performance, and user interaction.

This document records these decisions and their justification, including modifications to the original proposal and features deferred from the final implementation.

## 2. Selection of Numerical Integrator

**Decision:** Use velocity Verlet as the default numerical integrator while retaining Euler and Euler-Cromer as selectable alternatives.

**Reasoning:** Velocity Verlet provides second-order accuracy and improved long-term mechanical energy conservation for conservative systems. Euler integration introduces systematic numerical energy errors, while Euler-Cromer generally provides improved stability but lower accuracy.

The automated validation demonstrated that velocity Verlet produced the smallest errors in both analytical projectile motion and conservative gravitational motion. The 120-second conservative energy experiment resulted in a maximum relative mechanical energy drift of 0.0004882767%, below the required threshold of 0.3%.

Retaining all three integration methods also allows users to investigate the effects of numerical integration on simulated physical behavior.

## 3. Expansion to Rotating Rigid Bodies

**Decision:** Expand the original circular-particle collision model to support rotating rectangular rigid bodies.

**Reasoning:** The original particle model was sufficient for projectile-target collisions but limited the construction of realistic structures. Rectangular rigid bodies allow targets to be supported by structures that can collapse, translate, and rotate following projectile impacts.

The rigid-body implementation includes:

- Circular and rectangular body geometries.
- Angular position and angular velocity.
- Torque and moment of inertia.
- Rotational kinetic energy.
- Circle-circle, circle-rectangle, and rectangle-rectangle collisions.
- Collision impulses that account for rotational motion.

Rectangle-rectangle collision detection uses the Separating Axis Theorem (SAT). Collision impulses are applied at representative contact points, allowing off-center impacts to produce angular motion.

This expansion increases the physical realism and gameplay possibilities beyond the original proposal.

**Trade-off:** Rigid-body collisions introduce additional computational complexity and numerical challenges associated with sustained contact and stacked structures.

## 4. Contact Friction and Rolling Resistance

**Decision:** Implement static friction, kinetic friction, and rolling resistance through contact impulses rather than applying a general resistance force throughout the simulation.

**Reasoning:** Without contact friction, rectangular bodies and circular targets continue sliding or rolling for unrealistic periods following collisions. Applying friction only during contact better represents the physical interaction between surfaces.

The traditional launcher scene uses the following coefficients:

| Parameter | Value |
|---|---:|
| Static friction coefficient | 0.60 |
| Kinetic friction coefficient | 0.40 |
| Rolling resistance coefficient | 0.05 |

Static friction resists relative tangential motion at contact surfaces, while kinetic friction reduces sliding motion. Rolling resistance reduces sustained rotational motion of circular targets.

A low-speed restitution threshold of 0.2 LU/s is also used to suppress repeated small rebounds during resting contact.

**Trade-off:** These coefficients were selected to produce stable and physically plausible gameplay rather than obtained from experimental measurements of specific materials.

## 5. Iterative Collision Resolution

**Decision:** Introduce six collision solver iterations per physics timestep in the traditional launcher scene.

**Problem:** Initial testing revealed that stacked rectangular bodies gradually shifted or collapsed even when no projectiles were launched. Increasing the friction coefficients alone did not sufficiently eliminate this instability.

**Reasoning:** A single collision-resolution pass does not adequately resolve interactions between multiple simultaneously contacting bodies. Correcting one contact may introduce or modify another contact within the same structure.

The iterative collision solver repeatedly resolves body-body and body-boundary contacts during each physics timestep. Restitution is applied during the first solver iteration, while subsequent iterations focus on resolving remaining contacts without introducing repeated restitution impulses.

The numerical integration of motion is performed only once per physics timestep.

| Scene | Collision solver iterations |
|---|---:|
| Traditional launcher | 6 |
| Space launcher | 1 |
| Conservative launcher | 1 |
| Conservative test mode | 1 |

Following implementation, the traditional structure demonstrated improved stability, with approximately zero kinetic energy displayed after 60 simulated seconds without projectile launches.

**Trade-off:** Additional solver iterations increase computational cost. The increased iteration count is therefore restricted to the traditional launcher scene, where sustained contact between multiple rigid bodies is most significant.

## 6. Fixed-Timestep Physics and Rendering Independence

**Decision:** Separate physics integration from browser rendering through a fixed-timestep accumulator.

**Reasoning:** Browser rendering frequency depends on hardware performance, monitor refresh rate, and computational workload. Performing one physics calculation per rendered frame would cause the simulated motion to depend on the user's hardware.

Elapsed frame time is accumulated, and the physics engine executes discrete integration steps of a fixed duration whenever sufficient accumulated time is available.

A maximum of 64 physics substeps per rendered frame is enforced to prevent excessive computational workload following long processing delays.

A small floating-point tolerance is applied to the accumulator comparison to prevent rounding errors from incorrectly omitting individual physics steps.

Automated testing confirmed that rendering frequencies of 60 Hz and 144 Hz both produced 2,400 physics steps over 10 simulated seconds.

Browser CPU throttling produced the following results:

| CPU condition | FPS | Effective timestep (s) |
|---|---:|---:|
| No throttling | 60 | 0.0060004 |
| 4× slowdown | 60 | 0.0059998 |
| 6× slowdown | 59 | 0.0060000 |

These results support the consistency of the fixed-timestep implementation under the tested computational conditions.

**Trade-off:** During sufficiently long processing stalls, excess accumulated time is discarded to prevent an unbounded backlog of physics calculations. Consequently, simulated time may temporarily advance more slowly than real time under extreme computational loads.

## 7. Slingshot Launch Mechanism

**Decision:** Implement projectile launching by assigning an initial velocity proportional to the displacement between the projectile and the user's selected launch position.

**Reasoning:** Directly assigning the launch velocity provides predictable projectile trajectories and a simple interaction mechanism consistent with the original proposal.

The initial launch velocity is directed opposite the pulling direction, with its magnitude determined by the pulling displacement and launch-speed scaling factor.

Trajectory prediction provides visual feedback before launch, allowing the user to estimate the projectile's path.

The launch mechanism introduces energy and momentum into the system through external user interaction. Therefore, conservation of mechanical energy and momentum is not expected across the launch event.

**Trade-off:** The instantaneous velocity assignment approximates the behavior of a physical slingshot rather than explicitly simulating its elastic deformation and energy transfer.

## 8. Multiple Gravitational Environments

**Decision:** Implement multiple simulation scenes representing different gravitational environments.

**Reasoning:** Different gravitational environments allow the user to investigate projectile motion under uniform gravity and Newtonian gravitational attraction.

| Scene | Physical model |
|---|---|
| Traditional launcher | Uniform gravity, rigid-body structures, friction, and boundaries |
| Space launcher | Newtonian attraction toward a fixed gravitational source |
| Conservative launcher | Newtonian gravitational interactions between movable bodies |
| Conservative test mode | Controlled two-body gravitational system |

The traditional launcher provides familiar projectile motion and structural destruction gameplay. The space-based scenes demonstrate curved trajectories resulting from position-dependent gravitational acceleration.

The dedicated conservative test mode separates controlled numerical experiments from gameplay interactions.

**Trade-off:** Gameplay scenes may contain external interactions, fixed bodies, or target defeat mechanics that prevent them from behaving as strictly isolated physical systems. Conservation claims are therefore based on controlled validation experiments rather than unrestricted gameplay.

## 9. Energy and Momentum Diagnostics

**Decision:** Expand the debug HUD to display physical diagnostics alongside simulation performance information.

**Reasoning:** Displaying numerical quantities allows users to investigate the relationship between projectile motion, collisions, energy transfer, momentum, and numerical accuracy.

The HUD includes information such as:

- Simulated time and cumulative physics steps.
- Number of bodies.
- Total kinetic energy.
- Total mechanical energy.
- Accumulated energy loss.
- Relative energy deviation.
- Momentum deviation.
- Cursor position.
- Rendering frame rate.
- Physics substeps per frame.

Mechanical energy and accumulated energy loss are tracked separately to distinguish energy remaining in the simulated bodies from energy removed during dissipative interactions.

Momentum conservation is identified as not applicable in scenes where external forces or constraints prevent the simulated bodies from forming an isolated system.

**Trade-off:** The accumulated contact energy loss includes energy changes associated with numerical positional corrections. It should not be interpreted exclusively as physically dissipated energy. Mechanical energy conservation is evaluated independently in controlled conservative experiments.

## 10. Deterministic Reset and Permalink Functionality

**Decision:** Implement deterministic scene initialization and encode simulation settings within the URL hash.

**Reasoning:** Reproducibility is necessary for meaningful numerical experiments. Resetting a simulation with unchanged initial conditions and numerical parameters should reproduce the same physical behavior.

Unseeded random initialization is avoided so that repeated scene construction produces identical initial conditions.

The permalink functionality stores simulation control settings, allowing users to reproduce and share simulation configurations.

Automated validation confirmed:

- Identical numerical states after 3,000 physics steps in two independently initialized simulations.
- Successful encoding and decoding of simulation settings.
- Safe fallback to default settings for incomplete URL parameters.

**Trade-off:** Permalinks reproduce the initial simulation configuration rather than storing the complete time-dependent state or previous projectile-launching history.

## 11. Physics Engine and User Interface Separation

**Decision:** Maintain separation between the physics engine, rendering system, and user interface.

**Reasoning:** The physical model should operate independently of browser-specific functionality. This allows numerical experiments to be executed directly through Node.js without requiring a browser or graphical rendering.

The engine contains physical bodies, forces, numerical integrators, and collision-resolution algorithms. Rendering and user interaction are handled through separate modules.

The automated architecture audit confirmed that the physics engine contains no DOM dependencies.

This organization improves maintainability, modularity, and numerical reproducibility.

## 12. Automated Validation

**Decision:** Expand the automated validation suite to include both general engine regression tests and the quantitative experiments specified in the original project proposal.

**Reasoning:** Visual inspection alone is insufficient to establish numerical accuracy or physical correctness. Automated tests provide quantitative acceptance criteria and allow subsequent implementation changes to be evaluated against previously established behavior.

The final validation suite contains 28 passing assertions, including the following original proposal experiments:

| Experiment | Acceptance criterion | Measured result |
|---|---|---:|
| Conservative energy conservation | Drift below 0.3% | 0.0004882767% |
| Isolated collision momentum conservation | Relative error below 10⁻⁹ | 0.000000 |
| Inelastic collision energy reduction | Final KE below initial KE | 51.2% reduction |
| Timestep convergence | Landing speed difference below 0.5% | 0.0004391955% |

Additional tests evaluate integrator accuracy, collision energy accounting, coordinate transformations, deterministic reset behavior, accumulator consistency, pointer forces, permalink functionality, and architectural separation.

All 28 automated validation assertions passed. The complete numerical results and experimental conditions are documented in VALIDATION.md.

## 13. GitHub Pages Publishing Validation

**Decision:** Remove the previous automated publishing audit from the numerical validation suite.

**Reasoning:** The publishing audit included a requirement for a `.nojekyll` file, along with checks for root-relative asset paths and filename capitalization. The `.nojekyll` requirement was associated with an earlier project structure and is not necessarily required for the current static application.

The numerical validation suite is intended primarily to evaluate physics engine behavior and computational correctness. Live deployment is more appropriately evaluated by loading the published application and inspecting browser behavior.

The separate deployment verification should include:

- Successful loading of the published application.
- Successful loading of JavaScript modules and other required assets.
- Working simulation controls and projectile interactions.
- Correct filename capitalization and asset paths.
- Absence of browser console errors.

**Trade-off:** Removing the publishing audit also removes automated checks for asset paths and filename capitalization. These requirements must therefore be verified separately through deployment testing.

## 14. Scope Modifications and Deferred Features

The original proposal categorized implementation requirements into MUST, SHOULD, and COULD tiers. Development prioritized the mandatory functionality, numerical accuracy, and structural stability before optional gameplay enhancements.

### MUST Requirements

| Requirement | Status |
|---|---|
| Click-and-drag projectile launcher | Implemented |
| At least one playable level | Implemented |
| Projectile and collision-responsive targets | Implemented |
| Gravity and collision handling | Implemented |
| Reset and retry controls | Implemented |
| GitHub Pages deployment | Final verification required |

No original MUST gameplay requirements were intentionally removed.

### SHOULD Requirements

| Requirement | Status |
|---|---|
| Wind force | Deferred |
| Energy and momentum HUD | Implemented |
| Distinction between external interactions and numerical drift | Implemented |
| Numerical validation | Completed |
| Validation documentation | Completed |

Wind was deprioritized in favor of rigid-body motion, collision stability, contact friction, and numerical validation.

Although the original proposal included aerodynamic effects, wind is not required for the mandatory gameplay functionality or the controlled conservative validation experiments.

### COULD Requirements

| Requirement | Status |
|---|---|
| Mid-flight projectile actions | Deferred |
| Multiple levels and gravitational environments | Implemented |
| Multiple target layouts | Implemented |
| Numerical scoring system | Deferred |
| Limited-launch challenges | Partially implemented through finite projectile availability |

Mid-flight steering, detonation, and scoring were deprioritized because they introduce additional gameplay logic without directly improving the core physical model.

The available development effort was instead directed toward improved rigid-body dynamics, stable contact resolution, and quantitative validation.

## 15. Known Numerical and Physical Limitations

The final implementation contains several deliberate approximations and numerical limitations:

- Broad rectangular surface contacts are approximated using a single representative contact point rather than a complete multi-point contact manifold.
- Iterative collision resolution improves structural stability but does not guarantee indefinitely stable resting contact.
- Discrete collision detection may allow sufficiently fast-moving bodies to pass through thin objects between physics steps.
- Positional corrections used to resolve overlapping bodies may introduce artificial mechanical energy changes.
- Friction and rolling resistance coefficients are selected for plausible simulated behavior rather than calibrated against experimental measurements.
- The slingshot mechanism introduces external energy and momentum through instantaneous velocity assignment.
- Fixed gravitational sources and boundaries can exchange momentum with the simulated bodies.
- Target defeat and removal mechanics may alter the physical system.
- The fixed-timestep accumulator deliberately discards excess accumulated time during sufficiently long processing stalls.
- Validation results demonstrate accuracy under the tested conditions rather than guaranteeing accuracy for every possible simulation configuration.

These limitations are accepted because the project is intended to demonstrate computational mechanics through interactive gameplay rather than serve as a general-purpose engineering simulation package.

## 16. Final Project Assessment

The final implementation expands substantially beyond the original minimum projectile-launcher concept through the addition of rotational rigid-body dynamics, contact friction, iterative collision resolution, multiple gravitational environments, energy and momentum diagnostics, and reproducible simulation configurations.

Development decisions prioritized numerical accuracy, physical interpretation, structural stability, and reproducibility over optional gameplay features.

All three quantitative validation experiments specified in the original proposal passed their acceptance criteria, and the complete automated validation suite produced 28 passing assertions with zero failures.

Final browser-based deployment verification remains a separate acceptance requirement.