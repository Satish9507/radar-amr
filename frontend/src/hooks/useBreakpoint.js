import { useState, useEffect } from "react";

// ─── Breakpoints (matches Tailwind defaults) ──────────────────────────────────
// sm  ≥ 640px
// md  ≥ 768px
// lg  ≥ 1024px
// xl  ≥ 1280px

export default function useBreakpoint() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return {
    width,
    isMobile:  width < 640,               // phones
    isTablet:  width >= 640 && width < 1024, // tablets / small laptops
    isDesktop: width >= 1024,             // laptops and above
    // helpers
    below: (bp) => width < bp,
    above: (bp) => width >= bp,
  };
}
