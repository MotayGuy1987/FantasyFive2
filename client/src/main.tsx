// Add timestamp for debugging
const startTime = performance.now();
console.log("🚀 main.tsx: Starting React app at", new Date().toISOString());

try {
  console.log("🚀 main.tsx: About to import React...");
  
  import React from "react";
  import ReactDOM from "react-dom/client";
  import App from "./App";
  import "./index.css";

  console.log("🚀 main.tsx: All imports loaded successfully");
  console.log("🚀 main.tsx: React version:", React.version);
  console.log("🚀 main.tsx: Looking for root element...");

  const root = document.getElementById("root");
  console.log("🚀 main.tsx: Root element found:", !!root);
  console.log("🚀 main.tsx: Root element details:", {
    tagName: root?.tagName,
    id: root?.id,
    className: root?.className,
    innerHTML: root?.innerHTML?.substring(0, 100)
  });

  if (!root) {
    console.error("❌ Root element not found!");
    // Add fallback content to help debug
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1>Debug: Root element not found</h1>
        <p>The div with id="root" is missing from the HTML.</p>
        <p>Current body innerHTML:</p>
        <pre>${document.body.innerHTML}</pre>
      </div>
    `;
    throw new Error("Root element not found");
  }

  console.log("🚀 main.tsx: Creating React root...");
  const reactRoot = ReactDOM.createRoot(root);
  
  console.log("🚀 main.tsx: Rendering App component...");
  reactRoot.render(
