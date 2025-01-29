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

  const [searchTerm, setSearchTerm] = useState("");
  const [typedText, setTypedText] = useState("");
  const fullText = "Seearch with a feeling...";
  const port = process.env.PORT || 10000;
  const url = "https://british-museum-branching.onrender.com";
  const [loggedIn, setLoggedIn] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const navigate = useNavigate();

  //Text typing effect for header:
  useEffect(() => {
    let index = 0;
    const typingInterval = setInterval(() => {
      if (index < fullText.length) {
        setTypedText((prev) => prev + fullText.charAt(index));
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
    setHistory((prevHistory) => [...prevHistory, selectedObject]);
    setObject(selectedObject);
    setActiveNode(selectedObject);
    // Clear similar objects before fetching new ones
    setSimilarObjects([]);
    // Fetch similar objects for the newly selected object
    setTimeout(() => fetchSimilarObjects(selectedObject), 0);
  };

  // Handle clicking on old node
  const handleNodeSelect = (node) => {
    // Check if the node already exists in history
    const existingHistoryItem = searchHistory.find(
      (item) => item.text_for_embedding === node.description
    );

    if (existingHistoryItem) {
      // ✅ Restore previous state (same layout, previously fetched similar objects)
      setObject(existingHistoryItem);
      setSimilarObjects(similarRecords[existingHistoryItem.id] || []);
      setActiveNode(node);
    } else {
      // ✅ New node: Fetch fresh data & update layout
      fetchSimilarObjects(node.description);
      setObject({ text_for_embedding: node.description, Image: node.image });
      setActiveNode(node);
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
