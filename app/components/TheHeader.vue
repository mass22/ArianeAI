<script setup lang="ts">
const { apiLatencyMs } = useApiStatus()
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8 space-y-8">
    <header class="space-y-3">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-semibold tracking-tight">
          Ariane AI
        </h1>
        <ClientOnly>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <ApiStatusBadge />
              <span
                v-if="apiLatencyMs != null"
                class="text-xs text-muted-foreground tabular-nums"
              >
                API: {{ apiLatencyMs }}ms
              </span>
            </div>
            <ContextSwitcher />
          </div>
          <template #fallback>
            <div class="min-w-[200px] h-10" />
          </template>
        </ClientOnly>
      </div>
      <nav class="flex gap-4 items-center">
        <ul class="flex gap-4 items-center">
          <li>
            <NuxtLink to="/">Home</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/clients">Clients</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/leads">Leads</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/daily">Brief du jour</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/meeting">Meeting</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/observability/core">Observabilité</NuxtLink>
          </li>
          <li>
            <a href="http://massimo-ia:4001" target="_blank">Documentation</a>
          </li>
          <li>
            <NuxtLink to="/docs-chat">Docs Chat</NuxtLink>
          </li>
        </ul>
      </nav>
    </header>
  </div>
</template>
