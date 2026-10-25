import { audioBus } from "@web-games/core";
import { bind, play, setEnabled, setTheme, setVolume, unlock } from "cuelume";
import { useEffect } from "react";

// Interface cues sit under the games' own audio: present, never louder.
const VOLUME = 0.6;

// Every clickable control taps and every text field types, without anyone
// remembering an attribute: elements are marked as they appear. An element that
// already names its cue (data-cuelume-*) keeps it.
const CLICKABLE =
  'button, a[href], summary, select, [role="button"], [role="tab"], [role="link"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"]';
const TYPABLE =
  'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"], textarea, [contenteditable="true"]';
const CUES = ["tap", "type", "select", "toggle", "open", "close", "navigate"].map((c) => `data-cuelume-${c}`);

const hasCue = (el: Element) => CUES.some((a) => el.hasAttribute(a));

function mark(root: Element) {
  const each = (selector: string, attr: string) => {
    const found = root.matches(selector) ? [root, ...root.querySelectorAll(selector)] : root.querySelectorAll(selector);
    for (const el of found) if (!hasCue(el)) el.setAttribute(attr, "");
  };
  each(TYPABLE, "data-cuelume-type");
  each(CLICKABLE, "data-cuelume-tap");
}

/**
 * Cuelume for the whole app, in the playful `bubble` material, tied to the
 * portal's one Sound switch (the same mute the games obey). Unmuting taps once
 * as confirmation; muting is simply silence.
 */
export function useInterfaceSounds() {
  useEffect(() => {
    setTheme("bubble");
    setVolume(VOLUME);
    setEnabled(!audioBus.muted);
    mark(document.body);
    const observer = new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) mark(n);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const unbind = bind();
    const off = audioBus.onMuteChange((muted) => {
      setEnabled(!muted);
      if (!muted) void unlock().then((ok) => ok && play("tap"));
    });
    return () => {
      off();
      unbind();
      observer.disconnect();
    };
  }, []);
}
