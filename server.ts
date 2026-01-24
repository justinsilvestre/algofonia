import * as http from "http";
import * as https from "https";
import { parse } from "url";
import next from "next";
import { Server as OSCServer } from "node-osc";
import { startWebSocketServer } from "./app/server/websocketServer.js";
import { getCert } from "./app/server/getCert.js";
import { getLocalIp } from "./app/server/getLocalIp.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const useHttps =
  process.env.TUNNEL || process.env.NODE_ENV === "production" ? false : true;

if (process.env.NODE_ENV === "production") {
  console.log("Running in production mode");
} else {
  console.log("Running in mode:", process.env.NODE_ENV);
}

if (process.env.TUNNEL) {
  console.log("Serving over HTTP for tunneling");
}

// Prepare Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    console.log("🚀 Starting Algofonia server...");

    // Prepare Next.js
    await app.prepare();
    console.log("✅ Next.js app prepared");

    // Start OSC listener (for motion-tracking skeleton.py)
    const oscPort = 9000;
    const oscServer = new OSCServer(oscPort, "0.0.0.0");

    console.log(
      `✅ OSC server listening on udp://0.0.0.0:${oscPort} (e.g. /people/position)`
    );

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
    const { websocketServer: wsServer, broadcastPersonPosition } =
      await startWebSocketServer({
        httpServer: server,
      });
    console.log("✅ WebSocket server started");

    // Connect OSC to WebSocket broadcasting
    oscServer.on("message", (msg: unknown) => {
      if ((msg as [string, number, number, number])[0] === "/people/position") {
        const [_, personIdx, x, y] = msg as [string, number, number, number];
        console.log(`osc: /person/position ${[personIdx, x, y].join(", ")}`);
        // Forward to all connected WebSocket clients
        broadcastPersonPosition(personIdx, x, y);
      }
    });

    // Start Next.js server
    server.listen(port, () => {
      console.log(
        `✅ Next.js server ready on http${
          useHttps ? "s" : ""
        }://${hostname}:${port}`
      );
      console.log(
        `✅ WebSocket server ready on ws${
          useHttps ? "s" : ""
        }://${hostname}:${port}/ws`
      );
      const localIp = getLocalIp();
      console.log("🎵 Ready to make music!");

      function logInBox(message: string[]) {
        const boxWidth = Math.max(...message.map((line) => line.length)) + 4;
        console.log("*".repeat(boxWidth));
        message.forEach((line) => {
          const padding = " ".repeat(boxWidth - line.length - 3);
          console.log(`* ${line}${padding}*`);
        });
        console.log("*".repeat(boxWidth));
      }
      if (process.env.TUNNEL) {
        logInBox([
          "TUNNELING ENABLED - to access the dev site from anywhere, use the provided tunnel URL.",
          "",
          `LISTEN TO MUSIC at:`,
          `   🔊 http${useHttps ? "s" : ""}://<your-tunnel-url>/`,
          `   Or, on this machine, at http${
            useHttps ? "s" : ""
          }://localhost:${port}/`,
          "",
          // `MAKE MUSIC on local network at:`,
          // `   🎶 http${useHttps ? "s" : ""}://${localIp}:${port}`,
        ]);
      } else {
        logInBox([
          "",
          `LISTEN TO MUSIC at:`,
          `   🔊 http${useHttps ? "s" : ""}://${localIp}:${port}/listen`,
          `   Or, on this machine, at http${
            useHttps ? "s" : ""
          }://localhost:${port}/`,
          "",
          // `MAKE MUSIC on local network at:`,
          // `   🎶 http${useHttps ? "s" : ""}://${localIp}:${port}`,
        ]);
      }
    });

    server.on("upgrade", (req, socket, head) => {
      if (req.url === "/ws") {
        wsServer.handleUpgrade(req, socket, head, (ws) => {
          wsServer.emit("connection", ws, req);
        });
      }
    });

    server.on("error", (error) => {
      console.error("❌ Server error:", error);
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
