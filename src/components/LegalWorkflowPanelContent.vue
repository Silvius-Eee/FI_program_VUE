<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { message } from 'ant-design-vue';

const props = defineProps<{
  channel: any;
  docType: string;
}>();

const emit = defineEmits(['submit', 'close']);

const activeKey = ref('submission');

const formState = reactive({
  entities: [] as string[],
  documentLink: '',
  remarks: '',
});

const onboardingEntityOptions = [
  'SwooshTransfer Ltd (UK) - SPI licensed',
  'Steelhenge Pte Ltd (Singapore)',
  'Steelhenge HongKong Group Limited (HK)',
  'Quantumtech Ltd (HK) - MSO licensed',
  'QuantumWing Limited (HK)',
];
const legalDocumentTitleMap: Record<string, string> = {
  NDA: 'Non-Disclosure Agreement',
  MSA: 'Master Services Agreement',
};
const legalDocumentTitle = computed(() => (
  legalDocumentTitleMap[props.docType] || props.docType
));
const isNdaDocument = computed(() => props.docType === 'NDA');
const legalFormCopy = computed(() => {
  if (isNdaDocument.value) {
    return {
      entityLabel: 'Select Contracting Entities (Wooshpay Side)',
      uploadLabel: 'NDA Document Upload',
      uploadHint: 'Click or drag NDA here',
      linkLabel: 'NDA Document Link',
      linkPlaceholder: 'Paste the URL if the corridor provides a web link for NDA or a signing link',
      remarksLabel: 'Additional Notes',
      remarksPlaceholder: 'Any additional notes that need to be aligned with legal team',
    };
  }

  return {
    entityLabel: 'Select Contracting Entities (Wooshpay Side)',
    uploadLabel: 'MSA Document Upload',
    uploadHint: 'click or drag MSA here',
    linkLabel: 'MSA Document Link',
    linkPlaceholder: 'Paste the URL if the corridor provides a web link for MSA or a signing link',
    remarksLabel: 'Additional Notes',
    remarksPlaceholder: 'Any additional notes that need to be aligned with legal team',
  };
});

const handleSubmit = () => {
  if (formState.entities.length === 0) {
    message.warning('Please select at least one contracting entity.');
    return;
  }
  if (!formState.remarks.trim()) {
    message.warning('Please provide context or remarks for the reviewers.');
    return;
  }
  message.success(`${legalDocumentTitle.value} request sent to Legal Department`);
  emit('submit', { ...formState, docType: props.docType });
};
</script>

