<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  getChannelOnboardingWorkflow,
  getOnboardingStatusLabel,
  getOnboardingStatusTheme,
  hasOnboardingSubmission,
} from '../constants/onboarding';

const props = defineProps<{
  channel: any;
}>();

const emit = defineEmits(['submit', 'close']);

const activeKey = ref('submission');
const fileList = ref<any[]>([]);

const formState = reactive({
  documentLink: '',
  notes: '',
});

const workflow = computed(() => getChannelOnboardingWorkflow(props.channel, 'corridor'));
const statusLabel = computed(() => getOnboardingStatusLabel('corridor', workflow.value.status));
const statusTheme = computed(() => getOnboardingStatusTheme(workflow.value.status));

const formatMultiValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (Array.isArray(item)) {
          return item.map((part) => String(part || '').trim()).filter(Boolean).join(' / ');
        }
        return String(item || '').trim();
      })
      .filter(Boolean)
      .join(', ');
  }

  return String(value || '').trim();
};

const cooperationSummary = computed(() => (
  formatMultiValue(props.channel.cooperationModel) || 'Not provided'
));
const productSummary = computed(() => (
  formatMultiValue(props.channel.supportedProducts) || 'Not provided'
));
const merchantGeoSummary = computed(() => (
  formatMultiValue(props.channel.merchantGeoAllowed || props.channel.merchantGeo) || 'Not provided'
));
const corridorOverview = computed(() => ([
  { label: 'Corridor Name', value: props.channel.channelName || 'Not provided' },
  { label: 'Company Name', value: props.channel.companyName || 'Not provided' },
  { label: 'Registration Country', value: props.channel.registrationGeo || 'Not provided' },
  { label: 'Cooperation Model', value: cooperationSummary.value },
  { label: 'Supported Products', value: productSummary.value },
  { label: 'Merchant Geo Allowed', value: merchantGeoSummary.value },
]));

const syncFormState = () => {
  const submission = workflow.value.submission;
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
  const events = workflow.value.statusHistory.map((entry) => ({
    id: entry.id,
    type: 'status',
    title: `Status updated to ${getOnboardingStatusLabel('corridor', entry.status)}`,
    timestamp: entry.updatedAt,
    actor: entry.updatedBy,
    detail: entry.remark,
  }));

  if (hasOnboardingSubmission(workflow.value.submission)) {
    events.push({
      id: 'submission',
      type: 'submission',
      title: 'Package submitted to Compliance',
      timestamp: workflow.value.submission.submittedAt,
      actor: workflow.value.submission.submittedBy,
      detail: workflow.value.submission.notes,
    });
  }

  return events
    .filter((event) => event.timestamp)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
});

const handleSubmit = () => {
  message.success('Corridor onboarding package submitted successfully');
  emit('submit', {
    documentLink: formState.documentLink,
    notes: formState.notes,
    attachments: serializedAttachments.value,
  });
};
</script>

