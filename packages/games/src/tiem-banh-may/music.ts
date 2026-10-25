import type { RecordId } from "./config";

// Licensed music is kept out of git (see DESIGN.md → Music): each record's
// track is bundled when audio/music-<record>.mp3 is present on the deploying
// machine; a record without its file is simply not offered.
const MUSIC: Partial<Record<RecordId, string>> = {};
for (const [path, url] of Object.entries(
  import.meta.glob<string>("./audio/*.mp3", { eager: true, import: "default" }),
)) {
  const id = /music-([a-z]+)\.mp3$/.exec(path)?.[1];
  if (id) MUSIC[id as RecordId] = url;
}
/** Records that can be played here (their track was bundled). */
export const hasTrack = (id: RecordId) => !!MUSIC[id];

/** The bundled track for a record, if there is one. */
export const trackUrl = (id: RecordId) => MUSIC[id];
