import React, { useState, useEffect, useRef, useImperativeHandle } from "react";
import { Node } from "./Node.js";
import { updatePhysics } from "./physics.js";
import "./treestyle.css";
import * as d3 from "d3";

// Tree configuration constants
const TREE_CONFIG = {
  // Zoom settings
  MIN_ZOOM: 0.2,
  MAX_ZOOM: 2.0,
  DEFAULT_ZOOM: 1.0,
  
  // Tree layout
  EDGE_LENGTH: 200,
  CHILD_SPREAD: 50,
  CHILD_OFFSET_Y: -50,
  
  // UI settings
  PADDING: 100,
  TRANSITION_DURATION: 750,
  NODE_RADIUS: 30,
  
  // Physics
  WIND_FORCE_MULTIPLIER: 0.00065,
  WIND_FORCE_BASE: 0.12
};

// Input validation function
const validateProps = ({ searchHistory, similarRecords, onNodeSelect, activeNode }) => {
  const errors = [];
  
  if (!Array.isArray(searchHistory)) {
    errors.push('searchHistory must be an array');
  }
  
  if (typeof onNodeSelect !== 'function') {
    errors.push('onNodeSelect must be a function');
  }
  
  if (similarRecords && typeof similarRecords !== 'object') {
    errors.push('similarRecords must be an object');
  }
  
  return errors;
};

// Safe data access helper
const safeGetSimilarRecords = (targetObject, similarRecords) => {
  if (!targetObject?.id || !similarRecords) return null;
  return similarRecords[targetObject.id] || null;
};

// Debug utility
const createDebugLogger = (componentName) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  return {
    log: (message, data) => {
      if (isDev) {
        console.log(`[${componentName}] ${message}`, data);
      }
    },
    error: (message, error) => {
      console.error(`[${componentName}] ${message}`, error);
    },
    warn: (message, data) => {
      if (isDev) {
        console.warn(`[${componentName}] ${message}`, data);
      }
    }
  };
};

