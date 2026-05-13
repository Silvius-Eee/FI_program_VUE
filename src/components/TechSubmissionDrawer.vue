<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import {
  CloseOutlined,
  InboxOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { createTechStepsData } from '../constants/initialData';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';

const props = defineProps<{
  open: boolean;
  channel: any;
}>();

const emit = defineEmits(['update:open', 'submit']);

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

const handleClose = () => {
  emit('update:open', false);
};

const handleSubmit = () => {
  if (showTextLimitWarning(message.warning, [
    { label: 'Technical Documentation', value: formState.techRawInfo, max: INPUT_LIMITS.techRawInfo },
  ])) return;

  message.success('Technical information synced successfully');
  emit('submit', { ...formState });
  emit('update:open', false);
};

watch(() => props.open, (newVal) => {
  if (newVal) {
    activeKey.value = 'action';
  }
});

</script>

<template>
  <a-drawer
    :open="open"
    @update:open="(val: boolean) => emit('update:open', val)"
    placement="right"
    :width="950"
    :closable="false"
    :body-style="{ padding: 0 }"
  >
    <div class="h-full flex flex-col bg-white">
      <!-- Custom Header -->
      <div class="px-6 py-5 border-b border-slate-50 flex items-center gap-4">
        <button @click="handleClose" class="text-slate-400 hover:text-slate-600 transition-colors">
          <close-outlined class="text-[18px]" />
        </button>
        <span class="text-[18px] font-black text-slate-900 tracking-[-0.01em]">Technical Integration Workspace</span>
      </div>

      <!-- Tabs -->
      <div class="px-6 border-b border-slate-50">
        <a-tabs v-model:activeKey="activeKey" class="fitrem-tabs">
          <a-tab-pane key="action" tab="Workspace" />
          <a-tab-pane key="history" tab="History & Approval Records" />
        </a-tabs>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div v-if="activeKey === 'action'">
          <div class="grid grid-cols-2 gap-12">
            <div>
              <h5 class="text-[15px] font-black text-sky-600 mb-6 tracking-tight">Submission Form</h5>
              <a-form layout="vertical">
                <a-form-item>
                  <template #label>
                    <div class="flex items-center gap-2">
                      <span class="text-[15px] font-black text-slate-900 tracking-[-0.01em]">Technical Documentation</span>
                      <a-tooltip placement="topLeft">
                        <template #title>
                          <span>Submit API links, sandbox credentials, webhook configuration, and related technical setup details.</span>
                        </template>
                        <info-circle-outlined class="cursor-help text-[14px] text-slate-400 transition-colors hover:text-sky-600" />
                      </a-tooltip>
                    </div>
                  </template>
                  <a-textarea 
                    v-model:value="formState.techRawInfo" 
                    :maxlength="INPUT_LIMITS.techRawInfo"
                    :rows="12" 
                    show-count
                    placeholder="Paste all technical emails, doc links, and credentials here..."
                    class="rounded-xl border-slate-200 mt-2" 
                  />
                </a-form-item>
                
                <a-form-item class="mt-8">
                  <template #label>
                    <span class="text-[15px] font-black text-slate-900 tracking-[-0.01em]">Attachment Archive (Optional)</span>
                  </template>
                  <a-upload-dragger class="bg-slate-50/50 border-dashed border-slate-200 rounded-2xl py-8 mt-2">
                    <p class="ant-upload-drag-icon">
                      <inbox-outlined class="text-sky-500 text-3xl" />
                    </p>
                    <p class="text-[14px] font-bold text-slate-800">Click or drag files here</p>
                  </a-upload-dragger>
                </a-form-item>
              </a-form>
            </div>

            <div class="border-l border-slate-100 pl-10">
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
        </div>

        <div v-else>
          <div class="max-w-2xl mx-auto py-4">
            <a-timeline v-if="channel.submissionHistory?.tech?.date">
              <a-timeline-item color="green">
                <template #dot><div class="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></div></template>
                <div class="flex flex-col gap-2">
                  <div class="text-[15px] font-black text-slate-800">{{ channel.submissionHistory.tech.date }}</div>
                  <div class="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                    <div class="space-y-2 text-[13px] text-slate-600 font-medium">
                      <div class="flex items-center gap-2">
                        <span class="text-slate-400">Submitted by:</span>
                        <span class="text-slate-900 font-bold">{{ channel.submissionHistory.tech.user || 'N/A' }}</span>
                      </div>
                      <div v-if="channel.submissionHistory.tech.notes" class="flex items-start gap-2">
                        <span class="text-slate-400 shrink-0">Remarks:</span>
                        <span class="text-slate-900 italic">"{{ channel.submissionHistory.tech.notes }}"</span>
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

      <!-- Footer -->
      <div class="p-6 border-t border-slate-50 bg-white flex justify-end gap-3">
        <a-button @click="handleClose" class="h-[44px] px-8 rounded-xl font-bold text-slate-500 border-slate-200">Close Workspace</a-button>
        <a-button type="primary" @click="handleSubmit" class="h-[44px] px-8 rounded-xl font-bold bg-[#0284c7] border-none shadow-md">Sync Information</a-button>
      </div>
    </div>
  </a-drawer>
</template>

<style scoped>
.fitrem-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.fitrem-tabs :deep(.ant-tabs-tab) {
  padding: 16px 4px;
  font-weight: 700;
  color: #64748b;
}

.fitrem-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #0284c7 !important;
}

.fitrem-tabs :deep(.ant-tabs-ink-bar) {
  background: #0284c7;
  height: 3px;
  border-radius: 3px 3px 0 0;
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
