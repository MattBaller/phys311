**PHYSICS-BASED PROJECTILE LAUNCHER**
Physics 311 — Project Proposal by Matthew Nallar

*A1 — Title & pitch*
Launch, collide, and hit every target: visitors pull back a projectile and release it, then adjust their next shot to knock down the remaining targets.

*A2 — The physics*
Bodies move in 2D under these forces and constraints:
• Gravity: planet level F_g=mg; space level F_ij=G  (m_i  m_j)/(|r_j  - r_i |³)  (r_j  - r_i ) Air resistance/wind: F_drag  = ½ ρC_D A|v_wind  - v|(v_wind  - v), directed with the relative airflow.
• Slingshot: pulling the projectile by Δr sets its launch velocity opposite the pull,  v₀ =-kLΔr (kL is the launch-speed scale).
• Collisions: circular bodies cannot overlap; at contact, an impulse along the line of centers changes their velocities, with normal relative speed after impact = −e times its value before impact.
Use velocity Verlet for gravity-driven trajectories because it is time-reversible and limits long-term energy drift in conservative motion. Use Euler-Cromer only if a strongly dissipative case makes it more suitable. The wind-off, no-launch case is the conservative reduction.
Units are scaled simulation units: length (LU), mass (MU), and seconds, with G = 1 LU³/(MU·s²). Typical scene scale is 1–20 LU, projectile mass about 1 MU, source masses about 500–800 MU, and launch speeds about 5–12 LU/s.

*A3 — Three-tier scope*
MUST — due end of Week 12
A working click-and-drag launcher, one level, a projectile, and targets that respond to collisions.
Basic gravity and collision handling, reset/retry controls, and deployment to GitHub Pages.
SHOULD
Add the wind force and a HUD showing energy and momentum, with external-force effects distinguished from numerical drift.
Complete the numerical validation tests and document their results.
COULD — either item can be dropped
Mid-flight projectile actions, such as changing direction or detonating.
Multiple levels, target layouts, scoring, and limited-launch challenges.

*A4 — Validation plan*
1. Conservative energy test: disable wind, drag, launches, and collisions; use Verlet with Δt = 1/240 s for 120 s. Expected: mechanical energy remains constant, with |ΔE/E₀| < 0.3%.
2. Isolated collision test: two-body collision with coefficient of restitution e = 0.6. Expected: |Δp|/|p₀| < 10⁻⁹ and total kinetic energy strictly decreases.
3. Time-step check: repeat the same no-wind projectile shot with Δt = 1/120 s and 1/240 s. Expected: the measured landing speed differs by < 0.5%. Wind and any mid-flight action will be disabled during conservation tests because they apply external momentum and/or energy.

*A5 — Biggest risk + fallback*
The thing most likely to sink this project is making the gravity-driven trajectories stable and testable, and my fallback is a planet-based level with uniform gravity instead of Newtonian attraction.

*A6 — Week-by-week timeline*
Week 11: Complete proposal and a risk spike testing launcher, collisions, and gravity.
Week 12: Finish the entire MUST tier and deploy the playable game to GitHub Pages.
Week 13: Add SHOULD features; complete validation report and documentation, polish, and launch.

*A7 — Audience*
This is for gamers who enjoy physics-based games; after two minutes, they should understand how launch direction, speed, gravity, wind, and collisions determine whether a projectile hits its targets.
