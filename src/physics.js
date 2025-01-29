import { Node } from "./Node.js";

// Physics update function
export // Physics update function
const updatePhysics = (nodes, links, windForce) => {
  const damping = 0.8; // Damping factor for smooth movement
  const collisionBuffer = 5; // Buffer distance to avoid overlap

  let allResting = true; // Check if all nodes are at rest

  nodes.forEach((node, index) => {
    if (node.parentNode === null) return; // Skip root node

    // Update position based on velocity
    node.position.x += node.velocity.x;
    node.position.y += node.velocity.y;

    // Apply damping to velocity
    node.velocity.x *= damping;
    node.velocity.y *= damping;

    // Check if node is effectively at rest
    const speed = Math.sqrt(node.velocity.x ** 2 + node.velocity.y ** 2);

    if (!node.initialRestingChecked) {
      node.resting = true;
      node.initialRestingChecked = true; // Set rest state once
    }

    // Check for collisions with other nodes
    for (let i = index + 1; i < nodes.length; i++) {
      const otherNode = nodes[i];
      const dx = otherNode.position.x - node.position.x;
      const dy = otherNode.position.y - node.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = node.extends + otherNode.extends + collisionBuffer;

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

        // Adjust velocities
        //node.velocity.x -= resolveX * 0.1;
        //node.velocity.y -= resolveY * 0.1;
        //otherNode.velocity.x += resolveX * 0.1;
        //otherNode.velocity.y += resolveY * 0.1;
      }
    }
  });

  // Only fix link lengths and apply restoring forces once nodes are at rest
  if (allResting) {
    links.forEach((link, index) => {
      const source = link.source;
      const target = link.target;

      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const targetLength = 150; // Fixed link length
      const diff = distance - targetLength;

      // Apply spring force
      const springForce = 0.15 * diff; // Clamp spring force
      const fx = (springForce * dx) / distance;
      const fy = (springForce * dy) / distance;

      target.velocity.x -= fx;
      target.velocity.y -= fy;
      source.velocity.x += fx;
      source.velocity.y += fy;

      // Calculate and store the initial angle
      if (!link.initialAngle && target.resting && source.resting) {
        link.initialAngle = Math.atan2(dy, dx); // Store initial angle once
      }

      // Apply angular restoring force
      if (link.initialAngle !== undefined) {
        const currentAngle = Math.atan2(
          target.position.y - source.position.y,
          target.position.x - source.position.x
        );
        const angleDiff = currentAngle - link.initialAngle;

        // Clamp angle difference
        const restoringForce = Math.max(Math.min(-0.05 * angleDiff, 0.1), -0.1); // Stabilize restoring force

        const angleForceX =
          restoringForce * Math.cos(currentAngle + Math.PI / 2);
        const angleForceY =
          restoringForce * Math.sin(currentAngle + Math.PI / 2);

        target.velocity.x += angleForceX;
        target.velocity.y += angleForceY;
        source.velocity.x -= angleForceX;
        source.velocity.y -= angleForceY;
      }

      // Apply wind force
      const windScaleFactor = (index + 1) ** 3 / links.length; // Smaller indices get less wind

      target.velocity.x += windForce[0] * windScaleFactor;
      target.velocity.y += -windForce[1];

      source.velocity.x += windForce[0] * windScaleFactor;
      source.velocity.y += -windForce[1];

      // Apply damping force directly in world space
      const dampingFactor = 0.2; // Damping strength (adjust as needed)

      // Apply damping to the target node
      target.velocity.x *= 1 - dampingFactor;
      target.velocity.y *= 1 - dampingFactor;

      // Apply damping to the source node
      source.velocity.x *= 1 - dampingFactor;
      source.velocity.y *= 1 - dampingFactor;
    });
  }
};
