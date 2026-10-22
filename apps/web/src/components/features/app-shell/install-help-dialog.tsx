import { PlusSignSquareIcon, Share08Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { useInstallStore } from "#/stores/install";

/** iOS has no install prompt API, so "Cài app" opens these Safari steps instead. */
export function InstallHelpDialog() {
  const open = useInstallStore((s) => s.iosHelpOpen);
  const setOpen = useInstallStore((s) => s.setIosHelpOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm Engames vào màn hình chính</DialogTitle>
          <DialogDescription>Chơi toàn màn hình như app thật, mở nhanh từ màn hình chính và chơi được cả khi offline.</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-2.5">
          <Step n={1} icon={Share08Icon}>
            Bấm nút <b>Chia sẻ</b> trên thanh Safari
          </Step>
          <Step n={2} icon={PlusSignSquareIcon}>
            Chọn <b>Thêm vào MH chính</b>
          </Step>
          <Step n={3}>
            Bấm <b>Thêm</b> rồi mở Engames từ màn hình chính
          </Step>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, icon, children }: { n: number; icon?: typeof Share08Icon; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-muted p-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {n}
      </span>
      <span className="flex-1">{children}</span>
      {icon && <HugeiconsIcon icon={icon} className="size-5 text-muted-foreground" />}
    </li>
  );
}
