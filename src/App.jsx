// App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import "./App.css";
import Stream from "./Stream";
import Join from "./Join";

function Home() {
  return (
    <div className="home-container">
      <div className="home-block">
        <h1 className="home-title">Screen Share App</h1>
        <div className="home-options">
          <Link to="/stream" className="option-button">
            Create Stream
          </Link>
          <Link to="/join" className="option-button">
            Join Stream
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stream" element={<Stream />} />
        <Route path="/join" element={<Join />} />
        <Route path="/join/:roomId" element={<Join />} /> {/* ✅ dynamic route */}
      </Routes>
    </Router>
  );
}

export default App;
