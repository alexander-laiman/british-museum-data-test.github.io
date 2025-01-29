import React, { useState, useCallback } from "react";
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";

import "./TreeBuilder.css"; // Import custom styles

const initialNodes = [
  {
    id: "1",
    data: { label: "Root" },
    position: { x: 250, y: 5 },
    type: "customNode",
  },
];

const initialEdges = [];

const TreeBuilder = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [idCounter, setIdCounter] = useState(2); // Track node IDs

  // Add a new child node dynamically
  const addNode = (parentId) => {
    const newNodeId = idCounter.toString();
    const newNode = {
      id: newNodeId,
      data: { label: `Node ${newNodeId}` },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      type: "customNode",
    };

    setNodes((prev) => [...prev, newNode]);
    setEdges((prev) => [
      ...prev,
      { id: `e${parentId}-${newNodeId}`, source: parentId, target: newNodeId },
    ]);
    setIdCounter((prev) => prev + 1);
  };

  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  return (
    <div className="tree-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
      </ReactFlow>
      <button className="add-node-btn" onClick={() => addNode("1")}>
        Add Child Node
      </button>
    </div>
  );
};

export default TreeBuilder;
