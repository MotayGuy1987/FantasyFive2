// Add timestamp for debugging
const startTime = performance.now();
console.log("🚀 main.tsx: Starting React app at", new Date().toISOString());

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// Function to show messages on screen for mobile debugging
function showMessage(message: string, isError: boolean = false) {
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
      max-height: 300px;
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

// Global error handlers
window.addEventListener('error', (event) => {
  showMessage(`❌ Global Error: ${event.message} at ${event.filename}:${event.lineno}`, true);
});

window.addEventListener('unhandledrejection', (event) => {
  showMessage(`❌ Unhandled Promise: ${event.reason}`, true);
});

async function loadApp() {
  try {
    showMessage("🚀 Starting Fantasy Mini League...");
    
    const root = document.getElementById("root");
    if (!root) {
      showMessage("❌ Root element not found!", true);
      return;
    }
    
    showMessage("🚀 Root element found, creating React root...");
    const reactRoot = ReactDOM.createRoot(root);
    
    showMessage("🚀 Importing App component...");
    
    // Try to import your App component
    const { default: App } = await import("./App");
    
    showMessage("✅ App component imported successfully!");
    showMessage("🚀 Rendering App component...");
    
    reactRoot.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    showMessage("✅ Fantasy Mini League app rendered successfully!");
    
    // Hide debug messages after a delay if no errors
    setTimeout(() => {
      const debugDiv = document.getElementById('debug-messages');
      if (debugDiv) {
        debugDiv.style.opacity = '0.3';
        setTimeout(() => {
          debugDiv.remove();
        }, 2000);
      }
    }, 3000);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showMessage(`❌ Error loading App: ${errorMessage}`, true);
    
    // Show detailed error info
    document.body.innerHTML += `
      <div style="
        background: #ffebee; 
        border: 2px solid #f44336; 
        padding: 20px; 
        margin: 20px;
        font-family: Arial, sans-serif;
      ">
        <h2 style="color: #d32f2f; margin-top: 0;">Fantasy Mini League - App Loading Error</h2>
        <p><strong>Error:</strong> ${errorMessage}</p>
        <p><strong>This usually means:</strong></p>
        <ul>
          <li>There's a syntax error in your App component</li>
          <li>One of your imports is failing</li>
          <li>There's a missing dependency</li>
        </ul>
        <details style="margin-top: 15px;">
          <summary>Technical Details (Click to expand)</summary>
          <pre style="background: #f5f5f5; padding: 10px; overflow: auto; font-size: 11px;">
            ${error instanceof Error ? error.stack || 'No stack trace available' : 'No stack trace available'}
          </pre>
        </details>
      </div>
    `;
  }
}

showMessage("🚀 Initializing app loader...");
loadApp();
