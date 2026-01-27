"use client";
import { useCallback, useMemo, useState } from "react";
import * as Tone from "tone";
import {
  getToneControls,
  ToneControls,
  ToneEventListenerArg,
  ToneEventMap,
  ToneEventType,
} from "./tone";
import { useDidChange } from "../listen/useDidChange";
import type {
  SetState,
  SoundModule,
  SoundModuleDefinition,
} from "./SoundModule";
import type {
  SoundModuleOf,
  SoundModuleKey,
  SoundModulesDefinitions,
  SoundModuleStateOf,
  SoundModuleControlsOf,
} from "./soundModules/definitions";

export function useTone(
  soundModulesDefinitions: SoundModulesDefinitions,
  soundModulesOrder: SoundModuleKey[]
) {
  const [controls] = useState<ToneControls>(() => getToneControls());

  const [startedOnce, setStartedOnce] = useState(() => {
    return controls.transport.state === "started";
  });
  const [activeSoundModules, setActiveSoundModules] = useState<
    SoundModuleOf<SoundModuleKey>[]
  >([]);

  const getSetState = useCallback(
    <Key extends SoundModuleKey>(soundModule: SoundModuleOf<Key>) => {
      const index = activeSoundModules.findIndex(
        (c) => c.key === soundModule.key
      );
      const setState: SetState<SoundModuleStateOf<Key>> = (updater) => {
        const newSoundModules = [...activeSoundModules];
        const oldSoundModule = newSoundModules[index];
        const oldState = oldSoundModule.state;
        const newState =
          typeof updater === "function"
            ? (
                updater as (
                  prevState: SoundModuleStateOf<Key>
                ) => SoundModuleStateOf<Key>
              )(oldState)
            : updater;
        newSoundModules[index] = {
          ...oldSoundModule,
          state: newState,
        };

        const definition = oldSoundModule.definition;
        if (definition.onStateChange) {
          definition.onStateChange(
            controls,
            oldSoundModule.controls,
            newState,
            oldState
          );
        }
        setActiveSoundModules(newSoundModules);
      };
      return setState;
    },
    [activeSoundModules, controls]
  );

  const start = useCallback(
    (startTime?: Tone.Unit.Time | undefined) => {
      return Tone.start().then(() => {
        const { transport } = controls;

        const newSoundModules = soundModulesOrder.map((key) =>
          // @ts-expect-error -- parameter type inference issue
          createSoundModule(key, soundModulesDefinitions[key], controls)
        );
        setActiveSoundModules(newSoundModules);

        addEventListenersForModules(newSoundModules, controls, getSetState);

        console.log(
          "Starting Tone.js Transport with soundModules:",
          newSoundModules
        );

        const startBpm = controls.getBpm();

        transport.bpm.value = startBpm;
        transport.start(startTime);

        setStartedOnce(true);
      });
    },
    [soundModulesDefinitions, soundModulesOrder, controls, getSetState]
  );

  useDidChange(activeSoundModules, (current) => {
    const newSoundModules = current;
    // Re-register event listeners for all modules
    // Currently re-adding ALL event listeners, even for unchanged soundModules.

    removeEventListenersForModules(newSoundModules, controls);
    addEventListenersForModules(newSoundModules, controls, getSetState);
  });

  const soundModulesDef = useMemo(() => {
    return { soundModulesDefinitions, soundModulesOrder };
  }, [soundModulesDefinitions, soundModulesOrder]);
  useDidChange(soundModulesDef, (current, previous) => {
    console.log("Updating soundModules due to definition or order change");
    const newActiveSoundModules: SoundModuleOf<SoundModuleKey>[] = [];
    for (const newActiveSoundModuleKey of current.soundModulesOrder) {
      const oldActiveSoundModule = activeSoundModules.find(
        (c) => c.key === newActiveSoundModuleKey
      );
      const newSoundModuleHasBeenAdded = !oldActiveSoundModule;
      if (newSoundModuleHasBeenAdded) {
        const newActiveSoundModule = createSoundModule(
          newActiveSoundModuleKey,
          // @ts-expect-error -- parameter type inference issue
          current.soundModulesDefinitions[newActiveSoundModuleKey],
          controls
        );
        newActiveSoundModules.push(newActiveSoundModule);
      } else {
        // an active soundModule with this key has existed since before the change,
        // meaning that we need to check if its definition has changed
        const oldDefinition =
          previous.soundModulesDefinitions[newActiveSoundModuleKey];
        const newDefinition =
          current.soundModulesDefinitions[newActiveSoundModuleKey];
        const soundModuleUnchanged = oldDefinition === newDefinition;
        if (soundModuleUnchanged) {
          // keep old soundModule as is
          newActiveSoundModules.push(oldActiveSoundModule);
        } else {
          // Teardown old soundModule
          oldDefinition.teardown(
            // @ts-expect-error -- suppressing potential runtime errors when structure changes
            oldActiveSoundModule.controls,
            oldActiveSoundModule.state,
            controls
          );
          const newActiveSoundModuleBase = createSoundModule(
            newActiveSoundModuleKey,
            // @ts-expect-error -- parameter type inference issue
            newDefinition,
            controls
          );
          const newActiveSoundModuleState = {
            ...(newActiveSoundModuleBase.state as object),
            ...(oldActiveSoundModule.state as object),
          } as typeof newActiveSoundModuleBase.state;
          newActiveSoundModuleBase.definition.onStateChange?.(
            controls,
            newActiveSoundModuleBase.controls,
            oldActiveSoundModule.state,
            newActiveSoundModuleBase.state
          );
          console.log(
            "New active soundModule state for " + newActiveSoundModuleKey,
            newActiveSoundModuleState
          );
          newActiveSoundModules.push({
            ...newActiveSoundModuleBase,
            state: newActiveSoundModuleState,
          });
        }
      }
    }

    const deletedSoundModules = activeSoundModules.filter(
      (c) => !current.soundModulesOrder.includes(c.key)
    );
    deletedSoundModules.forEach((soundModule) => {
      const definition = previous.soundModulesDefinitions[soundModule.key];
      definition.teardown(
        // @ts-expect-error -- suppressing potential runtime errors when structure changes
        soundModule.controls,
        soundModule.state,
        controls
      );
      removeEventListeners(soundModule, controls);
    });

    setActiveSoundModules(newActiveSoundModules);
  });

  return useMemo(
    () => ({
      controls,
      activeSoundModules,
      getSetState: getSetState,
      start,
      started: startedOnce,
    }),
    [controls, activeSoundModules, getSetState, start, startedOnce]
  );
}
export function createSoundModule<Key extends SoundModuleKey>(
  key: Key,
  definition: SoundModuleDefinition<
    SoundModuleControlsOf<Key>,
    SoundModuleStateOf<Key>,
    ToneControls,
    ToneEventMap
  >,
  tone: ToneControls
) {
  const { state, controls } = definition.initialize(tone);

  const soundModule: SoundModule<
    Key,
    typeof controls,
    typeof state,
    ToneControls,
    ToneEventMap
  > = {
    controls,
    state,
    key,
    definition,
    eventListeners: {},
  };
  return soundModule;
}