<template>
  <div class="cdd-workflow-panel h-full flex flex-col bg-transparent">
    <div class="cdd-tabs-shell px-6 border-b border-slate-100/90">
      <a-tabs v-model:activeKey="activeKey" class="fitrem-tabs">
        <a-tab-pane key="submission" tab="Submission" />
        <a-tab-pane key="history" tab="History & Approval" />
      </a-tabs>
    </div>

    <div class="cdd-panel-body flex-1 overflow-y-auto p-6 custom-scrollbar">
      <div v-if="activeKey === 'submission'" class="cdd-submission-stack">
        <div class="cdd-hero-card">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-[12px] font-bold text-slate-400 tracking-[0.18em] uppercase">Corridor onboarding</div>
              <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-900 leading-tight">{{ props.channel.channelName || 'Unnamed Corridor' }}</h3>
              <p class="mt-2 mb-0 text-[13px] text-slate-500 font-medium leading-relaxed">Submit the corridor-provided documents and review package for Compliance tracking.</p>
            </div>
            <span class="cdd-status-pill" :style="{ background: statusTheme.bg, color: statusTheme.text, borderColor: statusTheme.border }">{{ statusLabel }}</span>
          </div>
        </div>

        <div class="cdd-section-card">
          <div class="cdd-section-title">Corridor Profile Snapshot</div>
          <div class="cdd-overview-grid">
            <div v-for="item in corridorOverview" :key="item.label" class="cdd-overview-item">
              <div class="cdd-overview-label">{{ item.label }}</div>
              <div class="cdd-overview-value">{{ item.value }}</div>
            </div>
          </div>
        </div>

        <div class="cdd-section-card">
          <a-form layout="vertical" :required-mark="false" class="cdd-form">
            <a-form-item class="mb-0">
              <template #label>
                <span class="cdd-label-text">Corridor Package Attachments</span>
              </template>
              <a-upload-dragger
                class="cdd-upload-dragger mt-2"
                multiple
                :before-upload="preventUpload"
                :file-list="fileList"
                :show-upload-list="false"
                @change="handleUploadChange"
              >
                <p class="text-[15px] font-bold text-slate-800 mb-1">Upload corridor licenses, certificates, screening results, or related files.</p>
                <p class="text-[12px] font-medium text-slate-400 mb-0">Files are stored as metadata in local state for this prototype.</p>
              </a-upload-dragger>
              <div class="cdd-file-list">
                <div v-if="serializedAttachments.length" class="space-y-3">
                  <div v-for="file in serializedAttachments" :key="file.uid" class="cdd-file-row">
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-[13px] font-bold text-slate-800">{{ file.name }}</div>
                      <div class="text-[11px] text-slate-400">
                        {{ file.type || 'Unknown type' }}<span v-if="file.size"> · {{ file.size }} bytes</span>
                      </div>
                    </div>
                    <span class="cdd-file-badge">{{ file.status }}</span>
                  </div>
                </div>
                <div v-else class="text-[12px] font-medium text-slate-400 mt-3">No attachments added yet.</div>
              </div>
            </a-form-item>
          </a-form>
        </div>

        <div class="cdd-section-card">
          <div class="cdd-section-title">Reference Link</div>
          <a-textarea
            v-model:value="formState.documentLink"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            placeholder="Paste the corridor's document link or onboarding portal if available"
            class="cdd-textarea mt-3"
          />
        </div>

        <div class="cdd-section-card">
          <a-form layout="vertical" :required-mark="false" class="cdd-form">
            <a-form-item class="mb-0">
              <template #label>
                <span class="cdd-label-text">Internal Review Notes</span>
              </template>
              <a-textarea
                v-model:value="formState.notes"
                :rows="5"
                placeholder="Summarize key review findings, outstanding questions, or next steps..."
                class="cdd-textarea mt-2"
              />
            </a-form-item>
          </a-form>
        </div>
      </div>

      <div v-else class="cdd-history-view">
        <div class="max-w-2xl mx-auto py-5">
          <a-timeline v-if="historyEvents.length">
            <a-timeline-item v-for="event in historyEvents" :key="event.id" :color="event.type === 'submission' ? 'blue' : 'green'">
              <div class="flex flex-col gap-2">
                <div class="text-[15px] font-black text-slate-800">{{ event.title }}</div>
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
                  </div>
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>
          <div v-else class="py-12 text-center">
            <div class="text-slate-200 text-6xl mb-4 italic font-black opacity-20 uppercase tracking-tighter">History</div>
            <p class="text-slate-400 font-medium">No Corridor onboarding history yet.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="cdd-footer p-6 border-t border-slate-100/90 bg-white flex justify-end gap-3">
      <a-button @click="emit('close')" class="cdd-footer__secondary h-[44px] px-8 rounded-xl font-bold text-slate-500 border-slate-200">Close</a-button>
      <a-button type="primary" @click="handleSubmit" class="cdd-footer__primary h-[44px] px-8 rounded-xl font-bold bg-[#0284c7] border-none shadow-md">Send Corridor Package</a-button>
    </div>
  </div>
</template>

<style scoped>
.cdd-workflow-panel {
  min-height: 0;
}

.cdd-tabs-shell {
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

.fitrem-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #0284c7 !important;
}

.fitrem-tabs :deep(.ant-tabs-ink-bar) {
  background: #0284c7;
  height: 4px;
  border-radius: 999px 999px 0 0;
}

.cdd-panel-body {
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(248, 251, 255, 0.92) 0%, rgba(255, 255, 255, 0.96) 16%, #ffffff 100%);
}

.cdd-submission-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-block: 4px;
}

.cdd-hero-card,
.cdd-section-card {
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 45px -32px rgba(15, 23, 42, 0.35);
}

.cdd-hero-card {
  padding: 24px 22px;
}

.cdd-section-card {
  padding: 20px 18px;
}

.cdd-status-pill {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.cdd-section-title,
.cdd-label-text {
  font-size: 15px;
  font-weight: 900;
  color: #0f172a;
}

.cdd-overview-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 14px;
}

.cdd-overview-item {
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 14px 16px;
}

.cdd-overview-label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cdd-overview-value {
  margin-top: 6px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.cdd-upload-dragger :deep(.ant-upload-drag) {
  border-radius: 20px !important;
  border: 1px dashed #d7e4f1 !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.92) 100%) !important;
}

.cdd-file-list {
  margin-top: 16px;
}

.cdd-file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px 14px;
  background: #f8fafc;
}

.cdd-file-badge {
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
