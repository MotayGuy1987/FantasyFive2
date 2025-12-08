// Add timestamp for debugging
const startTime = performance.now();

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Function to show messages on screen for mobile debugging
function showDebugMessage(message: string, isError: boolean = false) {
  const debugDiv = document.getElementById('debug-messages') || (() => {
    const div = document.createElement('div');
    div.id = 'debug-messages';
    div.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: ${isError ? '#fee' : '#efe'};
      border-bottom: 2px solid ${isError ? '#f00' : '#0a0'};
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      z-index: 9999;
      max-height: 200px;
      overflow-y: auto;
    `;
    document.body.prepend(div);
    return div;
  })();
  
  const p = document.createElement('p');
  p.style.cssText = `margin: 0 0 5px 0; color: ${isError ? '#c00' : '#060'};`;
  p.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  debugDiv.appendChild(p);
  
  console.log(message);
}

// Global error handler
window.addEventListener('error', (event) => {
  showDebugMessage(`❌ Global Error: ${event.message} at ${event.filename}:${event.lineno}`, true);
});

window.addEventListener('unhandledrejection', (event) => {
  showDebugMessage(`❌ Unhandled Promise Rejection: ${event.reason}`, true);
});

try {
  showDebugMessage("🚀 Starting React app...");
  showDebugMessage(`🚀 Imports loaded. React version: ${React.version}`);
  
  const root = document.getElementById("root");
  
  if (!root) {
    showDebugMessage("❌ Root element not found!", true);
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif; background: #fee; border: 2px solid #f00;">
        <h1 style="color: #c00;">Error: Root element not found</h1>
        <p>The div with id="root" is missing from the HTML.</p>
      </div>
    `;
    throw new Error("Root element not found");
  }

  showDebugMessage("🚀 Root element found, creating React root...");
  
  const reactRoot = ReactDOM.createRoot(root);
  
  showDebugMessage("🚀 Rendering App component...");
  
  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  showDebugMessage("🚀 React app mounted successfully!");
  showDebugMessage(`🚀 Total startup time: ${Math.round(performance.now() - startTime)}ms`);
  
  // Hide debug messages after successful mount
  setTimeout(() => {
    const debugDiv = document.getElementById('debug-messages');
    if (debugDiv && !document.querySelector('[data-error="true"]')) {
      debugDiv.style.opacity = '0.3';
      debugDiv.style.pointerEvents = 'none';
      setTimeout(() => {
        debugDiv.remove();
      }, 3000);
    }
  }, 2000);
  
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  showDebugMessage(`❌ Error in main.tsx: ${errorMessage}`, true);
  
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif; background: #fee; border: 2px solid #f00; margin: 20px;" data-error="true">
      <h1 style="color: #c00;">React Mount Error</h1>
      <p><strong>Error:</strong> ${errorMessage}</p>
      <p><strong>Check the debug messages above for details.</strong></p>
      <details style="margin-top: 15px;">
        <summary>Technical Details</summary>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto; font-size: 11px;">${error instanceof Error ? error.stack : String(error)}</pre>
      </details>
    </div>
  `;
}
