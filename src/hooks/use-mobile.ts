import { useMediaQuery } from "@/lib/use-media-query"

const MOBILE_BREAKPOINT = 768

// Below md, the sidebar becomes a sheet
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}
