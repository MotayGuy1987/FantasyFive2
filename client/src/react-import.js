// Simple JavaScript file to test imports
import React from "react";
import ReactDOM from "react-dom/client";

console.log("React imports successful");

// Export for the main file to use
window.React = React;
window.ReactDOM = ReactDOM;

// Try to mount a simple component
try {
  const root = document.getElementById("root");
  if (root) {
    const reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(React.createElement('div', {
      style: {
        padding: '20px',
        background: '#e8f5e8',
        border: '2px solid #4caf50',
        margin: '20px',
        fontFamily: 'Arial, sans-serif'
      }
    }, [
      React.createElement('h1', { key: 'title', style: { color: '#2e7d32' } }, '✅ React Working!'),
      React.createElement('p', { key: 'message' }, 'React has successfully mounted. The blank screen issue is resolved.'),
      React.createElement('p', { key: 'next' }, 'Next step: Load the full App component.')
    ]));
  }
} catch (error) {
  console.error("React mount failed:", error);
}
