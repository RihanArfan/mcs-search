<script setup lang="ts">
const PAGE_SIZE = 30;

const { installers, updatedAt, pending, error } = useInstallers();
const { origin, originError, originLoading, searchPostcode, locateMe } = useOrigin();
const { filters, certBodyOptions, filtered, activeCount, resetFilters } = useFilteredInstallers(
  installers,
  origin,
);

const view = ref<"list" | "map">("list");
const filtersOpen = ref(false); // mobile slideover

const shown = ref(PAGE_SIZE);
watch([filtered], () => {
  shown.value = PAGE_SIZE;
});
const visible = computed(() => filtered.value.slice(0, shown.value));
const hasMore = computed(() => visible.value.length < filtered.value.length);

// Infinite scroll: reveal another page whenever the sentinel below the list is
// in view. The watcher re-checks after each page, since the observer only fires
// on visibility *changes* and the sentinel may still be on screen.
const sentinel = ref<HTMLElement | null>(null);
const sentinelVisible = ref(false);
useIntersectionObserver(
  sentinel,
  ([entry]) => {
    sentinelVisible.value = entry?.isIntersecting ?? false;
  },
  { rootMargin: "400px" },
);
watch([sentinelVisible, shown, filtered], async () => {
  await nextTick();
  if (sentinelVisible.value && hasMore.value) shown.value += PAGE_SIZE;
});
</script>

<template>
  <ClientOnly>
    <div class="fixed inset-0 flex bg-default">
      <!-- Desktop sidebar -->
      <aside class="hidden w-96 shrink-0 border-r border-default lg:block">
        <FilterSidebar
          v-model:view="view"
          :total-count="installers.length"
          :filtered-count="filtered.length"
          :updated-at="updatedAt"
          :error="error"
          :origin="origin"
          :origin-error="originError"
          :origin-loading="originLoading"
          :filters="filters"
          :cert-body-options="certBodyOptions"
          :active-count="activeCount"
          @search-postcode="searchPostcode"
          @locate-me="locateMe"
          @reset="resetFilters"
        />
      </aside>

      <!-- Main content -->
      <main class="relative min-w-0 flex-1">
        <InstallerMap
          v-if="view === 'map' && installers.length"
          :installers="filtered"
          :origin="origin"
          class="absolute inset-0"
        />
        <div v-else class="h-full overflow-y-auto px-4 pb-28 pt-4 sm:px-6 lg:pb-6">
          <div v-if="pending" class="flex justify-center py-12">
            <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
          </div>
          <p v-else-if="!installers.length" class="py-12 text-center text-muted">
            No data yet. Run the <code>installers:update</code> task.
          </p>
          <p v-else-if="!filtered.length" class="py-12 text-center text-muted">
            No installers match these filters.
          </p>
          <div v-else class="mx-auto flex w-full max-w-3xl flex-col gap-3">
            <InstallerCard v-for="i in visible" :key="i.id" :installer="i" />
            <div v-if="hasMore" ref="sentinel" class="flex justify-center py-4">
              <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
            </div>
            <p v-else class="py-4 text-center text-xs text-muted">
              {{ filtered.length.toLocaleString() }} installers
            </p>
          </div>
        </div>
      </main>

      <!-- Mobile: filters slideover + floating buttons -->
      <USlideover
        v-model:open="filtersOpen"
        side="left"
        title="Filters"
        description="Filter installers"
      >
        <template #content>
          <FilterSidebar
            v-model:view="view"
            :total-count="installers.length"
            :filtered-count="filtered.length"
            :updated-at="updatedAt"
            :error="error"
            :origin="origin"
            :origin-error="originError"
            :origin-loading="originLoading"
            :filters="filters"
            :cert-body-options="certBodyOptions"
            :active-count="activeCount"
            closable
            @search-postcode="searchPostcode"
            @locate-me="locateMe"
            @reset="resetFilters"
            @close="filtersOpen = false"
          />
        </template>
      </USlideover>

      <div
        v-if="!filtersOpen"
        class="fixed inset-x-0 bottom-5 z-20 flex justify-center gap-2 lg:hidden"
      >
        <UChip :show="activeCount > 0" :text="activeCount" size="3xl" inset>
          <UButton
            size="lg"
            class="rounded-full shadow-lg"
            icon="i-lucide-sliders-horizontal"
            @click="filtersOpen = true"
          >
            Filters
          </UButton>
        </UChip>
        <UButton
          size="lg"
          color="neutral"
          class="rounded-full shadow-lg"
          :icon="view === 'list' ? 'i-lucide-map' : 'i-lucide-list'"
          @click="view = view === 'list' ? 'map' : 'list'"
        >
          {{ view === "list" ? "Map" : "List" }}
        </UButton>
      </div>
    </div>

    <template #fallback>
      <div class="flex h-screen w-screen items-center justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
      </div>
    </template>
  </ClientOnly>
</template>
