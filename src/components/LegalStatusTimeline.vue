<script setup lang="ts">
import {
  getLegalDocumentStatusTheme,
  type LegalDocType,
  type LegalStatusHistoryEntry,
} from '../utils/workflowStatus';

const props = defineProps<{
  docType: LegalDocType;
  events: LegalStatusHistoryEntry[];
  emptyTitle?: string;
  emptyDescription?: string;
}>();

const isExternalLink = (value: string) => /^https?:\/\//i.test(value);

const getEventTitle = (docType: LegalDocType, event: LegalStatusHistoryEntry) => {
  if (event.actorRole === 'FIOP') {
    if (event.toStatus === 'Under our review') return `${docType} package submitted`;
    if (event.toStatus === 'Pending our signature') return `${docType} signed packet received`;
  }

  if (event.actorRole === 'Legal') {
    if (event.toStatus === 'Under Corridor review') return 'Status updated to Under Corridor review';
    if (event.toStatus === 'Pending Corridor signature') return 'Status updated to Pending Corridor signature';
    if (event.toStatus === 'Completed') return `${docType} archived`;
    if (event.toStatus === 'No Need') return `${docType} marked as No Need`;
  }

  return `Status updated to ${event.toStatus}`;
};
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
          <div class="text-[14px] font-black text-slate-900">{{ getEventTitle(props.docType, event) }}</div>
          <div class="mt-1 text-[12px] font-semibold text-slate-400">
            {{ event.time || 'Unknown time' }}<span v-if="event.actorName"> / {{ event.actorName }}</span>
          </div>
        </div>
        <span
          class="inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-black"
          :style="{
            backgroundColor: getLegalDocumentStatusTheme(props.docType, event.toStatus).bg,
            color: getLegalDocumentStatusTheme(props.docType, event.toStatus).text,
            borderColor: getLegalDocumentStatusTheme(props.docType, event.toStatus).text,
          }"
        >
          {{ event.toStatus }}
        </span>
      </div>

      <div v-if="event.note" class="mt-3 text-[13px] font-medium leading-relaxed text-slate-600">
        {{ event.note }}
      </div>

      <div v-if="event.documentLink || event.attachments.length" class="mt-3 flex flex-wrap gap-2">
        <a
          v-if="event.documentLink && isExternalLink(event.documentLink)"
          :href="event.documentLink"
          target="_blank"
          rel="noreferrer"
          class="inline-flex max-w-full items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700"
        >
          <span class="truncate">{{ event.documentLink }}</span>
        </a>
        <span
          v-else-if="event.documentLink"
          class="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
        >
          <span class="truncate">{{ event.documentLink }}</span>
        </span>

        <span
          v-for="file in event.attachments"
          :key="file.uid"
          class="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
        >
          <span class="truncate">{{ file.name }}</span>
        </span>
      </div>
    </div>

    <div
      v-if="props.events.length === 0"
      class="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center"
    >
      <div class="text-[14px] font-black text-slate-400">{{ props.emptyTitle || 'No history yet' }}</div>
      <div class="mt-2 text-[12px] font-semibold text-slate-400">
        {{ props.emptyDescription || 'This legal document has not entered the review flow yet.' }}
      </div>
    </div>
  </div>
</template>
