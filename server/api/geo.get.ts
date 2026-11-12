import { defineEventHandler } from "nitro/h3";

export interface GeoLocation {
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
}

interface CfProperties {
  latitude?: string;
  longitude?: string;
  city?: string;
  country?: string;
}

interface NetlifyGeo {
  city?: string;
  country?: { code?: string };
  latitude?: number;
  longitude?: number;
}

function decode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function fromNetlify(geo: NetlifyGeo | undefined): GeoLocation | null {
  if (geo?.latitude == null || geo.longitude == null) return null;
  return {
    lat: geo.latitude,
    lng: geo.longitude,
    city: geo.city ?? null,
    country: geo.country?.code ?? null,
  };
}

// Approximate location of the caller from whatever the hosting CDN provides:
//  - Vercel:     x-vercel-ip-* headers (always on)
//  - Cloudflare: request.cf (always on), else cf-ip* headers (needs the "Add
//                visitor location headers" managed transform)
//  - Netlify:    x-nf-geo header (base64 JSON), or context.geo on edge functions
// Returns null on any other host (and in local dev).
export default defineEventHandler((event): GeoLocation | null => {
  const h = event.req.headers;

  // Depends on the caller's IP, so it must never be shared between users.
  event.res.headers.set("Cache-Control", "private, no-store");

  // Cloudflare attaches `cf` to the original Request, which Nitro passes through.
  const cf = (event.req as { cf?: CfProperties }).cf;
  if (cf?.latitude != null && cf.longitude != null && Number.isFinite(+cf.latitude)) {
    return {
      lat: +cf.latitude,
      lng: +cf.longitude,
      city: cf.city ?? null,
      country: cf.country ?? null,
    };
  }

  const lat = h.get("x-vercel-ip-latitude") ?? h.get("cf-iplatitude");
  const lng = h.get("x-vercel-ip-longitude") ?? h.get("cf-iplongitude");
  if (lat != null && lng != null && Number.isFinite(+lat) && Number.isFinite(+lng)) {
    return {
      lat: +lat,
      lng: +lng,
      city: decode(h.get("x-vercel-ip-city") ?? h.get("cf-ipcity")),
      country: h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"),
    };
  }

  const runtime = (event.req as { runtime?: { netlify?: { context?: { geo?: NetlifyGeo } } } })
    .runtime;
  const nfHeader = h.get("x-nf-geo");
  if (nfHeader) {
    try {
      const geo = fromNetlify(JSON.parse(atob(nfHeader)));
      if (geo) return geo;
    } catch {}
  }
  return fromNetlify(runtime?.netlify?.context?.geo);
});
