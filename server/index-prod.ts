import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import express, { type Express } from "express";
import runApp from "./app";

export async function serveStatic(app: Express, _server: Server) {
  console.log("🚀 serveStatic function called!"); // Debug log
  console.log("Current working directory:", process.cwd()); // Debug log
  
  // Fix: Use the correct path where Vite builds the files
  const distPath = path.resolve(process.cwd(), "dist/public");
  
  console.log("Looking for static files in:", distPath); // Debug log
  console.log("Directory exists:", fs.existsSync(distPath)); // Debug log

  // List directory contents for debugging
  try {
    const files = fs.readdirSync("dist", { withFileTypes: true });
    console.log("Contents of dist directory:", files.map(f => f.name));
    
    if (fs.existsSync("dist/public")) {
      const publicFiles = fs.readdirSync("dist/public", { withFileTypes: true });
      console.log("Contents of dist/public directory:", publicFiles.map(f => f.name));
    }
  } catch (err) {
    console.log("Error reading dist directory:", err);
  }

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Catch-all handler: serve index.html for any route
  app.use("*", (_req, res) => {
    console.log("Serving index.html for route:", _req.originalUrl); // Debug log
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

(async () => {
  console.log("🎯 Starting production server..."); // Debug log
  await runApp(serveStatic);
})();
