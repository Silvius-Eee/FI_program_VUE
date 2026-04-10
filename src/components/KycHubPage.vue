<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { message, Modal } from 'ant-design-vue';
import {
  ArrowLeftOutlined,
  EditOutlined,
  FileSearchOutlined,
  SendOutlined,
} from '@ant-design/icons-vue';
import OnboardingHistoryTimeline from './OnboardingHistoryTimeline.vue';
import { useAppStore } from '../stores/app';
import {
  applyOnboardingSubmission,
  createEmptyOnboardingWorkflow,
  getChannelOnboardingWorkflow,
  getOnboardingCurrentVersion,
  getOnboardingTimelineEvents,
  getOnboardingStatusLabel,
  getOnboardingStatusTheme,
  getOnboardingTrackTitle,
  type OnboardingAttachmentMeta,
  type OnboardingActivityEntry,
  type OnboardingTrack,
  type OnboardingWorkflow,
} from '../constants/onboarding';

const store = useAppStore();
const uploadFileList = ref<any[]>([]);
const isSyncingDraft = ref(false);
const isEditing = ref(false);

const draft = reactive({
  entities: [] as string[],
  documentLink: '',
  notes: '',
  contactName: '',
  contactMethod: 'Email',
  contactValue: '',
  handoffNote: '',
});

const onboardingEntityOptions = [
  'SwooshTransfer Ltd (UK) - SPI licensed',
  'Steelhenge Pte Ltd (Singapore)',
  'Steelhenge HongKong Group Limited (HK)',
  'Quantumtech Ltd (HK) - MSO licensed',
  'QuantumWing Limited (HK)',
];

const contactMethodOptions = [
  { label: 'Email', value: 'Email' },
  { label: 'Slack', value: 'Slack' },
  { label: 'WeChat', value: 'WeChat' },
  { label: 'Telegram', value: 'Telegram' },
  { label: 'Phone', value: 'Phone' },
  { label: 'Other', value: 'Other' },
];

const channel = computed(() => store.selectedChannel || null);
const activeTrack = computed<OnboardingTrack>({
  get: () => store.kycHubTrack,
  set: (value) => store.setKycHubTrack(value),
});

const workflow = computed<OnboardingWorkflow>(() => (
  channel.value ? getChannelOnboardingWorkflow(channel.value, activeTrack.value) : createEmptyOnboardingWorkflow()
));

const trackTitle = computed(() => getOnboardingTrackTitle(activeTrack.value));
const statusLabel = computed(() => getOnboardingStatusLabel(activeTrack.value, workflow.value.status));
const statusTheme = computed(() => getOnboardingStatusTheme(workflow.value.status));
const currentVersion = computed(() => getOnboardingCurrentVersion(activeTrack.value, workflow.value));
const timelineEvents = computed(() => getOnboardingTimelineEvents(activeTrack.value, workflow.value));
const latestSubmissionEvent = computed<OnboardingActivityEntry | null>(() => (
  timelineEvents.value.find((entry) => entry.eventType === 'submission' || entry.eventType === 'resubmission') || null
));
const latestReviewerPreparationEvent = computed<OnboardingActivityEntry | null>(() => (
  timelineEvents.value.find((entry) => entry.actorRole === 'reviewer' && entry.status === 'self_preparation') || null
));

