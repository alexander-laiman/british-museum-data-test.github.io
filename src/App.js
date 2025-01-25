// React.js frontend to display objects based on search

// Import required modules
import React, { useState, useEffect } from "react";
import "./App.css"; // Optional: Custom styles

function App() {
  const [object, setObject] = useState(null);
  const [error, setError] = useState(null);
  const [similarObjects, setSimilarObjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const port = process.env.PORT || 10000;
  const url = "https://british-museum-branching.onrender.com";

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

      const data = await response.json();
      // Ensure data is always treated as an array
      const dataArray = Array.isArray(data) ? data : [data];
      setSimilarObjects(dataArray);
      console.log("Updated similarObjects state:", dataArray);
    } catch (err) {
      console.error(err);
      setError("Unable to load similar objects. Please try again later.");
    }
  };

  // Handle clicking on a similar object
  const handleSimilarObjectClick = (selectedObject) => {
    setObject(selectedObject);
    // Clear similar objects before fetching new ones
    setSimilarObjects([]);
    // Fetch similar objects for the newly selected object
    setTimeout(() => fetchSimilarObjects(selectedObject), 0);
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

  return (
    <div className="App">
      <header className="App-header">
        <h1>Object Search</h1>
        {error && <p className="error">{error}</p>}
        {object ? (
          <div className="object-card">
            <img src={object.Image} alt="Object" className="object-image" />
            <p>{object.text_for_embedding}</p>
            <p>
              <strong>ID:</strong> {object.id}
            </p>
          </div>
        ) : (
          !error && (
            <>
              <p>Enter your search term below:</p>
              <form onSubmit={handleSearchSubmit}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="search-input"
                />
                <button type="submit" className="fetch-button">
                  Search
                </button>
              </form>
            </>
          )
        )}
        {console.log("Current similarObjects state:", similarObjects)}
        {similarObjects && similarObjects.length > 0 ? (
          <div>
            <h2>Similar Objects</h2>
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
                  className="object-card"
                  style={{
                    flex: "1 1 300px",
                    maxWidth: "400px",
                    cursor: "pointer",
                  }}
                  onClick={() => handleSimilarObjectClick(simObj)}
                >
                  <img src={simObj.Image} alt={simObj.text_for_embedding} />
                  <p>{simObj.text_for_embedding}</p>
                  <p>
                    <strong>ID:</strong> {simObj.id}
                  </p>
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
              <p>No similar objects found.</p>
            </>
          )
        )}
      </header>
    </div>
  );
}

export default App;
