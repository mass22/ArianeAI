<template>
  <UApp>
    <ClientOnly>
      <TheHeader />
      <template #fallback>
        <div class="max-w-6xl mx-auto px-4 py-8">
          <header class="space-y-3">
            <div class="flex items-center justify-between">
              <h1 class="text-3xl font-semibold tracking-tight">Ariane AI</h1>
              <div class="min-w-[200px] h-10" />
            </div>
          </header>
        </div>
      </template>
    </ClientOnly>
    <NuxtPage :key="route.fullPath" />
  </UApp>
</template>

<script setup>
const route = useRoute()

// Configuration du mode dark par défaut
const colorMode = useColorMode()
// Définir le mode dark comme préférence par défaut
colorMode.preference = 'dark'
</script>
