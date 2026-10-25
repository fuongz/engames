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

export const games: GameManifest[] = Object.entries(manifestModules)
  .map(([path, manifest]) => {
    if (manifest.slug !== slugFromPath(path)) {
      throw new Error(
        `Manifest slug "${manifest.slug}" must match folder "${slugFromPath(path)}"`,
      );
    }
    return manifest;
  })
  .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));

export function findGame(slug: string) {
  return games.find((g) => g.slug === slug);
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
];