const isClosed = computed(() => workflow.value.status === 'completed' || workflow.value.status === 'no_need');
const canSubmitSupplement = computed(() => !isClosed.value);
const isEditRequired = computed(() => {
  if (workflow.value.status === 'not_started') return true;
  if (workflow.value.status !== 'self_preparation') return false;
  if (!latestReviewerPreparationEvent.value) return false;
  if (!latestSubmissionEvent.value) return true;

  return new Date(latestReviewerPreparationEvent.value.time).getTime() >= new Date(latestSubmissionEvent.value.time).getTime();
});
const canEditCurrentTrack = computed(() => canSubmitSupplement.value && (isEditRequired.value || isEditing.value));
const isSupplementMode = computed(() => (
  workflow.value.status !== 'self_preparation' && currentVersion.value > 0
));
const formDescription = computed(() => (
  activeTrack.value === 'corridor'
    ? isSupplementMode.value
      ? 'Refresh only the corridor contact and remarks that changed since the last submission.'
      : 'Fill in the corridor contact details and the note Compliance should read before reviewing this track.'
    : isSupplementMode.value
      ? 'Add only the updated entities, link, remarks, and attachments that changed since the last submission.'
      : 'Fill in the entities, supporting link, note, and attachments that Compliance should review on this track.'
));
const historyTitle = computed(() => (
  activeTrack.value === 'corridor' ? 'Corridor onboarding timeline' : `${trackTitle.value} history`
));
const historyDescription = computed(() => (
  activeTrack.value === 'corridor'
    ? 'Follow every submission, supplement, and review handoff on the same shared timeline.'
    : 'Use the shared timeline to confirm what FI submitted, what Compliance asked for, and when the status changed.'
));

const formTitle = computed(() => (
  workflow.value.status === 'self_preparation' && isEditRequired.value
    ? 'Update what Compliance asked for'
    : currentVersion.value > 0
      ? 'Update the submitted package'
      : 'Fill in the review package'
));

const submitButtonLabel = computed(() => (
  workflow.value.status === 'self_preparation' && isEditRequired.value
    ? 'Submit Update'
    : currentVersion.value > 0
      ? 'Send Supplement'
      : 'Submit to Compliance'
));

const serializedAttachments = computed<OnboardingAttachmentMeta[]>(() => uploadFileList.value.map((file) => ({
  uid: String(file.uid),
  name: String(file.name || 'Attachment'),
  status: String(file.status || 'done'),
  size: Number(file.size || 0),
  type: String(file.type || ''),
})));

const permissions = computed(() => {
  const rawPermissions = (workflow.value as any)?.permissions || {};
  return {
    canSubmit: rawPermissions.canSubmit ?? store.role === 'FI',
  };
});

const hasText = (value: unknown) => String(value ?? '').trim().length > 0;

const hasCorridorContactDraft = (value: Record<string, any> | null | undefined) => {
  const method = String(value?.contactMethod ?? '').trim();
  return hasText(value?.contactName)
    || hasText(value?.contactValue)
    || (method.length > 0 && method !== 'Email');
};

const hasMeaningfulDraft = (track: OnboardingTrack, value: Record<string, any> | null | undefined) => {
  if (!value || typeof value !== 'object') return false;

  if (track === 'corridor') {
    return hasCorridorContactDraft(value)
      || hasText(value.handoffNote)
      || hasText(value.notes);
  }

  return Boolean(
    (Array.isArray(value.entities) && value.entities.length)
    || hasText(value.documentLink)
    || hasText(value.notes)
    || (Array.isArray(value.attachments) && value.attachments.length),
  );
};

const syncDraft = () => {
  if (!channel.value) return;

  isSyncingDraft.value = true;
  const rawSavedDraft = store.getKycHubDraft(channel.value.id, activeTrack.value) || {};
  const savedDraft = hasMeaningfulDraft(activeTrack.value, rawSavedDraft) ? rawSavedDraft : {};
  const submission = workflow.value.submission || {};
  const hasSavedCorridorContact = activeTrack.value === 'corridor' && hasCorridorContactDraft(savedDraft);
  const corridorContactSource = hasSavedCorridorContact ? savedDraft : submission;

  draft.entities = Array.isArray(savedDraft.entities) && savedDraft.entities.length
    ? [...savedDraft.entities]
    : Array.isArray(submission.entities) ? [...submission.entities] : [];
  draft.documentLink = String(savedDraft.documentLink || submission.documentLink || '');
  draft.notes = String(savedDraft.notes || submission.notes || '');
  draft.contactName = String(corridorContactSource.contactName || channel.value.pocName || '');
  draft.contactMethod = String(corridorContactSource.contactMethod || channel.value.pocMethod || 'Email');
  draft.contactValue = String(corridorContactSource.contactValue || channel.value.pocDetail || '');
  draft.handoffNote = String(savedDraft.handoffNote || savedDraft.notes || submission.handoffNote || submission.notes || '');
  const attachments = Array.isArray(savedDraft.attachments) && savedDraft.attachments.length
    ? savedDraft.attachments
    : submission.attachments;
  uploadFileList.value = Array.isArray(attachments)
    ? attachments.map((attachment: any) => ({
        uid: attachment.uid,
        name: attachment.name,
        status: attachment.status || 'done',
        size: attachment.size,
        type: attachment.type,
      }))
    : [];
  isSyncingDraft.value = false;
};

