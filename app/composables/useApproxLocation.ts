import type { GeoLocation } from "~~/server/api/geo.get";

/** Approximate (IP-based) location from the CDN, used only to centre the map. */
export function useApproxLocation() {
  const { data } = useFetch<GeoLocation | null>("/api/geo", {
    key: "approx-location",
    lazy: true,
    server: false,
    default: () => null,
  });
  return data;
}
