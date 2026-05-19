// Types pour l'API leads/daily Ariane AI

export type LeadType = string
export type LeadStatus = string
export type PipelineStage =
  | 'inbox'
  | 'new'
  | 'contacted'
  | 'messaged'
  | 'replied'
  | 'scheduled'
  | 'proposal'
  | 'won'
  | 'lost'

/** Priorité géographique : 0=Unknown, 1=Canada, 2=USA, 3=EU, 4=Other */
export type GeoPriority = 0 | 1 | 2 | 3 | 4

export interface Lead {
  lead_key: string
  type?: LeadType
  status?: LeadStatus
  pipeline_stage?: PipelineStage
  priority_score?: number
  geo_priority?: GeoPriority | number | null
  next_followup_at?: string | null
  last_touch_at?: string | null
  company?: string | null
  contact_name?: string | null
  name?: string | null // API Ariane utilise "name"
  role?: string | null
  source?: string | null
  sources?: string[]
  linkedin_url?: string | null
  availability?: string | null
  rate_target?: string | null
  [key: string]: unknown
}

export interface LeadDetail extends Lead {
  notes?: string[]
  red_flags?: string[]
  generated_outreach?: string
  followup_j4?: string
  followup_j10?: string
  /** Versions anglaises (générées par Ariane Core lors de l'enrichissement) */
  generated_outreach_en?: string
  followup_j4_en?: string
  followup_j10_en?: string
  questions?: string[]
}

export interface LeadsResponse {
  items?: Lead[]
  leads?: Lead[] // API Ariane utilise "leads"
  total?: number
  ok?: boolean
}

export interface DailyBrief {
  date: string
  top_leads?: Array<Lead & { outreach?: string }>
  followups_today?: Array<Lead & { followup_message?: string }>
  pipeline_summary?: Record<string, number>
}

export interface LeadPatchPayload {
  status?: LeadStatus
  pipeline_stage?: PipelineStage
  geo_priority?: GeoPriority | number
  last_touch_at?: string
  next_followup_at?: string | null
  notes?: string[]
  /** Champs enrichis (saisie manuelle) */
  contact_name?: string | null
  name?: string | null
  company?: string | null
  role?: string | null
  linkedin_url?: string | null
  type?: LeadType | null
}
