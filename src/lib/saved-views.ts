import type { FilterKey, SortKey } from "@/pages/Inbox";

export type SavedView = {
  id: string;
  name: string;
  filter: FilterKey;
  sort: SortKey;
  stageFilter: string | null;
  tagFilter: string | null;
};

const KEY = "inbox.saved-views";

export function listViews(): SavedView[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveViews(views: SavedView[]) {
  localStorage.setItem(KEY, JSON.stringify(views));
  window.dispatchEvent(new Event("saved-views-changed"));
}

export function addView(v: Omit<SavedView, "id">): SavedView {
  const view: SavedView = { ...v, id: crypto.randomUUID() };
  const all = listViews();
  all.push(view);
  saveViews(all);
  return view;
}

export function removeView(id: string) {
  saveViews(listViews().filter((v) => v.id !== id));
}
