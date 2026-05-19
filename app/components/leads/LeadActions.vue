<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Lead } from '~/types/leads'

const props = defineProps<{
  lead: Lead
  loading?: boolean
  /** Type de relance due aujourd'hui (J+4 ou J+10) — affiche les boutons correspondants */
  followupTypeToday?: 'j4' | 'j10' | null
}>()

const emit = defineEmits<{
  statusChange: [status: string]
  pipelineChange: [stage: string]
  markMessaged: []
  markJ4Sent: []
  markJ10Sent: []
}>()

const items = computed<DropdownMenuItem[][]>(() => {
  const followupItems: DropdownMenuItem[] = []
  if (props.followupTypeToday === 'j4') {
    followupItems.push({
      label: 'J+4 envoyé',
      icon: 'i-lucide-send',
      onSelect: () => emit('markJ4Sent'),
    })
  }
  if (props.followupTypeToday === 'j10') {
    followupItems.push({
      label: 'J+10 envoyé',
      icon: 'i-lucide-send',
      onSelect: () => emit('markJ10Sent'),
    })
  }
  return [
    [
      {
        label: 'Marquer comme message envoyé',
        icon: 'i-lucide-message-square',
        onSelect: () => emit('markMessaged'),
      },
    ],
    ...(followupItems.length ? [followupItems] : []),
    [
      { label: 'Statut: Actif', icon: 'i-lucide-user', onSelect: () => emit('statusChange', 'active') },
      { label: 'Statut: Inactif', icon: 'i-lucide-user-x', onSelect: () => emit('statusChange', 'inactive') },
    ],
    [
      { label: 'Pipeline: Contacté', onSelect: () => emit('pipelineChange', 'contacted') },
      { label: 'Pipeline: Répondu', onSelect: () => emit('pipelineChange', 'replied') },
      { label: 'Pipeline: RDV planifié', onSelect: () => emit('pipelineChange', 'scheduled') },
    ],
  ]
})
</script>

<template>
  <UDropdownMenu :items="items" :ui="{ content: 'w-52' }">
    <UButton
      variant="ghost"
      size="sm"
      icon="i-lucide-more-horizontal"
      :loading="loading"
    />
  </UDropdownMenu>
</template>
