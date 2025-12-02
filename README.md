This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Running a development server

Because the app uses motion controls, some devices/browsers require the page to be served over HTTPS. This means that running the app locally requires one of two workarounds:

### Method #1: Local HTTPS server

The advantage of this method is that it is more reliable, and doesn't rely on a working Internet connection.

1. Run the app via:
    ```bash
    npm run dev
    ```
2. Navigate to the app (don't forget the S in "https"!)
   - [https://localhost:3000/listen](https://localhost:3000/listen) for the *output client*
   - [https://<your-ip-here>:3000](https://<your-ip-here>:3000) for the *input client*. You should see the exact address in your terminal output after step 1.
3. Follow all prompts in your browser to grant permission to run the app.

The disadvantage of this method is that step 3 can be tricky, since browsers rightfully make it difficult to open a website like this without a valid HTTPS cert.

### Method #2: Cloudflare Tunnel

This method requires an internet connection and relies on the free "Cloudflare Tunnels" service, which has no uptime guarantees, but has generally worked pretty well.

1. Run the app via:
    ```
    npm run dev:tunnel
    ```
2. Find the tunnel address in the terminal output. It should look something like:
   ```
    2025-11-25T20:40:52Z INF +--------------------------------------------------------------------------------------------+
    2025-11-25T20:40:52Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
    2025-11-25T20:40:52Z INF |  https://<some>-<random>-<words>-<here>.trycloudflare.com                                     |
    2025-11-25T20:40:52Z INF +--------------------------------------------------------------------------------------------+
   ```
3. Navigate to the app:
  -  https://<some>-<random>-<words>-<here>.trycloudflare.com/listen for the *output client*
  -  https://<some>-<random>-<words>-<here>.trycloudflare.com for the *input client*

Now, anyone with an Internet connection can access the app from that address, a long as your tunnel is working. You can check your terminal output to make sure the tunnel is still working.

# Connecting via WebSockets

To subscribe to a room's events (currently `SCHEDULE_BEAT` and `MOTION_INPUT`) via a WebSocket client (e.g. in Touch Designer):

1. **Connect your client** to the correct WebSockets endpoint, paying attention that it ends in `/ws`:
  - `wss://algofonia.nullstack.io/ws` - production server
  - `wss://<your-local-ip>:3000/ws` - local dev server running via Method #1 above
  - `wss://<some>-<random>-<words>-<here>.trycloudflare.com/ws` - local dev server running via Method #2 above
2. Use your client to **send a message** with type `SUBSCRIBE_TO_ROOM_REQUEST` in JSON format, as shown here. (For the default room, use the room name `"default"`.)
    ```
    {
      type: "SUBSCRIBE_TO_ROOM_REQUEST",
      roomName: "default"
    }
    ```
3. Confirm that the request was processed successfully by **listening for a message** with type `SUBSCRIBE_TO_ROOM_REPLY`, with the following JSON structure.
   ```
   {
      type: "SUBSCRIBE_TO_ROOM_REPLY",
      roomName: "default"
    }
   ```

Now, once the `/listen` page is opened and the music has started, you'll start receiving messages for certain events from the room, all in JSON format. Currently, you should receive events with type `SCHEDULE_BEAT` events as well as `MOTION_INPUT`. You can find their structure documented **with the `MessageToServer` data type** in the file [/app/WebsocketMessage.ts](./app/WebsocketMessage.ts).

## Learn Next.js

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

