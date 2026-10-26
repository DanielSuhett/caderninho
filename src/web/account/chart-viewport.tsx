import { type ReactNode, useEffect, useRef, useState } from "react";

// Mount each expensive canvas once, just before it is visible. Exact amounts
// remain in the surrounding legend/table, including when code fails to load.
export function ChartViewport({
  children,
  height,
}: {
  children: ReactNode;
  height: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          setVisible(true);
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className="chart-viewport"
      ref={root}
      style={{ minHeight: height }}
    >
      {visible ? children : null}
    </div>
  );
}
