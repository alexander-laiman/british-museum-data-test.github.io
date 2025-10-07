import React, { useState, useEffect, useRef } from "react";
import { Node } from "./Node.js";
import { updatePhysics } from "./physics.js";
import "./treestyle.css";
import * as d3 from "d3";

export const TreeGraph = ({
  searchHistory,
  similarRecords,
  onNodeSelect,
  activeNode,
}) => {
  const containerRef = useRef(null); // Reference to the div container
  const svgRef = useRef(null); // Reference to the SVG
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  }); // Default size
  const [activeNodeS, setActiveNode] = useState(null); // Track selected node
  const [links, setLinks] = useState([]);
  const nodesRef = useRef([]);
  const maxNodes = 3;
  const windForceRef = useRef(0);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 }); // Pan and zoom state
  const zoomRef = useRef(null); // Reference to the zoom behavior

  const updateTreeFromHistory = (searchHistory, similarRecords) => {
    if (!searchHistory.length) return;

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
        null // Root has no parent
      );
      nodesRef.current.push(rootNode);
      
      // Center the view on the root node when it's first created
      if (svgRef.current && containerSize.width > 0 && zoomRef.current) {
        const svg = d3.select(svgRef.current);
        const centerTransform = d3.zoomIdentity
          .translate(containerSize.width / 2, containerSize.height / 2)
          .scale(1);
        
        svg.transition()
          .duration(500)
          .call(zoomRef.current.transform, centerTransform);
      }
    }

    let parentNode = rootNode; // Start with root as the first parent

    // 🟢 **(NEW) Attach Similar Objects for Root Node**
    if (similarRecords[searchHistory[0].id]) {
      similarRecords[searchHistory[0].id].forEach((similarObject, i) => {
        // ✅ Prevent duplicate child nodes under the same parent
        let existingChild = rootNode.childNodes.find(
          (child) => child.description === similarObject.text_for_embedding
        );
        if (existingChild) return;

        const childPosition = {
          x:
            rootNode.position.x +
            (i - Math.floor(similarRecords[searchHistory[0].id].length / 2)) *
              50,
          y: rootNode.position.y - 50,
        };

        // ✅ Attach similarObject node immediately to root
        const childNode = new Node(
          childPosition,
          { x: 0, y: 0 },
          similarObject.text_for_embedding,
          similarObject.Image,
          rootNode
        );
        rootNode.childNodes.push(childNode);
        nodesRef.current.push(childNode);

        setLinks((prevLinks) => [
          ...prevLinks,
          { source: rootNode, target: childNode },
        ]);
      });
    }

    // 2️⃣ Process History: Attach Each Node to the Previous One
    searchHistory.slice(1).forEach((object) => {
      let existingNode = nodesRef.current.find(
        (node) =>
          node.description === object.text_for_embedding &&
          node.parentNode === parentNode
      );

      if (!existingNode) {
        // Determine position based on parent
        const position = {
          x: parentNode.position.x + 50,
          y: parentNode.position.y - 50,
        };

        // Create new node and assign parent-child relationship
        const newNode = new Node(
          position,
          { x: 0, y: 0 },
          object.text_for_embedding,
          object.Image,
          parentNode
        );
        parentNode.childNodes.push(newNode); // Store in parent's childNodes
        nodesRef.current.push(newNode);

        setLinks((prevLinks) => [
          ...prevLinks,
          { source: parentNode, target: newNode },
        ]);

        parentNode = newNode; // ✅ Only update parentNode if a new node was created
      } else {
        parentNode = existingNode; // ✅ Move down the tree to the existing node
      }

      // 🟢 **Attach Similar Objects for This Node**
      if (similarRecords[object.id]) {
        similarRecords[object.id].forEach((similarObject, i) => {
          // ✅ Ensure no duplicate child nodes under the same parent
          let existingChild = parentNode.childNodes.find(
            (child) => child.description === similarObject.text_for_embedding
          );
          if (existingChild) return;

          const childPosition = {
            x:
              parentNode.position.x +
              (i - Math.floor(similarRecords[object.id].length / 2)) * 50,
            y: parentNode.position.y - 50,
          };

          // ✅ Attach similar object node immediately
          const childNode = new Node(
            childPosition,
            { x: 0, y: 0 },
            similarObject.text_for_embedding,
            similarObject.Image,
            parentNode
          );
          parentNode.childNodes.push(childNode); // Store child under the correct parent
          nodesRef.current.push(childNode);

          setLinks((prevLinks) => [
            ...prevLinks,
            { source: parentNode, target: childNode },
          ]);
        });
      }
    });
  };

  // Hook to ensure tree updates dynamically when history changes
  useEffect(() => {
    updateTreeFromHistory(searchHistory, similarRecords);
  }, [searchHistory, similarRecords]);

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
          .duration(750)
          .call(zoomRef.current.transform, resetTransform);
      } else {
        // No nodes yet, just center the view
        const resetTransform = d3.zoomIdentity
          .translate(containerSize.width / 2, containerSize.height / 2)
          .scale(1);
        
        svg.transition()
          .duration(750)
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

    const addChildNodes = (node) => {
      const newNodes = nodesRef.current;
      const newLinks = links;
      const childDistance = 200;
      const spread = 300;

      for (let i = 0; i < 3; i++) {
        const childNode = new Node(
          {
            x: node.position.x + (i - 1) * spread,
            y: node.position.y - childDistance,
          },
          { x: Math.random() * 2 - 1, y: -Math.abs(Math.random() * 2 - 1) },
          `Child Node ${newNodes.length + 1}`,
          null,
          node
        );
        childNode.parentNode = node;
        node.childNodes.push(childNode);
        newNodes.push(childNode);
        newLinks.push({ source: node, target: childNode });
      }

      setLinks([...newLinks]);
    };

    const animate = () => {
      // Only animate if we have nodes
      if (nodesRef.current.length > 0) {
        // Generate a smooth wind force
        windForceRef.current = [
          Math.sin(Date.now() / 5000) * 0.00065 +
            Math.sin(Date.now() / 10000 + 213) * 0.00005 +
            Math.sin(Date.now() / 500 + 0.42) * 0.0006 +
            Math.sin(Date.now() / 5 + 0.1) * 0.00005 +
            Math.sin(Date.now() / 5 + 0.16) * 0.00002,
          0.12,
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
              return d.extends;
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
};

export default TreeGraph;
