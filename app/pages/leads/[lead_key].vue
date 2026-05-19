<script setup lang="ts">
import type { LeadDetail } from '~/types/leads'
import { formatDateDisplay, getFollowupType, getScheduledFollowupType, todayMontreal } from '~/lib/dateUtils'
import { GEO_PRIORITY_OPTIONS } from '~/config/geo-priority'

definePageMeta({ ssr: false })

const route = useRoute()
const leadKey = computed(() => route.params.lead_key as string)

const { fetchLead, patchLead, fetchGeoOptions, enrichLead, markAsMessaged, markJ4Sent, markJ10Sent, scheduleJ4, scheduleJ10, markReplied, scheduleCall, markProposal, markWon, markLost } = useArianeApi()

const geoOptions = ref<Array<{ value: number; label: string }>>([...GEO_PRIORITY_OPTIONS])

const TYPE_LABELS: Record<string, string> = {
  cto_or_head_of_engineering: 'CTO / Head Eng',
  tech_lead_or_senior: 'Tech Lead / Senior',
  warm_contact: 'Contact proche',
  recruiter: 'Recruteur',
  engineer: 'Ingénieur',
}
const SOURCE_LABELS: Record<string, string> = {
  linkedin_csv: 'LinkedIn CSV',
  urls: 'URLs',
}

function formatType(type: string | undefined): string {
  return (type && TYPE_LABELS[type]) || type || '—'
}
function formatSource(source: string | string[] | undefined): string {
  const s = Array.isArray(source) ? source[0] : source
  return (s && SOURCE_LABELS[s]) || s || '—'
}
function linkedinHref(url: string | undefined): string {
  if (!url) return ''
  return url.startsWith('http') ? url : `https://${url}`
}

