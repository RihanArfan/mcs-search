import type { Installer, InstallerWithDistance, RegionKey, TechnologyKey } from "~~/shared/types";

const STORAGE_KEY = "mcs-search:filters";

interface Origin {
  lat: number;
  lng: number;
  label: string;
}

export interface InstallerFilters {
  query: string;
  technologies: TechnologyKey[];
  /** Installer must offer ALL selected technologies (true) or ANY (false). */
  matchAll: boolean;
  regions: RegionKey[];
  certBodies: string[];
  boilerUpgradeOnly: boolean;
  maxDistance: number | null;
}

const DEFAULT_FILTERS: InstallerFilters = {
  query: "",
  technologies: [],
  matchAll: true,
  regions: [],
  certBodies: [],
  boilerUpgradeOnly: false,
  maxDistance: null,
};

function loadPersistedFilters(): Partial<InstallerFilters> {
  if (!import.meta.client) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useFilteredInstallers(installers: Ref<Installer[]>, origin: Ref<Origin | null>) {
  const filters = reactive<InstallerFilters>({ ...DEFAULT_FILTERS, ...loadPersistedFilters() });

  if (import.meta.client) {
    watch(filters, (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), {
      deep: true,
    });
  }

  const certBodyOptions = computed(() =>
    [...new Set(installers.value.map((i) => i.certBody).filter(Boolean))].sort(),
  );

  const enriched = computed<InstallerWithDistance[]>(() => {
    const o = origin.value;
    return installers.value.map((i) => ({
      ...i,
      distance:
        o && i.lat != null && i.lng != null ? haversineMiles(o.lat, o.lng, i.lat, i.lng) : null,
    }));
  });

  const filtered = computed(() => {
    const q = filters.query.trim().toLowerCase();
    return enriched.value
      .filter(
        (i) =>
          !q ||
          i.name.toLowerCase().includes(q) ||
          i.certNumber.toLowerCase().includes(q) ||
          i.postcode.toLowerCase().includes(q),
      )
      .filter((i) => {
        if (!filters.technologies.length) return true;
        const test = (t: TechnologyKey) => i.technologies.includes(t);
        return filters.matchAll
          ? filters.technologies.every(test)
          : filters.technologies.some(test);
      })
      .filter((i) => !filters.regions.length || filters.regions.some((r) => i.regions.includes(r)))
      .filter((i) => !filters.certBodies.length || filters.certBodies.includes(i.certBody))
      .filter((i) => !filters.boilerUpgradeOnly || i.boilerUpgradeScheme)
      .filter(
        (i) =>
          filters.maxDistance == null || (i.distance != null && i.distance <= filters.maxDistance),
      )
      .sort((a, b) => {
        if (a.distance == null && b.distance == null) return a.name.localeCompare(b.name);
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      });
  });

  /** Number of filter groups currently narrowing the results (excluding distance). */
  const activeCount = computed(
    () =>
      Number(filters.query.trim() !== "") +
      Number(filters.technologies.length > 0) +
      Number(filters.regions.length > 0) +
      Number(filters.certBodies.length > 0) +
      Number(filters.boilerUpgradeOnly) +
      Number(filters.maxDistance != null),
  );

  function resetFilters() {
    Object.assign(filters, structuredClone(DEFAULT_FILTERS));
  }

  return { filters, certBodyOptions, filtered, activeCount, resetFilters };
}
