import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { LandingRuleExample } from "./landing-rule-example";

function ResponsiveRuleExample() {
  const root = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWide((entry?.contentRect.width ?? 0) >= 800);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root}>
      <LandingRuleExample
        interactive
        wide={wide}
      />
    </div>
  );
}

export function mountLandingRule(element: HTMLElement) {
  createRoot(element).render(<ResponsiveRuleExample />);
}
