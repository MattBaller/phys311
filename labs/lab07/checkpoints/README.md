**Architecture**

Body: Stores each disk's mass, position, velocity, and collision radius.

Force: Spring and NewtonGravity calculate interactions between bodies.

Integrator: Velocity Verlet advances the simulation.

World: Coordinates force calculations, integration, collision handling, and data recording.

CircleCollisions: Detects overlapping disks and resolves collisions using an impulse-based method.


**Procedure**

Open lab07_mini_project.ipynb in the project's Python environment.

Ensure NumPy and Matplotlib are installed.

Run the notebook cells in order.

Inspect the trajectory plot, collision count, and conservation-law panel.

Run the notebook from a location where Python can import the lab07_engine package.


**Validation**

The simulation records total mechanical energy and total linear momentum. Since the model has no external forces or fixed supports, both quantities should remain approximately constant. The elastic collision counter verifies that the collision-resolution method is exercised during the run.

Numerical integration and overlap correction may produce small errors. These are measured and displayed rather than assumed to be zero.


**Purpose**

This mini-project combines multiple engine components into a single scene and establishes a baseline for porting the physics model to JavaScript in the next stage.