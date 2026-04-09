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
import { useAppStore } from '../stores/app';
import {
  applyOnboardingSubmission,
  createEmptyOnboardingWorkflow,
  getChannelOnboardingWorkflow,
  getLatestOnboardingReviewerNote,
  getOnboardingCurrentVersion,
  getOnboardingStatusLabel,
  getOnboardingStatusTheme,
  getOnboardingTrackTitle,
  type OnboardingAttachmentMeta,
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

const siblingTrack = computed<OnboardingTrack>(() => (
  activeTrack.value === 'wooshpay' ? 'corridor' : 'wooshpay'
));

const siblingWorkflow = computed<OnboardingWorkflow>(() => (
  channel.value ? getChannelOnboardingWorkflow(channel.value, siblingTrack.value) : createEmptyOnboardingWorkflow()
));

const trackTitle = computed(() => getOnboardingTrackTitle(activeTrack.value));
const statusLabel = computed(() => getOnboardingStatusLabel(activeTrack.value, workflow.value.status));
const statusTheme = computed(() => getOnboardingStatusTheme(workflow.value.status));
const currentVersion = computed(() => getOnboardingCurrentVersion(activeTrack.value, workflow.value));
const latestReviewerNote = computed(() => getLatestOnboardingReviewerNote(activeTrack.value, workflow.value));

const isClosed = computed(() => workflow.value.status === 'completed' || workflow.value.status === 'no_need');
const canSubmitSupplement = computed(() => !isClosed.value);
const isEditRequired = computed(() => (
  workflow.value.status === 'not_started' || workflow.value.status === 'self_preparation'
));
const canEditCurrentTrack = computed(() => canSubmitSupplement.value && (isEditRequired.value || isEditing.value));

const formTitle = computed(() => (
  workflow.value.status === 'self_preparation'
    ? 'Respond to Compliance'
    : currentVersion.value > 0
      ? 'Add Supplementary Material'
      : 'Start KYC Handoff'
));

const submitButtonLabel = computed(() => (
  workflow.value.status === 'self_preparation'
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

const syncDraft = () => {
  if (!channel.value) return;

  isSyncingDraft.value = true;
  const savedDraft = store.getKycHubDraft(channel.value.id, activeTrack.value) || {};
  const submission = workflow.value.submission || {};
  const source = {
    ...submission,
    ...savedDraft,
  };

  draft.entities = Array.isArray(source.entities) ? [...source.entities] : [];
  draft.documentLink = String(source.documentLink || '');
  draft.notes = String(source.notes || '');
  draft.contactName = String(source.contactName || '');
  draft.contactMethod = String(source.contactMethod || 'Email');
  draft.contactValue = String(source.contactValue || '');
  draft.handoffNote = String(source.handoffNote || source.notes || '');
  uploadFileList.value = Array.isArray(source.attachments)
    ? source.attachments.map((attachment: any) => ({
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
    isEditing.value = workflow.value.status === 'not_started' || workflow.value.status === 'self_preparation';
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
    store.setKycHubDraft(nextDraft.channelId, nextDraft.track, {
      entities: nextDraft.entities,
      documentLink: nextDraft.documentLink,
      notes: nextDraft.notes,
      contactName: nextDraft.contactName,
      contactMethod: nextDraft.contactMethod,
      contactValue: nextDraft.contactValue,
      handoffNote: nextDraft.handoffNote,
      attachments: nextDraft.attachments,
    });
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

const buildSnapshotLines = (targetWorkflow: OnboardingWorkflow, track: OnboardingTrack) => {
  if (track === 'corridor') {
    return [
      { label: 'Primary Contact', value: targetWorkflow.submission.contactName || 'Not provided' },
      { label: 'Contact Method', value: targetWorkflow.submission.contactMethod || 'Not provided' },
      { label: 'Contact Detail', value: targetWorkflow.submission.contactValue || 'Not provided' },
      { label: 'Handoff Note', value: targetWorkflow.submission.handoffNote || targetWorkflow.submission.notes || 'No handoff note yet' },
      { label: 'Reference Link', value: targetWorkflow.submission.documentLink || 'No reference link' },
      {
        label: 'Attachments',
        value: targetWorkflow.submission.attachments.length
          ? targetWorkflow.submission.attachments.map((file) => file.name).join(', ')
          : 'No attachment uploaded',
      },
    ];
  }

  return [
    {
      label: 'Entities',
      value: targetWorkflow.submission.entities.length
        ? targetWorkflow.submission.entities.join(', ')
        : 'No entity selected',
    },
    { label: 'Reference Link', value: targetWorkflow.submission.documentLink || 'No document link' },
    { label: 'Notes', value: targetWorkflow.submission.notes || 'No note provided' },
    {
      label: 'Attachments',
      value: targetWorkflow.submission.attachments.length
        ? targetWorkflow.submission.attachments.map((file) => file.name).join(', ')
        : 'No attachment uploaded',
    },
  ];
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
        documentLink: draft.documentLink,
        attachments: serializedAttachments.value,
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
              <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold text-slate-500">
                <span>Track: {{ trackTitle }}</span>
                <span>FI Owner: {{ channel.fiopOwner || 'Unassigned' }}</span>
                <span>Last Updated: {{ workflow.lastUpdatedAt || 'No update yet' }}</span>
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

        <section class="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <article class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.26)]">
            <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">FI View</div>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <div class="text-[22px] font-black text-slate-950">{{ trackTitle }}</div>
              <a-tag
                :style="{ backgroundColor: statusTheme.bg, color: statusTheme.text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
              >
                {{ statusLabel }}
              </a-tag>
            </div>
            <p class="mt-3 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
              FI can start the handoff, respond to Compliance, or proactively add supplementary material if the corridor reaches out directly.
            </p>
            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <div class="rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-3">
                <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Latest Reviewer Note</div>
                <div class="mt-2 text-[13px] font-semibold leading-relaxed text-slate-700">
                  {{ latestReviewerNote || 'No compliance note yet. Once submitted, Compliance will continue the handoff.' }}
                </div>
              </div>
              <div class="rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-3">
                <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Current Version</div>
                <div class="mt-2 text-[20px] font-black text-slate-950">v{{ currentVersion || 0 }}</div>
              </div>
            </div>
          </article>

          <article class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.26)]">
            <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Other Track</div>
            <div class="mt-3 text-[20px] font-black text-slate-950">{{ getOnboardingTrackTitle(siblingTrack) }}</div>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <a-tag
                :style="{ backgroundColor: getOnboardingStatusTheme(siblingWorkflow.status).bg, color: getOnboardingStatusTheme(siblingWorkflow.status).text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
              >
                {{ getOnboardingStatusLabel(siblingTrack, siblingWorkflow.status) }}
              </a-tag>
            </div>
            <div class="mt-4 text-[13px] font-medium leading-relaxed text-slate-500">
              {{ getLatestOnboardingReviewerNote(siblingTrack, siblingWorkflow) || 'No latest note on the sibling track.' }}
            </div>
          </article>
        </section>

        <section class="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.3)]">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Submission Surface</div>
                <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">{{ formTitle }}</h3>
                <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                  Corridor onboarding starts from the handoff contact, but both tracks can accept supplementary links and attachments after the first submission.
                </p>
              </div>

              <a-tag
                :style="{ backgroundColor: canSubmitSupplement ? '#f5f3ff' : '#f8fafc', color: canSubmitSupplement ? '#7c3aed' : '#475569', border: 'none', borderRadius: '999px', fontWeight: 800, padding: '6px 14px' }"
              >
                {{ isEditRequired ? 'Action Required' : canSubmitSupplement ? 'Supplement Allowed' : 'Read Only' }}
              </a-tag>
            </div>

            <div v-if="canEditCurrentTrack" class="mt-6 space-y-5">
              <template v-if="activeTrack === 'corridor'">
                <div class="grid gap-4 md:grid-cols-2">
                  <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Contact Name</div>
                    <a-input v-model:value="draft.contactName" class="mt-3" placeholder="Primary corridor contact" />
                  </div>
                  <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                    <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Contact Method</div>
                    <a-select v-model:value="draft.contactMethod" class="mt-3 w-full" :options="contactMethodOptions" />
                  </div>
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Contact Detail</div>
                  <a-input
                    v-model:value="draft.contactValue"
                    class="mt-3"
                    placeholder="Email address, Slack handle, phone number, or other direct channel"
                  />
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Handoff Note</div>
                  <a-textarea
                    v-model:value="draft.handoffNote"
                    :rows="6"
                    class="mt-3"
                    placeholder="Context that Compliance should know before taking over the conversation"
                  />
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Reference Link</div>
                  <a-input
                    v-model:value="draft.documentLink"
                    class="mt-3"
                    placeholder="Optional folder or doc link for supplementary material"
                  />
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Attachments</div>
                  <a-upload-dragger
                    class="kyc-submit-upload mt-4"
                    multiple
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
                      <div class="text-[12px] font-medium text-slate-400">Use this when the corridor asks FI directly for extra material.</div>
                    </div>
                  </a-upload-dragger>

                  <div class="mt-4 space-y-3" v-if="serializedAttachments.length">
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

              <template v-else>
                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
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
                        @change="() => draft.entities = draft.entities.includes(entity) ? draft.entities.filter((item) => item !== entity) : [...draft.entities, entity]"
                      >
                        <span class="text-[13px] font-semibold text-slate-700">{{ entity }}</span>
                      </a-checkbox>
                    </label>
                  </div>
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Reference Link</div>
                  <a-input
                    v-model:value="draft.documentLink"
                    class="mt-3"
                    placeholder="Drive folder, dataroom, or internal package URL"
                  />
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Submitter Note</div>
                  <a-textarea
                    v-model:value="draft.notes"
                    :rows="6"
                    class="mt-3"
                    placeholder="Context for Compliance before they continue the onboarding directly with the corridor"
                  />
                </div>

                <div class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                  <div class="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">Attachments</div>
                  <a-upload-dragger
                    class="kyc-submit-upload mt-4"
                    multiple
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

                  <div class="mt-4 space-y-3" v-if="serializedAttachments.length">
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

              <div class="flex justify-end">
                <a-button
                  type="primary"
                  class="h-[46px] rounded-2xl border-none bg-[#8256fc] px-6 font-black shadow-[0_18px_32px_-20px_rgba(130,86,252,0.55)]"
                  :disabled="!permissions.canSubmit"
                  @click="handleSubmit"
                >
                  <template #icon><send-outlined /></template>
                  {{ submitButtonLabel }}
                </a-button>
              </div>
            </div>

            <div v-else class="mt-6 rounded-[20px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center">
              <div class="flex justify-center">
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <edit-outlined class="text-[18px]" />
                </div>
              </div>
              <div class="mt-4 text-[18px] font-black text-slate-900">
                {{ canSubmitSupplement ? 'Compliance is driving this track' : 'This track is closed' }}
              </div>
              <div class="mt-2 text-[13px] font-medium leading-relaxed text-slate-500">
                {{ canSubmitSupplement
                  ? 'You can still add a supplement if the corridor reaches FI directly for additional material.'
                  : 'No further FI action is expected on this track.' }}
              </div>
              <a-button
                v-if="canSubmitSupplement"
                type="primary"
                class="mt-5 h-[44px] rounded-2xl border-none bg-[#8256fc] px-5 font-black shadow-[0_18px_32px_-20px_rgba(130,86,252,0.55)]"
                @click="openEditMode"
              >
                <template #icon><edit-outlined /></template>
                Add Supplement
              </a-button>
            </div>
          </article>

          <aside class="space-y-5">
            <article class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.26)]">
              <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Latest Snapshot</div>
              <div class="mt-3 space-y-3">
                <div
                  v-for="item in buildSnapshotLines(workflow, activeTrack)"
                  :key="item.label"
                  class="rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-3"
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

            <article class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.26)]">
              <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">What FI Sees</div>
              <div class="mt-3 text-[13px] font-medium leading-relaxed text-slate-600">
                The FI view stays lightweight, but it still allows supplementary submissions while the track is in progress if the corridor asks FI directly for extra material.
              </div>
            </article>
          </aside>
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
