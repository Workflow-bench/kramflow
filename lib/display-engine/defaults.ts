import {
  DEFAULT_TIMER_THRESHOLDS,
  INITIAL_HOLD_STATE,
  INITIAL_TIMER_STATE,
  type DisplayEngineState,
} from "./types";

export function createInitialEngineState(): DisplayEngineState {
  return {
    registry: {},
    groups: {},
    timer: { ...INITIAL_TIMER_STATE, thresholds: { ...DEFAULT_TIMER_THRESHOLDS } },
    hold: { ...INITIAL_HOLD_STATE },
    broadcasts: {
      active: [],
      history: [],
      scheduled: [],
      templates: [],
      favorites: [],
      drafts: [],
    },
    speakerReady: {},
  };
}
