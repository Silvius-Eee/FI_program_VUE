<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useAppStore } from '../stores/app';
import {
  getChannelOnboardingWorkflow,
  getOnboardingRevocableAction,
  getOnboardingStatusLabel,
  getOnboardingStatusTheme,
  getOnboardingTimelineEvents,
  hasOnboardingSubmission,
} from '../constants/onboarding';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';

const props = defineProps<{
  channel: any;
}>();

const emit = defineEmits(['submit', 'close', 'revoke']);
const store = useAppStore();

const activeKey = ref('submission');
const fileList = ref<any[]>([]);

const formState = reactive({
  entities: [] as string[],
  documentLink: '',
  notes: '',
});

const onboardingEntityOptions = [
  'SwooshTransfer Ltd (UK) - SPI licensed',
  'Steelhenge Pte Ltd (Singapore)',
  'Steelhenge HongKong Group Limited (HK)',
  'Quantumtech Ltd (HK) - MSO licensed',
  'QuantumWing Limited (HK)',
];

const workflow = computed(() => getChannelOnboardingWorkflow(props.channel, 'wooshpay'));
const statusLabel = computed(() => getOnboardingStatusLabel('wooshpay', workflow.value.status));
const statusTheme = computed(() => getOnboardingStatusTheme(workflow.value.status));
const canOperateChannel = computed(() => store.canOperateFiWork(props.channel));
const revocableAction = computed(() => (
  canOperateChannel.value
    ? getOnboardingRevocableAction('wooshpay', workflow.value, 'FIOP', store.currentUserName)
    : null
));

const syncFormState = () => {
  const submission = workflow.value.submission;
  formState.entities = [...submission.entities];
  formState.documentLink = submission.documentLink;
  formState.notes = submission.notes;
  fileList.value = submission.attachments.map((attachment) => ({
    uid: attachment.uid,
    name: attachment.name,
    status: attachment.status || 'done',
    size: attachment.size,
    type: attachment.type,
  }));
};

watch(workflow, syncFormState, { immediate: true, deep: true });

const preventUpload = () => false;

const handleUploadChange = (info: any) => {
  fileList.value = (info.fileList || []).map((file: any) => ({
    uid: String(file.uid),
    name: String(file.name || 'Attachment'),
    status: 'done',
    size: Number(file.size || 0),
    type: String(file.type || ''),
  }));
};

const serializedAttachments = computed(() => fileList.value.map((file) => ({
  uid: String(file.uid),
  name: String(file.name || 'Attachment'),
  status: String(file.status || 'done'),
  size: Number(file.size || 0),
  type: String(file.type || ''),
})));

const historyEvents = computed(() => {
  const events = getOnboardingTimelineEvents('wooshpay', workflow.value).map((entry) => ({
    id: entry.id,
    type: entry.eventType === 'submission' || entry.eventType === 'resubmission' ? 'submission' : 'status',
    status: entry.displayStatus || entry.status,
    timestamp: entry.time,
    actor: entry.actorName,
    detail: entry.remark,
    attachments: entry.attachments,
    revoked: entry.lifecycle?.state === 'revoked',
  }));

  if (!events.length && hasOnboardingSubmission(workflow.value.submission)) {
    events.push({
      id: 'submission',
      type: 'submission',
      status: workflow.value.status,
      timestamp: workflow.value.submission.submittedAt,
      actor: workflow.value.submission.submittedBy,
      detail: workflow.value.submission.notes,
      attachments: workflow.value.submission.attachments,
      revoked: false,
    });
  }

  return events
    .filter((event) => event.timestamp)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
});

const handleSubmit = () => {
  if (formState.entities.length === 0) {
    message.warning('Please select at least one contracting entity.');
    return;
  }
  if (showTextLimitWarning(message.warning, [
    { label: 'Supporting link or portal', value: formState.documentLink, max: INPUT_LIMITS.url },
    { label: 'What Compliance should review', value: formState.notes, max: INPUT_LIMITS.note },
  ])) return;

  message.success('WooshPay onboarding package submitted successfully');
  emit('submit', {
    entities: [...formState.entities],
    documentLink: formState.documentLink,
    notes: formState.notes,
    attachments: serializedAttachments.value,
  });
};
</script>

