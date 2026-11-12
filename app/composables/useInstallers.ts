import type { Installer, InstallersMeta } from "~~/shared/types";

export function useInstallers() {
  const { data, status, error, refresh } = useFetch<Installer[]>("/installers.json", {
    key: "installers",
    server: false,
    default: () => [],
  });
  const { data: meta } = useFetch<InstallersMeta>("/installers.meta.json", {
    key: "installers-meta",
    server: false,
  });

  return {
    installers: computed(() => data.value ?? []),
    updatedAt: computed(() => meta.value?.updatedAt ?? null),
    pending: computed(() => status.value === "pending"),
    error,
    refresh,
  };
}
