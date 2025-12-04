export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const response = await $fetch(`http://192.168.2.110:11434/api/generate`, {
    method: "POST",
    body: {
      model: "llama3",
      prompt: body.prompt,
      stream: false
    }
  })

  return response
})