<template>
  <div class="kyc-workflow-panel h-full flex flex-col bg-transparent">
    <div class="kyc-tabs-shell px-6 border-b border-slate-100/90">
      <a-tabs v-model:activeKey="activeKey" class="fitrem-tabs">
        <a-tab-pane key="submission" tab="Submission" />
        <a-tab-pane key="history" tab="History" />
      </a-tabs>
    </div>

    <div class="kyc-panel-body flex-1 overflow-y-auto p-6 custom-scrollbar">
      <div v-if="activeKey === 'submission'" class="submission-stack">
        <div class="kyc-hero-card">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-[12px] font-bold text-slate-400 tracking-[0.18em] uppercase">WooshPay onboarding</div>
              <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-900 leading-tight">{{ props.channel.channelName || 'Unnamed Corridor' }}</h3>
              <p class="mt-2 mb-0 text-[13px] text-slate-500 font-medium leading-relaxed">
                Choose the WooshPay-side entities, add the supporting package, and explain what Compliance should review.
              </p>
            </div>
            <span class="kyc-status-pill" :style="{ background: statusTheme.bg, color: statusTheme.text, borderColor: statusTheme.border }">
              {{ statusLabel }}
            </span>
          </div>
        </div>

        <a-form layout="vertical" :required-mark="false" class="kyc-form">
          <div class="kyc-section-card">
            <a-form-item required class="mb-0">
              <template #label>
                <div class="kyc-label-row">
                  <span class="kyc-required-mark" aria-hidden="true">*</span>
                  <span class="kyc-label-text">Which WooshPay entities are in scope</span>
                </div>
              </template>
              <a-checkbox-group v-model:value="formState.entities" class="kyc-entity-group w-full">
                <div class="kyc-entity-list">
                  <a-checkbox
                    v-for="opt in onboardingEntityOptions"
                    :key="opt"
                    :value="opt"
                    :class="['entity-option', { 'entity-option--selected': formState.entities.includes(opt) }]"
                  >
                    <span class="entity-option__text">{{ opt }}</span>
                  </a-checkbox>
                </div>
              </a-checkbox-group>
            </a-form-item>
          </div>

          <div class="kyc-section-card">
            <a-form-item class="mb-0">
              <template #label>
                <span class="kyc-label-text">Supporting attachments</span>
              </template>
              <a-upload-dragger
                class="kyc-upload-dragger mt-2"
                multiple
                :before-upload="preventUpload"
                :file-list="fileList"
                :show-upload-list="false"
                @change="handleUploadChange"
              >
                <div class="ant-upload-drag-icon">
                  <div class="kyc-upload-icon-shell bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
                    <div class="kyc-upload-icon-core bg-sky-500 rounded-xl flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 16L12 8M12 8L9 11M12 8L15 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8 16H16" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <p class="kyc-upload-copy text-[15px] font-bold text-slate-800 mb-1">Upload the files Compliance should review.</p>
                <p class="text-[12px] font-medium text-slate-400 mb-0">Files stay as local metadata in this prototype and can be reviewed from the workbench.</p>
              </a-upload-dragger>

              <div class="kyc-file-list">
                <div v-if="serializedAttachments.length" class="space-y-3">
                  <div v-for="file in serializedAttachments" :key="file.uid" class="kyc-file-row">
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-[13px] font-bold text-slate-800">{{ file.name }}</div>
                      <div class="text-[11px] text-slate-400">
                        {{ file.type || 'Unknown type' }}<span v-if="file.size"> · {{ file.size }} bytes</span>
                      </div>
                    </div>
                    <span class="kyc-file-badge">{{ file.status }}</span>
                  </div>
                </div>
                <div v-else class="text-[12px] font-medium text-slate-400 mt-3">No attachments added yet.</div>
              </div>
            </a-form-item>
          </div>

          <div class="kyc-section-card">
            <a-form-item class="mb-0">
              <template #label>
                <span class="kyc-label-text">Supporting link or portal (optional)</span>
              </template>
              <a-textarea
                v-model:value="formState.documentLink"
                :maxlength="INPUT_LIMITS.url"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                show-count
                placeholder="Paste the URL if the corridor provides a web link or onboarding portal"
                class="kyc-link-textarea mt-2"
              />
            </a-form-item>
          </div>

          <div class="kyc-section-card">
            <a-form-item class="mb-0" required>
              <template #label>
                <div class="kyc-label-row">
                  <span class="kyc-required-mark" aria-hidden="true">*</span>
                  <span class="kyc-label-text">What Compliance should review</span>
                </div>
              </template>
              <a-textarea
                v-model:value="formState.notes"
                :maxlength="INPUT_LIMITS.note"
                :rows="4"
                show-count
                placeholder="List the materials, exceptions, or instructions Compliance should read before reviewing this track."
                class="kyc-textarea mt-2"
              />
            </a-form-item>
          </div>
        </a-form>
      </div>

      <div v-else class="kyc-history-view">
        <div class="max-w-2xl mx-auto py-5">
          <a-timeline v-if="historyEvents.length">
            <a-timeline-item v-for="event in historyEvents" :key="event.id" :color="event.revoked ? 'orange' : event.type === 'submission' ? 'blue' : 'green'">
              <div class="flex flex-col gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black"
                    :style="{
                      backgroundColor: getOnboardingStatusTheme(event.status).bg,
                      color: getOnboardingStatusTheme(event.status).text,
                      borderColor: getOnboardingStatusTheme(event.status).border,
                    }"
                  >
                    {{ getOnboardingStatusLabel('wooshpay', event.status) }}
                  </span>
                  <span
                    v-if="event.revoked"
                    class="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-orange-700"
                  >
                    Revoked
                  </span>
                </div>
                <div class="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                  <div class="space-y-2 text-[13px] text-slate-600 font-medium">
                    <div class="flex items-center gap-2">
                      <span class="text-slate-400">Time:</span>
                      <span class="text-slate-900 font-bold">{{ event.timestamp }}</span>
                    </div>
                    <div v-if="event.actor" class="flex items-center gap-2">
                      <span class="text-slate-400">By:</span>
                      <span class="text-slate-900 font-bold">{{ event.actor }}</span>
                    </div>
                    <div v-if="event.detail" class="flex items-start gap-2">
                      <span class="text-slate-400 shrink-0">Notes:</span>
                      <span class="text-slate-900 italic">"{{ event.detail }}"</span>
                    </div>
                    <div v-if="event.attachments.length" class="flex items-start gap-2">
                      <span class="text-slate-400 shrink-0">Attachments:</span>
                      <span class="flex min-w-0 flex-wrap gap-2">
                        <span
                          v-for="attachment in event.attachments"
                          :key="attachment.uid"
                          class="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
                        >
                          <span class="truncate">{{ attachment.name }}</span>
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  v-if="revocableAction && revocableAction.eventId === event.id"
                  class="flex justify-end"
                >
                  <a-button
                    class="h-[36px] rounded-xl border-orange-200 bg-orange-50 px-4 font-bold text-orange-700"
                    @click="emit('revoke')"
                  >
                    {{ revocableAction.label }}
                  </a-button>
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>
          <div v-else class="py-12 text-center">
            <div class="text-slate-200 text-6xl mb-4 italic font-black opacity-20 uppercase tracking-tighter">History</div>
            <p class="text-slate-400 font-medium">No WooshPay onboarding history yet.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="kyc-footer p-6 border-t border-slate-100/90 bg-white flex justify-end gap-3">
      <a-button @click="emit('close')" class="kyc-footer__secondary h-[44px] px-8 rounded-xl font-bold text-slate-500 border-slate-200">Close</a-button>
      <a-button type="primary" @click="handleSubmit" class="kyc-footer__primary h-[44px] px-8 rounded-xl font-bold bg-[#0284c7] border-none shadow-md">Send WooshPay Package</a-button>
    </div>
  </div>
