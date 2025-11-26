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
      bpm: number;
      nextBeatTimestamp: number;
    }
  | {
      type: "ROOM_STATE_UPDATE";
      roomName: string;
      roomState: RoomState;
    }
  | {
      type: "SET_TEMPO";
      bpm: number;
      actionTimestamp: number;
      nextBeatTimestamp: number;
    }
  | MotionInputMessageToClient;

export type MotionInputMessageToClient = {
  type: "MOTION_INPUT";
  frontToBack: number;
  around: number;
  actionTimestamp: number;
  nextBeatTimestamp: number;
};

export type RoomState = {
  inputClientsCount: number;
  outputClientsCount: number;
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
      clientType: "input" | "output";
    }
  | {
      type: "SET_TEMPO";
      roomName: string;
      bpm: number;
      actionTimestamp: number;
      nextBeatTimestamp: number;
    }
  | {
      type: "MOTION_INPUT";
      roomName: string;
      userId: number;
      frontToBack: number;
      around: number;
      actionTimestamp: number;
      nextBeatTimestamp: number;
    };
