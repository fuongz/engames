import { HelpCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "#/components/ui/dialog";
import { Kbd } from "#/components/ui/kbd";

/** "Hướng dẫn": how the portal works, with its own sidebar trigger. */
export function HelpDialog({ triggerClassName }: { triggerClassName: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={triggerClassName} />}>
        <HugeiconsIcon icon={HelpCircleIcon} className="size-5" />
        Hướng dẫn
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chơi Engames thế nào?</DialogTitle>
          <DialogDescription>Game chạy ngay trong trình duyệt, không cần tài khoản hay cài đặt.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <Tip title="Chọn game">
            Bấm vào một game rồi bấm <b>Chơi</b>. Cách điều khiển của từng game nằm ngay trên trang game.
          </Tip>
          <Tip title="Tìm nhanh">
            Gõ vào ô tìm kiếm hoặc nhấn <Kbd>⌘K</Kbd> để nhảy tới game hay thể loại.
          </Tip>
          <Tip title="Cài lên điện thoại">
            Android: bấm <b>Cài Engames</b>. iPhone: trong Safari bấm <b>Chia sẻ</b> rồi <b>Thêm vào MH chính</b>.
          </Tip>
          <Tip title="Chơi offline">Game đã mở một lần sẽ chơi được cả khi mất mạng. Kỷ lục được lưu trên máy của bạn.</Tip>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Tip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-muted p-3.5">
      <span className="font-semibold">{title}</span>
      <span className="leading-relaxed text-muted-foreground">{children}</span>
    </div>
  );
}