watch([channel, activeTrack], syncDraft, { immediate: true });

watch(
  () => [workflow.value.status, activeTrack.value, channel.value?.id],
  () => {
    isEditing.value = workflow.value.status === 'not_started' || isEditRequired.value;
  },
  { immediate: true },
);

watch(
  () => ({
    channelId: channel.value?.id,
    track: activeTrack.value,
    entities: [...draft.entities],
    documentLink: draft.documentLink,
    notes: draft.notes,
    contactName: draft.contactName,
    contactMethod: draft.contactMethod,
    contactValue: draft.contactValue,
    handoffNote: draft.handoffNote,
    attachments: serializedAttachments.value,
  }),
  (nextDraft) => {
    if (isSyncingDraft.value || !nextDraft.channelId) return;
    const draftPayload = {
      entities: nextDraft.entities,
      documentLink: nextDraft.documentLink,
      notes: nextDraft.notes,
      contactName: nextDraft.contactName,
      contactMethod: nextDraft.contactMethod,
      contactValue: nextDraft.contactValue,
      handoffNote: nextDraft.handoffNote,
      attachments: nextDraft.attachments,
    };

    if (!hasMeaningfulDraft(nextDraft.track, draftPayload)) {
      store.clearKycHubDraft(nextDraft.channelId, nextDraft.track);
      return;
    }

    store.setKycHubDraft(nextDraft.channelId, nextDraft.track, draftPayload);
  },
  { deep: true },
);

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

const validateDraft = () => {
  if (!permissions.value.canSubmit) {
    message.warning('You do not have permission to submit this track.');
    return false;
  }

  if (activeTrack.value === 'wooshpay') {
    if (!draft.entities.length) {
      message.warning('Select at least one onboarding entity before submitting.');
      return false;
    }
    if (!draft.documentLink.trim() && !serializedAttachments.value.length) {
      message.warning('Add a document link or at least one attachment before submitting.');
      return false;
    }
    return true;
  }

  if (!draft.contactName.trim() || !draft.contactValue.trim()) {
    message.warning('Fill in the primary corridor contact before submitting.');
    return false;
  }

  return true;
};

const handleSubmit = () => {
  if (!channel.value || !validateDraft()) return;

  const payload = activeTrack.value === 'corridor'
    ? {
        contactName: draft.contactName,
        contactMethod: draft.contactMethod,
        contactValue: draft.contactValue,
        handoffNote: draft.handoffNote,
        notes: draft.handoffNote,
        documentLink: '',
        attachments: [],
      }
    : {
        entities: [...draft.entities],
        documentLink: draft.documentLink,
        notes: draft.notes,
        attachments: serializedAttachments.value,
      };

  Modal.confirm({
    title: `${submitButtonLabel.value} for ${trackTitle.value}?`,
    content: 'This will hand the track over to Compliance and move your FI view back to the status card.',
    okText: submitButtonLabel.value,
    onOk: () => {
      const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const actor = store.role === 'FI' ? 'Current User' : 'Submitter';
      const updated = {
        ...applyOnboardingSubmission(
          channel.value,
          activeTrack.value,
          payload,
          actor,
          timestamp,
        ),
        auditLogs: [
          {
            time: timestamp,
            user: actor,
            action: `${submitButtonLabel.value} for ${trackTitle.value}.`,
            color: 'blue',
          },
          ...(channel.value.auditLogs || []),
        ],
      };
      if (activeTrack.value === 'corridor') {
        updated.pocName = draft.contactName;
        updated.pocMethod = draft.contactMethod;
        updated.pocDetail = draft.contactValue;
      }
      store.updateChannel(updated);
      store.clearKycHubDraft(channel.value.id, activeTrack.value);
      message.success(`${trackTitle.value} submitted to Compliance.`);
      store.closeKycSubmit();
    },
  });
};

