import { Flow } from "@cloudflare/kumo/components/flow";
import { PauseIcon, PlayIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  McpStepContent,
  mcpNodeClass,
  mcpSteps,
  mcpSummary,
} from "./mcp-steps";
import { UiButton } from "./ui";

const stepDuration = 2400;

export function McpFlow() {
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [horizontal, setHorizontal] = useState(
    () => matchMedia("(min-width: 1100px)").matches,
  );
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(!document.hidden);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setReduced(preference.matches);
      if (preference.matches) {
        setPlaying(false);
        setStep(-1);
      }
    };
    syncPreference();
    preference.addEventListener("change", syncPreference);
    const orientation = matchMedia("(min-width: 1100px)");
    const syncOrientation = () => setHorizontal(orientation.matches);
    orientation.addEventListener("change", syncOrientation);
    const visibility = new IntersectionObserver(
      ([entry]) => {
        const inView = entry?.isIntersecting ?? false;
        setVisible(inView);
        if (inView && !started.current && !preference.matches) {
          started.current = true;
          setStep(0);
          setPlaying(true);
        }
      },
      { threshold: 0.2 },
    );
    visibility.observe(element);
    const foregroundChanged = () => setForeground(!document.hidden);
    document.addEventListener("visibilitychange", foregroundChanged);
    return () => {
      preference.removeEventListener("change", syncPreference);
      document.removeEventListener("visibilitychange", foregroundChanged);
      orientation.removeEventListener("change", syncOrientation);
      visibility.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing || reduced || !visible || !foreground) {
      return;
    }
    const timer = setTimeout(() => {
      if (step === mcpSteps.length - 1) {
        setPlaying(false);
        return;
      }
      setStep((previous) => previous + 1);
    }, stepDuration);
    return () => clearTimeout(timer);
  }, [playing, reduced, visible, foreground, step]);

  const toggle = useCallback(() => {
    started.current = true;
    if (playing) {
      setPlaying(false);
      return;
    }
    setStep((previous) =>
      previous < 0 || previous === mcpSteps.length - 1 ? 0 : previous,
    );
    setPlaying(true);
  }, [playing]);
  const showAll = useCallback(() => {
    started.current = true;
    setPlaying(false);
    setStep(-1);
  }, []);
  const current = mcpSteps[step];
  let playLabel = "Reproduzir";
  if (step === mcpSteps.length - 1) {
    playLabel = "Repetir";
  } else if (step >= 0) {
    playLabel = "Continuar";
  }
  if (playing) {
    playLabel = "Pausar";
  }
  return (
    <div
      className="mcp-flow"
      data-orientation={horizontal ? "horizontal" : "vertical"}
      data-playing={playing && visible && foreground && !reduced}
      data-step={step}
      ref={root}
    >
      <div className="mcp-playback">
        <span className="mcp-step-count">
          {current ? `${step + 1} / ${mcpSteps.length}` : "Fluxo completo"}
        </span>
        {!reduced && (
          <fieldset
            aria-label="Reprodução da ilustração"
            className="mcp-controls"
          >
            <UiButton
              icon={playing ? PauseIcon : PlayIcon}
              onClick={toggle}
              type="button"
              variant="secondary"
            >
              {playLabel}
            </UiButton>
            <UiButton
              onClick={showAll}
              type="button"
              variant="ghost"
            >
              Sem animação
            </UiButton>
          </fieldset>
        )}
      </div>
      <Flow
        align="center"
        canvas={false}
        className="mcp-diagram"
        orientation={horizontal ? "horizontal" : "vertical"}
        padding={{ x: 4, y: 8 }}
      >
        {mcpSteps.map((item, index) => (
          <Flow.Node
            id={item.id}
            key={item.id}
            render={
              <li
                aria-current={step === index ? "step" : undefined}
                className={mcpNodeClass}
                data-active={step === index}
              />
            }
          >
            <McpStepContent step={item} />
          </Flow.Node>
        ))}
      </Flow>
      <p className="mcp-caption">{current?.caption ?? mcpSummary}</p>
    </div>
  );
}

export function mountMcpFlow(element: HTMLElement) {
  createRoot(element).render(<McpFlow />);
}