</template>

<style scoped>
.kyc-workflow-panel {
  min-height: 0;
}

.kyc-tabs-shell {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(248, 251, 255, 0.88) 100%);
}

.fitrem-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.fitrem-tabs :deep(.ant-tabs-nav-wrap) {
  padding-top: 6px;
}

.fitrem-tabs :deep(.ant-tabs-tab) {
  padding: 14px 2px 16px;
  margin: 0 24px 0 0;
  font-weight: 700;
  font-size: 14px;
  color: #64748b;
}

.fitrem-tabs :deep(.ant-tabs-tab:hover) {
  color: #0f172a;
}

.fitrem-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #0284c7 !important;
}

.fitrem-tabs :deep(.ant-tabs-ink-bar) {
  background: #0284c7;
  height: 4px;
  border-radius: 999px 999px 0 0;
}

.kyc-panel-body {
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(248, 251, 255, 0.92) 0%, rgba(255, 255, 255, 0.96) 16%, #ffffff 100%);
}

.submission-stack {
  padding-block: 4px;
}

.kyc-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.kyc-hero-card,
.kyc-section-card {
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 45px -32px rgba(15, 23, 42, 0.35);
}

.kyc-hero-card {
  padding: 24px 22px;
  margin-bottom: 18px;
}

.kyc-section-card {
  padding: 20px 18px;
}

