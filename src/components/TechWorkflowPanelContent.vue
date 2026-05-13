<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { InboxOutlined, InfoCircleOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { createTechStepsData } from '../constants/initialData';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';

const props = defineProps<{
  channel: any;
}>();

const emit = defineEmits(['submit', 'close']);

const activeKey = ref('action');

const formState = reactive({
  techRawInfo: '',
});

const canonicalTechSteps = createTechStepsData('notStarted');
const techStepsData = computed(() => {
  const channelSteps = Array.isArray(props.channel?.techStepsData) ? props.channel.techStepsData : [];

  return canonicalTechSteps.map((step, index) => ({
    title: step.title,
    status: channelSteps[index]?.status || step.status,
  }));
});

const handleSubmit = () => {
  if (showTextLimitWarning(message.warning, [
    { label: 'Technical Documentation', value: formState.techRawInfo, max: INPUT_LIMITS.techRawInfo },
  ])) return;

  message.success('Technical information synced successfully');
  emit('submit', { ...formState });
};
</script>

<template>
  <div class="tech-workflow-panel h-full flex flex-col bg-transparent">
    <div class="tech-tabs-shell px-6 border-b border-slate-100/90">
      <a-tabs v-model:activeKey="activeKey" class="fitrem-tabs">
        <a-tab-pane key="action" tab="Workspace" />
        <a-tab-pane key="history" tab="History & Approval Records" />
      </a-tabs>
    </div>

    <div class="tech-panel-body flex-1 overflow-y-auto p-6 custom-scrollbar">
      <div v-if="activeKey === 'action'" class="submission-stack">
        <div>
          <h5 class="text-[15px] font-black text-sky-600 mb-6 tracking-tight">Submission Form</h5>
          <a-form layout="vertical" :required-mark="false" class="tech-form">
            <div class="tech-section-card">
              <a-form-item class="mb-0">
                <template #label>
                  <div class="tech-label-row">
                    <span class="tech-label-text">Technical Documentation</span>
                    <a-tooltip placement="topLeft">
                      <template #title>
                        <span>Submit API links, sandbox credentials, webhook configuration, and related technical setup details.</span>
                      </template>
                      <info-circle-outlined class="tech-label-icon" />
                    </a-tooltip>
                  </div>
                </template>
                <a-textarea
                  v-model:value="formState.techRawInfo"
                  :maxlength="INPUT_LIMITS.techRawInfo"
                  :rows="10"
                  show-count
                  placeholder="Paste all technical emails, doc links, and credentials here..."
                  class="tech-textarea mt-2"
                />
              </a-form-item>
            </div>

            <div class="tech-section-card tech-section-card--upload">
              <a-form-item class="mb-0">
                <template #label>
                  <span class="tech-label-text">Attachment Archive (Optional)</span>
                </template>
                <a-upload-dragger class="tech-upload-dragger mt-2">
                  <div class="ant-upload-drag-icon">
                    <div class="tech-upload-icon-shell">
                      <div class="tech-upload-icon-core">
                        <inbox-outlined class="text-white text-[18px]" />
                      </div>
                    </div>
                  </div>
                  <p class="tech-upload-copy">Click or drag files here</p>
                </a-upload-dragger>
              </a-form-item>
            </div>
          </a-form>
        </div>

        <div class="tech-section-card tech-section-card--pipeline">
          <h5 class="text-[15px] font-black text-slate-500 mb-6 tracking-tight">Real-time Integration Pipeline</h5>
          <a-steps direction="vertical" size="small" :current="1">
            <a-step v-for="step in techStepsData" :key="step.title" :title="step.title" :status="step.status">
              <template #description>
                <div :class="step.status === 'process' ? 'bg-sky-50 p-2 rounded-lg mt-1' : 'p-2 mt-1'">
                  <span class="text-[12px] text-slate-500 font-medium">
                    {{ step.status === 'finish' ? 'Phase Completed' : (step.status === 'process' ? 'Currently in Development' : 'Scheduled') }}
                  </span>
                </div>
              </template>
            </a-step>
          </a-steps>
        </div>
      </div>

      <div v-else>
        <div class="max-w-2xl mx-auto py-4">
          <a-timeline v-if="props.channel.submissionHistory?.tech?.date">
            <a-timeline-item color="green">
              <template #dot><div class="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></div></template>
              <div class="flex flex-col gap-2">
                <div class="text-[15px] font-black text-slate-800">{{ props.channel.submissionHistory.tech.date }}</div>
                <div class="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                  <div class="space-y-2 text-[13px] text-slate-600 font-medium">
                    <div class="flex items-center gap-2">
                      <span class="text-slate-400">Submitted by:</span>
                      <span class="text-slate-900 font-bold">{{ props.channel.submissionHistory.tech.user || 'N/A' }}</span>
                    </div>
                    <div v-if="props.channel.submissionHistory.tech.notes" class="flex items-start gap-2">
                      <span class="text-slate-400 shrink-0">Remarks:</span>
                      <span class="text-slate-900 italic">"{{ props.channel.submissionHistory.tech.notes }}"</span>
                    </div>
                  </div>
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>
          <div v-else class="py-12 text-center">
            <div class="text-slate-200 text-6xl mb-4 italic font-black opacity-20 uppercase tracking-tighter">History</div>
            <p class="text-slate-400 font-medium">No technical integration history records yet.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
      <a-button @click="emit('close')" class="h-[44px] px-8 rounded-xl font-bold text-slate-500 border-slate-200">Close</a-button>
      <a-button type="primary" @click="handleSubmit" class="h-[44px] px-8 rounded-xl font-bold bg-[#0284c7] border-none shadow-md">Sync Information</a-button>
    </div>
  </div>
</template>

<style scoped>
.tech-workflow-panel {
  min-height: 0;
}

.tech-tabs-shell {
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

.tech-panel-body {
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(248, 251, 255, 0.92) 0%, rgba(255, 255, 255, 0.96) 16%, #ffffff 100%);
}

.submission-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-block: 4px;
}

.tech-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.tech-section-card {
  padding: 20px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.92) 100%);
  box-shadow: 0 16px 36px -30px rgba(15, 23, 42, 0.28);
}

