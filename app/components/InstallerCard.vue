<script setup lang="ts">
import { TECHNOLOGIES, type InstallerWithDistance } from "~~/shared/types";

defineProps<{ installer: InstallerWithDistance }>();

const site = (url: string) => websiteUrl(url);
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 class="font-semibold">
          {{ installer.name }}
        </h2>
        <p class="text-sm text-muted">
          {{
            [...installer.address, installer.county, installer.postcode].filter(Boolean).join(", ")
          }}
        </p>
        <p class="text-xs text-muted">{{ installer.certBody }} · {{ installer.certNumber }}</p>
      </div>
      <UBadge v-if="installer.distance != null" variant="subtle" class="shrink-0">
        {{ installer.distance.toFixed(1) }} mi
      </UBadge>
    </div>

    <div class="mt-3 flex flex-wrap gap-1">
      <UBadge
        v-for="t in installer.technologies"
        :key="t"
        color="neutral"
        variant="outline"
        size="sm"
      >
        {{ TECHNOLOGIES[t] }}
      </UBadge>
      <UBadge v-if="installer.boilerUpgradeScheme" color="success" variant="subtle" size="sm">
        Boiler Upgrade Scheme
      </UBadge>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <UButton
        v-if="installer.phone"
        size="sm"
        variant="soft"
        icon="i-lucide-phone"
        :href="telHref(installer.phone)"
      >
        {{ installer.phone }}
      </UButton>
      <UButton
        v-if="installer.email"
        size="sm"
        variant="soft"
        icon="i-lucide-mail"
        :href="`mailto:${installer.email}`"
      >
        Email
      </UButton>
      <UButton
        v-if="site(installer.website)"
        size="sm"
        variant="soft"
        icon="i-lucide-globe"
        :href="site(installer.website)!"
        target="_blank"
        rel="noopener noreferrer"
      >
        Website
      </UButton>
      <UButton
        v-if="installer.lat != null && installer.lng != null"
        size="sm"
        variant="soft"
        icon="i-lucide-navigation"
        :href="directionsUrl(installer.lat, installer.lng)"
        target="_blank"
        rel="noopener noreferrer"
      >
        Directions
      </UButton>
    </div>
  </UCard>
</template>
