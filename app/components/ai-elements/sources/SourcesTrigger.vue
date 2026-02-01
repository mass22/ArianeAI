<script setup lang="ts">
import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDownIcon } from 'lucide-vue-next';
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
  count: number
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <CollapsibleTrigger
    :class="cn('flex items-center gap-2', props.class)"
  >
    <slot>
      <p class="font-medium">
        Used {{ props.count }} sources
      </p>
      <ChevronDownIcon class="h-4 w-4" />
    </slot>
  </CollapsibleTrigger>
</template>
