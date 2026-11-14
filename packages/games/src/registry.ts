import type { GameCategory, GameManifest, GameModule, Localized } from "@web-games/core";

// Every folder with a manifest.ts is a game. Manifests are eager (small, needed
// for listings); game code is lazy so each game ships as its own chunk and only
// loads when opened.
const manifestModules = import.meta.glob<GameManifest>("./*/manifest.ts", {
  eager: true,
  import: "default",
});
const gameLoaders = import.meta.glob<GameModule>("./*/index.ts", {
  import: "default",
});

const slugFromPath = (path: string) => path.split("/").at(-2) ?? "";

/**
 * Games pulled from every listing for now (library, search, Prize Counter,
 * changelog, sitemap). Their pages, saves and history still resolve through
 * findGame, so old links and records keep working. Remove a slug to bring it back.
 */
export const HIDDEN_GAMES: ReadonlySet<string> = new Set(["phi-dao", "khu-cach-ly"]);

/** Every game folder, hidden ones included (rooms, saves and history need them). */
export const allGames: GameManifest[] = Object.entries(manifestModules)
  .map(([path, manifest]) => {
    if (manifest.slug !== slugFromPath(path)) {
      throw new Error(
        `Manifest slug "${manifest.slug}" must match folder "${slugFromPath(path)}"`,
      );
    }
    return manifest;
  })
  .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));

/** Every listed game, newest first. */
export const games: GameManifest[] = allGames.filter((g) => !HIDDEN_GAMES.has(g.slug));

export function findGame(slug: string) {
  return allGames.find((g) => g.slug === slug);
}

export async function loadGame(slug: string): Promise<GameModule> {
  const loader = gameLoaders[`./${slug}/index.ts`];
  if (!loader) throw new Error(`Game "${slug}" has no index.ts`);
  return loader();
}

export const categories: { id: GameCategory; label: Localized<string> }[] = [
  { id: "hanh-dong", label: { vi: "Hành động", en: "Action" } },
  { id: "chien-thuat", label: { vi: "Chiến thuật", en: "Strategy" } },
  { id: "tri-tue", label: { vi: "Trí tuệ", en: "Puzzle" } },
  { id: "phieu-luu", label: { vi: "Phiêu lưu", en: "Adventure" } },
  { id: "the-thao", label: { vi: "Thể thao", en: "Sports" } },
  { id: "arcade", label: { vi: "Game thùng", en: "Arcade" } },
];