.tech-section-card--upload {
  background: linear-gradient(180deg, rgba(250, 252, 255, 0.98) 0%, rgba(245, 249, 255, 0.94) 100%);
}

.tech-section-card--pipeline {
  padding: 24px 22px;
}

.tech-label-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tech-label-text {
  display: block;
  color: #0f172a;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 900;
  letter-spacing: -0.01em;
  margin: 0;
}

.tech-label-icon {
  color: #94a3b8;
  font-size: 14px;
  cursor: help;
  transition: color 0.2s ease;
}

.tech-label-icon:hover {
  color: #0284c7;
}

.tech-upload-dragger {
  margin-top: 14px;
  display: block;
  width: 100%;
}

.tech-upload-dragger :deep(.ant-upload-wrapper) {
  display: block;
  width: 100%;
}

.tech-upload-dragger :deep(.ant-upload-drag) {
  border-radius: 20px !important;
  border: 1px dashed #d7e4f1 !important;
  background: linear-gradient(180deg, rgba(250, 252, 255, 0.98) 0%, rgba(245, 249, 255, 0.94) 100%) !important;
  padding: 28px 20px !important;
  overflow: hidden;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.tech-upload-dragger :deep(.ant-upload-drag:hover) {
  border-color: #7dd3fc !important;
  background: linear-gradient(180deg, rgba(248, 252, 255, 1) 0%, rgba(240, 249, 255, 0.96) 100%) !important;
  box-shadow: inset 0 0 0 1px rgba(125, 211, 252, 0.24);
}

.tech-upload-dragger :deep(.ant-upload) {
  padding: 0;
}

.tech-upload-dragger :deep(.ant-upload-btn) {
  padding: 0 !important;
}

.tech-upload-icon-shell {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 28px -26px rgba(15, 23, 42, 0.3);
}

.tech-upload-icon-core {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%);
}

.tech-upload-copy {
  margin: 0;
  max-width: 300px;
  margin-inline: auto;
  line-height: 1.55;
  color: #1e293b;
  font-size: 15px;
  font-weight: 700;
}

.tech-form :deep(.ant-form-item-label > label) {
  height: auto;
  align-items: flex-start;
}

.tech-form :deep(.ant-input),
.tech-form :deep(.ant-input-affix-wrapper),
.tech-form :deep(.ant-input-textarea textarea) {
  border-color: #dbe3ee;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: none;
}

.tech-form :deep(.ant-input:hover),
.tech-form :deep(.ant-input-affix-wrapper:hover),
.tech-form :deep(.ant-input-textarea textarea:hover) {
  border-color: #93c5fd;
}

.tech-form :deep(.ant-input:focus),
.tech-form :deep(.ant-input-affix-wrapper-focused),
.tech-form :deep(.ant-input-textarea textarea:focus) {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.12);
}

.tech-form :deep(.ant-input-textarea textarea) {
  min-height: 220px;
  padding: 14px 16px;
  line-height: 1.6;
  resize: vertical;
}

.tech-section-card--pipeline :deep(.ant-steps-item-title) {
  font-weight: 800;
  color: #0f172a;
}

.tech-section-card--pipeline :deep(.ant-steps-item-description) {
  max-width: none;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
</style>
