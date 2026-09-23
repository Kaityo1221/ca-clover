"use client";

import { useEffect } from "react";

/**
 * TEMP: guard the SuzukiPM joke sequence while the accepted burn texture still
 * lives inside the shared StampMedal3D component. Once the ritual owns the burn
 * state directly, this file can be removed together with the special sequence.
 */
export function SuzukiSpecialFinishGuard() {
  useEffect(() => {
    let timer: number | null = null;
    let armedRoot: HTMLElement | null = null;

    const clear = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      armedRoot = null;
    };

    const inspect = () => {
      const root = document.querySelector<HTMLElement>('[data-suzuki-ritual-root="true"]');
      if (!root) {
        clear();
        return;
      }

      const badgeVisible = Array.from(root.querySelectorAll("h2")).some(
        (heading) => heading.textContent?.trim().toLowerCase() === "suzukipm",
      );
      if (!badgeVisible || armedRoot === root) return;

      armedRoot = root;
      timer = window.setTimeout(() => {
        if (!document.contains(root)) return;
        root.style.pointerEvents = "none";
        root.style.transition = "opacity .42s ease";
        root.style.opacity = "0";
        window.setTimeout(() => {
          if (document.contains(root)) root.style.display = "none";
        }, 430);
      }, 6000);
    };

    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true });
    inspect();

    return () => {
      clear();
      observer.disconnect();
    };
  }, []);

  return null;
}
