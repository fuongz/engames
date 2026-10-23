// Server-side checks for games whose progress lives on the player's account
// (`requiresAccount`). Each such game ships a pure `src/<slug>/save.ts` exporting
// `rules`; the portal's server runs every save through them before storing it.

export interface SaveRules {
  /** The save if it has the right shape, else null. */
  parse(raw: unknown): unknown | null;
  /** Could `next` follow `prev` (null: the first save) in real play? */
  plausible(prev: unknown | null, next: unknown): boolean;
  /** The leaderboard number for a save, computed here rather than trusted. */
  score?(save: unknown): number;
}

const modules = import.meta.glob<SaveRules>("./*/save.ts", {
  eager: true,
  import: "rules",
});

export function findSaveRules(slug: string): SaveRules | undefined {
  return modules[`./${slug}/save.ts`];
}
