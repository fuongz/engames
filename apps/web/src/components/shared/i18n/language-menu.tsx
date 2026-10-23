import { GlobeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { isLocale, LOCALES } from "@web-games/games/i18n";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { chooseLocale } from "#/stores/locale";

/**
 * Tiếng Việt / English picker. `sidebar`: a full-width row styled by the caller;
 * `compact`: a round icon button for the phone top bar.
 */
export function LanguageMenu({ variant, triggerClassName }: { variant: "sidebar" | "compact"; triggerClassName?: string }) {
  const locale = useLocale();
  const m = useMessages();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          variant === "sidebar" ? (
            <button type="button" className={triggerClassName} />
          ) : (
            <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label={m.language.label} />
          )
        }
      >
        <HugeiconsIcon icon={GlobeIcon} className={variant === "sidebar" ? "size-5" : undefined} />
        {variant === "sidebar" && m.language[locale]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} className="min-w-44">
        {/* Base UI: a label is a Menu.GroupLabel and must sit inside a group */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m.language.label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={locale} onValueChange={(v) => isLocale(v) && chooseLocale(v)}>
            {LOCALES.map((l) => (
              <DropdownMenuRadioItem key={l} value={l} lang={l}>
                {m.language[l]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
