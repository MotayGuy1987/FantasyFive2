import runApp, { serveStatic } from "./app";

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