.kyc-status-pill {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.kyc-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kyc-required-mark {
  color: #ef4444;
  font-size: 14px;
  line-height: 1;
  font-weight: 900;
}

.kyc-label-text {
  display: block;
  color: #0f172a;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.kyc-entity-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.entity-option {
  margin: 0;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.96);
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.entity-option:hover {
  transform: translateY(-1px);
  border-color: #bae6fd;
  background: #f8fcff;
  box-shadow: 0 14px 24px -24px rgba(14, 165, 233, 0.55);
}

.entity-option--selected {
  border-color: #7dd3fc;
  background: linear-gradient(180deg, rgba(240, 249, 255, 0.98) 0%, rgba(248, 252, 255, 0.98) 100%);
  box-shadow: 0 18px 28px -24px rgba(14, 165, 233, 0.5);
}

.entity-option :deep(.ant-checkbox) {
  top: 0.15em;
}

.entity-option :deep(.ant-checkbox-inner) {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border-color: #cbd5e1;
}

.entity-option :deep(.ant-checkbox-checked .ant-checkbox-inner) {
  border-color: #1d9be7;
  background: #1d9be7;
}

.entity-option :deep(.ant-checkbox + span) {
  padding-inline-start: 12px;
}

.entity-option__text {
  display: block;
  color: #475569;
  font-size: 14px;
  line-height: 1.55;
  font-weight: 600;
}

.kyc-upload-dragger {
  margin-top: 14px;
  display: block;
  width: 100%;
}

.kyc-upload-dragger :deep(.ant-upload-wrapper) {
  display: block;
  width: 100%;
}

.kyc-upload-dragger :deep(.ant-upload-drag) {
  border-radius: 20px !important;
  border: 1px dashed #d7e4f1 !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.92) 100%) !important;
}

.kyc-upload-icon-shell {
  width: 64px;
  height: 64px;
}

.kyc-upload-icon-core {
  width: 40px;
  height: 40px;
}

.kyc-file-list {
  margin-top: 16px;
}

.kyc-file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px 14px;
  background: #f8fafc;
}

.kyc-file-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 10px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 11px;
  font-weight: 800;
  text-transform: capitalize;
}
</style>
