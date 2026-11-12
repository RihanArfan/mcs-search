<script setup lang="ts">
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// maplibre-gl infers its worker URL from its own chunk's import.meta.url, which
// breaks once Vite re-bundles/hashes that chunk. Point it at the worker asset
// explicitly instead.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { Feature, FeatureCollection, Point } from "geojson";
import { TECHNOLOGIES, type InstallerWithDistance } from "~~/shared/types";

maplibregl.setWorkerUrl(maplibreWorkerUrl);

interface Origin {
  lat: number;
  lng: number;
  label: string;
}

const props = defineProps<{
  installers: InstallerWithDistance[];
  origin: Origin | null;
}>();

const STYLES = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
// Roughly "this city" – the location is only IP-accurate.
const APPROX_ZOOM = 9;
const UK_CENTER: [number, number] = [-2.5, 54.5];
// Padded bounding box around the UK (incl. Shetland and Northern Ireland).
const UK_BOUNDS: [[number, number], [number, number]] = [
  [-11, 49],
  [3.5, 61.5],
];
const SOURCE = "installers";

const containerEl = ref<HTMLDivElement>();
const colorMode = useColorMode();
const approx = useApproxLocation();
// Only auto-centre until the user has an exact origin or has moved the map.
let userMoved = false;
let map: maplibregl.Map | undefined;
let popup: maplibregl.Popup | undefined;
let originMarker: maplibregl.Marker | undefined;

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function updateOriginMarker(origin: Origin | null) {
  if (!map) return;
  if (!origin) {
    originMarker?.remove();
    originMarker = undefined;
    return;
  }
  originMarker ??= new maplibregl.Marker({ color: "#dc2626" });
  originMarker.setLngLat([origin.lng, origin.lat]).addTo(map);
}

function toGeoJson(installers: InstallerWithDistance[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: installers
      .filter((i) => i.lat != null && i.lng != null)
      .map((i): Feature<Point> => ({
        type: "Feature",
        id: Number(i.id),
        geometry: { type: "Point", coordinates: [i.lng!, i.lat!] },
        properties: {
          name: i.name,
          address: [...i.address, i.county, i.postcode].filter(Boolean).join(", "),
          phone: i.phone,
          email: i.email,
          website: i.website,
          certBody: i.certBody,
          certNumber: i.certNumber,
          technologies: i.technologies.map((t) => TECHNOLOGIES[t]).join("|"),
          boiler: i.boilerUpgradeScheme,
          distance: i.distance,
        },
      })),
  };
}

const ICONS = {
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  directions: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
};

