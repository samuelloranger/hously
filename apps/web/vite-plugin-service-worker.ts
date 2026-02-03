import { join } from "path";
import type { Plugin } from "vite";
import { build } from "esbuild";  

/**
 * Vite plugin to compile TypeScript service worker files into a single sw.js file
 * The service worker is compiled at build time using esbuild and output to the public directory
 */
export function serviceWorkerPlugin(): Plugin {
  let root: string;
  let publicDir: string;
  let outDir: string;

  return {
    name: "service-worker-plugin",
    configResolved(config) {
      root = config.root;
      publicDir = join(root, config.publicDir || "public");
      outDir = config.build.outDir || join(root, "dist");
    },
    async buildStart() {
      // This will run during dev server startup and build
    },
    async writeBundle() {
      // This runs after all files are written during build
      // Write directly to dist folder since writeBundle runs after public files are copied
      try {
        const swEntry = join(root, "src/sw/index.ts");
        const outputPath = join(outDir, "sw.js");

        await build({
          entryPoints: [swEntry],
          bundle: true,
          outfile: outputPath,
          platform: "browser",
          format: "iife",
          minify: process.env.NODE_ENV === "production",
          sourcemap: process.env.NODE_ENV === "production" ? false : "inline",
          target: "es2020",
          tsconfig: join(root, "src/sw/tsconfig.json"),
        });

        console.log("✓ Service worker compiled successfully");
      } catch (error) {
        console.error("✗ Failed to compile service worker:", error);
        throw error;
      }
    },
    configureServer(server) {
      // During dev, compile service worker on request
      server.middlewares.use(async (req, res, next) => {
        if (req.url === "/sw.js") {
          try {
            const swEntry = join(root, "src/sw/index.ts");

            const result = await build({
              entryPoints: [swEntry],
              bundle: true,
              write: false,
              platform: "browser",
              format: "iife",
              minify: false,
              sourcemap: "inline",
              target: "es2020",
              tsconfig: join(root, "src/sw/tsconfig.json"),
            });

            if (result.errors.length > 0) {
              throw new Error(`esbuild failed: ${result.errors.map((e) => e.text).join(", ")}`);
            }

            const output = result.outputFiles?.[0];
            if (!output) {
              throw new Error("No output from esbuild");
            }

            res.setHeader("Content-Type", "application/javascript");
            res.setHeader("Cache-Control", "no-cache");
            res.end(output.text);
          } catch (error) {
            console.error("Failed to compile service worker:", error);
            res.statusCode = 500;
            res.end(`console.error("Service worker compilation error: ${error}");`);
          }
        } else {
          next();
        }
      });
    },
  };
}

