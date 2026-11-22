
// Integrators.js — swappable time-steppers.
// Supports translational and rotational motion.

function setAcc(bodies) {
  for (const b of bodies) {

    // Translational acceleration: a = F/m
    b.acc.set(
      b.force.x * b.invMass,
      b.force.y * b.invMass
    );

    // Angular acceleration: alpha = torque/I
    b.alpha = (b.torque ?? 0) * (b.invI ?? 0);
  }
}


// ---------- Euler ----------

export const Euler = {
  name: 'euler',
  label: 'Euler (explicit)',

  step(world, dt) {
    world.accumulateForces();
    setAcc(world.bodies);

    for (const b of world.bodies) {
      if (b.fixed || b.locked) continue;

      // Translational motion
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;

      b.vel.x += b.acc.x * dt;
      b.vel.y += b.acc.y * dt;

      // Rotational motion
      b.angle += b.omega * dt;
      b.omega += b.alpha * dt;
    }
  }
};


// ---------- Euler-Cromer ----------

export const EulerCromer = {
  name: 'ec',
  label: 'Euler-Cromer (symplectic)',

  step(world, dt) {
    world.accumulateForces();
    setAcc(world.bodies);

    for (const b of world.bodies) {
      if (b.fixed || b.locked) continue;

      // Translational motion
      b.vel.x += b.acc.x * dt;
      b.vel.y += b.acc.y * dt;

      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;

      // Rotational motion
      b.omega += b.alpha * dt;
      b.angle += b.omega * dt;
    }
  }
};


// ---------- Velocity Verlet ----------

export const Verlet = {
  name: 'verlet',
  label: 'Velocity Verlet (symplectic)',

  step(world, dt) {
    world.accumulateForces();
    setAcc(world.bodies);

    const half = [];

    // First half-step
    for (const b of world.bodies) {

      if (b.fixed || b.locked) {
        half.push(null);
        continue;
      }

      // Half-step translational velocity
      const vhx = b.vel.x + 0.5 * b.acc.x * dt;
      const vhy = b.vel.y + 0.5 * b.acc.y * dt;

      // Half-step angular velocity
      const wh = b.omega + 0.5 * b.alpha * dt;

      // Update position
      b.pos.x += vhx * dt;
      b.pos.y += vhy * dt;

      // Update orientation
      b.angle += wh * dt;

      // Store half-step velocities
      half.push([vhx, vhy, wh]);
    }

    // Recalculate forces and torques
    world.accumulateForces();
    setAcc(world.bodies);

    // Second half-step
    world.bodies.forEach((b, i) => {

      if (b.fixed || b.locked) return;

      // Complete translational velocity
      b.vel.x = half[i][0] + 0.5 * b.acc.x * dt;
      b.vel.y = half[i][1] + 0.5 * b.acc.y * dt;

      // Complete angular velocity
      b.omega = half[i][2] + 0.5 * b.alpha * dt;
    });
  }
};


// ---------- Integrator registry ----------

export const INTEGRATORS = {
  euler: Euler,
  ec: EulerCromer,
  verlet: Verlet
};
