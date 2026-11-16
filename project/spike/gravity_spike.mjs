// Disposable risk spike: one moving body under one fixed Newtonian gravity source.
// Run with: node gravity_spike.mjs
//
// This intentionally does not import the game engine. It isolates the numerical
// risk: whether Verlet can keep a gravity-driven trajectory stable over time.

const G = 1.0;
const SOURCE_MASS = 800.0;
const SOFTENING = 0.05;       // Same order as the space-scene gravity softening.
const START_RADIUS = 3.0;
const TOTAL_TIME = 120.0;
const TIME_STEPS = [1 / 60, 1 / 120, 1 / 240, 1 / 480];

function acceleration(x, y) {
  const r2Soft = x * x + y * y + SOFTENING * SOFTENING;
  const factor = -G * SOURCE_MASS / Math.pow(r2Soft, 1.5);
  return { x: factor * x, y: factor * y };
}

function mechanicalEnergy(x, y, vx, vy) {
  const kinetic = 0.5 * (vx * vx + vy * vy);
  const radiusSoft = Math.sqrt(x * x + y * y + SOFTENING * SOFTENING);
  const potential = -G * SOURCE_MASS / radiusSoft;
  return kinetic + potential;
}

function run(dt) {
  // Start on an approximately circular orbit in the softened potential.
  let x = START_RADIUS;
  let y = 0;
  const vCircular = Math.sqrt(
    G * SOURCE_MASS * START_RADIUS * START_RADIUS /
    Math.pow(START_RADIUS * START_RADIUS + SOFTENING * SOFTENING, 1.5)
  );
  let vx = 0;
  let vy = vCircular;

  const E0 = mechanicalEnergy(x, y, vx, vy);
  let a = acceleration(x, y);
  let maxRelativeEnergyError = 0;
  const steps = Math.round(TOTAL_TIME / dt);

  for (let i = 0; i < steps; i++) {
    // Velocity-Verlet position update.
    const nextX = x + vx * dt + 0.5 * a.x * dt * dt;
    const nextY = y + vy * dt + 0.5 * a.y * dt * dt;

    const nextA = acceleration(nextX, nextY);

    // Velocity-Verlet velocity update.
    const nextVx = vx + 0.5 * (a.x + nextA.x) * dt;
    const nextVy = vy + 0.5 * (a.y + nextA.y) * dt;

    x = nextX;
    y = nextY;
    vx = nextVx;
    vy = nextVy;
    a = nextA;

    const energy = mechanicalEnergy(x, y, vx, vy);
    const relativeError = Math.abs((energy - E0) / E0);
    maxRelativeEnergyError = Math.max(maxRelativeEnergyError, relativeError);
  }

  return {
    dt,
    steps,
    maxRelativeEnergyError,
    finalRadius: Math.hypot(x, y),
    finalSpeed: Math.hypot(vx, vy),
  };
}

console.log("Fixed-source Newtonian gravity + velocity Verlet");
console.log(`G=${G}, source mass=${SOURCE_MASS}, softening=${SOFTENING}`);
console.log(`Initial radius=${START_RADIUS}, duration=${TOTAL_TIME} s`);
console.log("");
console.log("dt (s)       steps    max |ΔE/E0|       final r       final speed");

for (const dt of TIME_STEPS) {
  const result = run(dt);
  console.log(
    `${result.dt.toFixed(6).padEnd(12)} ` +
    `${String(result.steps).padEnd(8)} ` +
    `${result.maxRelativeEnergyError.toExponential(4).padEnd(17)} ` +
    `${result.finalRadius.toFixed(6).padEnd(13)} ` +
    `${result.finalSpeed.toFixed(6)}`
  );
}
