<template>
  <div>
    <h1>Bienvenue sur ArianeAI</h1>
    <p>{{ data.response }}</p>
  </div>
</template>
<script setup>
const { data } = await useFetch('/api/ai/generate', {
  method: 'POST',
  body: {
    prompt: 'Dis bonjour depuis Nuxt'
  }
})
</script>
