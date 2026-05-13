<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import {
  CloseOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';

const props = defineProps<{
  open: boolean;
  channel: any;
}>();

const emit = defineEmits(['update:open', 'submit']);

const activeKey = ref('action');

const formState = reactive({
  entities: [] as string[],
  remarks: '',
});

const onboardingEntityOptions = [
  'SwooshTransfer Ltd (UK) - SPI licensed',
  'Steelhenge Pte Ltd (Singapore)',
  'Steelhenge HongKong Group Limited (HK)',
  'Quantumtech Ltd (HK) - MSO licensed',
  'QuantumWing Limited (HK)',
];

const handleClose = () => {
  emit('update:open', false);
};

const handleSubmit = () => {
  if (formState.entities.length === 0) {
    message.warning('Please select at least one contracting entity.');
    return;
  }
  if (showTextLimitWarning(message.warning, [
    { label: 'Audit Trail / Remarks', value: formState.remarks, max: INPUT_LIMITS.note },
  ])) return;

  message.success('Pricing schedule saved and updated');
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
    :width="640"
    :closable="false"
    :body-style="{ padding: 0 }"
  >
    <div class="h-full flex flex-col bg-white">
      <!-- Custom Header -->
      <div class="px-6 py-5 border-b border-slate-50 flex items-center gap-4">
        <button @click="handleClose" class="text-slate-400 hover:text-slate-600 transition-colors">
          <close-outlined class="text-[18px]" />
        </button>
        <span class="text-[18px] font-black text-slate-900 uppercase tracking-tight">Pricing Schedule</span>
      </div>

      <!-- Tabs -->
      <div class="px-6 border-b border-slate-50">
        <a-tabs v-model:activeKey="activeKey" class="fitrem-tabs">
          <a-tab-pane key="action" tab="Schedule Form" />
          <a-tab-pane key="history" tab="History & Approval" />
        </a-tabs>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div v-if="activeKey === 'action'">
          <a-form layout="vertical">
            <a-form-item required>
              <template #label>
                <span class="text-[13px] font-bold text-slate-800 uppercase tracking-wider">
                  <span class="text-red-500 mr-1">*</span>Select Contracting Entities (Our Side)
                </span>
              </template>
              <a-checkbox-group v-model:value="formState.entities" class="w-full">
                <div class="flex flex-col gap-3 mt-2">
                  <a-checkbox v-for="opt in onboardingEntityOptions" :key="opt" :value="opt">
                    <span class="text-[14px] text-slate-600 font-medium">{{ opt }}</span>
                  </a-checkbox>
                </div>
              </a-checkbox-group>
            </a-form-item>

            <a-form-item class="mt-8">
              <template #label>
                <span class="text-[13px] font-bold text-slate-800 uppercase tracking-wider">Pricing Schedule Document Upload</span>
              </template>
              <a-upload-dragger class="bg-slate-50/50 border-dashed border-slate-200 rounded-2xl py-10 mt-2">
                <div class="ant-upload-drag-icon">
                  <div class="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
                    <div class="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 16L12 8M12 8L9 11M12 8L15 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8 16H16" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <p class="text-[15px] font-bold text-slate-800 mb-1">Click or drag pricing schedule PDF here</p>
              </a-upload-dragger>
            </a-form-item>

            <a-form-item class="mt-8 mb-0">
              <template #label>
                <span class="text-[13px] font-bold text-slate-800 uppercase tracking-wider">Audit Trail / Remarks</span>
              </template>
              <a-textarea 
                v-model:value="formState.remarks" 
                :maxlength="INPUT_LIMITS.note"
                :rows="4" 
                show-count
                placeholder="E.g., Corridor provided a customized pricing schedule for HK market..."
                class="rounded-xl border-slate-200 mt-2" 
              />
            </a-form-item>
          </a-form>
        </div>

        <div v-else>
          <div class="max-w-2xl mx-auto py-4">
            <a-timeline v-if="channel.submissionHistory?.pricing?.date">
              <a-timeline-item color="green">
                <template #dot><div class="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></div></template>
                <div class="flex flex-col gap-2">
                  <div class="text-[15px] font-black text-slate-800">{{ channel.submissionHistory.pricing.date }}</div>
                  <div class="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                    <div class="space-y-2 text-[13px] text-slate-600 font-medium">
                      <div class="flex items-center gap-2">
                        <span class="text-slate-400">Submitted by:</span>
                        <span class="text-slate-900 font-bold">{{ channel.submissionHistory.pricing.user || 'N/A' }}</span>
                      </div>
                      <div v-if="channel.submissionHistory.pricing.notes" class="flex items-start gap-2">
                        <span class="text-slate-400 shrink-0">Remarks:</span>
                        <span class="text-slate-900 italic">"{{ channel.submissionHistory.pricing.notes }}"</span>
                      </div>
                    </div>
                  </div>
                </div>
              </a-timeline-item>
            </a-timeline>
            <div v-else class="py-12 text-center">
              <div class="text-slate-200 text-6xl mb-4 italic font-black opacity-20 uppercase tracking-tighter">History</div>
              <p class="text-slate-400 font-medium">No pricing schedule submission history yet.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-slate-50 bg-white flex justify-end gap-3">
        <a-button @click="handleClose" class="h-[44px] px-8 rounded-xl font-bold text-slate-500 border-slate-200">Cancel</a-button>
        <a-button type="primary" @click="handleSubmit" class="h-[44px] px-8 rounded-xl font-bold bg-[#0284c7] border-none shadow-md">Save & Update</a-button>
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
