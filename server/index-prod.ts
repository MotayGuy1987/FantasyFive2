import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import express, { type Express } from "express";
import runApp from "./app";

export async function serveStatic(app: Express, _server: Server) {
  console.log("🚀 serveStatic function called!");
  console.log("Current working directory:", process.cwd());
  
  const distPath = path.resolve(process.cwd(), "dist/public");
  
  console.log("Looking for static files in:", distPath);
  console.log("Directory exists:", fs.existsSync(distPath));

  // Debug: List directory contents
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

  // Debug: Check what's in the built index.html file
  try {
    const indexPath = path.join(distPath, "index.html");
    const indexContent = fs.readFileSync(indexPath, "utf8");
    console.log("📄 index.html content preview (first 800 chars):");
    console.log(indexContent.substring(0, 800));
    console.log("📄 index.html includes script tags:", indexContent.includes("<script"));
    console.log("📄 index.html includes root div:", indexContent.includes('id="root"'));
  } catch (err) {
    console.error("❌ Error reading index.html:", err);
  }

  // Debug: List what's in the assets folder
  try {
    const assetsPath = path.join(distPath, "assets");
    if (fs.existsSync(assetsPath)) {
      const assetsFiles = fs.readdirSync(assetsPath);
      console.log("📁 Assets folder contents:", assetsFiles);
    }
  } catch (err) {
    console.error("❌ Error reading assets folder:", err);
  }

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Catch-all handler: serve index.html for any route
  app.use("*", (req, res) => {
    console.log("🎯 Serving index.html for route:", req.originalUrl);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

(async () => {
  console.log("🎯 Starting production server...");
  await runApp(serveStatic);
})();
