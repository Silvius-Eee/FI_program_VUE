<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { message, Modal } from 'ant-design-vue';
import { ArrowLeftOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue';
import { useAppStore } from '../stores/app';
import {
  applyOnboardingStatusUpdate,
  createEmptyOnboardingWorkflow,
  getChannelOnboardingWorkflow,
  getLatestOnboardingReviewerNote,
  getOnboardingCurrentVersion,
  getOnboardingStatusLabel,
  getOnboardingStatusTheme,
  getOnboardingTrackTitle,
  getOnboardingWorkflowStatusLabel,
  getRecentOnboardingMilestones,
  type OnboardingStatusKey,
  type OnboardingTrack,
  type OnboardingWorkflow,
} from '../constants/onboarding';

const store = useAppStore();

const reviewDraft = reactive({
  remark: '',
});
const statusDraft = ref<OnboardingStatusKey>('not_started');

const channel = computed(() => store.selectedChannel || null);
const activeTrack = computed<OnboardingTrack>(() => store.kycHubTrack);

const workflow = computed<OnboardingWorkflow>(() => (
  channel.value ? getChannelOnboardingWorkflow(channel.value, activeTrack.value) : createEmptyOnboardingWorkflow()
));

const trackTitle = computed(() => getOnboardingTrackTitle(activeTrack.value));
const statusLabel = computed(() => getOnboardingStatusLabel(activeTrack.value, workflow.value.status));
const statusTheme = computed(() => getOnboardingStatusTheme(workflow.value.status));
const currentVersion = computed(() => getOnboardingCurrentVersion(activeTrack.value, workflow.value));
const latestReviewerNote = computed(() => getLatestOnboardingReviewerNote(activeTrack.value, workflow.value));
const recentMilestones = computed(() => getRecentOnboardingMilestones(activeTrack.value, workflow.value, 4));

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
      { label: 'Handoff Note', value: workflow.value.submission.handoffNote || workflow.value.submission.notes || 'No handoff note' },
      { label: 'Reference Link', value: workflow.value.submission.documentLink || 'No document link' },
      {
        label: 'Attachments',
        value: workflow.value.submission.attachments.length
          ? workflow.value.submission.attachments.map((file) => file.name).join(', ')
          : 'No attachments uploaded',
      },
    ];
  }

  return [
    {
      label: 'Entities',
      value: workflow.value.submission.entities.length
        ? workflow.value.submission.entities.join(', ')
        : 'No entity selected',
    },
    { label: 'Reference Link', value: workflow.value.submission.documentLink || 'No document link' },
    { label: 'Submitter Note', value: workflow.value.submission.notes || 'No note provided' },
    {
      label: 'Attachments',
      value: workflow.value.submission.attachments.length
        ? workflow.value.submission.attachments.map((file) => file.name).join(', ')
        : 'No attachments uploaded',
    },
  ];
});

const statusOptions = computed(() => ([
  { label: getOnboardingWorkflowStatusLabel(activeTrack.value, 'completed'), value: 'completed' },
  { label: getOnboardingWorkflowStatusLabel(activeTrack.value, 'no_need'), value: 'no_need' },
  { label: getOnboardingWorkflowStatusLabel(activeTrack.value, 'self_preparation'), value: 'self_preparation' },
  { label: getOnboardingWorkflowStatusLabel(activeTrack.value, 'not_started'), value: 'not_started' },
  { label: getOnboardingWorkflowStatusLabel(activeTrack.value, 'counterparty_reviewing'), value: 'counterparty_reviewing' },
]));

watch(
  () => [workflow.value.status, activeTrack.value, channel.value?.id],
  () => {
    statusDraft.value = workflow.value.status;
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
    message.warning('You do not have permission to request FI input.');
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

  const actionLabel = nextStatus === 'completed'
    ? 'Complete'
    : nextStatus === 'self_preparation'
      ? 'Need FI Input'
      : nextStatus === 'no_need'
        ? 'No Need'
        : 'Update Status';

  const actionMessage = nextStatus === 'completed'
    ? 'This will close the task and keep the FI view in read-only mode.'
    : nextStatus === 'self_preparation'
      ? 'This will surface your note on the FI card and request a follow-up handoff.'
      : nextStatus === 'no_need'
        ? 'This will close the track as not required.'
        : 'This will update the current workflow status on the detail view, queue, and FI card.';

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
                <span>Current Version: v{{ currentVersion || 0 }}</span>
              </div>
            </div>

            <div class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Latest Compliance Note</div>
              <div class="mt-2 max-w-[280px] text-[13px] font-semibold leading-relaxed text-slate-700">
                {{ latestReviewerNote || 'No compliance note yet.' }}
              </div>
            </div>
          </div>
        </section>

        <section class="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div class="space-y-5">
            <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
              <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Kickoff Content</div>
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
                  <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Review Action</div>
                  <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">Status updates happen here</h3>
                  <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                    Review the kickoff content, then choose the next workflow state from the five system statuses before saving your note.
                  </p>
                </div>
              </div>

              <div class="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[13px] font-black text-slate-700">Workflow Status</div>
                  <a-select
                    v-model:value="statusDraft"
                    class="mt-4 w-full status-select"
                    :options="statusOptions"
                  />
                  <div class="mt-3 text-[12px] font-semibold text-slate-400">
                    Queue tabs still group the same five states into In Progress, Need FI Input, and Done.
                  </div>
                </div>

                <div class="flex items-end">
                  <a-button
                    type="primary"
                    class="h-[44px] rounded-2xl border-none bg-[#8256fc] px-5 font-black shadow-[0_18px_32px_-20px_rgba(130,86,252,0.55)]"
                    @click="handleReviewAction()"
                  >
                    Save Status
                  </a-button>
                </div>
              </div>

              <div class="mt-5 rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                <div class="text-[13px] font-black text-slate-700">Reviewer Note</div>
                <a-textarea
                  v-model:value="reviewDraft.remark"
                  :rows="7"
                  class="mt-4"
                  placeholder="Add a longer note for FI or for the internal audit trail"
                />
              </div>
            </article>
          </div>

          <aside class="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Recent Milestones</div>
                <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">{{ trackTitle }}</h3>
              </div>
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <safety-certificate-outlined class="text-[18px]" />
              </div>
            </div>

            <div class="mt-5 space-y-4">
              <div
                v-for="event in recentMilestones"
                :key="event.id"
                class="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-4"
              >
                <div class="text-[14px] font-black text-slate-900">{{ event.title }}</div>
                <div class="mt-1 text-[12px] font-semibold text-slate-400">
                  {{ event.time }}<span v-if="event.actorName"> / {{ event.actorName }}</span>
                </div>
                <div v-if="event.remark" class="mt-3 text-[13px] font-medium leading-relaxed text-slate-600">
                  {{ event.remark }}
                </div>
              </div>

              <div
                v-if="recentMilestones.length === 0"
                class="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center"
              >
                <div class="text-[14px] font-black text-slate-400">No milestones yet</div>
                <div class="mt-2 text-[12px] font-semibold text-slate-400">This track has not been submitted yet.</div>
              </div>
            </div>
          </aside>
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
