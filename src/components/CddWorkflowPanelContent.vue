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

const formState = reactive({
  contactName: '',
  contactMethod: '',
  contactValue: '',
  handoffNote: '',
});

const workflow = computed(() => getChannelOnboardingWorkflow(props.channel, 'corridor'));
const statusLabel = computed(() => getOnboardingStatusLabel('corridor', workflow.value.status));
const statusTheme = computed(() => getOnboardingStatusTheme(workflow.value.status));

const syncFormState = () => {
  const submission = workflow.value.submission;
  const shouldPrefillProfileContact = !String(submission.contactName || '').trim()
    && !String(submission.contactMethod || '').trim()
    && !String(submission.contactValue || '').trim();

  formState.contactName = submission.contactName || (shouldPrefillProfileContact ? String(props.channel.pocName || '') : '');
  formState.contactMethod = submission.contactMethod || (shouldPrefillProfileContact ? String(props.channel.pocMethod || 'Email') : 'Email');
  formState.contactValue = submission.contactValue || (shouldPrefillProfileContact ? String(props.channel.pocDetail || '') : '');
  formState.handoffNote = submission.handoffNote || submission.notes;
};

watch(workflow, syncFormState, { immediate: true, deep: true });

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
      detail: workflow.value.submission.handoffNote || workflow.value.submission.notes,
    });
  }

  return events
    .filter((event) => event.timestamp)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
});

const handleSubmit = () => {
  message.success('Corridor onboarding package submitted successfully');
  emit('submit', {
    contactName: formState.contactName,
    contactMethod: formState.contactMethod,
    contactValue: formState.contactValue,
    handoffNote: formState.handoffNote,
  });
};
</script>

<template>
  <div class="cdd-workflow-panel">
    <div class="cdd-tabs-shell px-6 border-b border-slate-100/90">
      <a-tabs v-model:activeKey="activeKey" class="fitrem-tabs">
        <a-tab-pane key="submission" tab="Submission" />
        <a-tab-pane key="history" tab="History" />
      </a-tabs>
    </div>

    <div class="cdd-panel-body">
      <div v-if="activeKey === 'submission'" class="cdd-submission-stack">
        <div class="cdd-hero-card">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">Corridor onboarding</div>
              <h3 class="mt-2 mb-0 text-[22px] font-black leading-tight text-slate-900">
                {{ props.channel.channelName || 'Unnamed Corridor' }}
              </h3>
              <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                Fill in the corridor contact details and the note Compliance should read before reviewing this track.
              </p>
            </div>
            <span
              class="cdd-status-pill"
              :style="{ background: statusTheme.bg, color: statusTheme.text, borderColor: statusTheme.border }"
            >
              {{ statusLabel }}
            </span>
          </div>
        </div>

        <div class="cdd-section-card">
          <div class="cdd-section-title">Corridor contact</div>
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <div class="cdd-label-text">Contact Name</div>
              <a-input v-model:value="formState.contactName" class="mt-2" placeholder="Primary corridor contact" />
            </div>
            <div>
              <div class="cdd-label-text">Contact Method</div>
              <a-input v-model:value="formState.contactMethod" class="mt-2" placeholder="Email, Slack, phone, or other direct channel" />
            </div>
            <div class="md:col-span-2">
              <div class="cdd-label-text">Contact Detail</div>
              <a-input v-model:value="formState.contactValue" class="mt-2" placeholder="Email address, handle, or phone number" />
            </div>
          </div>
        </div>

        <div class="cdd-section-card">
          <a-form layout="vertical" :required-mark="false" class="cdd-form">
            <a-form-item class="mb-0">
              <template #label>
                <span class="cdd-label-text">What Compliance should know</span>
              </template>
              <a-textarea
                v-model:value="formState.handoffNote"
                :rows="5"
                placeholder="Explain what changed, what matters, or what Compliance should pay attention to on this track."
                class="cdd-textarea mt-2"
              />
            </a-form-item>
          </a-form>
        </div>
      </div>

      <div v-else class="cdd-history-view">
        <div class="mx-auto max-w-2xl py-5">
          <a-timeline v-if="historyEvents.length">
            <a-timeline-item
              v-for="event in historyEvents"
              :key="event.id"
              :color="event.type === 'submission' ? 'blue' : 'green'"
            >
              <div class="flex flex-col gap-2">
                <div class="text-[15px] font-black text-slate-800">{{ event.title }}</div>
                <div class="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                  <div class="space-y-2 text-[13px] font-medium text-slate-600">
                    <div class="flex items-center gap-2">
                      <span class="text-slate-400">Time:</span>
                      <span class="font-bold text-slate-900">{{ event.timestamp }}</span>
                    </div>
                    <div v-if="event.actor" class="flex items-center gap-2">
                      <span class="text-slate-400">By:</span>
                      <span class="font-bold text-slate-900">{{ event.actor }}</span>
                    </div>
                    <div v-if="event.detail" class="flex items-start gap-2">
                      <span class="shrink-0 text-slate-400">Notes:</span>
                      <span class="italic text-slate-900">"{{ event.detail }}"</span>
                    </div>
                  </div>
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>
          <div v-else class="py-12 text-center">
            <div class="mb-4 text-6xl font-black uppercase tracking-tighter text-slate-200 opacity-20 italic">History</div>
            <p class="font-medium text-slate-400">No Corridor onboarding history yet.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="cdd-footer">
      <a-button
        @click="emit('close')"
        class="cdd-footer__secondary h-[44px] rounded-xl border-slate-200 px-8 font-bold text-slate-500"
      >
        Close
      </a-button>
      <a-button
        type="primary"
        @click="handleSubmit"
        class="cdd-footer__primary h-[44px] rounded-xl border-none bg-[#0284c7] px-8 font-bold shadow-md"
      >
        Send Corridor Package
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.cdd-workflow-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.cdd-tabs-shell {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(248, 251, 255, 0.88) 100%);
}

.fitrem-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.cdd-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.cdd-submission-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cdd-hero-card,
.cdd-section-card {
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: #ffffff;
  padding: 24px;
  box-shadow: 0 18px 44px -30px rgba(15, 23, 42, 0.26);
}

.cdd-section-title {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #94a3b8;
}

.cdd-label-text {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.cdd-textarea :deep(.ant-input) {
  border-radius: 16px;
}

.cdd-status-pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 800;
}

.cdd-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
  background: #ffffff;
  padding: 24px;
}
</style>