function linkHtml(href: string, label: string, icon: keyof typeof ICONS, external = true) {
  const target = external ? ' target="_blank" rel="noopener noreferrer"' : "";
  return (
    `<a href="${escapeHtml(href)}"${target} class="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary no-underline hover:bg-primary/20">` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</svg>` +
    `${escapeHtml(label)}</a>`
  );
}

function popupHtml(p: Record<string, any>, [lng, lat]: [number, number]) {
  const chips = (p.technologies ? String(p.technologies).split("|") : [])
    .map(
      (t) =>
        `<span class="rounded-full border border-default px-2 py-0.5 text-[11px]">${escapeHtml(t)}</span>`,
    )
    .join("");
  const site = websiteUrl(p.website ?? "");
  const links = [
    p.phone && linkHtml(telHref(p.phone), p.phone, "phone", false),
    p.email && linkHtml(`mailto:${p.email}`, "Email", "mail", false),
    site && linkHtml(site, "Website", "globe"),
    linkHtml(directionsUrl(lat, lng), "Directions", "directions"),
  ]
    .filter(Boolean)
    .join("");

  return `
    <div class="flex w-72 max-w-full flex-col gap-2 text-sm">
      <div class="flex items-start justify-between gap-2 pr-5">
        <div class="font-semibold leading-snug">${escapeHtml(p.name)}</div>
        ${p.distance != null ? `<span class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">${Number(p.distance).toFixed(1)} mi</span>` : ""}
      </div>
      ${p.address ? `<div class="text-xs text-muted">${escapeHtml(p.address)}</div>` : ""}
      ${chips ? `<div class="flex flex-wrap gap-1">${chips}</div>` : ""}
      ${p.boiler === true || p.boiler === "true" ? '<div class="text-xs font-medium text-success">Boiler Upgrade Scheme</div>' : ""}
      <div class="text-[11px] text-muted">${escapeHtml(p.certBody)} · ${escapeHtml(p.certNumber)}</div>
      <div class="flex flex-wrap gap-1.5">${links}</div>
    </div>`;
}

function addLayers() {
  if (!map) return;

  const existing = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(toGeoJson(props.installers));
    return;
  }

  map.addSource(SOURCE, {
    type: "geojson",
    data: toGeoJson(props.installers),
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: SOURCE,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": ["step", ["get", "point_count"], "#60a5fa", 25, "#3b82f6", 100, "#1d4ed8"],
      "circle-radius": ["step", ["get", "point_count"], 16, 25, 20, 100, 26],
      "circle-stroke-width": 1,
      "circle-stroke-color": "#ffffff",
    },
  });

  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: SOURCE,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
    },
    paint: { "text-color": "#ffffff" },
  });

  map.addLayer({
    id: "unclustered-point",
    type: "circle",
    source: SOURCE,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#2563eb",
      "circle-radius": 6,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#ffffff",
    },
  });

  for (const layer of ["clusters", "unclustered-point"]) {
    map.on("mouseenter", layer, () => (map!.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", layer, () => (map!.getCanvas().style.cursor = ""));
  }

  map.on("click", "clusters", async (e) => {
    const features = map!.queryRenderedFeatures(e.point, { layers: ["clusters"] });
    const clusterId = features[0]?.properties?.cluster_id;
    if (clusterId == null) return;
    const source = map!.getSource(SOURCE) as maplibregl.GeoJSONSource;
    const zoom = await source.getClusterExpansionZoom(clusterId);
    const [lng, lat] = (features[0]!.geometry as Point).coordinates as [number, number];
    map!.easeTo({ center: [lng, lat], zoom });
  });

  map.on("click", "unclustered-point", (e) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const [lng, lat] = (feature.geometry as Point).coordinates as [number, number];
    popup?.remove();
    popup = new maplibregl.Popup({ closeButton: true, maxWidth: "340px", offset: 10 })
      .setLngLat([lng, lat])
      .setHTML(popupHtml(feature.properties as Record<string, any>, [lng, lat]))
      .addTo(map!);
  });
}

onMounted(async () => {
  await nextTick();
  if (!containerEl.value) return;

  map = new maplibregl.Map({
    container: containerEl.value,
    style: colorMode.value === "dark" ? STYLES.dark : STYLES.light,
    center: props.origin
      ? [props.origin.lng, props.origin.lat]
      : approx.value
        ? [approx.value.lng, approx.value.lat]
        : UK_CENTER,
    zoom: props.origin ? 11 : approx.value ? APPROX_ZOOM : 5.2,
    maxBounds: UK_BOUNDS,
    minZoom: 4,
  });

  // `originalEvent` is only set for user-initiated gestures, not programmatic moves.
  map.on("movestart", (e) => {
    if ((e as { originalEvent?: unknown }).originalEvent) userMoved = true;
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");
  map.on("load", addLayers);
  updateOriginMarker(props.origin);
});

onBeforeUnmount(() => map?.remove());

watch(
  () => props.installers,
  () => {
    if (map?.isStyleLoaded()) addLayers();
  },
);

// The approximate location may arrive after the map has been created.
watch(approx, (loc) => {
  if (!map || !loc || props.origin || userMoved) return;
  map.flyTo({ center: [loc.lng, loc.lat], zoom: APPROX_ZOOM });
});

watch(
  () => props.origin,
  (origin) => {
    updateOriginMarker(origin);
    if (!map || !origin) return;
    map.flyTo({ center: [origin.lng, origin.lat], zoom: 11 });
  },
);

watch(
  () => colorMode.value,
  (mode) => {
    if (!map) return;
    map.setStyle(mode === "dark" ? STYLES.dark : STYLES.light);
    map.once("style.load", addLayers);
  },
);
</script>

<template>
  <div ref="containerEl" class="h-full w-full" />
</template>
