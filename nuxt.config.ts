export default defineNuxtConfig({
  compatibilityDate: "2026-11-03",
  modules: ["@nuxt/ui", "@vueuse/nuxt/module"],
  css: ["~/assets/css/main.css"],

  app: {
    head: {
      title: "MCS Installer Search",
      meta: [
        {
          name: "description",
          content: "Find MCS certified installers near you, sorted by real distance.",
        },
      ],
    },
  },

  nitro: {
    experimental: { tasks: true },
    // Run weekly on platforms with a writable filesystem / cron support:
    // scheduledTasks: { '0 3 * * 0': ['installers:update'] },
  },

  vite: {
    // maplibre-gl loads its worker as a sibling file next to its own module
    // URL; Vite's dep pre-bundler would lose that file, so serve it as-is.
    optimizeDeps: {
      exclude: ["maplibre-gl"],
    },
  },

  devtools: true,
});
