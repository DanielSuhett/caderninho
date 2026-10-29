import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import {
  currentRoute,
  interceptNavigation,
  subscribeNavigation,
} from "./account-navigation";

export function useWorkspaceNavigation() {
  const route = useSyncExternalStore(
    subscribeNavigation,
    currentRoute,
    () => "/account",
  );
  const previous = useRef(route);
  useEffect(interceptNavigation, []);
  useLayoutEffect(() => {
    if (previous.current === route) {
      return;
    }
    previous.current = route;
    document
      .querySelector<HTMLElement>("#workspace-content")
      ?.focus({ preventScroll: true });
    document
      .querySelector<HTMLElement>(".workspace-main")
      ?.scrollTo({ behavior: "instant", top: 0 });
  }, [route]);
  return route;
}
