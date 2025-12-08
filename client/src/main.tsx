// Add timestamp for debugging
const startTime = performance.now();
console.log("🚀 main.tsx: Starting React app at", new Date().toISOString());

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("🚀 main.tsx: All imports loaded successfully");
console.log("🚀 main.tsx: React version:", React.version);

try {
  console.log("🚀 main.tsx: Looking for root element...");
  const root = document.getElementById("root");
  
  console.log("🚀 main.tsx: Root element found:", !!root);
  console.log("🚀 main.tsx: Document ready state:", document.readyState);
  
  if (!root) {
    console.error("❌ Root element not found!");
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif; color: red; background: white;">
        <h1>Error: Root element not found</h1>
        <p>The div with id="root" is missing from the HTML.</p>
      </div>
    `;
    throw new Error("Root element not found");
  }

  console.log("🚀 main.tsx: Creating React root...");
  const reactRoot = ReactDOM.createRoot(root);
  
  console.log("🚀 main.tsx: Rendering your Fantasy Mini League App...");
  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  
  console.log("🚀 main.tsx: Fantasy Mini League app mounted successfully!");
  console.log(`🚀 main.tsx: Total startup time: ${performance.now() - startTime}ms`);
  
} catch (error) {
  console.error("❌ Error in main.tsx:", error);
  
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif; background: #fee; border: 2px solid #f00; margin: 20px;">
      <h1 style="color: #c00;">Fantasy Mini League - Loading Error</h1>
      <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
      <p><strong>Good news:</strong> React is working! This error is likely from your app code.</p>
      <details style="margin-top: 15px;">
        <summary>Technical Details</summary>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto; font-size: 11px;">${error instanceof Error ? error.stack : String(error)}</pre>
      </details>
    </div>
  `;
}
