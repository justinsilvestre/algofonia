import { ReactNode } from "react";

/**
 * An sound module instance with its own controls for managing sound
 * and internal state for managing both sound and UI state.
 * Event listeners can be registered to respond to global events,
 * such as changes in key or tempo, or even external events
 * from sources like visuals.
 */
export type SoundModule<
  Key extends string,
  SoundModuleControls,
  SoundModuleState,
  GlobalToneControls,
  ToneEventMap extends Record<string, unknown>,
> = {
  controls: SoundModuleControls;
  state: SoundModuleState;
  key: Key;
  eventListeners: {
    [T in keyof ToneEventMap]?: (...args: unknown[]) => unknown;
  };
  definition: SoundModuleDefinition<
    SoundModuleControls,
    SoundModuleState,
    GlobalToneControls,
    ToneEventMap
  >;
};

export type SoundModuleDefinition<
  SoundModuleControls,
  SoundModuleState,
  GlobalToneControls,
  ToneEventMap extends Record<string, unknown>,
> = {
  initialize: (tone: GlobalToneControls) => {
    controls: SoundModuleControls;
    state: SoundModuleState;
  };
  teardown: (
    controls: SoundModuleControls,
    soundModuleState: SoundModuleState,
    tone: GlobalToneControls
  ) => void;
  onStateChange?: (
    tone: GlobalToneControls,
    controls: SoundModuleControls,
    state: SoundModuleState,
    prevState: SoundModuleState
  ) => void;
  onToneEvent?: {
    [T in keyof ToneEventMap]?: (
      controls: SoundModuleControls,
      state: SoundModuleState,
      tone: GlobalToneControls,
      arg: ToneEventMap[T],
      setState: SetState<SoundModuleState>
    ) => void;
  };
  renderMonitorDisplay?: (
    state: SoundModuleState,
    setState: SetState<SoundModuleState>,
    toneControls: GlobalToneControls
  ) => ReactNode;
};

export type SetState<SoundModuleState> = (
  state: SoundModuleState | ((prevState: SoundModuleState) => SoundModuleState)
) => void;
