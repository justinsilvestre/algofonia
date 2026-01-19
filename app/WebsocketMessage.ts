export type MessageToClient =
  | {
      type: "SYNC_REPLY";
      /** using NTP, client timestamp when sync request was sent */
      t0: number;
      /** server timestamp when sync request was received */
      s0: number;
    }
  | {
      type: "JOIN_ROOM_REPLY";
      userId: number;
      roomState: RoomState;
    }
  | {
      type: "ROOM_STATE_UPDATE";
      roomName: string;
      roomState: RoomState;
    }
  | {
      type: "SET_TEMPO";
      roomName: string;
      bpm: number;
      actionTimestamp: number;
      nextBeatNumber: number;
      nextBeatTimestamp: number;
    }
  | {
      type: "SYNC_BEAT";
      roomName: string;
      beatNumber: number;
      beatTimestamp: number;
      bpm: number;
    }
  | {
      type: "SUBSCRIBE_TO_ROOM_REPLY";
      roomName: string;
    }
  | {
      type: "SCHEDULE_BEAT";
      roomName: string;
      beatNumber: number;
      beatTimestamp: number;
    }
  | MotionInputMessageToClient;

export type MotionInputMessageToClient = {
  type: "MOTION_INPUT";
  userId: number;
  frontToBack: number;
  around: number;
  actionTimestamp: number;
  nextBeatTimestamp: number;
};

export type RoomState = {
  inputClients: number[];
  outputClients: number[];
  subscriptionsCount: number;
  beat: {
    bpm: number;
    startTimestamp: number;
    lastBeatNumber: number;
    nextBeatTimestamp: number;
  } | null;
};

export type MessageToServer =
  | {
      type: "SYNC";
      /** Using NTP, client timestamp when sync request was sent */
      t0: number;
    }
  | {
      type: "JOIN_ROOM_REQUEST";
      roomName: string;
      clientType: "input";
    }
  | {
      type: "JOIN_ROOM_REQUEST";
      roomName: string;
      clientType: "output";
      bpm: number;
    }
  | {
      type: "SET_TEMPO";
      roomName: string;
      bpm: number;
      actionTimestamp: number;
      nextBeatNumber: number;
      nextBeatTimestamp: number;
    }
  | {
      type: "MOTION_INPUT";
      roomName: string;
      userId: number;
      frontToBack: number;
      around: number;
      actionTimestamp: number;
      lastBeatNumber: number;
      nextBeatTimestamp: number;
    }
  | {
      type: "SYNC_BEAT";
      roomName: string;
      beatNumber: number;
      beatTimestamp: number;
    }
  | {
      type: "SUBSCRIBE_TO_ROOM_REQUEST";
      roomName: string;
    }
  | {
      type: "SCHEDULE_BEAT";
      roomName: string;
      beatNumber: number;
      beatTimestamp: number;
    };
