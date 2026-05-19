<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'
import type { Lead } from '~/types/leads'
import { formatDateDisplay, getFollowupType, getScheduledFollowupType, todayMontreal } from '~/lib/dateUtils'
import { geoPriorityLabel } from '~/config/geo-priority'
import LeadActions from './LeadActions.vue'

const props = defineProps<{
  leads: Lead[]
  loading?: boolean
  actionLoadingKey?: string | null
}>()

const emit = defineEmits<{
  statusChange: [lead: Lead, status: string]
  pipelineChange: [lead: Lead, stage: string]
  markMessaged: [lead: Lead]
  markJ4Sent: [lead: Lead]
  markJ10Sent: [lead: Lead]
}>()

const router = useRouter()
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')


function formatType(type: string | undefined): string {
  if (!type) return '—'
  const map: Record<string, string> = {
    cto_or_head_of_engineering: 'CTO / Head Eng',
    tech_lead_or_senior: 'Tech Lead / Senior',
    warm_contact: 'Contact proche',
    recruiter: 'Recruteur',
    engineer: 'Ingénieur',
  }
  return map[type] || type
}

function formatSource(source: string | string[] | undefined): string {
  if (!source) return '—'
  const s = Array.isArray(source) ? source[0] : source
  if (!s) return '—'
  const map: Record<string, string> = {
    linkedin_csv: 'LinkedIn CSV',
    urls: 'URLs',
  }
  return map[s] ?? s
}

const columnPinning = ref<{ left?: string[]; right?: string[] }>({ left: ['lead_key'] })

const columns: TableColumn<Lead>[] = [
  {
    accessorKey: 'lead_key',
    header: 'Lead',
    size: 220,
    cell: ({ row }) => {
      const lead = row.original
      return h('div', { class: 'flex flex-col' }, [
        h('span', { class: 'font-medium' }, lead.contact_name || lead.name || lead.lead_key),
        lead.company
          ? h('span', { class: 'text-xs text-muted' }, lead.company)
          : null,
      ])
    },
  },
  {
    accessorKey: 'role',
    header: 'Rôle',
    cell: ({ row }) => {
      const role = (row.original as Lead & { role?: string }).role
      return h('span', { class: 'text-sm' }, role || '—')
    },
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.original.type
      return h('span', { class: 'text-xs text-muted' }, formatType(type))
    },
  },
  {
    accessorKey: 'source',
    header: 'Source',
    cell: ({ row }) => {
      const lead = row.original
      const source = lead.source ?? (lead as Lead & { sources?: string[] }).sources?.[0]
      return h('span', { class: 'text-xs' }, formatSource(source))
    },
  },
  {
    accessorKey: 'pipeline_stage',
    header: 'Pipeline',
    cell: ({ row }) => {
      const stage = row.original.pipeline_stage || '—'
      return h(UBadge, { variant: 'subtle', size: 'xs' }, () => stage)
    },
  },
  {
    accessorKey: 'geo_priority',
    header: 'Priorité géo',
    cell: ({ row }) => {
      const geo = (row.original as Lead & { geo_priority?: number }).geo_priority
      const label = geoPriorityLabel(geo)
      if (label === '—') return h('span', { class: 'text-muted text-xs' }, '—')
      return h(UBadge, { variant: 'outline', size: 'xs' }, () => label)
    },
  },
  {
    accessorKey: 'priority_score',
    header: 'Score',
    cell: ({ row }) => {
      const score = row.original.priority_score
      return h('span', { class: 'font-mono text-sm' }, score != null ? String(score) : '—')
    },
  },
  {
    accessorKey: 'next_followup_at',
    header: 'Prochain suivi',
    cell: ({ row }) => {
      const lead = row.original
      const lastTouchRaw = (lead as Record<string, unknown>).last_action_at ?? lead.last_touch_at
      const lastTouch = typeof lastTouchRaw === 'string' ? lastTouchRaw : (lastTouchRaw != null ? String(lastTouchRaw) : undefined)
      const followupType = getScheduledFollowupType(lastTouch, lead.next_followup_at)
      return h('div', { class: 'flex items-center gap-1.5 flex-wrap' }, [
        followupType
          ? h(UBadge, { variant: followupType === 'j4' ? 'solid' : 'outline', size: 'xs', color: followupType === 'j4' ? 'primary' : 'neutral' }, () => `J+${followupType === 'j4' ? '4' : '10'}`)
          : null,
        h('span', { class: 'text-sm' }, formatDateDisplay(lead.next_followup_at)),
      ])
    },
  },
  {
    accessorKey: 'linkedin_url',
    header: 'LinkedIn',
    cell: ({ row }) => {
      const url = (row.original as Lead & { linkedin_url?: string }).linkedin_url
      if (!url) return h('span', { class: 'text-muted' }, '—')
      const href = url.startsWith('http') ? url : `https://${url}`
      return h(
        'a',
        {
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'inline-flex items-center gap-1 text-primary hover:underline text-sm',
        },
        [h(resolveComponent('UIcon'), { name: 'i-lucide-external-link', class: 'size-4' }), ' Profil'],
      )
    },
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'text-right' }, 'Actions'),
    cell: ({ row }) => {
      const lead = row.original
      const isLoading = props.actionLoadingKey === lead.lead_key
      const lastTouchRaw = (lead as Record<string, unknown>).last_action_at ?? lead.last_touch_at
      const lastTouch = typeof lastTouchRaw === 'string' ? lastTouchRaw : (lastTouchRaw != null ? String(lastTouchRaw) : undefined)
      return h('div', { class: 'flex items-center justify-end gap-1' }, [
        h(
          UButton,
          {
            variant: 'ghost',
            size: 'sm',
            onClick: (e: Event) => {
              e.stopPropagation()
              router.push(`/leads/${lead.lead_key}`)
            },
          },
          () => 'Voir',
        ),
        h(LeadActions, {
          lead,
          loading: isLoading,
          followupTypeToday: getScheduledFollowupType(lastTouch, lead.next_followup_at),
          onStatusChange: (s: string) => emit('statusChange', lead, s),
          onPipelineChange: (s: string) => emit('pipelineChange', lead, s),
          onMarkMessaged: () => emit('markMessaged', lead),
          onMarkJ4Sent: () => emit('markJ4Sent', lead),
          onMarkJ10Sent: () => emit('markJ10Sent', lead),
        }),
      ])
    },
  },
]
</script>

<template>
  <div class="border border-default rounded-lg overflow-x-auto leads-table-wrapper">
    <UTable
      v-model:column-pinning="columnPinning"
      :data="leads"
      :columns="columns"
      :loading="loading"
      empty="Aucun lead trouvé"
      class="w-full min-w-[900px]"
      @select="(e: any, row: { original: Lead }) => navigateTo(`/leads/${row.original.lead_key}`)"
    />
  </div>
</template>

<style scoped>
/* Fond opaque sur la colonne sticky pour masquer le contenu qui défile */
.leads-table-wrapper :deep(th:first-child),
.leads-table-wrapper :deep(td:first-child) {
  background: hsl(var(--background)) !important;
  box-shadow: 2px 0 4px -2px rgb(0 0 0 / 0.08);
}
</style>
