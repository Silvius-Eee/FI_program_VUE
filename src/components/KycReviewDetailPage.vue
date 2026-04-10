<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { message, Modal } from 'ant-design-vue';
import { ArrowLeftOutlined } from '@ant-design/icons-vue';
import OnboardingHistoryTimeline from './OnboardingHistoryTimeline.vue';
import { useAppStore } from '../stores/app';
import {
  applyOnboardingStatusUpdate,
  getComplianceVisibleOnboardingStatuses,
  createEmptyOnboardingWorkflow,
  getChannelOnboardingWorkflow,
  getOnboardingStatusLabel,
  getOnboardingStatusTheme,
  getOnboardingTimelineEvents,
  getOnboardingTrackTitle,
  getOnboardingWorkflowStatusLabel,
  type OnboardingStatusKey,
  type OnboardingTrack,
  type OnboardingWorkflow,
} from '../constants/onboarding';

const store = useAppStore();

const reviewDraft = reactive({
  remark: '',
});
const statusDraft = ref<OnboardingStatusKey>('counterparty_reviewing');

const channel = computed(() => store.selectedChannel || null);
const activeTrack = computed<OnboardingTrack>(() => store.kycHubTrack);

const workflow = computed<OnboardingWorkflow>(() => (
  channel.value ? getChannelOnboardingWorkflow(channel.value, activeTrack.value) : createEmptyOnboardingWorkflow()
));

const trackTitle = computed(() => getOnboardingTrackTitle(activeTrack.value));
const displayStatus = computed<OnboardingStatusKey>(() => (
  workflow.value.status === 'not_started' ? 'counterparty_reviewing' : workflow.value.status
));
const statusLabel = computed(() => getOnboardingStatusLabel(activeTrack.value, displayStatus.value));
const statusTheme = computed(() => getOnboardingStatusTheme(displayStatus.value));
const timelineEvents = computed(() => getOnboardingTimelineEvents(activeTrack.value, workflow.value));
const preparationLabel = computed(() => getOnboardingStatusLabel(activeTrack.value, 'self_preparation'));
const reviewingLabel = computed(() => getOnboardingStatusLabel(activeTrack.value, 'counterparty_reviewing'));

const permissions = computed(() => {
  const rawPermissions = (workflow.value as any)?.permissions || {};
  const roleDefaults = store.role === 'Compliance'
    ? { canReview: true, canApprove: true, canRequestChanges: true, canNoNeed: true }
    : { canReview: false, canApprove: false, canRequestChanges: false, canNoNeed: false };

  return {
    canApprove: rawPermissions.canApprove ?? roleDefaults.canApprove,
    canRequestChanges: rawPermissions.canRequestChanges ?? roleDefaults.canRequestChanges,
    canNoNeed: rawPermissions.canNoNeed ?? roleDefaults.canNoNeed,
  };
});

const snapshotLines = computed(() => {
  if (activeTrack.value === 'corridor') {
    return [
      { label: 'Primary Contact', value: workflow.value.submission.contactName || 'Not provided' },
      { label: 'Contact Method', value: workflow.value.submission.contactMethod || 'Not provided' },
      { label: 'Contact Detail', value: workflow.value.submission.contactValue || 'Not provided' },
      { label: 'Comment', value: workflow.value.submission.handoffNote || workflow.value.submission.notes || 'No comment provided' },
    ];
  }

  return [
    {
      label: 'Entities',
      value: workflow.value.submission.entities.length
        ? workflow.value.submission.entities.join(', ')
        : 'No entity selected',
    },
    { label: 'Link', value: workflow.value.submission.documentLink || 'No link provided' },
    { label: 'Note', value: workflow.value.submission.notes || 'No note provided' },
    {
      label: 'Attachments',
      value: workflow.value.submission.attachments.length
        ? workflow.value.submission.attachments.map((file) => file.name).join(', ')
        : 'No attachments uploaded',
    },
  ];
});

const statusOptions = computed(() => (
  getComplianceVisibleOnboardingStatuses().map((status) => ({
    label: getOnboardingWorkflowStatusLabel(activeTrack.value, status),
    value: status,
  }))
));

watch(
  () => [workflow.value.status, activeTrack.value, channel.value?.id],
  () => {
    const nextStatus = workflow.value.status === 'not_started'
      ? 'counterparty_reviewing'
      : workflow.value.status;
    statusDraft.value = getComplianceVisibleOnboardingStatuses().includes(nextStatus)
      ? nextStatus
      : 'counterparty_reviewing';
  },
  { immediate: true },
);

