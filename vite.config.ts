import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  // Expose only these two public values, never other server environment variables.
  define: {
    "import.meta.env.SUPABASE_URL": JSON.stringify(env.SUPABASE_URL || ""),
    "import.meta.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY || ""),
  },
  server: {
    host: "::",
    port: 8080,
    open: false,
    fs: {
      // Allow serving from project root and all subdirectories
      allow: [".."],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
    emptyOutDir: true,
  },
  plugins: [
    react(),
    // Only wire up the express dev middleware during `vite dev` (serve mode)
    // Import is deferred inside the plugin so it never runs during `vite build`
    command === "serve" ? expressDevPlugin() : null,
  ].filter(Boolean) as Plugin[],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  };
});

// Lazy-load the express server only in dev — keeps it out of the build graph
function expressDevPlugin(): Plugin {
  return {
    name: "express-dev-plugin",
    apply: "serve",
    async configureServer(server) {
      // Dynamic import so esbuild never bundles server code during client build
      const { createServer } = await import("./server/index.ts");
      const app = createServer();
      server.middlewares.use(app);
    },
  };
}