/** Récupère la première valeur non vide parmi des clés possibles (variantes API) */
function getField(lead: LeadDetail | null, keys: string[]): string {
  if (!lead) return ''
  for (const k of keys) {
    const v = (lead as Record<string, unknown>)[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

const lead = ref<LeadDetail | null>(null)
const loading = ref(true)
const actionLoading = ref(false)
const geoPrioritySaving = ref(false)

async function loadGeoOptionsOnce() {
  const { data } = await fetchGeoOptions()
  if (data?.length) geoOptions.value = data
}

async function handleGeoPriorityChange(value: number) {
  if (!lead.value || geoPrioritySaving.value) return
  geoPrioritySaving.value = true
  try {
    const { error } = await patchLead(leadKey.value, { geo_priority: value })
    if (!error) {
      lead.value = { ...lead.value, geo_priority: value }
    }
  } finally {
    geoPrioritySaving.value = false
  }
}

async function loadLead() {
  loading.value = true
  try {
    const { data } = await fetchLead(leadKey.value)
    const raw = data ?? null
    // L'API Ariane peut renvoyer { lead: {...} } ou { data: {...} } — on déplie
    lead.value = (raw && typeof raw === 'object' && (raw.lead ?? raw.data ?? raw)) ?? null
  } finally {
    loading.value = false
  }
}

async function runAction(fn: () => Promise<{ error: string | null }>) {
  actionLoading.value = true
  try {
    const { error } = await fn()
    if (!error) await loadLead()
  } finally {
    actionLoading.value = false
  }
}

function copyToClipboard(text: string) {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    useToast().add({ title: 'Copié', description: 'Texte copié dans le presse-papier', color: 'success' })
  })
}

watch(leadKey, () => loadLead(), { immediate: true })

onMounted(() => loadGeoOptionsOnce())

const { messageLang, hasEnVersion, getOutreach, getFollowupJ4, getFollowupJ10 } = useLeadMessagesLang()

/** Switcher FR/EN visible uniquement si le lead a des versions anglaises */
const hasEnMessages = computed(() => hasEnVersion(lead.value))

/** Messages selon la langue sélectionnée (avec fallback FR) */
const generatedOutreach = computed(() => getOutreach(lead.value))
const followupJ4 = computed(() => getFollowupJ4(lead.value))
const followupJ10 = computed(() => getFollowupJ10(lead.value))

/** Flag J+4 ou J+10 si prochain suivi = aujourd'hui (pour les boutons "envoyé" qui requièrent la date du jour) */
const followupTypeToday = computed(() => {
  if (!lead.value) return null
  const lastTouch = (lead.value as Record<string, unknown>).last_action_at ?? lead.value.last_touch_at
  return getFollowupType(lastTouch, lead.value.next_followup_at, todayMontreal())
})

/** Type de relance planifiée (J+4 ou J+10) — visible même si la date n'est pas aujourd'hui */
const scheduledFollowupType = computed(() => {
  if (!lead.value) return null
  const lastTouch = (lead.value as Record<string, unknown>).last_action_at ?? lead.value.last_touch_at
  return getScheduledFollowupType(lastTouch, lead.value.next_followup_at)
})

/** Notes normalisées en tableau (l'API peut renvoyer string ou string[]) */
const notesList = computed(() => {
  const n = lead.value?.notes
  if (!n) return []
  if (Array.isArray(n)) return n.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
  if (typeof n === 'string') return n.trim() ? [n.trim()] : []
  return []
})

const newNote = ref('')
const addingNote = ref(false)
const enriching = ref(false)
const savingLead = ref(false)

/** Champs éditables du lead (synchronisés au chargement) */
const editForm = ref({
  contact_name: '',
  company: '',
  role: '',
  type: '',
  linkedin_url: '',
})

const TYPE_NONE = '__none__'
const typeOptions = [
  { value: TYPE_NONE, label: '—' },
  { value: 'cto_or_head_of_engineering', label: 'CTO / Head Eng' },
  { value: 'tech_lead_or_senior', label: 'Tech Lead / Senior' },
  { value: 'warm_contact', label: 'Contact proche' },
  { value: 'recruiter', label: 'Recruteur' },
  { value: 'engineer', label: 'Ingénieur' },
]

function syncEditFormFromLead(l: LeadDetail | null) {
  if (!l) return
  editForm.value = {
    contact_name: getField(l, ['contact_name', 'name', 'full_name', 'contactName']),
    company: getField(l, ['company', 'company_name', 'organization']),
    role: getField(l, ['role', 'title', 'job_title', 'position']),
    type: getLeadTypeValue(l),
    linkedin_url: l.linkedin_url ?? '',
  }
}

function getLeadTypeValue(l: LeadDetail): string {
  const t = l.type?.trim()
  return t && typeOptions.some((o) => o.value === t) ? t : TYPE_NONE
}

const hasEditChanges = computed(() => {
  if (!lead.value) return false
  const l = lead.value
  return (
    editForm.value.contact_name !== getField(l, ['contact_name', 'name', 'full_name', 'contactName'])
    || editForm.value.company !== getField(l, ['company', 'company_name', 'organization'])
    || editForm.value.role !== getField(l, ['role', 'title', 'job_title', 'position'])
    || editForm.value.type !== getLeadTypeValue(l)
    || editForm.value.linkedin_url !== (l.linkedin_url ?? '')
  )
})

async function saveLeadEdits() {
  if (!lead.value || !hasEditChanges.value || savingLead.value) return
  savingLead.value = true
  try {
    const payload: Record<string, unknown> = {}
    if (editForm.value.contact_name !== undefined) {
      const nameVal = editForm.value.contact_name || null
      payload.contact_name = nameVal
      payload.name = nameVal // API Ariane utilise "name"
    }
    if (editForm.value.company !== undefined) payload.company = editForm.value.company || null
    if (editForm.value.role !== undefined) payload.role = editForm.value.role || null
    if (editForm.value.type !== undefined) payload.type = editForm.value.type === TYPE_NONE ? null : editForm.value.type || null
    if (editForm.value.linkedin_url !== undefined) payload.linkedin_url = editForm.value.linkedin_url || null
    const { error } = await patchLead(leadKey.value, payload as never)
    if (!error) await loadLead()
  } finally {
    savingLead.value = false
  }
}

watch(lead, (l) => syncEditFormFromLead(l), { immediate: true })

/** Nom et entreprise affichés (priorité au formulaire s'il y a des changements non sauvegardés) */
const displayName = computed(() => {
  if (hasEditChanges.value && editForm.value.contact_name?.trim()) {
    return editForm.value.contact_name.trim()
  }
  return getField(lead.value, ['contact_name', 'name', 'full_name', 'contactName']) || lead.value?.lead_key || ''
})
const displayCompany = computed(() => {
  if (hasEditChanges.value && editForm.value.company?.trim()) {
    return editForm.value.company.trim()
  }
  return getField(lead.value, ['company', 'company_name', 'organization'])
})

async function handleEnrich() {
  enriching.value = true
  try {
    const { data, error } = await enrichLead(leadKey.value)
    if (!error && data) {
      lead.value = (lead.value ? { ...lead.value, ...data } : data) as LeadDetail
    }
  } finally {
    enriching.value = false
  }
}

async function addNote() {
  const text = newNote.value.trim()
  if (!text || !lead.value) return
  addingNote.value = true
  try {
    const current = notesList.value
    const { error } = await patchLead(leadKey.value, { notes: [...current, text] })
    if (!error) {
      newNote.value = ''
      await loadLead()
    }
  } finally {
    addingNote.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div class="flex items-center gap-2">
        <UButton
          to="/leads"
          variant="ghost"
          icon="i-lucide-arrow-left"
          size="sm"
        >
          Retour aux leads
        </UButton>
        <UButton
          to="/daily"
          variant="ghost"
          icon="i-lucide-calendar"
          size="sm"
        >
          Brief du jour
        </UButton>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin text-muted" />
      </div>

      <template v-else-if="lead">
        <div class="space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-semibold">
                {{ displayName || lead.lead_key }}
              </h1>
              <p v-if="displayCompany" class="text-muted">
                {{ displayCompany }}
              </p>
              <div class="flex flex-wrap items-center gap-2 mt-2">
                <UBadge v-if="lead.pipeline_stage" variant="subtle" size="sm">
                  {{ lead.pipeline_stage }}
                </UBadge>
                <UBadge v-if="lead.priority_score != null" variant="outline" size="sm">
                  Score: {{ lead.priority_score }}
                </UBadge>
                <UButton
                  v-if="linkedinHref(lead.linkedin_url)"
                  size="xs"
                  variant="outline"
                  icon="i-simple-icons-linkedin"
                  :to="linkedinHref(lead.linkedin_url)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Profil LinkedIn
                </UButton>
              </div>
            </div>
          </div>

          <!-- Alerte si champs vides alors que linkedin_url présent (import par URLs) -->
          <div
            v-if="lead.linkedin_url && (!getField(lead, ['contact_name', 'name']) || !getField(lead, ['company', 'company_name']) || !getField(lead, ['role', 'title']))"
            class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
          >
            <p class="font-medium mb-1">Informations manquantes</p>
            <p class="text-amber-700 dark:text-amber-300">
              Ce lead a été importé via une URL LinkedIn mais le nom, l'entreprise ou le poste n'ont pas été renseignés automatiquement. Vous pouvez les saisir manuellement ci-dessous, ou essayer « Générer les messages » si le serveur récupère ces infos à la demande.
            </p>
          </div>

          <!-- Fiche lead : champs éditables + lecture seule -->
          <div class="rounded-lg border border-default p-4">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p class="text-sm font-semibold">Fiche lead</p>
              <UButton
                v-if="hasEditChanges"
                size="sm"
                :loading="savingLead"
                :disabled="savingLead"
                @click="saveLeadEdits"
              >
                Enregistrer les modifications
              </UButton>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <UFormField label="Nom">
                <UInput
                  v-model="editForm.contact_name"
                  placeholder="Nom du contact"
                  size="sm"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Poste / Rôle">
                <UInput
                  v-model="editForm.role"
                  placeholder="Ex: CTO, Tech Lead"
                  size="sm"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Entreprise">
                <UInput
                  v-model="editForm.company"
                  placeholder="Nom de l'entreprise"
                  size="sm"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Type">
                <USelect
                  :model-value="editForm.type"
                  :items="typeOptions"
                  value-key="value"
                  size="sm"
                  class="w-full"
                  placeholder="Type de contact"
                  @update:model-value="(v) => { editForm.type = (typeof v === 'string' ? v : String((v as { value?: string })?.value ?? TYPE_NONE)) }"
                />
              </UFormField>
              <UFormField label="LinkedIn">
                <UInput
                  v-model="editForm.linkedin_url"
                  placeholder="https://linkedin.com/in/..."
                  size="sm"
                  class="w-full"
                />
              </UFormField>
              <div>
                <dt class="text-muted text-xs">Score</dt>
                <dd class="font-medium mt-0.5">{{ lead.priority_score != null ? lead.priority_score : '—' }}</dd>
              </div>
              <div>
                <dt class="text-muted text-xs">Source</dt>
                <dd class="font-medium mt-0.5">{{ (lead.source || lead.sources?.[0]) ? formatSource(lead.source ?? lead.sources?.[0]) : '—' }}</dd>
              </div>
              <div>
                <dt class="text-muted text-xs">Priorité géo</dt>
                <dd class="font-medium mt-0.5">
                  <USelectMenu
                    :model-value="(lead.geo_priority ?? 0) as number"
                    :items="geoOptions"
                    value-key="value"
                    size="sm"
                    class="w-32"
                    placeholder="Priorité géo"
                    :loading="geoPrioritySaving"
                    @update:model-value="handleGeoPriorityChange"
                  />
                </dd>
              </div>
              <div>
                <dt class="text-muted text-xs">Prochain suivi</dt>
                <dd class="font-medium mt-0.5 flex items-center gap-2">
                  <UBadge
                    v-if="followupTypeToday"
                    :variant="followupTypeToday === 'j4' ? 'solid' : 'outline'"
                    size="xs"
                    :color="followupTypeToday === 'j4' ? 'primary' : 'neutral'"
                  >
                    J+{{ followupTypeToday === 'j4' ? '4' : '10' }}
                  </UBadge>
                  {{ lead.next_followup_at ? formatDateDisplay(lead.next_followup_at) : '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-muted text-xs">Dernier contact</dt>
                <dd class="font-medium mt-0.5">{{ lead.last_touch_at ? formatDateDisplay(lead.last_touch_at) : '—' }}</dd>
              </div>
            </div>
          </div>

          <!-- Notes & Red flags -->
          <div class="space-y-3">
            <div v-if="lead.red_flags?.length" class="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3">
              <p class="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Alertes</p>
              <ul class="text-sm text-red-600 dark:text-red-300 space-y-0.5">
                <li v-for="(f, i) in lead.red_flags" :key="i">{{ f }}</li>
              </ul>
            </div>
            <div class="rounded-lg border border-default p-4">
              <p class="text-sm font-semibold mb-2">Notes</p>
              <ul v-if="notesList.length" class="text-sm space-y-1 mb-3">
                <li v-for="(n, i) in notesList" :key="i" class="py-1 px-2 rounded bg-muted/50">{{ n }}</li>
              </ul>
              <p v-else class="text-sm text-muted italic mb-3">Aucune note pour l’instant.</p>
              <form @submit.prevent="addNote" class="flex gap-2">
                <UTextarea
                  v-model="newNote"
                  placeholder="Ajouter une note..."
                  :rows="2"
                  class="min-w-0 flex-1"
                  :disabled="addingNote"
                />
                <UButton
                  type="submit"
                  size="sm"
                  :loading="addingNote"
                  :disabled="!newNote.trim()"
                  class="shrink-0 self-end"
                >
                  Ajouter
                </UButton>
              </form>
            </div>
          </div>

          <!-- Outreach & followups -->
          <div class="rounded-lg border border-default p-4 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-3">
                <p class="text-sm font-semibold">Messages de prospection</p>
                <div
                  v-if="hasEnMessages"
                  class="flex rounded-md overflow-hidden border border-default"
                  role="group"
                  aria-label="Langue des messages"
                >
                  <UButton
                    size="xs"
                    variant="ghost"
                    :color="messageLang === 'fr' ? 'primary' : 'neutral'"
                    :class="messageLang === 'fr' ? 'bg-muted' : ''"
                    @click="messageLang = 'fr'"
                  >
                    FR
                  </UButton>
                  <UButton
                    size="xs"
                    variant="ghost"
                    :color="messageLang === 'en' ? 'primary' : 'neutral'"
                    :class="messageLang === 'en' ? 'bg-muted' : ''"
                    @click="messageLang = 'en'"
                  >
                    EN
                  </UButton>
                </div>
              </div>
              <UButton
                size="sm"
                variant="outline"
                icon="i-lucide-sparkles"
                :loading="enriching"
                :disabled="enriching"
                @click="handleEnrich"
              >
                {{ enriching ? 'Génération en cours…' : 'Générer les messages' }}
              </UButton>
            </div>
            <div>
              <p class="text-sm font-semibold mb-1">Outreach généré</p>
              <p v-if="generatedOutreach" class="text-sm text-muted whitespace-pre-wrap">
                {{ generatedOutreach }}
              </p>
              <p v-else class="text-sm text-muted italic">
                Aucun — généré par le backend Ariane lors de l’enrichissement du lead.
              </p>
              <UButton
                v-if="generatedOutreach"
                size="xs"
                variant="outline"
                icon="i-lucide-copy"
                class="mt-2"
                @click="copyToClipboard(generatedOutreach)"
              >
                Copier outreach
              </UButton>
            </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-lg border border-default p-4">
              <p class="text-sm font-semibold mb-1">Relance J+4</p>
              <p v-if="followupJ4" class="text-sm text-muted whitespace-pre-wrap mb-2">{{ followupJ4 }}</p>
              <p v-else class="text-sm text-muted italic mb-2">Aucun — message généré par le backend Ariane lors de l’enrichissement.</p>
              <div class="flex flex-wrap gap-2">
              <UButton
                v-if="followupJ4"
                size="xs"
                variant="outline"
                icon="i-lucide-copy"
                @click="copyToClipboard(followupJ4)"
              >
                Copier J+4
              </UButton>
              <UButton
                  size="xs"
                  variant="outline"
                  icon="i-lucide-calendar-plus"
                  :loading="actionLoading"
                  @click="runAction(() => scheduleJ4(leadKey))"
                >
                  Planifier J+4
                </UButton>
              </div>
            </div>
            <div class="rounded-lg border border-default p-4">
              <p class="text-sm font-semibold mb-1">Relance J+10</p>
              <p v-if="followupJ10" class="text-sm text-muted whitespace-pre-wrap mb-2">{{ followupJ10 }}</p>
              <p v-else class="text-sm text-muted italic mb-2">Aucun — message généré par le backend Ariane lors de l'enrichissement.</p>
              <div class="flex flex-wrap gap-2">
              <UButton
                v-if="followupJ10"
                size="xs"
                variant="outline"
                icon="i-lucide-copy"
                @click="copyToClipboard(followupJ10)"
              >
                Copier J+10
              </UButton>
                <UButton
                  size="xs"
                  variant="outline"
                  icon="i-lucide-calendar-plus"
                  :loading="actionLoading"
                  @click="runAction(() => scheduleJ10(leadKey))"
                >
                  Planifier J+10
                </UButton>
              </div>
            </div>
          </div>

          <div v-if="lead.questions?.length" class="rounded-lg border border-default p-4">
            <p class="text-sm font-semibold mb-2">5 questions</p>
            <ol class="list-decimal list-inside text-sm text-muted space-y-1">
              <li v-for="(q, i) in lead.questions" :key="i">{{ q }}</li>
            </ol>
          </div>

          <!-- Actions pipeline -->
          <div class="flex flex-wrap gap-2 pt-4 border-t border-default">
            <UButton
              v-if="['inbox', 'new'].includes(lead.pipeline_stage ?? '')"
              variant="outline"
              size="sm"
              :loading="actionLoading"
              @click="runAction(() => markAsMessaged(leadKey))"
            >
              Marquer messagé
            </UButton>
            <UButton
              v-if="scheduledFollowupType === 'j4'"
              variant="outline"
              size="sm"
              color="primary"
              :loading="actionLoading"
              @click="runAction(() => markJ4Sent(leadKey))"
            >
              J+4 envoyé
            </UButton>
            <UButton
              v-if="scheduledFollowupType === 'j10'"
              variant="outline"
              size="sm"
              color="primary"
              :loading="actionLoading"
              @click="runAction(() => markJ10Sent(leadKey))"
            >
              J+10 envoyé
            </UButton>
            <UButton
              variant="outline"
              size="sm"
              :loading="actionLoading"
              @click="runAction(() => markReplied(leadKey))"
            >
              Marquer répondu
            </UButton>
            <UButton
              variant="outline"
              size="sm"
              :loading="actionLoading"
              @click="runAction(() => scheduleCall(leadKey))"
            >
              Planifier appel
            </UButton>
            <UButton
              variant="outline"
              size="sm"
              :loading="actionLoading"
              @click="runAction(() => markProposal(leadKey))"
            >
              Proposition
            </UButton>
            <UButton
              color="success"
              variant="outline"
              size="sm"
              :loading="actionLoading"
              @click="runAction(() => markWon(leadKey))"
            >
              Gagné
            </UButton>
            <UButton
              color="error"
              variant="outline"
              size="sm"
              :loading="actionLoading"
              @click="runAction(() => markLost(leadKey))"
            >
              Perdu
            </UButton>
          </div>
        </div>
        </div>
      </template>

      <div v-else class="text-center py-12 text-muted">
        Lead introuvable
      </div>
    </div>
  </div>
</template>
