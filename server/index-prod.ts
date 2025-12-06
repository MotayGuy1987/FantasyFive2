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

  // Debug: Check what's in the built index.html file
  try {
    const indexPath = path.join(distPath, "index.html");
    const indexContent = fs.readFileSync(indexPath, "utf8");
    console.log("\n📄 COMPLETE index.html content:");
    console.log("=".repeat(80));
    console.log(indexContent);
    console.log("=".repeat(80));
    console.log("📄 index.html file size:", indexContent.length, "characters");
    console.log("📄 index.html includes script tags:", indexContent.includes("<script"));
    console.log("📄 index.html includes main.tsx:", indexContent.includes("main.tsx"));
    console.log("📄 index.html includes root div:", indexContent.includes('id="root"'));
    console.log("📄 index.html includes type=module:", indexContent.includes('type="module"'));
  } catch (err) {
    console.error("❌ Error reading index.html:", err);
  }

  // Debug: List what's in the assets folder
  try {
    const assetsPath = path.join(distPath, "assets");
    if (fs.existsSync(assetsPath)) {
      const assetsFiles = fs.readdirSync(assetsPath);
      console.log("📁 Assets folder contents:", assetsFiles);
      
      // Show details of each asset file
      assetsFiles.forEach(file => {
        const filePath = path.join(assetsPath, file);
        const stats = fs.statSync(filePath);
        console.log(`  - ${file}: ${stats.size} bytes`);
      });
    } else {
      console.log("📁 Assets folder does not exist");
    }
  } catch (err) {
    console.error("❌ Error reading assets folder:", err);
  }

  // Check if favicon exists
  try {
    const faviconPath = path.join(distPath, "favicon.png");
    if (fs.existsSync(faviconPath)) {
      const stats = fs.statSync(faviconPath);
      console.log("🎨 favicon.png exists:", stats.size, "bytes");
    } else {
      console.log("🎨 favicon.png not found");
    }
  } catch (err) {
    console.error("❌ Error checking favicon:", err);
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
  console.log("🎯 Environment variables:", Object.keys(process.env).filter(key => 
    key.includes('NODE') || key.includes('PORT') || key.includes('DATABASE')
  ).reduce((obj, key) => {
    obj[key] = process.env[key];
    return obj;
  }, {} as Record<string, string | undefined>));
  
  await runApp(serveStatic);
})();