<template>
  <div :class="['legal-workflow-panel h-full flex flex-col bg-white', { 'legal-form--nda': isNdaDocument }]">
    <div class="legal-tabs-shell px-6 border-b border-slate-100/90">
      <a-tabs v-model:activeKey="activeKey" class="fitrem-tabs">
        <a-tab-pane key="submission" tab="Submission" />
        <a-tab-pane key="history" tab="History & Approval" />
      </a-tabs>
    </div>

    <div class="legal-panel-body flex-1 overflow-y-auto p-6 custom-scrollbar">
      <div v-if="activeKey === 'submission'" class="submission-stack">
        <a-form layout="vertical" :required-mark="false" class="legal-form-shell">
          <div class="legal-form-section legal-form-section--entities">
            <a-form-item required class="mb-0">
              <template #label>
                <div class="legal-label-row">
                  <span class="legal-required-mark" aria-hidden="true">*</span>
                  <span class="legal-label-text">{{ legalFormCopy.entityLabel }}</span>
                </div>
              </template>
              <a-checkbox-group v-model:value="formState.entities" class="w-full">
                <div class="legal-entity-group">
                  <a-checkbox
                    v-for="opt in onboardingEntityOptions"
                    :key="opt"
                    :value="opt"
                    :class="['entity-option-row', { 'entity-option-row--selected': formState.entities.includes(opt) }]"
                  >
                    <span class="entity-option-text">{{ opt }}</span>
                  </a-checkbox>
                </div>
              </a-checkbox-group>
            </a-form-item>
          </div>

          <div class="legal-form-section legal-form-section--upload">
            <a-form-item class="mb-0">
              <template #label>
                <span class="legal-label-text">{{ legalFormCopy.uploadLabel }}</span>
              </template>
              <a-upload-dragger class="legal-upload-dragger">
                <div class="ant-upload-drag-icon">
                  <div class="legal-upload-icon-shell">
                    <div class="legal-upload-icon-core">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 16L12 8M12 8L9 11M12 8L15 11" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8 16H16" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <p class="legal-upload-hint">{{ legalFormCopy.uploadHint }}</p>
              </a-upload-dragger>
            </a-form-item>
          </div>

          <div class="legal-form-section">
            <a-form-item class="mb-0">
              <template #label>
                <span class="legal-label-text">{{ legalFormCopy.linkLabel }}</span>
              </template>
              <a-textarea
                v-model:value="formState.documentLink"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                :placeholder="legalFormCopy.linkPlaceholder"
                class="legal-link-textarea"
              />
            </a-form-item>
          </div>

          <div class="legal-form-section legal-form-section--last">
            <a-form-item required class="mb-0">
              <template #label>
                <div class="legal-label-row">
                  <span class="legal-required-mark" aria-hidden="true">*</span>
                  <span class="legal-label-text">{{ legalFormCopy.remarksLabel }}</span>
                </div>
              </template>
              <a-textarea
                v-model:value="formState.remarks"
                :rows="4"
                :placeholder="legalFormCopy.remarksPlaceholder"
                class="legal-textarea"
              />
            </a-form-item>
          </div>
        </a-form>
      </div>

      <div v-else>
        <div class="max-w-2xl mx-auto py-4">
          <div v-if="props.channel.submissionHistory?.[props.docType.toLowerCase()]?.date">
            <a-timeline>
              <a-timeline-item color="green">
                <template #dot><div class="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></div></template>
                <div class="flex flex-col gap-2">
                  <div class="text-[15px] font-black text-slate-800">{{ props.channel.submissionHistory[props.docType.toLowerCase()].date }}</div>
                  <div class="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                    <div class="space-y-2 text-[13px] text-slate-600 font-medium">
                      <div class="flex items-center gap-2">
                        <span class="text-slate-400">Submitted by:</span>
                        <span class="text-slate-900 font-bold">{{ props.channel.submissionHistory[props.docType.toLowerCase()].user || 'N/A' }}</span>
                      </div>
                      <div v-if="props.channel.submissionHistory[props.docType.toLowerCase()].notes" class="flex items-start gap-2">
                        <span class="text-slate-400 shrink-0">Remarks:</span>
                        <span class="text-slate-900 italic">"{{ props.channel.submissionHistory[props.docType.toLowerCase()].notes }}"</span>
                      </div>
                    </div>
                  </div>
                </div>
              </a-timeline-item>
            </a-timeline>
          </div>
          <div v-else class="py-12 text-center">
            <div class="text-slate-200 text-6xl mb-4 italic font-black opacity-20 uppercase tracking-tighter">History</div>
            <p class="text-slate-400 font-medium">No submission history yet for {{ legalDocumentTitle }}.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="legal-footer p-6 border-t border-slate-100/90 bg-white flex gap-3">
      <a-button @click="emit('close')" class="legal-footer__secondary px-6 rounded-xl font-bold text-slate-500 border-slate-200">Close</a-button>
      <a-button type="primary" @click="handleSubmit" class="legal-footer__primary px-6 rounded-xl font-bold border-none">Send {{ legalDocumentTitle }} Request</a-button>
    </div>
  </div>
</template>

<style scoped>
.legal-workflow-panel {
  min-height: 0;
}

.legal-tabs-shell {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(248, 251, 255, 0.88) 100%);
}

.legal-panel-body {
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(248, 251, 255, 0.92) 0%, rgba(255, 255, 255, 0.96) 16%, #ffffff 100%);
}

.submission-stack {
  padding-block: 4px;
}

.legal-form-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.legal-form-section {
  padding: 20px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.92) 100%);
  box-shadow: 0 16px 36px -30px rgba(15, 23, 42, 0.28);
}

.legal-form-section--entities {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.92) 100%);
}

.legal-form-section--upload {
  background:
    linear-gradient(180deg, rgba(250, 252, 255, 0.98) 0%, rgba(245, 249, 255, 0.94) 100%);
}

.legal-form-section--last {
  margin-bottom: 0;
}

.legal-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legal-required-mark {
  margin-top: 0;
  color: #ef4444;
  font-size: 14px;
  line-height: 1;
  font-weight: 900;
  flex-shrink: 0;
}

.legal-label-text {
  display: block;
  color: #0f172a;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.legal-entity-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.entity-option-row {
  margin: 0;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.entity-option-row:hover {
  border-color: #bfdbfe;
  background: #f8fbff;
  box-shadow: 0 14px 24px -24px rgba(37, 99, 235, 0.35);
  transform: translateY(-1px);
}

.entity-option-row--selected {
  border-color: #93c5fd;
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.98) 0%, rgba(248, 252, 255, 0.98) 100%);
  box-shadow: 0 18px 28px -24px rgba(37, 99, 235, 0.26);
}