function addEventListeners(
  soundModule: SoundModuleOf<SoundModuleKey>,
  controls: ToneControls,
  getSetState: <Key extends SoundModuleKey>(
    soundModule: SoundModuleOf<Key>
  ) => SetState<SoundModuleOf<Key>["state"]>
) {
  if (soundModule.definition.onToneEvent) {
    for (const eventName in soundModule.definition.onToneEvent) {
      const listener = (arg: ToneEventListenerArg<ToneEventType>) => {
        const handler =
          soundModule.definition.onToneEvent?.[eventName as ToneEventType];
        if (handler) {
          handler(
            soundModule.controls,
            soundModule.state,
            controls,
            arg as never,
            getSetState(soundModule)
          );
        }
      };
      controls.addEventListener(eventName as ToneEventType, listener);
      soundModule.eventListeners[eventName as ToneEventType] = listener as (
        ...args: unknown[]
      ) => unknown[];
    }
  }
}

function removeEventListeners(
  soundModule: SoundModuleOf<SoundModuleKey>,
  controls: ToneControls
) {
  for (const eventName in soundModule.eventListeners) {
    const listener = soundModule.eventListeners[eventName as ToneEventType];
    if (listener) {
      controls.removeEventListener(eventName as ToneEventType, listener);
    }
  }
}

function addEventListenersForModules(
  soundModules: SoundModuleOf<SoundModuleKey>[],
  controls: ToneControls,
  getSetState: <Key extends SoundModuleKey>(
    soundModule: SoundModuleOf<Key>
  ) => SetState<SoundModuleOf<Key>["state"]>
) {
  for (const soundModule of soundModules) {
    addEventListeners(soundModule, controls, getSetState);
  }
}

function removeEventListenersForModules(
  soundModules: SoundModuleOf<SoundModuleKey>[],
  controls: ToneControls
) {
  for (const soundModule of soundModules) {
    removeEventListeners(soundModule, controls);
  }
}
