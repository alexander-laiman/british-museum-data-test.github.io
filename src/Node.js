// Define the Node class
export class Node {
  constructor(
    position,
    velocity,
    description = "",
    image = null,
    parent = null
  ) {
    this.position = position;
    this.velocity = velocity;
    this.extends = 30; // Default size for collision handling
    this.childNodes = [];
    this.parentNode = parent;
    this.userSelected = false;
    this.description = description;
    this.image = image;
    this.depth = parent ? parent.depth + 1 : 0; // Calculate depth based on parent
    this.resting = false; // Flag to indicate if node is at rest
    this.initialRestingChecked = false; // Ensure initial resting values are set only once
  }
}
