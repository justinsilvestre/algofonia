export const MessageTypes = {
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  BEAT: "beat",
  SET_TEMPO: "set_tempo",
  USER_COUNT: "user_count",
  ERROR: "error",
} as const;

export type WebSocketMessage =
  | {
      type: typeof MessageTypes.JOIN_ROOM;
      roomId: string;
      userId: string;
    }
  | {
      type: typeof MessageTypes.LEAVE_ROOM;
    }
  | {
      type: typeof MessageTypes.BEAT;
      bpm: number;
      timestamp: number;
      beatNumber: number;
    }
  | {
      type: typeof MessageTypes.SET_TEMPO;
      bpm: number;
      timestamp: number;
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
