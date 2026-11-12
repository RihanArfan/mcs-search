interface Origin {
  lat: number;
  lng: number;
  label: string;
}

interface PostcodesIoResponse {
  status: number;
  result: {
    postcode: string;
    latitude: number;
    longitude: number;
  };
}

export function useOrigin() {
  const origin = useState<Origin | null>("origin", () => null);
  const originError = useState<string | null>("origin-error", () => null);
  const originLoading = useState<boolean>("origin-loading", () => false);

  async function searchPostcode(postcode: string) {
    const trimmed = postcode.trim();
    if (!trimmed) return;

    originLoading.value = true;
    originError.value = null;

    try {
      const res = await $fetch<PostcodesIoResponse>(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`,
      );
      origin.value = {
        lat: res.result.latitude,
        lng: res.result.longitude,
        label: res.result.postcode,
      };
    } catch {
      originError.value = `Couldn't find postcode "${trimmed}"`;
    } finally {
      originLoading.value = false;
    }
  }

  function locateMe() {
    if (!import.meta.client || !navigator.geolocation) {
      originError.value = "Geolocation is not available in this browser";
      return;
    }

    originLoading.value = true;
    originError.value = null;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        origin.value = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "My location",
        };
        originLoading.value = false;
      },
      (err) => {
        originError.value = err.message || "Could not get your location";
        originLoading.value = false;
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return { origin, originError, originLoading, searchPostcode, locateMe };
}
