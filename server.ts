/* eslint-disable @typescript-eslint/no-explicit-any */
import * as http from "http";
import * as https from "https";
import { parse } from "url";
import next from "next";
// @ts-expect-error -- no types available
import osc from "osc";
import { startWebSocketServer } from "./app/server/websocket-server.js";
import { getCert } from "./app/server/getCert.js";
import { getLocalIp } from "./app/server/getLocalIp.js";
import { Server } from "node-osc";

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

    const oscTestServerPort = 8000;
    const oscTestServer = new Server(oscTestServerPort, "0.0.0.0", () => {
      console.log(`OSC test server is listening on port ${oscTestServerPort}`);
    });
    oscTestServer.on("message", (msg, rinfo) => {
      console.log("Received OSC message:", msg, "from", rinfo);
    });
    oscTestServer.on("bundle", (bundle: any, rinfo: any) => {
      console.log("Received OSC bundle:", bundle, "from", rinfo);
    });

    const udpPort = new osc.UDPPort({
      localAddress: "0.0.0.0",
      localPort: 57121,
      metadata: true,
    });

    // Listen for incoming OSC messages.
    udpPort.on("message", function (oscMsg: any, timeTag: any, info: any) {
      console.log("An OSC message just arrived!", oscMsg);
      console.log("Timetag:", timeTag, "Remote info:", info);
    });
    udpPort.on("bundle", function (oscBundle: any, timeTag: any, info: any) {
      console.log("An OSC bundle just arrived!", oscBundle);
      console.log("Timetag:", timeTag, "Remote info:", info);
    });

    // Open the socket.
    udpPort.open();

    const sendOscMessage = (...args: unknown[]) => {
      udpPort.send(...args, "127.0.0.1", oscTestServerPort);
      // udpPort.send(...args, );
    };

    // When the port is read, send an OSC message to, say, SuperCollider
    udpPort.on("ready", function () {
      console.log("✅ OSC UDP port is ready");
      udpPort.send(
        {
          timeTag: osc.timeTag(0),
          packets: [
            {
              address: "/s_new_bundled",
              args: [
                {
                  type: "s",
                  value: "default",
                },
                {
                  type: "i",
                  value: 100,
                },
              ],
            },
          ],
        },
        "127.0.0.1",
        oscTestServerPort
      );

      udpPort.send(
        {
          address: "/s_new",
          args: [
            {
              type: "s",
              value: "default",
            },
            {
              type: "i",
              value: 100,
            },
          ],
        },
        "127.0.0.1",
        oscTestServerPort
      );
    });

    // Start WebSocket server
    const wsServer = await startWebSocketServer({
      server,
      sendOscMessage,
    });
    console.log("✅ WebSocket server started");

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
      console.log(
        `Access on local network at: http${
          useHttps ? "s" : ""
        }://${localIp}:${port}`
      );
      console.log("🎵 Ready to make music!");
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
