"use client";
// components/showcase/v2/Reveal.tsx
// The landing page's one motion grammar: elements marked data-reveal settle in once as they enter the screen
// ("rise": text lifts out of a soft blur; "rule": a rule draws from the left; "fade"). Content is visible without
// JavaScript and with reduced motion: the hidden start state only applies once this script marks the page ready.
import * as React from "react";

export function Reveal() {
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector(".v2");
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    // anything already on screen at load stays put; only what is below the fold animates in
    const fold = window.innerHeight;
    const later = items.filter((el) => el.getBoundingClientRect().top > fold * 0.92);
    later.forEach((el) => el.classList.add("v2-wait"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("v2-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    later.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
