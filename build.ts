import { build } from "esbuild";
import { resolve } from "path";

async function buildServer() {
  try {
    await build({
      entryPoints: [resolve("server/index-prod.ts")],
      bundle: true,
      platform: "node",
      target: "node18",
      format: "esm",
      outfile: "dist/index.js",
      external: [
        // External dependencies that shouldn't be bundled
        "pg",
        "pg-native",
        "@neondatabase/serverless",
      ],
      banner: {
        js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
      },
      define: {
        "process.env.NODE_ENV": '"production"'
      },
      minify: true,
      sourcemap: false,
    });
    
    console.log("✅ Server build completed successfully");
  } catch (error) {
    console.error("❌ Server build failed:", error);
    process.exit(1);
  }
}

buildServer();