const handleReviewAction = () => {
  if (!channel.value) return;
  const nextStatus = statusDraft.value;

  if (nextStatus === 'completed' && !permissions.value.canApprove) {
    message.warning('You do not have permission to complete this track.');
    return;
  }
  if (nextStatus === 'self_preparation' && !permissions.value.canRequestChanges) {
    message.warning(`You do not have permission to move this track to ${preparationLabel.value}.`);
    return;
  }
  if (nextStatus === 'no_need' && !permissions.value.canNoNeed) {
    message.warning('You do not have permission to mark this as no need.');
    return;
  }
  if (nextStatus === 'self_preparation' && !reviewDraft.remark.trim()) {
    message.warning('Add a note before sending the task back to FI.');
    return;
  }

  const actionLabel = getOnboardingWorkflowStatusLabel(activeTrack.value, nextStatus);

  const actionMessage = nextStatus === 'completed'
    ? 'This will close the task and keep the FI view in read-only mode.'
    : nextStatus === 'self_preparation'
      ? `This will move the track to ${preparationLabel.value} and surface your note on the FI card for follow-up.`
      : nextStatus === 'no_need'
        ? 'This will close the track as not required.'
        : `This will move the track to ${reviewingLabel.value} across the detail view, queue, and FI card.`;

  Modal.confirm({
    title: `Update ${trackTitle.value}?`,
    content: actionMessage,
    okText: actionLabel,
    onOk: () => {
      const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const actor = store.role === 'Compliance' ? 'Compliance User' : 'Reviewer';
      const updated = {
        ...applyOnboardingStatusUpdate(
          channel.value,
          activeTrack.value,
          nextStatus,
          reviewDraft.remark.trim(),
          actor,
          timestamp,
        ),
        auditLogs: [
          {
            time: timestamp,
            user: actor,
            action: `${actionLabel} on ${trackTitle.value}.${reviewDraft.remark ? ` ${reviewDraft.remark}` : ''}`,
            color: nextStatus === 'completed' ? 'green' : nextStatus === 'self_preparation' ? 'orange' : 'purple',
          },
          ...(channel.value.auditLogs || []),
        ],
      };
      store.updateChannel(updated);
      reviewDraft.remark = '';
      message.success(`${trackTitle.value} updated.`);
      store.closeKycReviewDetail();
    },
  });
};
</script>

<template>
  <div class="kyc-review-detail-page min-h-screen px-5 py-6">
    <div class="mx-auto max-w-[1280px] space-y-5">
      <div
        v-if="!channel"
        class="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)]"
      >
        <a-empty description="No KYC task selected." />
        <a-button type="primary" class="mt-6 h-[42px] rounded-xl px-6 font-bold" @click="store.closeKycReviewDetail()">
          Return to Queue
        </a-button>
      </div>

      <template v-else>
        <section class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.28)]">
          <div class="flex flex-wrap items-start justify-between gap-5">
            <div class="min-w-0 flex-1">
              <a-button type="text" class="!mb-4 !px-0 font-bold text-slate-500" @click="store.closeKycReviewDetail()">
                <template #icon><arrow-left-outlined /></template>
                Back to Queue
              </a-button>
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="m-0 text-[28px] font-black tracking-[-0.02em] text-slate-950">
                  {{ channel.channelName || 'Unnamed Corridor' }}
                </h2>
                <a-tag
                  :style="{ backgroundColor: statusTheme.bg, color: statusTheme.text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
                >
                  {{ statusLabel }}
                </a-tag>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold text-slate-500">
                <span>Track: {{ trackTitle }}</span>
                <span>FI Owner: {{ channel.fiopOwner || 'Unassigned' }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="space-y-5">
          <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
            <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">What FI submitted</div>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div
                v-for="item in snapshotLines"
                :key="item.label"
                class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4"
              >
                <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{{ item.label }}</div>
                <div class="mt-2 break-words text-[13px] font-semibold leading-relaxed text-slate-700">{{ item.value }}</div>
              </div>
            </div>
            <div class="mt-4 text-[12px] font-semibold text-slate-400">
              {{ workflow.submission.submittedAt || 'Not submitted yet' }}
              <span v-if="workflow.submission.submittedBy"> / {{ workflow.submission.submittedBy }}</span>
            </div>
          </article>

          <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Review decision</div>
                <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">Choose the next status and explain the decision</h3>
                <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                  Review the submitted material first, then pick the next status and leave a reviewer note that tells FI what happens next.
                </p>
              </div>
            </div>

            <div class="mt-5 rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
              <div class="text-[13px] font-black text-slate-700">Next status</div>
              <div class="mt-4">
                <a-select
                  v-model:value="statusDraft"
                  class="w-full status-select"
                  :options="statusOptions"
                />
              </div>
              <div class="mt-3 text-[12px] font-semibold text-slate-400">
                Saving the decision updates the queue placement for this track immediately.
              </div>
            </div>

            <div class="mt-5 rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
              <div class="text-[13px] font-black text-slate-700">Reviewer Note</div>
              <a-textarea
                v-model:value="reviewDraft.remark"
                :rows="7"
                class="mt-4"
                placeholder="Explain what FI should update next, or record why this track can be closed."
              />
            </div>

            <div class="mt-5 flex justify-center">
              <a-button
                type="primary"
                class="h-[44px] rounded-2xl border-none bg-[#8256fc] px-5 font-black shadow-[0_18px_32px_-20px_rgba(130,86,252,0.55)]"
                @click="handleReviewAction()"
              >
                Send to FI
              </a-button>
            </div>
          </article>
        </section>

        <section>
          <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Shared timeline</div>
                <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">See how this track got here</h3>
                <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                  FI and Compliance read the same timeline, so every submission, review note, and final decision stays in one place.
                </p>
              </div>
            </div>

            <div class="mt-5">
              <OnboardingHistoryTimeline
                :events="timelineEvents"
                :track="activeTrack"
                empty-title="No history yet"
                empty-description="This track has not been submitted yet."
              />
            </div>
          </article>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.kyc-review-detail-page {
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 24%),
    radial-gradient(circle at top right, rgba(130, 86, 252, 0.06), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #f8fafc 42%, #f8fafc 100%);
}

.status-select :deep(.ant-select-selector) {
  min-height: 44px;
  border-radius: 14px !important;
}
</style>
