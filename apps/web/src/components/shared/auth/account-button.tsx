import { GoogleIcon, Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useSession } from "#/hooks/use-session";
import { signInWithGoogle, signOut } from "#/lib/auth-client";
import { cn } from "#/lib/utils";

/**
 * Google sign-in (only used to put your name on leaderboards).
 * `sidebar`: full-width row; `compact`: avatar / icon for the phone top bar.
 */
export function AccountButton({ variant }: { variant: "sidebar" | "compact" }) {
  const { data, isPending } = useSession();
  const user = data?.user;

  if (isPending) return <div className={variant === "sidebar" ? "h-12" : "size-10"} aria-hidden />;

  if (!user) {
    return variant === "sidebar" ? (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
      >
        <HugeiconsIcon icon={GoogleIcon} className="size-5 shrink-0" />
        <span className="grid min-w-0">
          <span className="font-medium whitespace-nowrap">Đăng nhập Google</span>
          <span className="truncate text-xs text-muted-foreground">Lưu tên trên bảng xếp hạng</span>
        </span>
      </button>
    ) : (
      <Button
        variant="ghost"
        size="icon"
        className="size-10 rounded-full"
        aria-label="Đăng nhập Google"
        onClick={() => void signInWithGoogle()}
      >
        <HugeiconsIcon icon={GoogleIcon} />
      </Button>
    );
  }

  const initial = user.name.slice(0, 1).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex items-center gap-3 rounded-xl text-left transition-colors hover:bg-secondary",
              variant === "sidebar" ? "w-full px-3 py-2" : "rounded-full p-1",
            )}
          />
        }
      >
        <Avatar className="size-8 shrink-0">
          {user.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="text-xs font-semibold">{initial}</AvatarFallback>
        </Avatar>
        {variant === "sidebar" && <span className="min-w-0 flex-1 truncate text-sm font-medium">{user.name}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} className="min-w-52">
        {/* Base UI: a label is a Menu.GroupLabel and must sit inside a group */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid">
            <span className="truncate">{user.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <HugeiconsIcon icon={Logout01Icon} />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
