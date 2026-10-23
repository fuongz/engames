import { type ReactNode, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { useMessages } from "#/hooks/use-messages";

/** Solo and co-op boards for a game that plays online. */
export function BoardTabs({ solo, coop }: { solo: ReactNode; coop: ReactNode }) {
  const m = useMessages();
  const [tab, setTab] = useState<"solo" | "coop">("solo");
  return (
    <div className="grid gap-3">
      <ToggleGroup
        value={[tab]}
        onValueChange={(v) => v[0] && setTab(v[0] as "solo" | "coop")}
        aria-label={m.player.leaderboard}
        variant="outline"
        className="w-max"
      >
        <ToggleGroupItem value="solo" className="h-9 px-4">
          {m.online.boardSolo}
        </ToggleGroupItem>
        <ToggleGroupItem value="coop" className="h-9 px-4">
          {m.online.boardCoop}
        </ToggleGroupItem>
      </ToggleGroup>
      {tab === "solo" ? solo : coop}
    </div>
  );
}