.entity-option-text {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  line-height: 1.55;
}

.legal-upload-dragger {
  margin-top: 14px;
  display: block;
  width: 100%;
}

.legal-upload-dragger :deep(.ant-upload-wrapper) {
  display: block;
  width: 100%;
}

.legal-upload-dragger :deep(.ant-upload-drag) {
  border-radius: 20px !important;
  border: 1px dashed #d7e4f1 !important;
  background: linear-gradient(180deg, rgba(250, 252, 255, 0.98) 0%, rgba(245, 249, 255, 0.94) 100%) !important;
  padding: 28px 20px !important;
  overflow: hidden;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.legal-upload-dragger :deep(.ant-upload-drag:hover) {
  border-color: #93c5fd !important;
  background: linear-gradient(180deg, rgba(248, 252, 255, 1) 0%, rgba(239, 246, 255, 0.96) 100%) !important;
  box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.22);
}

.legal-upload-icon-shell {
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

.legal-upload-icon-core {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%);
}

.legal-upload-hint {
  max-width: 300px;
  margin-inline: auto;
  margin-bottom: 0;
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.55;
}

.legal-form-shell :deep(.ant-input),
.legal-form-shell :deep(.ant-input-affix-wrapper),
.legal-link-textarea :deep(textarea),
.legal-textarea :deep(textarea) {
  border-color: #dbe7f3;
  background: #ffffff;
  border-radius: 16px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.legal-link-textarea :deep(textarea) {
  min-height: 64px;
  margin-top: 14px;
  padding: 12px 16px;
  line-height: 1.55;
  resize: none;
}

.legal-textarea :deep(textarea) {
  min-height: 132px;
  margin-top: 14px;
  padding: 14px 16px;
  line-height: 1.65;
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
  color: #2563eb !important;
}

.fitrem-tabs :deep(.ant-tabs-ink-bar) {
  background: #2563eb;
  height: 4px;
  border-radius: 999px 999px 0 0;
}

.entity-option-row :deep(.ant-checkbox) {
  top: 0.15em;
}

.entity-option-row :deep(.ant-checkbox-inner) {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border-color: #cbd5e1;
}

.entity-option-row :deep(.ant-checkbox + span) {
  padding-inline-start: 12px;
}

.entity-option-row :deep(.ant-checkbox-checked .ant-checkbox-inner) {
  border-color: #2563eb;
  background: #2563eb;
}

.legal-upload-dragger :deep(.ant-upload),
.legal-upload-dragger :deep(.ant-upload-btn) {
  padding: 0;
}

.legal-form-shell :deep(.ant-input::placeholder),
.legal-link-textarea :deep(textarea::placeholder),
.legal-textarea :deep(textarea::placeholder) {
  color: #94a3b8;
}

.legal-form-shell :deep(.ant-input:hover),
.legal-link-textarea :deep(textarea:hover),
.legal-textarea :deep(textarea:hover) {
  border-color: #bfdbfe;
}

.legal-form-shell :deep(.ant-input:focus),
.legal-form-shell :deep(.ant-input-focused),
.legal-link-textarea :deep(textarea:focus),
.legal-textarea :deep(textarea:focus) {
  border-color: #60a5fa;
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.12);
}

.legal-footer {
  align-items: center;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, #ffffff 100%);
}

.legal-footer__secondary,
.legal-footer__primary {
  height: 48px !important;
  border-radius: 16px !important;
  font-weight: 700;
}

.legal-footer__secondary {
  min-width: 104px;
  flex: 0 0 auto;
  background: rgba(255, 255, 255, 0.92);
}

.legal-footer__primary {
  flex: 1 1 auto;
  min-width: 0;
  height: auto !important;
  min-height: 48px;
  padding-top: 10px !important;
  padding-bottom: 10px !important;
  background: linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%) !important;
  box-shadow: 0 18px 32px -18px rgba(2, 132, 199, 0.56) !important;
}

.legal-footer__primary:hover {
  background: linear-gradient(180deg, #2db2f4 0%, #1695e0 100%) !important;
}

.legal-footer__primary :deep(.ant-btn-icon),
.legal-footer__primary :deep(span),
.legal-footer__secondary :deep(span) {
  white-space: normal;
  line-height: 1.2;
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
