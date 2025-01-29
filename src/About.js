import React from "react";
import "./About.css";
const About = () => {
  return (
    <div className="page-container">
      <header className="page-header">
        <h1>About DataConnections</h1>
      </header>
      <p className="page-content">
        DataConnections is a tool designed to visualize relationships between
        objects and explore data-driven connections interactively. The
        collection hosted here right now is from the British museum and
        represents many artifacts from both ancient and modern China. Item's can
        be searched with specific terms, or more vague feelings and emotions.
      </p>

      <header className="page-header">
        <h1>Future Goals</h1>
      </header>
      <p className="page-content">
        I'd like to take large texts on Chinese art and history and push them
        into a RAG system. The hope is to find deeper connections between
        artifacts to make them more engaging as well as enable independent
        exploration.
      </p>
    </div>
  );
};

export default About;
