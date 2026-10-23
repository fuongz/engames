import { Fragment } from "react";
import { Kbd } from "#/components/ui/kbd";

/**
 * Renders the two bits of markup the catalogs use: `**bold**` and `[[⌘K]]`
 * (a key hint). Anything else is plain text, so copy never carries HTML.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/);
  return parts.map((part, i) => {
    // Parts never reorder, so the index is a stable key
    const key = i;
    if (part.startsWith("**") && part.endsWith("**")) return <b key={key}>{part.slice(2, -2)}</b>;
    if (part.startsWith("[[") && part.endsWith("]]")) return <Kbd key={key}>{part.slice(2, -2)}</Kbd>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}
