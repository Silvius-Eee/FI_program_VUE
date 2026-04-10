<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { message, Modal } from 'ant-design-vue';
import {
  ArrowLeftOutlined,
  FileSearchOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue';
import { useAppStore } from '../stores/app';
import LegalStatusTimeline from './LegalStatusTimeline.vue';
import {
  applyLegalStatusUpdate,
  getInitialLegalStatusForActor,
  getLegalDocumentStatusTheme,
  getLegalRequestPacket,
  getLegalStatusHistory,
  getLegalStatusOptions,
  normalizeLegalDocumentStatusLabel,
  type LegalDocType,
} from '../utils/workflowStatus';

const props = defineProps<{
  docType: LegalDocType;
}>();

const store = useAppStore();
const uploadFileList = ref<any[]>([]);

const packetDraft = reactive({
  entities: [] as string[],
  documentLink: '',
  remarks: '',
  status: '',
});

const legalDraft = reactive({
  status: '',
  note: '',
});

const onboardingEntityOptions = [
  'SwooshTransfer Ltd (UK) - SPI licensed',
  'Steelhenge Pte Ltd (Singapore)',
  'Steelhenge HongKong Group Limited (HK)',
  'Quantumtech Ltd (HK) - MSO licensed',
  'QuantumWing Limited (HK)',
];

const documentMetaMap = {
  NDA: {
    title: 'Non-Disclosure Agreement',
    fiSubtitle: 'FIOP records Corridor feedback, revised drafts, and signature progress here before Legal finalizes the file.',
    legalSubtitle: 'Legal reviews the latest packet from FIOP and updates the shared corridor status for NDA handling.',
    linkPlaceholder: 'Paste the NDA source link or signing URL',
    remarksPlaceholder: 'Add the latest remarks, signature details, or blocker for Legal',
  },
  MSA: {
    title: 'Master Services Agreement',
    fiSubtitle: 'FIOP records Corridor feedback, redlines, and signature progress here before Legal finalizes the file.',
    legalSubtitle: 'Legal reviews the latest packet from FIOP and updates the shared corridor status for MSA handling.',
    linkPlaceholder: 'Paste the MSA source link, dataroom URL, or signing URL',
    remarksPlaceholder: 'Add the latest remarks, redline status, or blocker for Legal',
  },
} as const;

const channel = computed(() => store.selectedChannel || null);
const documentMeta = computed(() => documentMetaMap[props.docType]);
const isLegalReviewer = computed(() => store.role === 'Legal');
const fiActorName = computed(() => channel.value?.fiopOwner || 'Current User');
const requestPacket = computed(() => (
  channel.value ? getLegalRequestPacket(channel.value, props.docType) : {
    entities: [],
    documentLink: '',
    remarks: '',
    attachments: [],
    submittedAt: '',
    submittedBy: '',
  }
));
const historyEntries = computed(() => (
  channel.value ? getLegalStatusHistory(channel.value, props.docType) : []
));
const displayStatus = computed(() => normalizeLegalDocumentStatusLabel(
  props.docType,
  channel.value?.[props.docType === 'MSA' ? 'contractStatus' : 'ndaStatus']
    || channel.value?.globalProgress?.[props.docType === 'MSA' ? 'contract' : 'nda'],
));
const statusTheme = computed(() => getLegalDocumentStatusTheme(props.docType, displayStatus.value));
const fiStatusOptions = computed(() => getLegalStatusOptions(props.docType, 'FIOP'));
const legalStatusOptions = computed(() => getLegalStatusOptions(props.docType, 'Legal'));
const latestUpdatedAt = computed(() => (
  historyEntries.value[0]?.time
  || requestPacket.value.submittedAt
  || channel.value?.lastModifiedAt
  || ''
));
const serializedAttachments = computed(() => uploadFileList.value.map((file) => ({
  uid: String(file.uid),
  name: String(file.name || 'Attachment'),
  status: String(file.status || 'done'),
  size: Number(file.size || 0),
  type: String(file.type || ''),
})));
const hasSubmissionPacket = computed(() => (
  Boolean(requestPacket.value.submittedAt)
  || Boolean(requestPacket.value.submittedBy)
  || Boolean(requestPacket.value.remarks)
  || Boolean(requestPacket.value.documentLink)
  || requestPacket.value.entities.length > 0
  || requestPacket.value.attachments.length > 0
));

const syncPacketDraft = () => {
  packetDraft.entities = [...requestPacket.value.entities];
  packetDraft.documentLink = requestPacket.value.documentLink;
  packetDraft.remarks = requestPacket.value.remarks;
  packetDraft.status = getInitialLegalStatusForActor(props.docType, 'FIOP', displayStatus.value);
  uploadFileList.value = requestPacket.value.attachments.map((attachment) => ({
    uid: attachment.uid,
    name: attachment.name,
    status: attachment.status || 'done',
    size: attachment.size,
    type: attachment.type,
  }));
};

watch([channel, () => props.docType, displayStatus], syncPacketDraft, { immediate: true });

watch([channel, () => props.docType, displayStatus], () => {
  legalDraft.status = getInitialLegalStatusForActor(props.docType, 'Legal', displayStatus.value);
  legalDraft.note = '';
}, { immediate: true });

const preventUpload = () => false;

const handleUploadChange = (info: any) => {
  uploadFileList.value = (info.fileList || []).map((file: any) => ({
    uid: String(file.uid),
    name: String(file.name || 'Attachment'),
    status: 'done',
    size: Number(file.size || 0),
    type: String(file.type || ''),
  }));
};

const isExternalLink = (value: string) => /^https?:\/\//i.test(value);

const handleFiSave = () => {
  if (!channel.value) return;
  if (!packetDraft.entities.length) {
    message.warning('Select at least one contracting entity before syncing the packet.');
    return;
  }
  if (!packetDraft.remarks.trim()) {
    message.warning('Add remarks before sending the packet to Legal.');
    return;
  }

  Modal.confirm({
    title: `Send ${documentMeta.value.title} to Legal?`,
    content: 'This updates the shared packet, syncs the selected status, and records the event in the legal timeline.',
    okText: 'Send to Legal',
    onOk: () => {
      const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const updated = applyLegalStatusUpdate({
        channel: channel.value,
        docType: props.docType,
        actorRole: 'FIOP',
        actorName: fiActorName.value,
        nextStatus: packetDraft.status as any,
        note: packetDraft.remarks.trim(),
        timestamp,
        packetUpdate: {
          entities: [...packetDraft.entities],
          documentLink: packetDraft.documentLink.trim(),
          remarks: packetDraft.remarks.trim(),
          attachments: serializedAttachments.value,
        },
      });

      store.updateChannel(updated);
      message.success(`${documentMeta.value.title} sent to Legal.`);
    },
  });
};

const handleLegalSave = () => {
  if (!channel.value) return;

  Modal.confirm({
    title: `Update ${documentMeta.value.title} status?`,
    content: 'This syncs the latest Legal status back to the corridor dashboard and FI detail view.',
    okText: 'Save Status',
    onOk: () => {
      const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const updated = applyLegalStatusUpdate({
        channel: channel.value,
        docType: props.docType,
        actorRole: 'Legal',
        actorName: 'Legal Team',
        nextStatus: legalDraft.status as any,
        note: legalDraft.note.trim(),
        timestamp,
      });

      store.updateChannel(updated);
      message.success(`${documentMeta.value.title} status updated.`);
      store.closeLegalDetail();
    },
  });
};
</script>

<template>
  <div class="legal-detail-page min-h-screen px-5 py-6">
    <div class="mx-auto max-w-[1280px] space-y-5">
      <div
        v-if="!channel"
        class="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)]"
      >
        <a-empty description="No legal task selected." />
        <a-button type="primary" class="mt-6 h-[42px] rounded-xl px-6 font-bold" @click="store.closeLegalDetail()">
          Return
        </a-button>
      </div>

      <template v-else>
        <section class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.28)]">
          <div class="flex flex-wrap items-start justify-between gap-5">
            <div class="min-w-0 flex-1">
              <a-button type="text" class="!mb-4 !px-0 font-bold text-slate-500" @click="store.closeLegalDetail()">
                <template #icon><arrow-left-outlined /></template>
                {{ isLegalReviewer ? 'Back to Legal Queue' : 'Back to Corridor' }}
              </a-button>
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="m-0 text-[28px] font-black tracking-[-0.02em] text-slate-950">
                  {{ channel.channelName || 'Unnamed Corridor' }}
                </h2>
                <a-tag
                  :style="{ backgroundColor: statusTheme.bg, color: statusTheme.text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
                >
                  {{ displayStatus }}
                </a-tag>
              </div>
              <div class="mt-3 text-[13px] font-semibold text-slate-500">
                {{ documentMeta.title }}
              </div>
            </div>

            <div class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Latest Update</div>
              <div class="mt-2 max-w-[280px] text-[13px] font-semibold leading-relaxed text-slate-700">
                {{ latestUpdatedAt || 'No submission yet' }}
              </div>
              <div class="mt-2 text-[12px] font-semibold text-slate-400">
                FI Owner: {{ channel.fiopOwner || 'Unassigned' }}
              </div>
            </div>
          </div>
        </section>

        <template v-if="isLegalReviewer">
          <section class="space-y-5">
            <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
              <div>
                <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Submission Packet</div>
                <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">{{ documentMeta.title }}</h3>
                <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                  {{ documentMeta.legalSubtitle }}
                </p>
              </div>

              <div v-if="hasSubmissionPacket" class="mt-5 rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-4">
                <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Submitted At</div>
                    <div class="mt-2 text-[13px] font-semibold text-slate-700">{{ requestPacket.submittedAt || 'Unknown time' }}</div>
                  </div>
                  <div>
                    <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Submitted By</div>
                    <div class="mt-2 text-[13px] font-semibold text-slate-700">{{ requestPacket.submittedBy || 'Unknown user' }}</div>
                  </div>
                  <div>
                    <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Current Status</div>
                    <div class="mt-2">
                      <a-tag
                        :style="{ backgroundColor: statusTheme.bg, color: statusTheme.text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
                      >
                        {{ displayStatus }}
                      </a-tag>
                    </div>
                  </div>
                </div>

                <div class="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <div v-if="requestPacket.entities.length" class="min-w-0">
                    <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Entities</div>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <span
                        v-for="entity in requestPacket.entities"
                        :key="entity"
                        class="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        <span class="truncate">{{ entity }}</span>
                      </span>
                    </div>
                  </div>

                  <div v-if="requestPacket.documentLink" class="min-w-0">
                    <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Document Link</div>
                    <div class="mt-2">
                      <a
                        v-if="isExternalLink(requestPacket.documentLink)"
                        :href="requestPacket.documentLink"
                        target="_blank"
                        rel="noreferrer"
                        class="inline-flex max-w-full items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700"
                      >
                        <span class="truncate">{{ requestPacket.documentLink }}</span>
                      </a>
                      <span
                        v-else
                        class="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        <span class="truncate">{{ requestPacket.documentLink }}</span>
                      </span>
                    </div>
                  </div>

                  <div>
                    <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Attachments</div>
                    <div v-if="requestPacket.attachments.length" class="mt-2 flex flex-wrap gap-2">
                      <span
                        v-for="file in requestPacket.attachments"
                        :key="file.uid"
                        class="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        <span class="truncate">{{ file.name }}</span>
                      </span>
                    </div>
                    <div v-else class="mt-2 text-[12px] font-semibold text-slate-400">No attachments captured.</div>
                  </div>
                </div>

                <div v-if="requestPacket.remarks" class="mt-4">
                  <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Remarks</div>
                  <div class="mt-2 text-[13px] font-medium leading-relaxed text-slate-600">
                    {{ requestPacket.remarks }}
                  </div>
                </div>
              </div>

              <div
                v-else
                class="mt-5 rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center"
              >
                <div class="text-[14px] font-black text-slate-400">No submission packet yet</div>
                <div class="mt-2 text-[12px] font-semibold text-slate-400">
                  FIOP has not shared a legal packet for this document yet.
                </div>
              </div>
            </article>

            <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
              <div>
                <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Legal Review</div>
                <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">Sync the legal status</h3>
                <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                  Legal only updates statuses that represent legal actions, Corridor follow-up requests, or final archive completion.
                </p>
              </div>

              <div class="mt-5 rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                <div class="text-[13px] font-black text-slate-700">Status</div>
                <a-select
                  v-model:value="legalDraft.status"
                  class="mt-4 w-full status-select"
                  :options="legalStatusOptions"
                />
              </div>

              <div class="mt-5 rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                <div class="text-[13px] font-black text-slate-700">Legal Note</div>
                <a-textarea
                  v-model:value="legalDraft.note"
                  :rows="7"
                  class="mt-4"
                  placeholder="Add the legal conclusion, requested changes, or archival note"
                />
              </div>

              <div class="mt-5 flex justify-center">
                <a-button
                  type="primary"
                  class="h-[44px] rounded-2xl border-none bg-[#0284c7] px-5 font-black shadow-[0_18px_32px_-20px_rgba(2,132,199,0.45)]"
                  @click="handleLegalSave"
                >
                  <template #icon><save-outlined /></template>
                  Save Status
                </a-button>
              </div>
            </article>
          </section>
        </template>

        <template v-else>
          <section>
            <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">FIOP Packet</div>
                  <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">{{ documentMeta.title }}</h3>
                  <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                    {{ documentMeta.fiSubtitle }}
                  </p>
                </div>

                <a-tag
                  :style="{ backgroundColor: '#f8fafc', color: '#475569', border: 'none', borderRadius: '999px', fontWeight: 800, padding: '6px 14px' }"
                >
                  FIOP update
                </a-tag>
              </div>

              <div class="mt-5 rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-4">
                <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Latest Packet Time</div>
                    <div class="mt-2 text-[13px] font-semibold text-slate-700">{{ requestPacket.submittedAt || 'No packet yet' }}</div>
                  </div>
                  <div>
                    <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Latest Packet Owner</div>
                    <div class="mt-2 text-[13px] font-semibold text-slate-700">{{ requestPacket.submittedBy || fiActorName }}</div>
                  </div>
                  <div>
                    <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Current Status</div>
                    <div class="mt-2">
                      <a-tag
                        :style="{ backgroundColor: statusTheme.bg, color: statusTheme.text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
                      >
                        {{ displayStatus }}
                      </a-tag>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-6 space-y-5">
                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Contracting Entities</div>
                  <div class="mt-4 grid gap-3 md:grid-cols-2">
                    <label
                      v-for="entity in onboardingEntityOptions"
                      :key="entity"
                      class="rounded-[16px] border border-slate-200 bg-white px-4 py-3 transition-all"
                      :class="packetDraft.entities.includes(entity) ? 'border-sky-300 bg-sky-50/70' : ''"
                    >
                      <a-checkbox
                        :checked="packetDraft.entities.includes(entity)"
                        @change="() => packetDraft.entities = packetDraft.entities.includes(entity) ? packetDraft.entities.filter((item) => item !== entity) : [...packetDraft.entities, entity]"
                      >
                        <span class="text-[13px] font-semibold text-slate-700">{{ entity }}</span>
                      </a-checkbox>
                    </label>
                  </div>
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Attachments</div>
                  <a-upload-dragger
                    class="legal-upload mt-4"
                    multiple
                    :before-upload="preventUpload"
                    :file-list="uploadFileList"
                    :show-upload-list="false"
                    @change="handleUploadChange"
                  >
                    <div class="flex flex-col items-center gap-3 py-4">
                      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                        <file-search-outlined class="text-[18px]" />
                      </div>
                      <div class="text-[15px] font-black text-slate-900">Drop files here or select attachments</div>
                      <div class="text-[12px] font-medium text-slate-400">Files are stored as metadata in this prototype.</div>
                    </div>
                  </a-upload-dragger>

                  <div v-if="serializedAttachments.length" class="mt-4 space-y-3">
                    <div
                      v-for="file in serializedAttachments"
                      :key="file.uid"
                      class="rounded-[16px] border border-slate-200 bg-white px-4 py-3"
                    >
                      <div class="truncate text-[13px] font-black text-slate-900">{{ file.name }}</div>
                      <div class="mt-1 text-[11px] font-semibold text-slate-400">
                        {{ file.type || 'Unknown type' }}<span v-if="file.size"> / {{ file.size }} bytes</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Document Link</div>
                  <a-input
                    v-model:value="packetDraft.documentLink"
                    class="mt-3"
                    :placeholder="documentMeta.linkPlaceholder"
                  />
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Remarks</div>
                  <a-textarea
                    v-model:value="packetDraft.remarks"
                    :rows="6"
                    class="mt-3"
                    :placeholder="documentMeta.remarksPlaceholder"
                  />
                  <div class="mt-5 flex flex-col items-center gap-4">
                    <div class="w-full max-w-[220px] self-start">
                      <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Status</div>
                      <a-select
                        v-model:value="packetDraft.status"
                        class="mt-3 w-full status-select"
                        :options="fiStatusOptions"
                      />
                    </div>
                    <a-button
                      type="primary"
                      class="h-[44px] rounded-xl border-none bg-[#0284c7] px-5 font-black shadow-[0_18px_32px_-20px_rgba(2,132,199,0.45)]"
                      @click="handleFiSave"
                    >
                      <template #icon><save-outlined /></template>
                      Send to Legal
                    </a-button>
                  </div>
                </div>
              </div>
            </article>
          </section>
        </template>

        <section>
          <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Legal Timeline</div>
                <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">{{ documentMeta.title }}</h3>
                <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                  Use the shared timeline to confirm what FIOP submitted, what Legal asked for, and when the status changed.
                </p>
              </div>
            </div>

            <div class="mt-5">
              <LegalStatusTimeline
                :doc-type="props.docType"
                :events="historyEntries"
                empty-title="No legal history yet"
                empty-description="This document has not entered the legal workflow for this corridor."
              />
            </div>
          </article>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.legal-detail-page {
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 24%),
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.06), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #f8fafc 42%, #f8fafc 100%);
}

.legal-upload :deep(.ant-upload) {
  border-radius: 18px;
}

.status-select :deep(.ant-select-selector) {
  min-height: 44px;
  border-radius: 14px !important;
}
</style>
