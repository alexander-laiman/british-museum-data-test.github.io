// React.js frontend to display objects based on search

// Import required modules
import React, { useState, useEffect } from "react";
import TreeBuilder from "./TreeBuilder";
import { Link } from "react-router-dom";
import { GoogleLogin, googleLogout } from "@react-oauth/google";
import "./App.css"; // Optional: Custom styles
import { TreeGraph } from "./TreeGraph";
import { Node } from "./Node.js";
import { updatePhysics } from "./physics.js";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import UserHome from "./UserHome";
import About from "./About";
import { useNavigate } from "react-router-dom"; // Import navigation hook

function App() {
  const [object, setObject] = useState(null);
  const [error, setError] = useState(null);
  const [similarObjects, setSimilarObjects] = useState([]);
  const [searchHistory, setHistory] = useState([]); // Stores the search history
  const [similarRecords, setSimilarRecords] = useState({}); // Stores similar objects per search
  const [searchedNodes, setSearchedNodes] = useState(new Set()); // Tracks which node IDs have been searched

  const [searchTerm, setSearchTerm] = useState("");
  const [typedText, setTypedText] = useState("");
  const fullText = "Search with a feeling...";
  const port = process.env.PORT || 10000;
    // Use environment variable for API URL
    const url = process.env.REACT_APP_API_URL;
    
    if (!url) {
      console.error('REACT_APP_API_URL environment variable is required');
      throw new Error('API URL not configured');
    }
  
  // Debug: Log the API URL being used
  console.log("API URL being used:", url);
  console.log("REACT_APP_API_URL env var:", process.env.REACT_APP_API_URL);
  const [loggedIn, setLoggedIn] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const navigate = useNavigate();

  //Text typing effect for header:
  useEffect(() => {
    let index = 0;
    setTypedText(""); // Reset text on mount
    
    const typingInterval = setInterval(() => {
      if (index < fullText.length) {
        setTypedText(fullText.substring(0, index + 1));
        index++;
      } else {
        clearInterval(typingInterval);
      }
    }, 60); // Typing speed
    
    return () => clearInterval(typingInterval); // Cleanup interval
  }, []);

  // Function to refresh the page or reset the state
  const handleRefresh = () => {
    window.location.reload(); // Full page reload
    // Alternatively, if using state management, reset the state instead of reloading.
  };

  // Fetch an object based on search term from the backend
  const fetchObjectBySearch = async (query) => {
    try {
      const response = await fetch(`${url}/search-object?query=${searchTerm}`);
      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }
      console.log(response);
      const dataArray = await response.json();
      const data = dataArray[0];
      setObject(dataArray);
      setHistory((prevHistory) => [...prevHistory, dataArray]);
      console.log("Current history state:", searchHistory);
      setError(null);
      
      // Set the active node for the initial search
      const nodeObject = {
        description: dataArray.text_for_embedding,
        image: dataArray.Image
      };
      setActiveNode(nodeObject);
      
      // Mark this node as searched
      setSearchedNodes(prev => new Set([...prev, dataArray.id]));
      
      // Fetch similar objects for the newly selected object
      fetchSimilarObjects(dataArray);
    } catch (err) {
      console.error(err);
      setError("Unable to load object. Please try again later.");
    }
  };

  // Fetch similar objects
  const fetchSimilarObjects = async (selectedObject) => {
    if (!selectedObject || !selectedObject.id) {
      console.log("None found.");
      return;
    }

    try {
      const response = await fetch(
        `${url}/similar-objects/${selectedObject.id}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch similar objects");
      }
      console.log("Setting similar objects.");
      console.log("Current similarObjects state:", similarObjects);
      const data = await response.json();
      // Ensure data is always treated as an array
      const dataArray = Array.isArray(data) ? data : [data];
      setSimilarObjects(dataArray);
      console.log("Updated similarObjects state:", dataArray);
      // Store the similar objects linked to the current search object
      setSimilarRecords((prevRecords) => ({
        ...prevRecords,
        [selectedObject.id]: dataArray, // Keep track of what was presented for this object
      }));
      console.log("Current similarRecords state:", similarRecords);
    } catch (err) {
      console.error(err);
      setError("Unable to load similar objects. Please try again later.");
    }
  };

  // Handle clicking on a similar object
  const handleSimilarObjectClick = (selectedObject) => {
    // Add the selected object to history
    setHistory((prevHistory) => [...prevHistory, selectedObject]);
    setObject(selectedObject);
    
    // Create a node object for the active node
    const nodeObject = {
      description: selectedObject.text_for_embedding,
      image: selectedObject.Image
    };
    setActiveNode(nodeObject);
    
    // Mark this node as searched
    setSearchedNodes(prev => new Set([...prev, selectedObject.id]));
    
    // Clear similar objects before fetching new ones
    setSimilarObjects([]);
    // Fetch similar objects for the newly selected object
    setTimeout(() => fetchSimilarObjects(selectedObject), 0);
  };

  // Handle clicking on old node
  const handleNodeSelect = (node) => {
    // Check if this node has an ID (from database) or if we need to find it
    let nodeId = node.id;
    
    // If node doesn't have an ID, try to find it in search history
    if (!nodeId) {
      const existingHistoryItem = searchHistory.find(
        (item) => item.text_for_embedding === node.description
      );
      nodeId = existingHistoryItem?.id;
    }
    
    // Check if this node ID has already been searched
    if (nodeId && searchedNodes.has(nodeId)) {
      // ✅ Node was previously searched: Find the original object and restore state
      const existingHistoryItem = searchHistory.find(
        (item) => item.id === nodeId
      );
      
      if (existingHistoryItem) {
        setObject(existingHistoryItem);
        setSimilarObjects(similarRecords[existingHistoryItem.id] || []);
        setActiveNode(node);
      }
    } else {
      // ✅ New node: Create object from node data and fetch similar objects
      const nodeObject = {
        id: nodeId || `node_${Date.now()}`, // Use existing ID or generate temporary one
        text_for_embedding: node.description,
        Image: node.image
      };
      
      setObject(nodeObject);
      setActiveNode(node);
      
      // Add the node object to search history so TreeGraph can find it
      setHistory((prevHistory) => [...prevHistory, nodeObject]);
      
      // Mark this node as searched and fetch similar objects
      setSearchedNodes(prev => new Set([...prev, nodeObject.id]));
      fetchSimilarObjects(nodeObject);
    }
  };

  // Handle search form submission
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    console.log("Searching for:", searchTerm);
    fetchObjectBySearch(searchTerm);
  };

  // Fetch an object on component mount
  useEffect(() => {
    // Do not fetch an object on component mount
  }, []);
  const handleLogin = (res) => {
    console.log(res);
    setLoggedIn(true);
    const userToken = res.credential;
    postMessage("/api/login", { token: userToken }).then((user) => {
      console.log(user);
    });
  };
  const handleLogout = (res) => {
    console.log("Logging out");
    setLoggedIn(false);
    postMessage("api/logout");
    googleLogout();
  };
  // Clear states when navigating away
  useEffect(() => {
    return () => {
      setObject(null);
      setSimilarObjects([]);
      setHistory([]);
      setActiveNode(null);
      setSearchTerm("");
      setSimilarRecords({});
      setSearchedNodes(new Set());
    };
  }, [navigate]);
  useEffect(() => {
    //getComputedStyle("/user_trees").then((treeObjs) => {
    //pull up trees
    //});
  }, []);

  return (
    <div className="App">
      <nav className="navbar-container">
        <span className="clickable-link">
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            DataConnections &gt; |
          </Link>
          <Link to="/about" className="clickable-link">
            About &gt;
          </Link>
        </span>

        {/* Show "User Profile" link only when logged in */}
        {loggedIn && (
          <Link to="/user" className="clickable-link">
            User Profile &gt;
          </Link>
        )}
        {loggedIn ? (
          <button onClick={handleLogout}> Log out</button>
        ) : (
          <GoogleLogin
            text="signin_with"
            onSuccess={handleLogin}
            onError={(err) => console.log(err)}
            theme="filled_black"
            shape="rectangular"
          />
        )}
      </nav>
      <Routes>
        <Route path="/user" element={<UserHome />} />
        <Route path="/about" element={<About />} />

        <Route
          path="/"
          element={
            <div className="main-app">
              {error && <p className="error">{error}</p>}
              {object ? (
                <div className="history-tree-main">
                  <div className="tree-wrapper">
                    <TreeGraph
                      searchHistory={searchHistory}
                      similarRecords={similarRecords}
                      onNodeSelect={handleNodeSelect}
                      activeNode={activeNode}
                    />
                  </div>

                  <div className="object-card">
                    <div className="image-card">
                      <p>
                        Currently Selected Node.<br />
                        <strong>ID:</strong> {object.id}
                      </p>
                      <img src={object.Image} alt={object.text_for_embedding} />
                    </div>
                    <p>{object.text_for_embedding}</p>
                  </div>
                </div>
              ) : (
                !error && (
                  <>
                    <header className="App-header">
                      <h1 className="animated-text">{typedText}</h1>
                    </header>
                    <div className="search-container">
                      <form
                        onSubmit={handleSearchSubmit}
                        className="search-form"
                      >
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="   Search..."
                          className="search-box"
                        />
                        <button type="submit" className="search-button">
                          {">"}
                        </button>
                      </form>
                    </div>
                  </>
                )
              )}
              {console.log("Current similarObjects state:", similarObjects)}
              {similarObjects && similarObjects.length > 0 ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "20px",
                      justifyContent: "center",
                    }}
                  >
                    <hr style={{ width: '100%', border: '1px solid #333', margin: '20px 0' }} />
                    <p>Related Nodes</p>
                    <hr style={{ width: '100%', border: '1px solid #333', margin: '20px 0' }} />
                    {similarObjects.map((simObj) => (
                      <div
                        key={simObj.id}
                        className="object-card-2"
                        onClick={() => handleSimilarObjectClick(simObj)}
                      >
                        <div className="image-card-2">
                          <p>
                            <strong>ID:</strong> {simObj.id}
                          </p>
                          <img
                            src={simObj.Image}
                            alt={simObj.text_for_embedding}
                          />
                          <p>{simObj.text_for_embedding}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                object && (
                  <>
                    {console.log(
                      "No similar objects found or similarObjects is empty."
                    )}
                  </>
                )
              )}
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
