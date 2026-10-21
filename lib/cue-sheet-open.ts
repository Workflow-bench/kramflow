// What "Open console" does for one imported session. Pure, so the decision can be
// tested without the store or the router. The console page performs the action.
//
// Rules (unchanged from the page this was extracted from):
// - the chosen session is already live: just open the console;
// - another operator holds control: refuse, stay on the cue sheet;
// - a different session has already started: do not switch it. Say so and open the
//   console unchanged; the operator switches from the session switcher, which asks;
// - nothing has started: make the chosen session live (asks the server), then open.
// Nothing here runs on import. Going live is only ever the result of this click.

export type OpenConsolePlan =
  | { kind: "navigate" }
  | { kind: "refuse-locked" }
  | { kind: "toast-then-navigate"; message: string }
  | { kind: "select-then-navigate" };

export function planOpenConsole(input: {
  chosenStoredId: string;
  liveId: string;
  lockedByOther: boolean;
  liveHasStarted: boolean;
  dayLabel: string;
  sessionLabel: string;
}): OpenConsolePlan {
  if (input.chosenStoredId === input.liveId) return { kind: "navigate" };
  if (input.lockedByOther) return { kind: "refuse-locked" };
  if (input.liveHasStarted) {
    return {
      kind: "toast-then-navigate",
      message: `${input.dayLabel} • ${input.sessionLabel} is not live. Switch sessions in the console.`,
    };
  }
  return { kind: "select-then-navigate" };
}
