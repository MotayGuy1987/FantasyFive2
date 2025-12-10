import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";
import express, { type Express } from "express";
import runApp from "./app";

export async function serveStatic(app: Express, _server: Server) {
  console.log("🚀 serveStatic function called!");
  console.log("Current working directory:", process.cwd());
  console.log("Node environment:", process.env.NODE_ENV);
  
  const distPath = path.resolve(process.cwd(), "dist/public");
  
  console.log("Looking for static files in:", distPath);
  console.log("Directory exists:", fs.existsSync(distPath));

  // Debug: List directory contents
  try {
    const files = fs.readdirSync("dist", { withFileTypes: true });
    console.log("Contents of dist directory:", files.map(f => `${f.name}${f.isDirectory() ? '/' : ''}`));
    
    if (fs.existsSync("dist/public")) {
      const publicFiles = fs.readdirSync("dist/public", { withFileTypes: true });
      console.log("Contents of dist/public directory:", publicFiles.map(f => `${f.name}${f.isDirectory() ? '/' : ''}`));
    }
  } catch (err) {
    console.log("Error reading dist directory:", err);
  }

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Add static file serving with detailed logging
  app.use((req, res, next) => {
    if (req.url.startsWith('/assets/') || req.url === '/favicon.png') {
      console.log("📦 Static asset requested:", req.url);
    }
    next();
  });

  app.use(express.static(distPath));

  // Catch-all handler: serve index.html for any route
  app.use("*", (req, res) => {
    console.log("🎯 Serving index.html for route:", req.originalUrl, "| Method:", req.method);
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    res.sendFile(path.resolve(distPath, "index.html"), (err) => {
      if (err) {
        console.error("❌ Error serving index.html:", err);
        res.status(500).send('Internal Server Error');
      }
    });
  });
}

(async () => {
  console.log("🎯 Starting production server...");
  console.log("🎯 Process arguments:", process.argv);
  console.log("🎯 Environment variables:", {
    DATABASE_URL: process.env.DATABASE_URL?.substring(0, 30) + "...", // Don't log full DB URL
    NODE_VERSION: process.env.NODE_VERSION,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV
  });

  await runApp(serveStatic);
})();
