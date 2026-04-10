<script setup lang="ts">
import {
  getOnboardingStatusLabel,
  getOnboardingStatusTheme,
  type OnboardingActivityEntry,
  type OnboardingTrack,
} from '../constants/onboarding';

const props = defineProps<{
  events: OnboardingActivityEntry[];
  track: OnboardingTrack;
  emptyDescription?: string;
  emptyTitle?: string;
}>();
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="event in props.events"
      :key="event.id"
      class="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-4"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-[14px] font-black text-slate-900">{{ event.title }}</div>
          <div class="mt-1 text-[12px] font-semibold text-slate-400">
            {{ event.time }}<span v-if="event.actorName"> / {{ event.actorName }}</span>
          </div>
        </div>
        <span
          class="inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-black"
          :style="{
            backgroundColor: getOnboardingStatusTheme(event.status).bg,
            color: getOnboardingStatusTheme(event.status).text,
            borderColor: getOnboardingStatusTheme(event.status).border,
          }"
        >
          {{ getOnboardingStatusLabel(props.track, event.status) }}
        </span>
      </div>

      <div v-if="event.remark" class="mt-3 text-[13px] font-medium leading-relaxed text-slate-600">
        {{ event.remark }}
      </div>

      <div v-if="event.attachments.length" class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="attachment in event.attachments"
          :key="attachment.uid"
          class="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
        >
          <span class="truncate">{{ attachment.name }}</span>
        </span>
      </div>
    </div>

    <div
      v-if="props.events.length === 0"
      class="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center"
    >
      <div class="text-[14px] font-black text-slate-400">{{ props.emptyTitle || 'No history yet' }}</div>
      <div class="mt-2 text-[12px] font-semibold text-slate-400">
        {{ props.emptyDescription || 'This track has not been submitted yet.' }}
      </div>
    </div>
  </div>
</template>
