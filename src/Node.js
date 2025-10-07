// Define the Node class
export class Node {
  constructor(
    position,
    velocity,
    description = "",
    image = null,
    parent = null,
    id = null
  ) {
    this.position = position;
    this.velocity = velocity;
    this.extends = 30; // Default size for collision handling
    this.childNodes = [];
    this.parentNode = parent;
    this.userSelected = false;
    this.description = description;
    this.image = image;
    this.id = id; // Store the database ID for caching purposes
    this.instanceId = `${id || 'temp'}_${Date.now()}_${Math.random()}`; // Unique instance ID
    this.depth = parent ? parent.depth + 1 : 0; // Calculate depth based on parent
    this.resting = false; // Flag to indicate if node is at rest (calculated dynamically)
  }
}
