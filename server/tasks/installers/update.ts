import { mkdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineTask } from "nitro/task";
import { REGIONS, TECHNOLOGIES } from "../../../shared/types";
import type { Installer, InstallersMeta, RegionKey, TechnologyKey } from "../../../shared/types";

const ENDPOINT = "https://mcscertified.com/wp-admin/admin-ajax.php";
const PER_PAGE = 30; // server-side cap; larger values are ignored
const DELAY_MS = 100; // 10 req/s: minimum gap between requests
const BACKOFF_MS = 2000; // base delay for retries after a failure
const MAX_RETRIES = 4;

// With lat/lng the API sorts by distance, which makes paging deterministic.
// Without them the order is reshuffled on every call. Extra anchors are only
// used if the first pass doesn't reach the reported total.
const ANCHORS = [
  { lat: 52.5, lng: -1.5 },
  { lat: 56.5, lng: -4.0 },
  { lat: 50.8, lng: -3.5 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RawInstaller = Record<string, string | null>;

interface ApiResponse {
  success: boolean;
  data: {
    data: RawInstaller[];
    pagination: { total_pages: number; current_page: number; total_count: number };
  };
}

async function fetchPage(anchor: { lat: number; lng: number }, page: number): Promise<ApiResponse> {
  const params = new URLSearchParams({
    action: "filter_installers",
    per_page: String(PER_PAGE),
    lat: String(anchor.lat),
    lng: String(anchor.lng),
    user_searched_location: "true",
    page: String(page),
  });

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      if (!json.success) throw new Error("API returned success=false");
      return json;
    } catch (err) {
      if (attempt >= MAX_RETRIES)
        throw new Error(`page ${page} failed: ${(err as Error).message}`, { cause: err });
      await sleep(BACKOFF_MS * 2 ** attempt);
    }
  }
}

const num = (v: string | null | undefined) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) && n !== 0 ? n : null;
};

function normalise(raw: RawInstaller): Installer {
  return {
    id: String(raw.installer_id),
    name: (raw.name ?? "").trim(),
    email: (raw.email ?? "").trim(),
    phone: (raw.telephone ?? "").trim(),
    website: (raw.website ?? "").trim(),
    address: [raw.address_line_1, raw.address_line_2, raw.address_line_3]
      .map((l) => (l ?? "").trim())
      .filter(Boolean),
    county: (raw.county ?? "").trim(),
    postcode: (raw.postcode ?? "").trim(),
    country: (raw.country ?? "").trim(),
    certNumber: (raw.certification_number ?? "").trim(),
    certBody: (raw.certification_body ?? "").trim(),
    boilerUpgradeScheme: raw.boiler_upgrade_scheme === "1",
    subType: (raw.technology_sub_type ?? "").trim(),
    lat: num(raw.lat),
    lng: num(raw.lng),
    technologies: (Object.keys(TECHNOLOGIES) as TechnologyKey[]).filter(
      (k) => raw[`technology_${k}`] === "1",
    ),
    regions: (Object.keys(REGIONS) as RegionKey[]).filter((k) => raw[`region_${k}`] === "1"),
  };
}

async function writeAtomic(path: string, data: unknown) {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data));
  await rename(tmp, path);
}

export default defineTask({
  meta: {
    name: "installers:update",
    description: "Scrape every MCS installer and write public/installers.json",
  },
  async run() {
    const byId = new Map<string, Installer>();
    let duplicatesSeen = 0;
    let pagesFetched = 0;
    let reportedTotal = 0;

    for (const [i, anchor] of ANCHORS.entries()) {
      let totalPages = 1;
      for (let page = 1; page <= totalPages; page++) {
        const { data } = await fetchPage(anchor, page);
        pagesFetched++;
        totalPages = data.pagination.total_pages;
        reportedTotal = data.pagination.total_count;

        for (const raw of data.data) {
          const installer = normalise(raw);
          if (byId.has(installer.id)) duplicatesSeen++;
          byId.set(installer.id, installer);
        }

        if (page % 10 === 0 || page === totalPages) {
          console.log(
            `[installers:update] pass ${i + 1} page ${page}/${totalPages}: ${byId.size}/${reportedTotal} unique`,
          );
        }
        await sleep(DELAY_MS);
      }
      if (byId.size >= reportedTotal) break;
      console.warn(
        `[installers:update] pass ${i + 1} got ${byId.size}/${reportedTotal}; trying another anchor`,
      );
    }

    const installers = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    const meta: InstallersMeta = {
      updatedAt: new Date().toISOString(),
      count: installers.length,
      reportedTotal,
      pagesFetched,
      duplicatesSeen,
      missingCoords: installers.filter((x) => x.lat == null || x.lng == null).length,
    };

    const dir = resolve(process.env.MCS_PUBLIC_DIR ?? join(process.cwd(), "public"));
    await mkdir(dir, { recursive: true });
    await writeAtomic(join(dir, "installers.json"), installers);
    await writeAtomic(join(dir, "installers.meta.json"), meta);

    if (meta.count !== meta.reportedTotal) {
      console.warn(`[installers:update] unique ${meta.count} != reported ${meta.reportedTotal}`);
    }
    return { result: meta };
  },
});
