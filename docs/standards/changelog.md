# Game changelogs

Every game says what changed in each release, in both languages. Players read
it in two places: **Update history** ("Lịch sử cập nhật") on the game page, and
the site-wide **What's new** timeline at `/changelog` ("Có gì mới", linked from
the sidebar), which can be narrowed to one game (`/changelog?game=<slug>`).

---

## The rule

**Every release bumps `manifest.version` and adds a changelog entry dated the
release day.** A release is anything a player would notice (see `version` in
`GameManifest`). No entry, no release; no version bump, no entry.

- `changelog` is ordered **newest first**; the new entry goes at the top.
- `changelog[0].version` **equals** `manifest.version`.
- `date` is the release day in Vietnam, `YYYY-MM-DD`.
- Entries are history: never edit an old entry's `version` or `date`, never
  reorder or delete one. Fix a typo in its text if you must.

## Adding an entry

```ts
// packages/games/src/<slug>/manifest.ts
import type { GameManifest } from "@web-games/core";

const manifest: GameManifest = {
  // …
  version: "1.4.0", // bumped
  changelog: [
    {
      version: "1.4.0", // the same as manifest.version
      date: "2026-11-12", // today, Vietnam time
      title: { vi: "Hũ may mắn", en: "Lucky Jar" }, // optional headline
      changes: {
        vi: ["Thêm Hũ may mắn chung cho mọi game arcade.", "Sửa lỗi xu bị trừ hai lần khi thoát giữa ván."],
        en: ["Added the Lucky Jar, shared by every arcade game.", "Fixed coins being taken twice when quitting mid-run."],
      },
    },
    // older entries below, newest first
  ],
};
```

`ChangelogEntry` lives in `packages/core/src/types.ts`:

| Field | What it is |
| --- | --- |
| `version` | Semver (`"1.4.0"`), strictly lower than the entry above it |
| `date` | `YYYY-MM-DD`; never later than the entry above it (two releases can share a day) |
| `title?` | `Localized<string>`, a short headline; give both languages or neither |
| `changes` | `Localized<string[]>`, one line per change, **at least one** in `vi` and in `en` |

### Writing the lines

- Write for players, not for the repo: what they will see or feel ("Ván chơi
  nhanh hơn khi ít người"), not how it was done ("refactor sim.ts").
- One change per line, a full sentence, ending with a full stop. Lead with the
  verb: Thêm / Sửa / Đổi… · Added / Fixed / Changed…
- Same lines in the same order in both languages.
- Keep the tone of [`jackpot.md`](jackpot.md) for anything about the Lucky Jar
  or tickets: soft and non-casino.

## What checks it

`packages/games/src/conventions.test.ts` (`changelog`) runs on every game with
a changelog and fails on:

- a version that is not semver, or versions that do not strictly descend;
- a date that is not a real `YYYY-MM-DD` day, or dates that go up;
- `manifest.version` set and different from `changelog[0].version`;
- an entry without a change in `vi` or in `en` (or with an empty line), or a
  title in one language only;
- `changelog: []` (leave the field out instead).

It does not know what day you released: getting the date right is on you.

## Where it shows

- **Game page** (`components/features/game-player/update-history.tsx`, inside
  `GameDetails`): newest entry open, older ones collapsed (shadcn Accordion),
  each with its version badge, the date in the player's language, the title and
  the bullets. Hidden when the game has no changelog.
- **`/changelog`** (`routes/changelog.tsx`,
  `components/features/changelog/`): every game's entries grouped by day, newest
  first, each linking to its game, with a game filter. Grouping and date
  formatting are pure functions in `apps/web/src/lib/changelog.ts`.
