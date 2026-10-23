// Selection, the shift-click anchor, search and the bulk-edit panel all
// belong to one viewed session's rows. When the effective viewed session
// changes by any route — the picker, a same-route ?session= change,
// Back/Forward, the per-tab restore, or the "no longer available" fallback —
// they must reset, or a bulk action could target ids from the previous
// session. The first resolution (null -> id) is not a change.
export type ViewState = {
  selected: ReadonlySet<string>;
  anchorId: string | null;
  search: string;
  bulkEditOpen: boolean;
};

export const EMPTY_VIEW_STATE: ViewState = {
  selected: new Set<string>(),
  anchorId: null,
  search: "",
  bulkEditOpen: false,
};

export function viewedSessionChanged(prev: string | null, next: string | null): boolean {
  return prev !== null && next !== null && prev !== next;
}

export function viewStateAfterSessionResolve(prev: string | null, next: string | null, state: ViewState): ViewState {
  return viewedSessionChanged(prev, next) ? EMPTY_VIEW_STATE : state;
}