export const TreeGraph = React.forwardRef(({
  searchHistory,
  similarRecords,
  onNodeSelect,
  activeNode,
  testRef,
}, ref) => {
  const containerRef = useRef(null); // Reference to the div container
  const svgRef = useRef(null); // Reference to the SVG
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  }); // Default size
  const [links, setLinks] = useState([]);
  const nodesRef = useRef([]);
  const windForceRef = useRef(0);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 }); // Pan and zoom state
  const zoomRef = useRef(null); // Reference to the zoom behavior
  const [maxDepth, setMaxDepth] = useState(0); // Track maximum tree depth
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const rootNodeRef = useRef(null); // Optimize root node lookup
  const debug = createDebugLogger('TreeGraph');

  // Error handler
  const handleError = (error, errorInfo) => {
    console.error('TreeGraph error:', error, errorInfo);
    setHasError(true);
    setErrorMessage(error.message || 'An error occurred');
  };

  // Function to calculate maximum depth of the tree
  const calculateMaxDepth = (nodes) => {
    if (!nodes || nodes.length === 0) return 0;
    return Math.max(...nodes.map(node => node.depth));
  };

  // Function to calculate the maximum distance from root to any leaf node
  const calculateMaxTreeHeight = (rootNode) => {
    if (!rootNode) return 0;
    
    let maxHeight = 0;
    
    const traverse = (node, currentHeight) => {
      if (node.childNodes.length === 0) {
        // Leaf node - check if this is the deepest path
        maxHeight = Math.max(maxHeight, currentHeight);
      } else {
        // Internal node - traverse children
        node.childNodes.forEach(child => {
          // Calculate distance from parent to child
          const distance = Math.sqrt(
            Math.pow(child.position.x - node.position.x, 2) + 
            Math.pow(child.position.y - node.position.y, 2)
          );
          traverse(child, currentHeight + distance);
        });
      }
    };
    
    traverse(rootNode, 0);
    return maxHeight;
  };

  // Function to calculate the center position of multiple nodes
  const calculateNodesCenter = (nodes) => {
    if (!nodes || nodes.length === 0) return null;
    
    if (nodes.length === 1) {
      return nodes[0].position;
    }
    
    // For multiple nodes, we have two strategies:
    // 1. If odd number of nodes: find the actual center node
    // 2. If even number of nodes: average the positions of the two center nodes
    
    if (nodes.length % 2 === 1) {
      // Odd number of nodes - find the center node
      const centerIndex = Math.floor(nodes.length / 2);
      const centerNode = nodes[centerIndex];
      debug.log('Odd number of nodes, using center node at index:', centerIndex, centerNode?.description);
      return centerNode.position;
    } else {
      // Even number of nodes - average the two center nodes
      const centerIndex1 = nodes.length / 2 - 1;
      const centerIndex2 = nodes.length / 2;
      const centerNode1 = nodes[centerIndex1];
      const centerNode2 = nodes[centerIndex2];
      
      const averageX = (centerNode1.position.x + centerNode2.position.x) / 2;
      const averageY = (centerNode1.position.y + centerNode2.position.y) / 2;
      
      debug.log('Even number of nodes, averaging center nodes at indices:', centerIndex1, centerIndex2, {
        node1: centerNode1?.description,
        node2: centerNode2?.description,
        averagePosition: { x: averageX, y: averageY }
      });
      
      return {
        x: averageX,
        y: averageY
      };
    }
  };

  // Function to smoothly move view to a specific node or center of multiple nodes
  const smoothMoveToNode = (targetNodeOrNodes, delay = 100) => {
    // Handle both single node and array of nodes
    const nodes = Array.isArray(targetNodeOrNodes) ? targetNodeOrNodes : [targetNodeOrNodes];
    const centerPosition = calculateNodesCenter(nodes);
    
    debug.log('smoothMoveToNode called:', { 
      nodeCount: nodes.length, 
      centerPosition, 
      delay,
      nodeDescriptions: nodes.map(n => n?.description)
    });
    
    if (!zoomRef.current || !svgRef.current || !centerPosition) {
      debug.log('smoothMoveToNode: Missing refs or center position');
      return;
    }
    
    // Add delay before the transition
    setTimeout(() => {
      // Get SVG dimensions
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgWidth = svgRect.width;
      const svgHeight = svgRect.height;
      
      const svg = d3.select(svgRef.current);
      const currentTransform = d3.zoomTransform(svg.node()) || d3.zoomIdentity;
      
      // Calculate target position to center the nodes in the view
      const translateX = svgWidth / 2 - centerPosition.x * currentTransform.k;
      const translateY = svgHeight / 2 - centerPosition.y * currentTransform.k;
      
      const targetTransform = d3.zoomIdentity
        .translate(translateX, translateY)
        .scale(currentTransform.k); // Keep current zoom level
      
      debug.log('smoothMoveToNode: Applying smooth transition', {
        from: { x: currentTransform.x, y: currentTransform.y, k: currentTransform.k },
        to: { x: translateX, y: translateY, k: currentTransform.k },
        centerPosition,
        nodeCount: nodes.length
      });
      
      svg.transition()
        .duration(TREE_CONFIG.TRANSITION_DURATION)
        .call(zoomRef.current.transform, targetTransform)
        .on("end", () => {
          debug.log('smoothMoveToNode: Smooth transition completed');
        });
    }, delay);
  };

  // Function to auto-zoom based on tree structure (for initial setup only)
  const autoZoomForDepth = (newMaxDepth) => {
    debug.log('autoZoomForDepth called with depth:', { newMaxDepth, nodeCount: nodesRef.current.length });
    
    if (!zoomRef.current || !svgRef.current || !nodesRef.current.length) {
      debug.log('autoZoomForDepth: Missing refs or no nodes');
      return;
    }
    
    const rootNode = rootNodeRef.current || nodesRef.current.find(node => node.parentNode === null);
    if (!rootNode) {
      debug.log('autoZoomForDepth: No root node found');
      return;
    }
    
    // Get SVG dimensions
    const svgRect = svgRef.current.getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;
    
    // Calculate zoom based on tree structure
    let finalZoom;
    
    if (nodesRef.current.length === 1) {
      // Single node case
      finalZoom = TREE_CONFIG.DEFAULT_ZOOM;
      debug.log('autoZoomForDepth: Single node case, zoom:', finalZoom);
    } else {
      // Multi-node case - calculate based on tree height
      const estimatedTreeHeight = newMaxDepth * TREE_CONFIG.EDGE_LENGTH;
      
      // Calculate zoom to fit the estimated tree height with some padding
      const zoomToFit = (svgHeight - TREE_CONFIG.PADDING * 2) / estimatedTreeHeight;
      
      // Use a reasonable zoom range
      finalZoom = Math.max(TREE_CONFIG.MIN_ZOOM, Math.min(TREE_CONFIG.MAX_ZOOM, zoomToFit));
      
      debug.log('autoZoomForDepth: Multi-node case', {
        estimatedTreeHeight,
        zoomToFit,
        finalZoom,
        newMaxDepth
      });
    }
    
    // Center on the root node
    const translateX = svgWidth / 2 - rootNode.position.x * finalZoom;
    const translateY = svgHeight / 2 - rootNode.position.y * finalZoom;
    
    const svg = d3.select(svgRef.current);
    const currentTransform = d3.zoomTransform(svg.node()) || d3.zoomIdentity;
    
    const targetTransform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(finalZoom);
    
    debug.log('autoZoomForDepth: Applying zoom transition', {
      from: { x: currentTransform.x, y: currentTransform.y, k: currentTransform.k },
      to: { x: translateX, y: translateY, k: finalZoom },
      rootPosition: rootNode.position
    });
    
    svg.transition()
      .duration(TREE_CONFIG.TRANSITION_DURATION)
      .call(zoomRef.current.transform, targetTransform)
      .on("end", () => {
        debug.log('autoZoomForDepth: Zoom transition completed');
        const finalTransform = d3.zoomTransform(svg.node());
        debug.log('autoZoomForDepth: Final transform after transition', finalTransform);
        
        // Fallback: if the zoom didn't change, force it
        if (Math.abs(finalTransform.k - finalZoom) > 0.01) {
          debug.log('autoZoomForDepth: Zoom not applied correctly, forcing it');
          svg.call(zoomRef.current.transform, targetTransform);
        }
      });
  };

  const updateTreeFromHistory = (searchHistory, similarRecords, activeNode) => {
    if (!searchHistory.length) return;

    // Track newly created nodes for smooth transitions
    const newlyCreatedNodes = [];

    // 1️⃣ Ensure Root Node Exists
    let rootNode = nodesRef.current.find(
      (node) => node.description === searchHistory[0].text_for_embedding
    );
    if (!rootNode) {
      // Position root node at origin (0,0) - we'll center the view on it
      rootNode = new Node(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        searchHistory[0].text_for_embedding,
        searchHistory[0].Image,
        null, // Root has no parent
        searchHistory[0].id // Pass the database ID
      );
      nodesRef.current.push(rootNode);
      rootNodeRef.current = rootNode; // Store reference for optimization
      newlyCreatedNodes.push(rootNode);
    }

    // Find the active node in our tree - this will be the parent for new children
    let parentNode = rootNode; // Default to root
    if (activeNode) {
      const activeNodeInTree = nodesRef.current.find(
        (node) => node.description === activeNode.description
      );
      if (activeNodeInTree) {
        parentNode = activeNodeInTree;
      }
    }

    // 🟢 **Attach Similar Objects to the Active Node**
    // Find the object that corresponds to the active node to get its similar objects
    let targetObject = null;
    
    // If we have an active node, find the corresponding object in search history
    if (activeNode) {
      targetObject = searchHistory.find(
        (item) => item.text_for_embedding === activeNode.description
      );
    }
    
    // Fallback to the last object in search history if no active node match
    if (!targetObject) {
      targetObject = searchHistory[searchHistory.length - 1];
    }
    
    const similarRecordsForTarget = safeGetSimilarRecords(targetObject, similarRecords);
    if (similarRecordsForTarget) {
      // Filter out similar objects that already exist anywhere in the tree
      const filteredSimilarObjects = similarRecordsForTarget.filter((similarObject) => {
        // Check if this object already exists anywhere in the tree
        const existsInTree = nodesRef.current.some(
          (node) => node.description === similarObject.text_for_embedding
        );
        return !existsInTree;
      });

      filteredSimilarObjects.forEach((similarObject, i) => {
        // ✅ Prevent adding the parent node as its own child
        if (parentNode.description === similarObject.text_for_embedding) {
          return;
        }


        const childPosition = {
          x:
            parentNode.position.x +
            (i - Math.floor(filteredSimilarObjects.length / 2)) * TREE_CONFIG.CHILD_SPREAD,
          y: parentNode.position.y + TREE_CONFIG.CHILD_OFFSET_Y,
        };

        // ✅ Attach similarObject node to the active parent node
        const childNode = new Node(
          childPosition,
          { x: 0, y: 0 },
          similarObject.text_for_embedding,
          similarObject.Image,
          parentNode,
          similarObject.id // Pass the database ID
        );
        parentNode.childNodes.push(childNode);
        nodesRef.current.push(childNode);
        newlyCreatedNodes.push(childNode);

        const newLink = { 
          source: parentNode, 
          target: childNode,
          similarityScore: similarObject.similarityScore || 0
        };
        
        
        setLinks((prevLinks) => [
          ...prevLinks,
          newLink
        ]);
      });
    }

    // Return newly created nodes for smooth transition handling
    return newlyCreatedNodes;
  };


  // Hook to ensure tree updates dynamically when history changes
  useEffect(() => {
    const previousNodeCount = nodesRef.current.length;
    const newlyCreatedNodes = updateTreeFromHistory(searchHistory, similarRecords, activeNode);
    const currentNodeCount = nodesRef.current.length;
    
    // Check if tree depth has increased and handle view transitions
    const currentMaxDepth = calculateMaxDepth(nodesRef.current);
    const isFirstNode = currentNodeCount === 1 && previousNodeCount === 0;
    const hasNewNodes = newlyCreatedNodes && newlyCreatedNodes.length > 0;
    
    debug.log('TreeGraph useEffect:', {
      previousNodeCount,
      currentNodeCount,
      currentMaxDepth,
      maxDepth,
      isFirstNode,
      hasNewNodes,
      newlyCreatedNodesCount: newlyCreatedNodes?.length || 0
    });
    
    if (isFirstNode) {
      // First node created - use auto-zoom to set up initial view
      setMaxDepth(currentMaxDepth);
      debug.log('First node created, calling autoZoomForDepth with depth:', currentMaxDepth);
      //autoZoomForDepth(currentMaxDepth);
    } else if (hasNewNodes) {
      // New nodes created - use smooth transition to center of all newly created nodes
      setMaxDepth(currentMaxDepth);
      debug.log('New nodes created, calling smoothMoveToNode for center of:', newlyCreatedNodes.length, 'nodes');
      //smoothMoveToNode(newlyCreatedNodes, 100); // 100ms delay as requested
    }
  }, [searchHistory, similarRecords, activeNode]); // Removed maxDepth to prevent infinite loops


  // Update container size dynamically
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize(); // Set initial size
    window.addEventListener("resize", updateSize); // Listen for resizes
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Remove the initial empty tree creation - we'll only show trees when there's real data

  // Handle node clicks
  const handleNodeClick = (_, node) => {
    node.userSelected = false;

    // Notify App.js that a new node was selected
    onNodeSelect(node);
  };

  // Reset view to center and default zoom
  const resetView = () => {
    if (svgRef.current && containerSize.width > 0 && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      
      // If we have nodes, center on the first node (root), otherwise center on view
      if (nodesRef.current.length > 0) {
        const rootNode = nodesRef.current[0];
        const resetTransform = d3.zoomIdentity
          .translate(
            containerSize.width / 2 - rootNode.position.x,
            containerSize.height / 2 - rootNode.position.y
          )
          .scale(1);
        
        svg.transition()
          .duration(TREE_CONFIG.TRANSITION_DURATION)
          .call(zoomRef.current.transform, resetTransform);
      } else {
        // No nodes yet, just center the view
        const resetTransform = d3.zoomIdentity
          .translate(containerSize.width / 2, containerSize.height / 2)
          .scale(1);
        
        svg.transition()
          .duration(TREE_CONFIG.TRANSITION_DURATION)
          .call(zoomRef.current.transform, resetTransform);
      }
    }
  };


  useEffect(() => {
    const svg = d3
      .select(svgRef.current)
      .attr("width", containerSize.width)
      .attr("height", containerSize.height)
      .style("background-color", "black");

    // Create a group for all tree elements that can be transformed
    const g = svg.append("g");

    // Set up zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4]) // Limit zoom range
      .on("zoom", (event) => {
        const { transform } = event;
        setTransform({ x: transform.x, y: transform.y, k: transform.k });
        g.attr("transform", transform);
      });

    // Store zoom behavior in ref for access by reset function
    zoomRef.current = zoom;

    // Apply zoom behavior to the SVG
    svg.call(zoom);

    // Set initial view - will be centered when real tree data loads
    const initialTransform = d3.zoomIdentity
      .translate(containerSize.width / 2, containerSize.height / 2)
      .scale(1);
    
    
    svg.call(zoom.transform, initialTransform);
    setTransform({ x: initialTransform.x, y: initialTransform.y, k: initialTransform.k });
    


    const animate = () => {
      // Only animate if we have nodes
      if (nodesRef.current.length > 0) {
        // Generate a smooth wind force
        windForceRef.current = [
          Math.sin(Date.now() / 5000) * TREE_CONFIG.WIND_FORCE_MULTIPLIER +
            Math.sin(Date.now() / 10000 + 213) * 0.00005 +
            Math.sin(Date.now() / 500 + 0.42) * 0.0006 +
            Math.sin(Date.now() / 5 + 0.1) * 0.00005 +
            Math.sin(Date.now() / 5 + 0.16) * 0.00002,
          TREE_CONFIG.WIND_FORCE_BASE,
        ]; // Smooth oscillating force
        updatePhysics(nodesRef.current, links, windForceRef.current);
      }
      
      // Render links
      g.selectAll("line")
        .data(links)
        .join("line")
        .attr("x1", (d) => d.source.position.x)
        .attr("y1", (d) => d.source.position.y)
        .attr("x2", (d) => d.target.position.x)
        .attr("y2", (d) => d.target.position.y)
        .attr("stroke", "white")
        .attr("stroke-width", 2);

      // Render similarity score labels
      g.selectAll("text.similarity-label")
        .data(links)
        .join("text")
        .attr("class", "similarity-label")
        .attr("x", (d) => {
          const midX = (d.source.position.x + d.target.position.x) / 2;
          const midY = (d.source.position.y + d.target.position.y) / 2;
          // Offset the text slightly to avoid overlapping with the line
          const dx = d.target.position.x - d.source.position.x;
          const dy = d.target.position.y - d.source.position.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length > 0) {
            const offsetX = (-dy / length) * 15; // Perpendicular offset
            return midX + offsetX;
          }
          return midX;
        })
        .attr("y", (d) => {
          const midX = (d.source.position.x + d.target.position.x) / 2;
          const midY = (d.source.position.y + d.target.position.y) / 2;
          // Offset the text slightly to avoid overlapping with the line
          const dx = d.target.position.x - d.source.position.x;
          const dy = d.target.position.y - d.source.position.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length > 0) {
            const offsetY = (dx / length) * 15; // Perpendicular offset
            return midY + offsetY;
          }
          return midY;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#61dafb")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("pointer-events", "none")
        .attr("stroke", "rgba(0, 0, 0, 0.8)")
        .attr("stroke-width", "0.5px")
        .attr("paint-order", "stroke fill")
        .attr("transform", (d) => {
          const dx = d.target.position.x - d.source.position.x;
          const dy = d.target.position.y - d.source.position.y;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          // Adjust angle for better readability - avoid upside-down text
          const adjustedAngle = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
          
          // Calculate the text position for rotation center
          const midX = (d.source.position.x + d.target.position.x) / 2;
          const midY = (d.source.position.y + d.target.position.y) / 2;
          const length = Math.sqrt(dx * dx + dy * dy);
          const offsetX = length > 0 ? (-dy / length) * 15 : 0;
          const offsetY = length > 0 ? (dx / length) * 15 : 0;
          const textX = midX + offsetX;
          const textY = midY + offsetY;
          
          return `rotate(${adjustedAngle}, ${textX}, ${textY})`;
        })
        .text((d) => {
          const score = d.similarityScore ? d.similarityScore.toFixed(2) : "N/A";
          return score;
        });

      // Render nodes
      g.selectAll("g.node-group")
        .data(nodesRef.current)
        .join("g")
        .attr("class", "node-group")
        .each(function (d) {
          const group = d3.select(this);

          // Render the circle
          group
            .selectAll("circle")
            .data([d])
            .join("circle")
            .attr("cx", (d) => d.position.x)
            .attr("cy", (d) => d.position.y)
            .attr("r", (d) => {
              return d.extends || TREE_CONFIG.NODE_RADIUS;
            })
            .attr("fill", "white")
            .attr("stroke", "gray")
            .attr("stroke-width", 1)
            .style("cursor", "pointer")
            .on("click", handleNodeClick);

          // Render the image inside the circle
          group
            .selectAll("image")
            .data([d])
            .join("image")
            .attr("x", (d) => d.position.x - d.extends)
            .attr("y", (d) => d.position.y - d.extends)
            .attr("width", (d) => d.extends * 2)
            .attr("height", (d) => d.extends * 2)
            .attr("xlink:href", (d) => d.image)
            .attr("clip-path", "circle()")
            .style("cursor", "pointer")
            .on("click", handleNodeClick);
        });

      requestAnimationFrame(animate);
    };

    animate();

    return () => svg.selectAll("*").remove();
  }, [links, containerSize]);

  // Expose methods for testing
  useImperativeHandle(ref, () => ({
    getNodeCount: () => nodesRef.current.length,
    getMaxDepth: () => calculateMaxDepth(nodesRef.current),
    getRootNode: () => rootNodeRef.current,
    triggerAutoZoom: (depth) => autoZoomForDepth(depth),
    smoothMoveToNode: (node, delay) => smoothMoveToNode(node, delay),
    resetView: () => resetView(),
    getTransform: () => transform,
    getContainerSize: () => containerSize
  }), [transform, containerSize]);

  // Validate props after all hooks
  const propErrors = validateProps({ searchHistory, similarRecords, onNodeSelect, activeNode });
  if (propErrors.length > 0) {
    console.error('TreeGraph prop validation failed:', propErrors);
    return <div>Error: Invalid props provided to TreeGraph</div>;
  }

  // Error boundary
  if (hasError) {
    return (
      <div className="tree-error">
        <h3>Tree Graph Error</h3>
        <p>{errorMessage}</p>
        <button onClick={() => setHasError(false)}>Retry</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tree-container">
      <div className="tree-controls">
        <button 
          className="reset-view-btn" 
          onClick={resetView}
          title="Reset view to center"
        >
          🎯 Reset View
        </button>
        <div className="zoom-info">
          Zoom: {Math.round(transform.k * 100)}%
        </div>
      </div>
      <svg ref={svgRef} />
    </div>
  );
});

TreeGraph.displayName = 'TreeGraph';

export default TreeGraph;
