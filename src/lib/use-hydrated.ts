import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False during prerender and hydration, true after. Views that read the shared
// browser query cache use it so the first client render matches the server HTML.
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
