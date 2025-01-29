import React, { useState, useEffect, useRef } from "react";
import { Node } from "./Node.js";
import { updatePhysics } from "./physics.js";
import "./treestyle.css";
import * as d3 from "d3";

export const TreeGraph = ({ searchHistory, similarRecords }) => {
  const containerRef = useRef(null); // Reference to the div container
  const svgRef = useRef(null); // Reference to the SVG
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  }); // Default size

  const [links, setLinks] = useState([]);
  const nodesRef = useRef([]);
  const maxNodes = 3;
  const windForceRef = useRef(0);

  const updateTreeFromHistory = (searchHistory, similarRecords) => {
    if (!searchHistory.length) return;

    // 1️⃣ Ensure Root Node Exists
    let rootNode = nodesRef.current.find(
      (node) => node.description === searchHistory[0].text_for_embedding
    );
    if (!rootNode) {
      rootNode = new Node(
        { x: containerSize.width / 2, y: containerSize.height - 50 },
        { x: 0, y: 0 },
        searchHistory[0].text_for_embedding,
        searchHistory[0].Image,
        null // Root has no parent
      );
      nodesRef.current.push(rootNode);
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

  useEffect(() => {
    const { width, height } = containerSize; // Get current div size

    const rootNode = new Node({ x: width / 2, y: height - 50 }, { x: 0, y: 0 });
    const initialNodes = [rootNode];
    const initialLinks = [];

    const childDistance = 300;
    const spread = 400;
    for (let i = 0; i < 3; i++) {
      const childNode = new Node(
        {
          x: rootNode.position.x + (i - 1) * spread,
          y: rootNode.position.y - childDistance,
        },
        { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 },
        `Child Node ${i + 1}`
      );
      childNode.parentNode = rootNode;
      rootNode.childNodes.push(childNode);
      initialNodes.push(childNode);
      initialLinks.push({ source: rootNode, target: childNode });
    }

    nodesRef.current = initialNodes;
    setLinks(initialLinks);
  }, []);

  useEffect(() => {
    const svg = d3
      .select(svgRef.current)
      .attr("width", containerSize.width)
      .attr("height", containerSize.height)
      .style("background-color", "black");

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

      svg
        .selectAll("g.node-group")
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
              if (d.userSelected) {
                d.extends = 40;
                return 40;
              }
              return d.extends;
            })
            .attr("fill", "white")
            .on("click", (_, d) => {
              if (!d.userSelected) {
                d.userSelected = true;
                if (d.depth < maxNodes) {
                  addChildNodes(d);
                }
              }
            });

          // Render the image inside the circle
          group
            .selectAll("image")
            .data([d])
            .join("image")
            .attr("x", (d) => d.position.x - d.extends / 2)
            .attr("y", (d) => d.position.y - d.extends / 2)
            .attr("width", (d) => d.extends)
            .attr("height", (d) => d.extends)
            .attr("xlink:href", (d) => d.image)
            .attr("clip-path", "circle()");
        });

      svg
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("x1", (d) => d.source.position.x)
        .attr("y1", (d) => d.source.position.y)
        .attr("x2", (d) => d.target.position.x)
        .attr("y2", (d) => d.target.position.y)
        .attr("stroke", "white");

      requestAnimationFrame(animate);
    };

    animate();

    return () => svg.selectAll("*").remove();
  }, [links, containerSize]);

  return (
    <div ref={containerRef} className="tree-container">
      <svg ref={svgRef} />
    </div>
  );
};

export default TreeGraph;