const openEditMode = () => {
  if (!canSubmitSupplement.value) return;
  isEditing.value = true;
};
</script>

<template>
  <div class="kyc-submit-page min-h-screen px-5 py-6">
    <div class="mx-auto max-w-[1280px] space-y-5">
      <div
        v-if="!channel"
        class="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)]"
      >
        <a-empty description="No corridor selected for KYC handoff." />
        <a-button type="primary" class="mt-6 h-[42px] rounded-xl px-6 font-bold" @click="store.closeKycSubmit()">
          Return
        </a-button>
      </div>

      <template v-else>
        <section class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.28)]">
          <div class="flex flex-wrap items-start justify-between gap-5">
            <div class="min-w-0 flex-1">
              <a-button type="text" class="!mb-4 !px-0 font-bold text-slate-500" @click="store.closeKycSubmit()">
                <template #icon><arrow-left-outlined /></template>
                Back to Corridor
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
            </div>

            <a-segmented
              v-model:value="activeTrack"
              class="kyc-track-switch"
              :options="[
                { value: 'wooshpay', label: 'WooshPay onboarding' },
                { value: 'corridor', label: 'Corridor onboarding' },
              ]"
            />
          </div>
        </section>

        <section>
          <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">What to fill in</div>
                <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">{{ formTitle }}</h3>
                <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                  {{ formDescription }}
                </p>
              </div>

              <a-tag
                :style="{ backgroundColor: canSubmitSupplement ? '#f5f3ff' : '#f8fafc', color: canSubmitSupplement ? '#7c3aed' : '#475569', border: 'none', borderRadius: '999px', fontWeight: 800, padding: '6px 14px' }"
              >
                {{ isEditRequired ? 'Action Required' : canSubmitSupplement ? 'Supplement Allowed' : 'Read Only' }}
              </a-tag>
            </div>

            <div class="mt-6 space-y-5">
              <template v-if="activeTrack === 'corridor'">
                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Corridor contact</div>
                  <div class="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <div class="text-[12px] font-bold text-slate-500">Contact Name</div>
                      <a-input
                        v-model:value="draft.contactName"
                        class="mt-2"
                        :readonly="!canEditCurrentTrack"
                        :class="!canEditCurrentTrack ? 'bg-white/70' : 'bg-white'"
                        placeholder="Primary corridor contact"
                      />
                    </div>
                    <div>
                      <div class="text-[12px] font-bold text-slate-500">Contact Method</div>
                      <a-select
                        v-model:value="draft.contactMethod"
                        class="mt-2 w-full"
                        :options="contactMethodOptions"
                        :disabled="!canEditCurrentTrack"
                      />
                    </div>
                    <div class="md:col-span-2">
                      <div class="text-[12px] font-bold text-slate-500">Contact Detail</div>
                      <a-input
                        v-model:value="draft.contactValue"
                        class="mt-2"
                        :readonly="!canEditCurrentTrack"
                        :class="!canEditCurrentTrack ? 'bg-white/70' : 'bg-white'"
                        placeholder="Email address, Slack handle, phone number, or other direct channel"
                      />
                    </div>
                  </div>
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Remarks</div>
                  <a-textarea
                    v-model:value="draft.handoffNote"
                    :rows="6"
                    class="mt-3"
                    :readonly="!canEditCurrentTrack"
                    :class="!canEditCurrentTrack ? 'bg-white/70' : 'bg-white'"
                    placeholder="Tell Compliance what they should know before reviewing this track."
                  />
                </div>
              </template>

              <template v-else>
                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Onboarding Entities</div>
                  <div class="mt-4 grid gap-3 md:grid-cols-2">
                    <label
                      v-for="entity in onboardingEntityOptions"
                      :key="entity"
                      class="rounded-[16px] border border-slate-200 bg-white px-4 py-3 transition-all"
                      :class="draft.entities.includes(entity) ? 'border-sky-300 bg-sky-50/70' : ''"
                    >
                      <a-checkbox
                        :checked="draft.entities.includes(entity)"
                        :disabled="!canEditCurrentTrack"
                        @change="() => draft.entities = draft.entities.includes(entity) ? draft.entities.filter((item) => item !== entity) : [...draft.entities, entity]"
                      >
                        <span class="text-[13px] font-semibold text-slate-700">{{ entity }}</span>
                      </a-checkbox>
                    </label>
                  </div>
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Link</div>
                  <a-input
                    v-model:value="draft.documentLink"
                    class="mt-3"
                    :readonly="!canEditCurrentTrack"
                    :class="!canEditCurrentTrack ? 'bg-white/70' : 'bg-white'"
                    placeholder="Drive folder, dataroom, or internal package URL"
                  />
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Remarks</div>
                  <a-textarea
                    v-model:value="draft.notes"
                    :rows="6"
                    class="mt-3"
                    :readonly="!canEditCurrentTrack"
                    :class="!canEditCurrentTrack ? 'bg-white/70' : 'bg-white'"
                    placeholder="Tell Compliance what they should review or watch for in this package."
                  />
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Attachments</div>
                  <a-upload-dragger
                    class="kyc-submit-upload mt-4"
                    multiple
                    :disabled="!canEditCurrentTrack"
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
              </template>

              <div v-if="canEditCurrentTrack" class="flex justify-center pt-1">
                <a-button
                  type="primary"
                  class="h-[46px] min-w-[220px] rounded-2xl border-none bg-[#8256fc] px-6 font-black shadow-[0_18px_32px_-20px_rgba(130,86,252,0.55)]"
                  :disabled="!permissions.canSubmit"
                  @click="handleSubmit"
                >
                  <template #icon><send-outlined /></template>
                  {{ submitButtonLabel }}
                </a-button>
              </div>

              <div v-else-if="canSubmitSupplement" class="flex justify-center pt-1">
                <a-button
                  type="primary"
                  class="h-[44px] min-w-[220px] rounded-2xl border-none bg-[#8256fc] px-5 font-black shadow-[0_18px_32px_-20px_rgba(130,86,252,0.55)]"
                  @click="openEditMode"
                >
                  <template #icon><edit-outlined /></template>
                  Add Supplement
                </a-button>
              </div>

              <div v-else class="text-[13px] font-semibold text-slate-400">
                No further FI action is expected on this track.
              </div>
            </div>
          </article>
        </section>

        <section>
          <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Track history</div>
                <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">{{ historyTitle }}</h3>
                <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                  {{ historyDescription }}
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
.kyc-submit-page {
  background:
    radial-gradient(circle at top left, rgba(130, 86, 252, 0.08), transparent 24%),
    radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 24%),
    linear-gradient(180deg, #faf7ff 0%, #f8fafc 42%, #f8fafc 100%);
}

.kyc-track-switch {
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  padding: 4px;
}

.kyc-track-switch :deep(.ant-segmented-item-selected) {
  color: #8256fc !important;
  font-weight: 800;
}

.kyc-submit-upload :deep(.ant-upload) {
  border-radius: 18px;
}
</style>
