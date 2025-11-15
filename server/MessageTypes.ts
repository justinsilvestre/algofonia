export const MessageTypes = {
  SYNC: "sync",
  SYNC_REPLY: "sync_reply",
  JOIN_ROOM_REQUEST: "join_room_request",
  ASSIGN_USER_ID: "assign_user_id",
  LEAVE_ROOM: "leave_room",
  BEAT: "beat",
  SET_TEMPO: "set_tempo",
  USER_COUNT: "user_count",
  ERROR: "error",
} as const;

export type WebSocketMessage =
  | {
      type: typeof MessageTypes.SYNC;
      /** client timestamp when sync request was sent */
      t1: number;
    }
  | {
      type: typeof MessageTypes.SYNC_REPLY;
      /** client timestamp when sync request was sent */
      t1: number;
      /** server timestamp when sync request was received */
      t2: number;
      /** server timestamp when sync reply was sent */
      t3: number;
    }
  | {
      type: typeof MessageTypes.JOIN_ROOM_REQUEST;
    }
  | {
      type: typeof MessageTypes.ASSIGN_USER_ID;
      userId: number;
    }
  | {
      type: typeof MessageTypes.LEAVE_ROOM;
    }
  | {
      type: typeof MessageTypes.BEAT;
      bpm: number;
      timestamp: number;
      beatNumber: number;
      nextBeatTimestamp: number;
    }
  | {
      type: typeof MessageTypes.SET_TEMPO;
      bpm: number;
      timestamp: number;
      nextBeatTimestamp: number;
    }
  | {
      type: typeof MessageTypes.USER_COUNT;
      count: number;
      roomId: string;
    }
  | {
      type: typeof MessageTypes.ERROR;
      message: string;
    };
