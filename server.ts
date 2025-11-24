import * as http from "http";
import * as https from "https";
import { parse } from "url";
import next from "next";
import { startWebSocketServer } from "./server/websocket-server.js";
import { getCert } from "./getCert.js";
import { getLocalIp } from "./getLocalIp.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const useHttps = process.env.USE_HTTPS || false;

// Prepare Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    console.log("🚀 Starting Algofonia server...");

    // Prepare Next.js
    await app.prepare();
    console.log("✅ Next.js app prepared");

    let server: http.Server | https.Server;
    if (useHttps) {
      const { cert } = await getCert("https");
      console.log("✅ TLS certificates ready");
      server = https.createServer(cert, async (req, res) => {
        try {
          const parsedUrl = parse(req.url!, true);
          await handle(req, res, parsedUrl);
        } catch (err) {
          console.error("Error occurred handling", req.url, err);
          res.statusCode = 500;
          res.end("Internal server error");
        }
      });
    } else {
      // Create main HTTP server for Next.js
      server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = parse(req.url!, true);
          await handle(req, res, parsedUrl);
        } catch (err) {
          console.error("Error occurred handling", req.url, err);
          res.statusCode = 500;
          res.end("Internal server error");
        }
      });
    }
    console.log("✅ Server created");

    // Start WebSocket server
    const wsServer = await startWebSocketServer({
      server,
    });
    console.log("✅ WebSocket server started");

    // Start Next.js server
    server.listen(port, () => {
      console.log(`✅ Next.js server ready on https://${hostname}:${port}`);
      console.log(`✅ WebSocket server ready on wss://${hostname}:${port}/ws`);
      const localIp = getLocalIp();
      console.log(`Access on local network at: https://${localIp}:${port}`);
      console.log("🎵 Algofonia is ready to make music!");
    });

    server.on("upgrade", (req, socket, head) => {
      if (req.url === "/ws") {
        wsServer.handleUpgrade(req, socket, head, (ws) => {
          wsServer.emit("connection", ws, req);
        });
      }
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
