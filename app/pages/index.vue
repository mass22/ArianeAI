<template>
  <div>
    <h1>Bienvenue sur ton IA locale</h1>
    <p v-if="response && !loading">{{ response }}</p>
    <p v-if="loading">Génération en cours...</p>

    <div>
      <input type="text" v-model="prompt" />
      <button @click="generate">Générer</button>
    </div>
  </div>
</template>
<script setup>
const prompt = ref('')
const response = ref('')
const loading = ref(false)
const generate = async () => {
  try {
    loading.value = true
    const data = await $fetch('/api/ai/generate', {
      method: 'POST',
      body: {
        prompt: prompt.value
      }
    })
    response.value = data.response
    loading.value = false
    return data.response
  } catch (error) {
    console.error('Erreur lors de la génération:', error)
    response.value = 'Erreur: ' + error.message
  }
}

// const { data } = await useFetch('/api/ai/generate', {
//   method: 'POST',
//   body: {
//     prompt: prompt.value
//   }
// })
</script>
