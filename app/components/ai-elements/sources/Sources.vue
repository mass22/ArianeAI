<script setup lang="ts">
import { Collapsible } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <Collapsible
    :class="cn('not-prose mb-4 text-primary text-xs', props.class)"
  >
    <slot />
  </Collapsible>
</template>
