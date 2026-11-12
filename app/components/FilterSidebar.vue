<script setup lang="ts">
import { REGIONS, TECHNOLOGIES, type TechnologyKey } from "~~/shared/types";
import type { InstallerFilters } from "~/composables/useFilteredInstallers";

interface Origin {
  lat: number;
  lng: number;
  label: string;
}

const props = defineProps<{
  totalCount: number;
  filteredCount: number;
  updatedAt: string | null;
  error: unknown;
  origin: Origin | null;
  originError: string | null;
  originLoading: boolean;
  filters: InstallerFilters;
  certBodyOptions: string[];
  activeCount: number;
  /** Shown when the sidebar is a mobile slideover, so it can be dismissed. */
  closable?: boolean;
}>();

const view = defineModel<"list" | "map">("view", { required: true });

const emit = defineEmits<{
  "search-postcode": [postcode: string];
  "locate-me": [];
  reset: [];
  close: [];
}>();

const postcode = ref("");

function onSearch() {
  if (!postcode.value.trim()) return;
  emit("search-postcode", postcode.value);
}

const technologyKeys = Object.keys(TECHNOLOGIES) as TechnologyKey[];
const regionItems = Object.entries(REGIONS).map(([value, label]) => ({ value, label }));
const viewItems = [
  { label: "List", value: "list", icon: "i-lucide-list" },
  { label: "Map", value: "map", icon: "i-lucide-map" },
];

function toggleTechnology(key: TechnologyKey) {
  const i = props.filters.technologies.indexOf(key);
  if (i === -1) props.filters.technologies.push(key);
  else props.filters.technologies.splice(i, 1);
}

const maxDistanceModel = computed({
  get: () => props.filters.maxDistance ?? 50,
  set: (v: number) => {
    props.filters.maxDistance = v;
  },
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-default">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
      <div>
        <h1 class="text-lg font-semibold tracking-tight">MCS Installer Search</h1>
        <p class="mt-0.5 text-sm text-muted">
          <span class="font-medium text-highlighted">{{ filteredCount.toLocaleString() }}</span>
          of {{ totalCount.toLocaleString() }} installers
        </p>
        <p v-if="updatedAt" class="text-xs text-dimmed">
          Updated {{ new Date(updatedAt).toLocaleDateString() }}
        </p>
      </div>
      <UButton
        v-if="closable"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="lg"
        aria-label="Close filters"
        @click="emit('close')"
      />
    </div>

    <!-- Scrollable filters -->
    <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
      <UAlert v-if="error" color="error" variant="subtle" title="Failed to load installers" />

      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">Location</h2>
        <div class="flex gap-2">
          <UInput
            v-model="postcode"
            icon="i-lucide-map-pin"
            placeholder="Postcode, e.g. CB8 0AT"
            class="flex-1"
            @keyup.enter="onSearch"
          />
          <UButton :loading="originLoading" aria-label="Search postcode" @click="onSearch">
            Go
          </UButton>
        </div>
        <UButton
          variant="soft"
          color="neutral"
          icon="i-lucide-locate-fixed"
          block
          :loading="originLoading"
          @click="emit('locate-me')"
        >
          Use my location
        </UButton>
        <p v-if="originError" class="text-xs text-error">{{ originError }}</p>
        <p v-else-if="origin" class="flex items-center gap-1 text-xs text-muted">
          <UIcon name="i-lucide-check" class="size-3.5 text-success" />
          Nearest to {{ origin.label }}
        </p>

        <div v-if="origin" class="mt-1">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm">Within</span>
            <span class="flex items-center gap-2 text-sm">
              <span class="font-medium">
                {{ filters.maxDistance == null ? "Any distance" : `${maxDistanceModel} mi` }}
              </span>
              <UButton
                v-if="filters.maxDistance != null"
                size="xs"
                variant="link"
                color="neutral"
                @click="filters.maxDistance = null"
              >
                Clear
              </UButton>
            </span>
          </div>
          <USlider v-model="maxDistanceModel" :min="1" :max="200" :step="1" />
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">Search</h2>
        <UInput
          v-model="filters.query"
          icon="i-lucide-search"
          placeholder="Name, certificate no. or postcode"
          class="w-full"
        />
      </section>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">Technology</h2>
          <label class="flex items-center gap-2 text-xs text-muted">
            Must offer all
            <USwitch v-model="filters.matchAll" size="xs" />
          </label>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <UButton
            v-for="key in technologyKeys"
            :key="key"
            size="xs"
            :variant="filters.technologies.includes(key) ? 'solid' : 'outline'"
            :color="filters.technologies.includes(key) ? 'primary' : 'neutral'"
            :aria-pressed="filters.technologies.includes(key)"
            @click="toggleTechnology(key)"
          >
            {{ TECHNOLOGIES[key] }}
          </UButton>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">More filters</h2>
        <USelectMenu
          v-model="filters.regions"
          multiple
          value-key="value"
          :items="regionItems"
          placeholder="Any region covered"
          icon="i-lucide-map"
          class="w-full"
        />
        <USelectMenu
          v-model="filters.certBodies"
          multiple
          :items="certBodyOptions"
          placeholder="Any certification body"
          icon="i-lucide-badge-check"
          class="w-full"
        />
        <label class="mt-1 flex items-center justify-between text-sm">
          Boiler Upgrade Scheme only
          <USwitch v-model="filters.boilerUpgradeOnly" />
        </label>
      </section>
    </div>

    <!-- Footer: show results (mobile), reset, view toggle, theme -->
    <div class="flex flex-col gap-3 border-t border-default px-5 py-4">
      <UButton v-if="closable" size="lg" block @click="emit('close')">
        Show {{ filteredCount.toLocaleString() }}
        {{ filteredCount === 1 ? "installer" : "installers" }}
      </UButton>
      <UButton
        v-if="activeCount > 0"
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-lucide-rotate-ccw"
        block
        @click="emit('reset')"
      >
        Reset {{ activeCount }} {{ activeCount === 1 ? "filter" : "filters" }}
      </UButton>
      <div class="flex items-center gap-2">
        <UTabs
          v-model="view"
          :items="viewItems"
          :content="false"
          size="sm"
          class="flex-1"
          :ui="{ list: 'w-full' }"
        />
        <UColorModeButton />
      </div>
    </div>
  </div>
</template>
