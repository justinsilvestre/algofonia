# WebSocket Communication Setup

This setup provides real-time communication between multiple clients using WebSockets.

## Architecture

- **WebSocket Server**: Node.js server running on port 8080
- **Client Hook**: React hook (`useWebSocket`) for easy WebSocket integration
- **Message Types**: Standardized message format for different operations

## Running the Servers

### Option 1: Run separately
```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start WebSocket server
npm run ws-server
```

### Option 2: Run together
```bash
# Start both servers concurrently
npm run dev:all
```

## Message Types

- `JOIN_ROOM`: Join a synchronization room
- `LEAVE_ROOM`: Leave the current room
- `SYNC_DATA`: Send synchronized data to other clients
- `USER_COUNT`: Receive user count updates
- `ERROR`: Error messages

## Testing

1. Open multiple browser tabs to `/sync-test`
2. Join the same room ID from different tabs
3. Send random data and see it synchronized across all clients
4. Watch user count updates as clients join/leave

## WebSocket Hook Usage

```typescript
import { useWebSocket, MessageTypes } from '../hooks/useWebSocket';

const {
  isConnected,
  userCount,
  joinRoom,
  sendSyncData,
  onMessage
} = useWebSocket();

// Join a room
joinRoom('my-room', 'my-user-id');

// Send data to other clients
sendSyncData({ x: 100, y: 200 });

// Listen for messages
useEffect(() => {
  const handleMessage = (message) => {
    if (message.type === MessageTypes.SYNC_DATA) {
      console.log('Received data:', message.payload);
    }
  };
  
  onMessage(handleMessage);
  return () => offMessage(handleMessage);
}, []);
```

## Server Features

- Room-based synchronization
- Automatic reconnection
- User count tracking
- Message broadcasting
- Error handling
- Graceful shutdown