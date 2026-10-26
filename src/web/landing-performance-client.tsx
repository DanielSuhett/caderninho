import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { LandingPerformance } from "./landing-performance";

function ResponsivePerformance() {
  const root = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWide((entry?.contentRect.width ?? 0) >= 880);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root}>
      <LandingPerformance
        interactive
        wide={wide}
      />
    </div>
  );
}

export function mountLandingPerformance(element: HTMLElement) {
  createRoot(element).render(<ResponsivePerformance />);
}
