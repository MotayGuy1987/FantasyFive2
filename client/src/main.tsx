console.log("🚀 main.tsx: Starting React app...");

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("🚀 main.tsx: Imports loaded successfully");

const root = document.getElementById("root");
console.log("🚀 main.tsx: Root element:", root);

if (!root) {
  console.error("❌ Root element not found!");
  throw new Error("Root element not found");
}

console.log("🚀 main.tsx: Creating React root...");
try {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  console.log("🚀 main.tsx: React app mounted successfully");
} catch (error) {
  console.error("❌ Error mounting React app:", error);
}
