import { Node } from "./Node.js";

// Physics configuration constants
const PHYSICS_CONFIG = {
  DAMPING: 0.5,
  COLLISION_BUFFER: 5,
  RESTING_THRESHOLD: 0.15, // Velocity threshold for considering a node "at rest"
  SPRING_FORCE: 0.1,
  TARGET_LINK_LENGTH: 150,
  ANGULAR_RESTORING_FORCE: 0.01,
  WIND_DAMPING_FACTOR: 0.2
};

// Physics update function
export const updatePhysics = (nodes, links, windForce) => {
  // Phase 1: Basic physics (collision detection, damping, position updates)
  let allResting = true; // Will be calculated based on actual velocities

  nodes.forEach((node, index) => {
    if (node.parentNode === null) return; // Skip root node

    // Update position based on velocity
    node.position.x += node.velocity.x;
    node.position.y += node.velocity.y;

    // Apply damping to velocity
    node.velocity.x *= PHYSICS_CONFIG.DAMPING;
    node.velocity.y *= PHYSICS_CONFIG.DAMPING;

    // Calculate actual speed and determine if node is at rest
    const speed = Math.sqrt(node.velocity.x ** 2 + node.velocity.y ** 2);
    const isResting = speed < PHYSICS_CONFIG.RESTING_THRESHOLD;
    
    // Update node's resting state
    node.resting = isResting;
    
    // Track if ALL nodes are resting (for phase 2)
    if (!isResting) {
      allResting = false;
    }

    // Check for collisions with other nodes
    for (let i = index + 1; i < nodes.length; i++) {
      const otherNode = nodes[i];
      const dx = otherNode.position.x - node.position.x;
      const dy = otherNode.position.y - node.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = node.extends + otherNode.extends + PHYSICS_CONFIG.COLLISION_BUFFER;

      if (distance < minDistance) {
        // Resolve collision
        const angle = Math.atan2(dy, dx);
        const overlap = minDistance - distance;
        const resolveX = (overlap / 2) * Math.cos(angle);
        const resolveY = (overlap / 2) * Math.sin(angle);

        node.position.x -= resolveX;
        node.position.y -= resolveY;
        otherNode.position.x += resolveX;
        otherNode.position.y += resolveY;

        // Note: Velocity adjustments commented out to avoid fighting with spring forces
        // These could be re-enabled with careful tuning if needed
      }
    }
  });

  // Phase 2: Complex forces (spring, angular, wind) - only when nodes are stable
  if (allResting) {
    links.forEach((link, index) => {
      const source = link.source;
      const target = link.target;

      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const diff = distance - PHYSICS_CONFIG.TARGET_LINK_LENGTH;

      // Apply spring force to maintain link length
      const springForce = PHYSICS_CONFIG.SPRING_FORCE * (0.8*diff);
      const fx = (springForce * dx) / distance;
      const fy = (springForce * dy) / distance;

      target.velocity.x -= fx;
      target.velocity.y -= fy;
      source.velocity.x += fx;
      source.velocity.y += fy;

      // Calculate and store the initial angle for angular stability
      if (!link.initialAngle && target.resting && source.resting) {
        link.initialAngle = Math.atan2(dy, dx);
      }

      // Apply angular restoring force to maintain link orientation
      if (link.initialAngle !== undefined) {
        const currentAngle = Math.atan2(dy, dx);
        const angleDiff = currentAngle - link.initialAngle;

        // Clamp angle difference to prevent excessive forces
        const restoringForce = Math.max(
          Math.min(-PHYSICS_CONFIG.ANGULAR_RESTORING_FORCE * angleDiff, 0.1), 
          -0.1
        );

        const angleForceX = restoringForce * Math.cos(currentAngle + Math.PI / 2);
        const angleForceY = restoringForce * Math.sin(currentAngle + Math.PI / 2);

        target.velocity.x += angleForceX;
        target.velocity.y += angleForceY;
        source.velocity.x -= angleForceX;
        source.velocity.y -= angleForceY;
      }

      // Apply wind force for natural movement
      const windScaleFactor = (index + 1) ** 3 / links.length;

      target.velocity.x += windForce[0] * windScaleFactor;
      target.velocity.y += -windForce[1];
      source.velocity.x += windForce[0] * windScaleFactor;
      source.velocity.y += -windForce[1];

      // Apply additional damping for wind effects
      target.velocity.x *= 1 - PHYSICS_CONFIG.WIND_DAMPING_FACTOR;
      target.velocity.y *= 1 - PHYSICS_CONFIG.WIND_DAMPING_FACTOR;
      source.velocity.x *= 1 - PHYSICS_CONFIG.WIND_DAMPING_FACTOR;
      source.velocity.y *= 1 - PHYSICS_CONFIG.WIND_DAMPING_FACTOR;
    });
  }
};
