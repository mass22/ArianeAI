// Types pour le workflow meeting/import Ariane-Core

export interface WorkflowStep {
  id?: string
  name: string
  status: 'pending' | 'running' | 'ok' | 'error'
  duration_ms?: number
  error?: string
  [key: string]: unknown
}

export interface ScribeResult {
  summary?: string
  resume?: string
  key_points?: string[]
  client_goals?: string[]
  objectifs?: string[]
  implicit_needs?: string[]
  risks?: string[]
  action_items?: string[]
  actions?: string[]
  open_questions?: string[]
  [key: string]: unknown
}

export interface MeetingResult {
  content?: string
  markdown?: string
  raw?: string
  /** Chemin vers le fichier markdown (si disponible) */
  markdown_path?: string
  [key: string]: unknown
}

/** Todo extrait du meeting (texte uniquement) */
export type TodoItem = string

/** Email de suivi : string brut ou objet structuré */
export interface FollowupEmail {
  subject?: string
  body?: string
}

export interface CrmResult {
  created?: boolean
  meeting_id?: string
  [key: string]: unknown
}

export interface MemoryResult {
  stored?: boolean
  [key: string]: unknown
}

export interface MeetingWorkflowResult {
  workflow_id: string
  status: 'ok' | 'degraded' | 'error'
  steps: WorkflowStep[]
  result: {
    meeting?: MeetingResult
    scribe?: ScribeResult
    /** Todos (max 5 côté backend, tronqué côté UI si plus) */
    todos?: TodoItem[]
    /** Email de suivi : string brut ou objet { subject, body } */
    followup_email?: string | FollowupEmail
    crm?: CrmResult
    memory?: MemoryResult
  }
}

export interface MeetingWorkflowImportPayload {
  audio_base64: string
  format?: string
  language?: string
  meta?: {
    source?: string
    label?: string
    clientId?: string
    dossierId?: string
    date?: string
    title?: string
    participants?: string[]
  }
}
