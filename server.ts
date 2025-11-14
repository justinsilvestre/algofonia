import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { startWebSocketServer } from "./server/websocket-server.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const wsPort = parseInt(process.env.WS_PORT || "8080", 10);

// Prepare Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    console.log("🚀 Starting Algofonia server...");

    // Prepare Next.js
    await app.prepare();
    console.log("✅ Next.js app prepared");

    // Start WebSocket server
    const wsServer = await startWebSocketServer({ port: wsPort });
    console.log("✅ WebSocket server started");

    // Create main HTTP server for Next.js
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("Error occurred handling", req.url, err);
        res.statusCode = 500;
        res.end("Internal server error");
      }
    });

    // Start Next.js server
    server.listen(port, () => {
      console.log(`✅ Next.js server ready on http://${hostname}:${port}`);
      console.log(`✅ WebSocket server ready on ws://${hostname}:${wsPort}`);
      console.log("🎵 Algofonia is ready to make music!");
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

      // Close Next.js server
      server.close(() => {
        console.log("✅ Next.js server closed");
      });

      // Close WebSocket server
      wsServer.close(() => {
        console.log("✅ WebSocket server closed");
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        console.log("⚠️  Forcing exit...");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
