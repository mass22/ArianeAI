// composables/useLlmChat.ts

export interface LlmChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LlmChatParams {
  model?: string
  system?: string
  messages: LlmChatMessage[]
  temperature?: number
  maxTokens?: number
  trace_id?: string
}

export interface LlmChatResponse {
  ok: boolean
  trace_id: string
  data?: {
    response: string
    model: string
    llm_ms: number
  }
  error?: {
    code: string
    message: string
  }
}

export const useLlmChat = () => {
  const callChat = async (params: LlmChatParams): Promise<LlmChatResponse['data']> => {
    const { data, error } = await useFetch<LlmChatResponse>('/api/llm/chat', {
      method: 'POST',
      body: {
        model: params.model || 'llama3.1:8b',
        system: params.system,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxTokens,
        trace_id: params.trace_id,
      },
    })
    
    if (error.value) {
      throw error.value
    }
    
    if (!data.value?.ok) {
      throw new Error(data.value?.error?.message || 'Erreur inconnue')
    }
    
    if (!data.value.data) {
      throw new Error('Réponse invalide du serveur')
    }
    
    return data.value.data
  }
  
  return { callChat }
}
