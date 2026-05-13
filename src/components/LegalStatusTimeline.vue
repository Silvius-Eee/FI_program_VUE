<script setup lang="ts">
import { message } from 'ant-design-vue';
import { openAttachmentRecord } from '../utils/attachment';
import {
  getLegalDocumentStatusTheme,
  normalizeLegalDocumentStatusLabel,
  type LegalAttachment,
  type LegalDocType,
  type LegalStatusHistoryEntry,
} from '../utils/workflowStatus';
import type { RevocableAction } from '../utils/workflowLifecycle';

const props = defineProps<{
  docType: LegalDocType;
  events: LegalStatusHistoryEntry[];
  emptyTitle?: string;
  emptyDescription?: string;
  revocableAction?: RevocableAction | null;
}>();

const emit = defineEmits<{
  revoke: [];
}>();

const isExternalLink = (value: string) => /^https?:\/\//i.test(value);

const shouldShowEventHeaderRow = (event: LegalStatusHistoryEntry) => (
  event.lifecycle?.state === 'revoked'
);

const legalDocumentDisplayNameMap: Record<LegalDocType, string> = {
  NDA: 'Non-Disclosure Agreement',
  MSA: 'Master Services Agreement',
  OTHER_ATTACHMENTS: 'Other Attachments',
};

const getGeneratedStatusNote = (event: LegalStatusHistoryEntry) => {
  const documentLabel = legalDocumentDisplayNameMap[props.docType];
  const previousStatus = normalizeLegalDocumentStatusLabel(props.docType, event.fromStatus || 'Not Started');
  const nextStatus = normalizeLegalDocumentStatusLabel(props.docType, event.toStatus);

  if (previousStatus === 'Not Started') {
    return `${event.actorRole} started ${documentLabel} and set status to ${nextStatus}.`;
  }

  return `${event.actorRole} updated ${documentLabel} from ${previousStatus} to ${nextStatus}.`;
};

const getVisibleEventNote = (event: LegalStatusHistoryEntry) => {
  const note = String(event.note || '').trim();
  if (!note) return '';
  return note === getGeneratedStatusNote(event) ? '' : note;
};

const getEventDisplayStatus = (event: LegalStatusHistoryEntry, index: number) => {
  if (event.displayStatus) return event.displayStatus;
  if (event.lifecycle?.state !== 'revoked') return event.toStatus;

  const previousVisibleEvent = props.events.slice(index + 1).find((candidate) => candidate.lifecycle?.state !== 'revoked');
  return normalizeLegalDocumentStatusLabel(
    props.docType,
    event.terminalDecision?.previousStatus || previousVisibleEvent?.toStatus || 'Not Started',
  );
};

const openTimelineAttachment = async (attachment: LegalAttachment) => {
  const opened = await openAttachmentRecord(attachment);
  if (!opened) {
    message.info('This attachment file is not available. Re-upload it or use the shared document link.');
  }
};
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="(event, index) in props.events"
      :key="event.id"
      class="rounded-[20px] border px-4 py-4"
      :class="event.lifecycle?.state === 'revoked' ? 'border-orange-200 bg-orange-50/60' : 'border-slate-200 bg-slate-50/70'"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div v-if="shouldShowEventHeaderRow(event)" class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-orange-700"
            >
              Revoked
            </span>
          </div>
          <div
            class="text-[12px] font-semibold text-slate-400"
            :class="shouldShowEventHeaderRow(event) ? 'mt-1' : ''"
          >
            {{ event.time || 'Unknown time' }}<span v-if="event.actorName"> / {{ event.actorName }}</span>
          </div>
        </div>
        <span
          class="inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-black"
          :style="{
            backgroundColor: getLegalDocumentStatusTheme(props.docType, getEventDisplayStatus(event, index)).bg,
            color: getLegalDocumentStatusTheme(props.docType, getEventDisplayStatus(event, index)).text,
            borderColor: getLegalDocumentStatusTheme(props.docType, getEventDisplayStatus(event, index)).text,
          }"
        >
          {{ getEventDisplayStatus(event, index) }}
        </span>
      </div>

      <div v-if="getVisibleEventNote(event)" class="mt-3 text-[13px] font-medium leading-relaxed text-slate-600">
        {{ getVisibleEventNote(event) }}
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

        <button
          v-for="file in event.attachments"
          :key="file.uid"
          type="button"
          class="inline-flex max-w-full cursor-pointer items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
          @click="openTimelineAttachment(file)"
        >
          <span class="truncate">{{ file.name }}</span>
        </button>
      </div>

      <div
        v-if="props.revocableAction && props.revocableAction.eventId === event.id"
        class="mt-4 flex justify-end"
      >
        <a-button
          class="h-[36px] rounded-xl border-orange-200 bg-orange-50 px-4 font-bold text-orange-700"
          @click="emit('revoke')"
        >
          {{ props.revocableAction.label }}
        </a-button>
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
