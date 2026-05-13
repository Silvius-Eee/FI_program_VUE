<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import dayjs from 'dayjs';
import {
  ArrowLeftOutlined,
  EyeOutlined,
  FileTextOutlined,
  InboxOutlined,
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { useAppStore } from '../stores/app';
import { chargebackHandlingOptions } from '../constants/channelOptions';
import {
  buildFundPrerequisiteSnapshot,
  getSettlementCycleDisplay,
  getSettlementThresholdDisplay,
  normalizeFundApprovalStatus,
} from '../constants/initialData';
import { openAttachmentRecord, openAttachmentUrl } from '../utils/attachment';
import {
  applyFundApprovalDecision,
  getFundApprovalLabel,
  getFundApprovalTheme,
  getFundPricingScheduleList,
  getFundRevocableAction,
  isFundPayinEligible,
  isFundReviewSubmitted,
  revokeFundApprovalDecision,
  type FundPaymentMethodRecord,
  type FundPricingScheduleRecord,
} from '../utils/fund';

type BackendAccountRow = {
  environmentType: string;
  environmentDetail: string;
  legalName: string;
  tradingName: string;
  address: string;
  account: string;
  password: string;
  remark: string;
};
type AttachmentMeta = {
  uid: string;
  name: string;
  status: string;
  size: number;
  type: string;
  url: string;
  downloadUrl?: string;
  storageId?: string;
  urlSessionId: string;
};

const store = useAppStore();

const channel = computed(() => store.selectedChannel || null);
const actorName = computed(() => store.currentUserName);
const fundApprovalStatus = computed(() => normalizeFundApprovalStatus(channel.value?.fundApproval?.status));
const approvalTheme = computed(() => getFundApprovalTheme(fundApprovalStatus.value));
const approvalLabel = computed(() => getFundApprovalLabel(fundApprovalStatus.value));
const fundPrerequisites = computed(() => buildFundPrerequisiteSnapshot(channel.value));
const fundReviewSubmitted = computed(() => Boolean(channel.value && isFundReviewSubmitted(channel.value)));
const fundReviewAvailable = computed(() => fundReviewSubmitted.value && fundPrerequisites.value.ready);
const canReviewFund = computed(() => fundReviewAvailable.value && fundApprovalStatus.value === 'pending');
const fundLegalPrerequisiteSummary = computed(() => (
  fundPrerequisites.value.legalItems.map((item) => `${item.label} ${item.status}`).join(' · ')
));
const supportedProductLabel = computed(() => (isFundPayinEligible(channel.value) ? 'Payin' : 'Unspecified'));
const approvalHistory = computed(() => (
  Array.isArray(channel.value?.fundApproval?.history)
    ? [...channel.value.fundApproval.history]
        .sort((left: any, right: any) => (
          new Date(String(right?.time || '')).getTime() - new Date(String(left?.time || '')).getTime()
        ))
    : []
));
const visibleApprovalHistory = computed(() => approvalHistory.value.filter((entry: any) => entry.type !== 'revoke'));
const latestApprovalEntry = computed(() => (
  approvalHistory.value.find((entry: any) => entry.type === 'approve') || approvalHistory.value[0] || null
));
const revocableAction = computed(() => (
  channel.value ? getFundRevocableAction(channel.value, actorName.value) : null
));
const isApproved = computed(() => channel.value?.fundApproval?.status === 'approved');
const approvalNote = ref('');
const activeProposalKeys = ref<string[]>([]);
const attachmentPreviewSessionId = (() => {
  const scopedGlobal = globalThis as typeof globalThis & { __fiAttachmentPreviewSessionId?: string };
  if (!scopedGlobal.__fiAttachmentPreviewSessionId) {
    scopedGlobal.__fiAttachmentPreviewSessionId = globalThis.crypto?.randomUUID?.() || `attachment-session-${Date.now()}`;
  }

  return scopedGlobal.__fiAttachmentPreviewSessionId;
})();

const reconciliationMethodCards = [
  { key: 'API', desc: 'Fetch reconciliation files or raw data through an API endpoint.' },
  { key: 'Portal', desc: 'Download files manually from the corridor portal.' },
  { key: 'SFTP', desc: 'Receive files through an agreed SFTP path.' },
  { key: 'Email', desc: 'Receive recurring files by email from the corridor team.' },
  { key: 'Other', desc: 'Use another method that needs to be documented in notes.' },
];

const normalizeText = (value: unknown) => String(value ?? '').trim();
const isFundDecisionHistoryEntry = (entry: any) => entry?.type === 'approve' || entry?.type === 'request_changes';

const normalizeStringList = (value: unknown, uppercase = false) => {
  const values = Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : normalizeText(value)
      ? [normalizeText(value)]
      : [];

  return [...new Set(values.map((item) => (uppercase ? item.toUpperCase() : item)))];
};

const normalizeSelectableList = (value: unknown, fallback: string[] = []) => {
  const values = normalizeStringList(value);
  return values.length || Array.isArray(value) ? values : [...fallback];
};

const normalizeAttachmentUrl = (value: unknown) => {
  const normalized = String((value as any)?.url || '').trim();
  return /^(blob:|data:|https?:)/i.test(normalized) ? normalized : '';
};

const normalizeAttachmentMeta = (value: unknown, index = 0): AttachmentMeta => ({
  uid: String((value as any)?.uid || `attachment-${Date.now()}-${index}`),
  name: String((value as any)?.name || 'Attachment'),
  status: String((value as any)?.status || 'done'),
  size: Number((value as any)?.size || 0),
  type: String((value as any)?.type || ''),
  url: normalizeAttachmentUrl(value),
  downloadUrl: String((value as any)?.downloadUrl || ''),
  storageId: String((value as any)?.storageId || ''),
  urlSessionId: String((value as any)?.urlSessionId || ''),
});

const normalizeAttachmentList = (value: unknown) => (
  Array.isArray(value)
    ? value.map((item, index) => normalizeAttachmentMeta(item, index)).filter((item) => item.name.trim())
    : []
);

const getAttachmentExtension = (name: string) => {
  const matched = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return matched?.[1] || '';
};

const formatAttachmentKind = (attachment: AttachmentMeta) => {
  const extension = getAttachmentExtension(attachment.name);
  if (extension) return extension.toUpperCase();

  const mimeSegment = attachment.type.split('/').pop();
  return mimeSegment ? mimeSegment.toUpperCase() : 'FILE';
};

const formatAttachmentSize = (size: number) => {
  if (!size) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const canOpenAttachment = (attachment: AttachmentMeta) => {
  if (!attachment.url) return false;
  if (attachment.url.startsWith('blob:')) {
    return attachment.urlSessionId === attachmentPreviewSessionId;
  }

  return true;
};

const openAttachment = (attachment: AttachmentMeta) => {
  if (!canOpenAttachment(attachment)) {
    message.info('This local file can only be opened in the same browser session it was uploaded in. Re-upload it if needed.');
    return;
  }

  openAttachmentUrl(attachment.url);
};

const resolveBackendAccountAddressHref = (value: string) => {
  const trimmed = normalizeText(value);
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
};

const backendAccounts = computed<BackendAccountRow[]>(() => (
  Array.isArray(channel.value?.backendAccounts)
    ? channel.value.backendAccounts
      .map((row: any) => ({
        environmentType: normalizeText(row?.environmentType),
        environmentDetail: normalizeText(row?.environmentDetail),
        legalName: normalizeText(row?.legalName),
        tradingName: normalizeText(row?.tradingName),
        address: normalizeText(row?.address),
        account: normalizeText(row?.account),
        password: normalizeText(row?.password),
        remark: normalizeText(row?.remark),
      }))
      .filter((row: BackendAccountRow) => Object.values(row).some((value) => normalizeText(value)))
    : []
));

const reconMethods = computed(() => normalizeStringList(channel.value?.reconMethods));
const chargebackHandling = computed(() => normalizeSelectableList(channel.value?.chargebackHandling));
const selectedChargebackHandlingLabels = computed(() => {
  const labelMap = new Map(chargebackHandlingOptions.map((option) => [option.value, option.label]));
  return chargebackHandling.value.map((value) => labelMap.get(value) || value).filter(Boolean);
});
const selectedReconciliationMethodCards = computed(() => (
  reconciliationMethodCards.filter((method) => reconMethods.value.includes(method.key))
));
const rechargeFlowAttachments = computed(() => normalizeAttachmentList(channel.value?.rechargeFlowAttachments));
const settlementAccountAttachments = computed(() => normalizeAttachmentList(channel.value?.corridorPayoutAccountAttachments));
const pricingSchedules = computed<FundPricingScheduleRecord[]>(() => (
  channel.value ? getFundPricingScheduleList(channel.value) : []
));

const getFundEditableRemarkSeed = (source: any = channel.value) => {
  const approval = source?.fundApproval && typeof source.fundApproval === 'object' ? source.fundApproval : {};
  const status = normalizeFundApprovalStatus(approval.status);
  const history = Array.isArray(approval.history)
    ? [...approval.history].sort((left: any, right: any) => (
        new Date(String(right?.time || '')).getTime() - new Date(String(left?.time || '')).getTime()
      ))
    : [];

  if (status === 'pending') {
    const latestEntry = history[0];
    return isFundDecisionHistoryEntry(latestEntry) && latestEntry?.lifecycle?.state === 'revoked'
      ? normalizeText(latestEntry.note)
      : '';
  }

  if (status === 'changes_requested' || status === 'approved') {
    return normalizeText(approval.note);
  }

  return '';
};

watch(
  () => [
    channel.value?.id,
    fundApprovalStatus.value,
    channel.value?.fundApproval?.submittedAt,
    channel.value?.fundApproval?.lastActionAt,
    Array.isArray(channel.value?.fundApproval?.history)
      ? channel.value.fundApproval.history.map((entry: any) => `${entry?.id || ''}:${entry?.lifecycle?.state || ''}:${entry?.note || ''}`).join('|')
      : '',
  ],
  () => {
    approvalNote.value = getFundEditableRemarkSeed();
  },
  { immediate: true },
);

watch(
  () => channel.value?.id,
  () => {
    activeProposalKeys.value = pricingSchedules.value.length ? [pricingSchedules.value[0].proposalId] : [];
  },
  { immediate: true },
);

const getMethodCurrencies = (record: FundPaymentMethodRecord, source: 'acquiring' | 'settlement') => {
  const rawValue = source === 'acquiring'
    ? record.settlement?.acquiringCurrency
    : record.settlement?.settlementCurrency;

  const values = normalizeStringList(rawValue, true);
  if (values.length) return values;

  if (source === 'acquiring') {
    return normalizeStringList(channel.value?.supportedCurrencies, true);
  }

  return [];
};

const formatMethodFxSummary = (record: FundPaymentMethodRecord) => {
  if (record.settlement?.fxCostValue !== null && record.settlement?.fxCostValue !== undefined) {
    return `${record.settlement?.fxCostOperator || '+'} ${record.settlement.fxCostValue}%`;
  }

  return normalizeText(record.settlement?.fxCostDetails) || 'Not set';
};

const openFundPricingProposal = (proposalId: string, methodId?: string | null) => {
  if (!channel.value) return;
  store.openFundPricingProposal(channel.value, proposalId, methodId || null);
};

const openFundPricingMethod = (proposalId: string, record: FundPaymentMethodRecord) => {
  const methodId = normalizeText(record.methodId || record.method?.id);
  if (!methodId) return;
  openFundPricingProposal(proposalId, methodId);
};

const getFundPricingMethodRow = (proposalId: string, record: FundPaymentMethodRecord) => ({
  class: 'fund-pricing-row fund-pricing-row--interactive',
  style: { cursor: 'pointer' },
  onClick: () => openFundPricingMethod(proposalId, record),
});

const getHistoryDisplayStatus = (entry: any, index: number) => {
  if (entry?.lifecycle?.state !== 'revoked') {
    return normalizeFundApprovalStatus(entry?.status || (entry?.type === 'reopened' ? 'not_started' : 'pending'));
  }

  const previousVisibleEntry = visibleApprovalHistory.value.slice(index + 1).find((candidate: any) => (
    candidate?.lifecycle?.state !== 'revoked'
  ));
  return normalizeFundApprovalStatus(
    entry?.previousStatus
    || entry?.terminalDecision?.previousStatus
    || previousVisibleEntry?.status
    || 'not_started',
  );
};

const getHistoryEntryId = (entry: any) => normalizeText(entry?.id);
const getTimelineAttachments = (entry: any) => {
  const entryAttachments = normalizeAttachmentList(entry?.attachments);
  if (entryAttachments.length) return entryAttachments;
  return entry?.type === 'submit' ? settlementAccountAttachments.value : [];
};
const openTimelineAttachment = async (attachment: AttachmentMeta) => {
  const opened = await openAttachmentRecord(attachment);
  if (!opened) {
    message.info('This attachment file is not available. Re-upload it or use the shared document link.');
  }
};

const buildTimestamp = () => dayjs().format('YYYY-MM-DD HH:mm:ss');

const handleApprove = () => {
  if (!channel.value || isApproved.value) return;
  if (!canReviewFund.value) {
    message.warning(fundReviewSubmitted.value ? 'Fund prerequisites changed. Ask FIOP to resubmit after KYC, legal, and pricing are complete.' : 'This corridor has not been submitted to Fund review.');
    return;
  }

  Modal.confirm({
    title: 'Approve fund review?',
    content: 'This will move the launch approval to FI Supervisor for the final go-live decision.',
    okText: 'Approve',
    onOk: () => {
      const updated = applyFundApprovalDecision(
        channel.value,
        'approve',
        actorName.value,
        buildTimestamp(),
        normalizeText(approvalNote.value) || 'Fund review approved.',
      );
      store.updateChannel(updated);
      approvalNote.value = updated.fundApproval.note;
      message.success('Fund approval recorded.');
    },
  });
};

const handleRequestChanges = () => {
  if (!channel.value || isApproved.value) return;
  if (!canReviewFund.value) {
    message.warning(fundReviewSubmitted.value ? 'Fund prerequisites changed. Ask FIOP to resubmit after KYC, legal, and pricing are complete.' : 'This corridor has not been submitted to Fund review.');
    return;
  }
  if (!normalizeText(approvalNote.value)) {
    message.warning('Please enter a remark before marking Revision Required.');
    return;
  }

  Modal.confirm({
    title: 'Mark as Revision Required?',
    content: 'This will return the fund review to FIOP for revision.',
    okText: 'Revision Required',
    onOk: () => {
      const updated = applyFundApprovalDecision(
        channel.value,
        'request_changes',
        actorName.value,
        buildTimestamp(),
        normalizeText(approvalNote.value),
      );
      store.updateChannel(updated);
      approvalNote.value = updated.fundApproval.note;
      message.success('Fund review returned with comments.');
    },
  });
};

const handleRevokeAction = () => {
  if (!channel.value || !revocableAction.value) return;

  Modal.confirm({
    title: 'Revoke this Fund decision?',
    content: 'This will mark the latest Fund status card as revoked and restore the corridor to pending Fund review.',
    okText: 'Revoke',
    okButtonProps: { danger: true },
    onOk: () => {
      const updated = revokeFundApprovalDecision(
        channel.value,
        actorName.value,
        buildTimestamp(),
      );
      store.updateChannel(updated);
      approvalNote.value = getFundEditableRemarkSeed(updated);
      message.success('Fund status revoked.');
    },
  });
};
</script>

<template>
  <div class="fund-detail-page">
    <div v-if="!channel" class="fund-empty-state">
      <a-empty description="No fund corridor selected." />
      <a-button type="primary" class="mt-6 h-[42px] rounded-lg px-6 font-bold" @click="store.closeFundDetail()">
        Return to Workspace
      </a-button>
    </div>

    <template v-else>
      <section class="detail-card">
        <a-button type="text" class="detail-back-button" @click="store.closeFundDetail()">
          <template #icon><arrow-left-outlined /></template>
          Back to Fund Workspace
        </a-button>

        <div class="detail-header">
          <div class="min-w-0 flex-1">
            <div class="detail-eyebrow">Fund review</div>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <h2 class="m-0 text-[28px] font-black tracking-[-0.02em] text-slate-950">
                {{ channel.channelName || 'Unnamed Corridor' }}
              </h2>
              <a-tag class="detail-product-tag">{{ supportedProductLabel }}</a-tag>
              <a-tag
                :style="{
                  backgroundColor: approvalTheme.bg,
                  color: approvalTheme.text,
                  border: 'none',
                  borderRadius: '999px',
                  fontWeight: 800,
                  padding: '4px 12px',
                }"
              >
                {{ approvalLabel }}
              </a-tag>
            </div>
            <div class="mt-3 text-[13px] font-semibold leading-relaxed text-slate-500">
              Treasury reviews FIOP-submitted fund facts before the corridor can be submitted for launch.
            </div>
          </div>

          <div class="detail-header-meta">
            <div class="detail-header-meta__label">Last Fund Action</div>
            <div class="detail-header-meta__value">
              {{ formatTimestamp(channel.fundApproval?.lastActionAt || channel.lastModifiedAt) }}
            </div>
            <div class="detail-header-meta__subvalue">
              {{ channel.fundApproval?.lastActionBy || '-' }}
            </div>
          </div>
        </div>
      </section>

      <section v-if="!fundReviewAvailable" class="detail-card fund-unavailable-card">
        <div class="fund-unavailable-card__content">
          <div class="detail-section-title">Not available for Fund review</div>
          <h3 class="decision-title mt-3">This corridor is not ready for Fund review</h3>
          <p class="decision-copy">
            Fund can review this channel only after FIOP submits fund review and KYC, NDA, MSA, and Pricing Schedule are complete.
          </p>

          <div class="launch-gate-card launch-gate-card--blocked mt-5">
            <div>
              <div class="launch-gate-card__label">Fund review prerequisites</div>
              <div class="launch-gate-card__value">
                {{ fundLegalPrerequisiteSummary }} 路 WooshPay KYC {{ fundPrerequisites.wooshpayKycStatus }} 路 Corridor KYC {{ fundPrerequisites.corridorKycStatus }}
              </div>
              <div v-if="!fundReviewSubmitted" class="launch-gate-card__missing">
                Waiting for FIOP to submit fund review.
              </div>
              <div v-else-if="fundPrerequisites.missingItems.length" class="launch-gate-card__missing">
                Missing: {{ fundPrerequisites.missingItems.join(' 路 ') }}
              </div>
            </div>
            <a-tag
              :style="{
                backgroundColor: '#fff1f2',
                color: '#be123c',
                border: 'none',
                borderRadius: '999px',
                fontWeight: 900,
                padding: '4px 12px',
              }"
            >
              Blocked
            </a-tag>
          </div>

          <a-button type="primary" class="mt-6 h-[42px] rounded-lg border-none bg-[#0284c7] px-6 font-bold" @click="store.closeFundDetail()">
            Return to Fund Workspace
          </a-button>
        </div>
      </section>

      <div v-else class="fund-detail-layout">
        <div class="fund-detail-main fund-detail-stack">
          <section class="detail-card">
          <div class="detail-section-title">Backend Account</div>
          <div class="detail-section-copy-stack">
            <p class="detail-section-copy">
              Mirrored from FIOP exactly as maintained in the channel detail page.
            </p>
            <p class="detail-section-note">
              Credentials stay visible for fund review, while remarks are displayed as a full-width note below each backend account row.
            </p>
          </div>

          <div v-if="backendAccounts.length" class="backend-account-table-shell mt-5">
            <div class="backend-account-table-scroll">
              <table class="backend-account-table">
                <colgroup>
                  <col style="width: 170px" />
                  <col style="width: 260px" />
                  <col style="width: 240px" />
                  <col style="width: 220px" />
                  <col style="width: 320px" />
                  <col style="width: 220px" />
                  <col style="width: 180px" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Environment Type</th>
                    <th>Environment Detail</th>
                    <th>Merchant Legal Name</th>
                    <th>Merchant Trading Name</th>
                    <th>Address</th>
                    <th>Account</th>
                    <th>Password</th>
                  </tr>
                </thead>
                <tbody>
                  <template
                    v-for="(row, index) in backendAccounts"
                    :key="`backend-account-${index}`"
                  >
                    <tr class="backend-account-table__row">
                      <td><div class="backend-account-table__text">{{ row.environmentType || '-' }}</div></td>
                      <td><div class="backend-account-table__text">{{ row.environmentDetail || '-' }}</div></td>
                      <td><div class="backend-account-table__text">{{ row.legalName || '-' }}</div></td>
                      <td><div class="backend-account-table__text">{{ row.tradingName || '-' }}</div></td>
                      <td>
                        <a
                          v-if="row.address"
                          :href="resolveBackendAccountAddressHref(row.address)"
                          target="_blank"
                          rel="noreferrer"
                          class="backend-account-table__link"
                        >
                          {{ row.address }}
                        </a>
                        <div v-else class="backend-account-table__text">-</div>
                      </td>
                      <td><div class="backend-account-table__credential">{{ row.account || '-' }}</div></td>
                      <td><div class="backend-account-table__credential backend-account-table__credential--password">{{ row.password || '-' }}</div></td>
                    </tr>
                    <tr class="backend-account-table__remark-row">
                      <td colspan="7" class="backend-account-table__remark-cell">
                        <div class="backend-account-table__remark-label">Remarks</div>
                        <div class="backend-account-table__remark-copy">{{ row.remark || 'No remarks provided.' }}</div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else class="backend-account-empty-state mt-5">
            <div class="backend-account-empty-state__title">No Backend Account data available.</div>
            <div class="backend-account-empty-state__copy">
              FIOP has not added any backend account row for this channel yet.
            </div>
            <div class="backend-account-table__remark-empty">
              <div class="backend-account-table__remark-label">Remarks</div>
              <div class="backend-account-table__remark-copy">
                Remarks will appear below each backend account row after backend account information is added.
              </div>
            </div>
          </div>
        </section>

          <section class="detail-card">
          <div class="detail-section-title">Recharge Flow</div>
          <p class="detail-section-copy">
            Process for funding the corridor from our side, including negative balances, pre-funding, and other fee payments.
          </p>

          <article class="mirror-card mt-5">
            <div class="readonly-display-stack">
              <div>
                <div class="mirror-label">Remark</div>
                <div class="readonly-value-card readonly-value-card--large mt-3">
                  {{ normalizeText(channel.rechargeFlowRemark) || 'No recharge flow remark captured.' }}
                </div>
              </div>

              <div>
                <div class="mirror-label">Supporting Files</div>
                <div v-if="!rechargeFlowAttachments.length" class="readonly-file-empty mt-3">
                  <eye-outlined class="text-sky-500 text-2xl" />
                  <span>No recharge files uploaded.</span>
                </div>
                <div v-else class="mt-3 space-y-3">
                  <button
                    v-for="file in rechargeFlowAttachments"
                    :key="file.uid"
                    type="button"
                    class="readonly-file-card"
                    @click="openAttachment(file)"
                  >
                    <div class="flex items-start gap-3">
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                        <file-text-outlined class="text-[16px]" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-[13px] font-black text-slate-900">{{ file.name }}</div>
                        <div class="mt-1 text-[11px] font-semibold text-slate-500">{{ formatAttachmentKind(file) }} / {{ formatAttachmentSize(file.size) }}</div>
                        <div class="mt-1 text-[11px] font-semibold" :class="canOpenAttachment(file) ? 'text-sky-600' : 'text-slate-500'">
                          {{ canOpenAttachment(file) ? 'Click to open' : 'Re-upload in this session to open' }}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>

          <section class="detail-card">
          <div class="detail-section-title">Dispute SOP</div>

          <article class="mirror-card mt-5">
            <div class="mirror-card__heading">
              <h4 class="mirror-card__title">Chargeback Handling</h4>
            </div>

            <div class="readonly-display-stack">
              <div>
                <div class="mirror-label">Dispute Handling Channel</div>
                <div v-if="selectedChargebackHandlingLabels.length" class="readonly-pill-row">
                  <span
                    v-for="label in selectedChargebackHandlingLabels"
                    :key="label"
                    class="readonly-pill"
                  >
                    {{ label }}
                  </span>
                </div>
                <div v-else class="readonly-empty mt-3">No dispute handling channel captured.</div>
              </div>

              <div>
                <div class="mirror-label">Handling Notes & References</div>
                <div class="readonly-value-card readonly-value-card--large mt-3">
                  {{ normalizeText(channel.chargebackRemarks) || 'No dispute SOP notes captured.' }}
                </div>
                <div class="readonly-helper">Mirrored from the current operating SOP maintained by FIOP.</div>
              </div>
            </div>
          </article>
        </section>

          <section class="detail-card">
          <div class="detail-section-title">Reconciliation</div>

          <article class="mirror-card mt-5">
            <div class="mb-6">
              <h4 class="mirror-card__title">Data Acquisition Method</h4>
              <p class="mirror-card__copy">Mirrored from the FIOP reconciliation card. Backend Account is shown separately above.</p>
            </div>

            <div class="readonly-display-stack">
              <div>
                <div class="mirror-subtitle">Acquisition Method</div>
                <div v-if="selectedReconciliationMethodCards.length" class="readonly-method-grid">
                  <div
                    v-for="method in selectedReconciliationMethodCards"
                    :key="method.key"
                    class="acquisition-card acquisition-card--active acquisition-card--display"
                  >
                    <div class="readonly-method-title">{{ method.key }}</div>
                    <p class="acquisition-card__copy">{{ method.desc }}</p>
                  </div>
                </div>
                <div v-else class="readonly-empty mt-3">No acquisition method captured.</div>
                <div class="readonly-helper">Multiple acquisition methods can be active at the same time.</div>

                <div class="mirror-detail-card mt-6">
                  <div class="mirror-subtitle">Detail</div>
                  <div class="readonly-value-card mt-3">
                    {{ normalizeText(channel.reconMethodDetail) || 'No acquisition detail captured.' }}
                  </div>
                </div>
              </div>

              <div class="mirror-note-card">
                <div class="mirror-subtitle">Settlement Account Details</div>
                <div class="readonly-value-card mt-3">
                  {{ normalizeText(channel.corridorPayoutAccount) || 'No settlement account details captured.' }}
                </div>

                <div class="mt-8">
                  <p class="readonly-helper mb-4">Supporting files mirrored from corridor setup. Accepted types include PDF, Word, Excel/CSV, and photos.</p>
                  <div v-if="!settlementAccountAttachments.length" class="readonly-file-empty">
                    <eye-outlined class="text-sky-500 text-2xl" />
                    <span>No supporting files uploaded</span>
                  </div>
                  <div v-else class="space-y-3">
                    <button
                      v-for="file in settlementAccountAttachments"
                      :key="file.uid"
                      type="button"
                      class="readonly-file-card"
                      @click="openAttachment(file)"
                    >
                      <div class="flex items-start gap-3">
                        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                          <file-text-outlined class="text-[16px]" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="truncate text-[13px] font-black text-slate-900">{{ file.name }}</div>
                          <div class="mt-1 text-[11px] font-semibold text-slate-500">{{ formatAttachmentKind(file) }} / {{ formatAttachmentSize(file.size) }}</div>
                          <div class="mt-1 text-[11px] font-semibold" :class="canOpenAttachment(file) ? 'text-sky-600' : 'text-slate-500'">
                            {{ canOpenAttachment(file) ? 'Click to open' : 'Re-upload in this session to open' }}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div class="mirror-note-card">
                <div class="mirror-subtitle">Reconciliation File Sample & Notes</div>
                <p class="readonly-helper mb-8">
                  Upload a representative sample and document any parsing rules, field definitions, or formatting caveats the team should watch for.
                </p>

                <div class="grid grid-cols-2 gap-10">
                  <div>
                    <div class="mirror-label">Upload Sample</div>
                    <div class="readonly-value-card readonly-value-card--compact mt-3">
                      No sample file uploaded.
                    </div>
                  </div>

                  <div>
                    <div class="mirror-label">Parsing Notes</div>
                    <div class="readonly-value-card readonly-value-card--large mt-3">
                      {{ normalizeText(channel.sampleNotes) || 'No parsing notes captured.' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>

          <section class="detail-card">
          <div class="detail-section-title">Pricing schedule list</div>
          <p class="detail-section-copy">
            Mirrored from Pricing. Expand one schedule to view fund-facing payment method fields only.
          </p>

          <div v-if="pricingSchedules.length === 0" class="empty-block mt-5">
            <div class="empty-block__icon"><inbox-outlined /></div>
            <div class="empty-block__title">No Approved Pricing Proposals Found</div>
            <div class="empty-block__copy">Only completed pricing schedules are available for Fund review.</div>
          </div>

          <div v-else class="mt-5">
            <a-collapse v-model:activeKey="activeProposalKeys" :bordered="false" class="pricing-proposal-collapse">
              <a-collapse-panel
                v-for="proposal in pricingSchedules"
                :key="proposal.proposalId"
                class="pricing-proposal-panel"
              >
                <template #header>
                  <div class="min-w-0 pr-2">
                    <span class="block text-[15px] font-black text-slate-800 truncate">
                      {{ proposal.proposalName }}
                    </span>
                    <div class="mt-2 flex items-center gap-2 text-[12px]">
                      <span class="timestamp-pill">Timestamp</span>
                      <span class="font-semibold text-slate-500 tabular-nums">{{ formatTimestamp(proposal.updatedAt) }}</span>
                    </div>
                  </div>
                </template>
                <template #extra>
                  <a-button
                    type="link"
                    class="px-0 font-bold"
                    @click.stop.prevent="openFundPricingProposal(proposal.proposalId)"
                  >
                    <template #icon><eye-outlined /></template>
                    View pricing detail
                  </a-button>
                </template>

                <a-table
                  :data-source="proposal.paymentMethodRecords"
                  :pagination="false"
                  row-key="methodId"
                  class="fund-pricing-table"
                  :scroll="{ x: 1100 }"
                  :custom-row="(record: FundPaymentMethodRecord) => getFundPricingMethodRow(proposal.proposalId, record)"
                >
                  <a-table-column title="Payment Method" key="method" :width="250">
                    <template #default="{ record }">
                      <span class="font-bold text-slate-800 text-[13px]">{{ record.methodName }}</span>
                    </template>
                  </a-table-column>

                  <a-table-column title="Acquiring Currency" key="acquiringCurrency" :width="190">
                    <template #default="{ record }">
                      <div class="currency-chip-row">
                        <template v-if="getMethodCurrencies(record, 'acquiring').length">
                          <div
                            v-for="currency in getMethodCurrencies(record, 'acquiring')"
                            :key="`${record.methodId}-acq-${currency}`"
                            class="currency-chip"
                          >
                            {{ currency }}
                          </div>
                        </template>
                        <span v-else class="empty-inline">Not set</span>
                      </div>
                    </template>
                  </a-table-column>

                  <a-table-column title="Settlement Currency" key="settlementCurrency" :width="190">
                    <template #default="{ record }">
                      <div class="currency-chip-row">
                        <template v-if="getMethodCurrencies(record, 'settlement').length">
                          <div
                            v-for="currency in getMethodCurrencies(record, 'settlement')"
                            :key="`${record.methodId}-set-${currency}`"
                            class="currency-chip"
                          >
                            {{ currency }}
                          </div>
                        </template>
                        <span v-else class="empty-inline">Not set</span>
                      </div>
                    </template>
                  </a-table-column>

                  <a-table-column title="Settlement Cycle" key="cycle" :width="170">
                    <template #default="{ record }">
                      <span class="table-value">{{ getSettlementCycleDisplay(record.settlement) }}</span>
                    </template>
                  </a-table-column>

                  <a-table-column title="Settlement Threshold" key="threshold" :width="170">
                    <template #default="{ record }">
                      <span class="table-value">{{ getSettlementThresholdDisplay(record.settlement) || 'Not set' }}</span>
                    </template>
                  </a-table-column>

                  <a-table-column title="FX Reference" key="fxReference" :width="180">
                    <template #default="{ record }">
                      <span class="table-value">{{ record.settlement?.fxCostReference || 'Not set' }}</span>
                    </template>
                  </a-table-column>

                  <a-table-column title="FX Markup / Details" key="fxMarkup" :width="220">
                    <template #default="{ record }">
                      <span class="table-value">{{ formatMethodFxSummary(record) }}</span>
                    </template>
                  </a-table-column>
                </a-table>
              </a-collapse-panel>
            </a-collapse>
          </div>
        </section>

          <section class="detail-card">
          <div class="detail-section-title">Review decision</div>

          <template v-if="isApproved">
            <h3 class="decision-title">Approved by Fund</h3>
            <p class="decision-copy">
              This fund review has been completed. The latest approved remark is kept here as the decision record.
            </p>

            <div class="decision-grid mt-5">
              <div class="detail-grid-item">
                <div class="detail-grid-item__label">Approved At</div>
                <div class="detail-grid-item__value">{{ formatTimestamp(channel.fundApproval?.lastActionAt) }}</div>
              </div>
              <div class="detail-grid-item">
                <div class="detail-grid-item__label">Approver</div>
                <div class="detail-grid-item__value">{{ channel.fundApproval?.lastActionBy || latestApprovalEntry?.user || '-' }}</div>
              </div>
              <div class="detail-grid-item detail-grid-item--wide">
                <div class="detail-grid-item__label">Remark</div>
                <div class="detail-grid-item__value">{{ channel.fundApproval?.note || latestApprovalEntry?.note || 'No remark recorded.' }}</div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="decision-note-card mt-5">
              <div class="decision-note-card__label">Remark</div>
              <a-textarea
                v-model:value="approvalNote"
                :rows="6"
              />
            </div>

            <div class="decision-actions mt-6">
              <a-button
                class="h-[44px] rounded-lg border-rose-200 bg-rose-50 px-5 font-bold text-rose-700"
                :disabled="!canReviewFund"
                @click="handleRequestChanges"
              >
                Revision Required
              </a-button>
              <a-button
                type="primary"
                class="h-[44px] rounded-lg border-none bg-[#0284c7] px-5 font-bold"
                :disabled="!canReviewFund"
                @click="handleApprove"
              >
                Approve
              </a-button>
            </div>
          </template>
        </section>

        </div>

        <aside class="detail-card fund-history-panel">
          <div class="detail-section-title">Fund timeline</div>

          <div v-if="visibleApprovalHistory.length" class="fund-timeline-list">
            <div
              v-for="(entry, index) in visibleApprovalHistory"
              :key="entry.id"
              class="fund-history-card"
              :class="entry.lifecycle?.state === 'revoked' ? 'fund-history-card--revoked' : ''"
            >
              <div class="fund-history-header">
                <div class="min-w-0 flex-1">
                  <div v-if="entry.lifecycle?.state === 'revoked'" class="fund-history-revoked-row">
                    <span class="fund-revoked-badge">Revoked</span>
                  </div>
                  <div class="fund-history-meta" :class="entry.lifecycle?.state === 'revoked' ? 'mt-1' : ''">
                    {{ formatTimestamp(entry.time) }}<span v-if="entry.user"> / {{ entry.user }}</span>
                  </div>
                </div>
                <span
                  class="fund-status-badge"
                  :style="{
                    backgroundColor: getFundApprovalTheme(getHistoryDisplayStatus(entry, index)).bg,
                    color: getFundApprovalTheme(getHistoryDisplayStatus(entry, index)).text,
                    borderColor: getFundApprovalTheme(getHistoryDisplayStatus(entry, index)).border,
                  }"
                >
                  {{ getFundApprovalLabel(getHistoryDisplayStatus(entry, index)) }}
                </span>
              </div>

              <div v-if="entry.note" class="fund-history-note">{{ entry.note }}</div>

              <div v-if="getTimelineAttachments(entry).length" class="fund-history-attachments">
                <button
                  v-for="attachment in getTimelineAttachments(entry)"
                  :key="attachment.uid"
                  type="button"
                  class="fund-history-attachment"
                  @click="openTimelineAttachment(attachment)"
                >
                  <span class="truncate">{{ attachment.name }}</span>
                </button>
              </div>

              <div
                v-if="revocableAction && revocableAction.eventId === getHistoryEntryId(entry)"
                class="fund-history-action"
              >
                <a-button
                  class="fund-revoke-decision-button"
                  @click="handleRevokeAction"
                >
                  {{ revocableAction.label }}
                </a-button>
              </div>
            </div>
          </div>

          <div v-else class="fund-history-empty">
            <div class="fund-history-empty__title">No fund timeline yet.</div>
            <div class="fund-history-empty__copy">
              Fund review actions will appear here after the first submission.
            </div>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.fund-detail-page {
  --fund-accent: #0ea5e9;
  --fund-accent-soft: rgba(14, 165, 233, 0.1);
  --fund-accent-strong: #0369a1;
  --fund-ink: #0f172a;
  --fund-muted: #64748b;
  --fund-border: rgba(148, 163, 184, 0.2);
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.1), transparent 24%),
    radial-gradient(circle at top right, rgba(245, 158, 11, 0.09), transparent 30%),
    linear-gradient(180deg, #f6fbff 0%, #f8fbff 24%, #f8fafc 58%, #f8fafc 100%);
  min-height: calc(100vh - 96px);
}

.fund-empty-state {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.fund-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(340px, 0.92fr);
  gap: 20px;
  align-items: stretch;
}

.fund-detail-main,
.fund-history-panel {
  min-width: 0;
}

.fund-detail-stack {
  display: grid;
  gap: 20px;
}

.fund-history-panel {
  align-self: stretch;
  height: 100%;
}

.fund-unavailable-card {
  display: grid;
  min-height: 360px;
  align-items: center;
}

.fund-unavailable-card__content {
  max-width: 760px;
}

.detail-card {
  position: relative;
  overflow: hidden;
  border-radius: 30px;
  border: 1px solid var(--fund-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.94) 100%);
  box-shadow:
    0 28px 64px -40px rgba(15, 23, 42, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  padding: 24px;
}

.launch-gate-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid #bfdbfe;
  border-radius: 18px;
  background: #eff6ff;
  padding: 14px 16px;
}

.launch-gate-card--blocked {
  border-color: #fecdd3;
  background: #fff1f2;
}

.launch-gate-card__label {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.launch-gate-card__value {
  margin-top: 4px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}

.launch-gate-card__missing {
  margin-top: 6px;
  color: #be123c;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.5;
}

.detail-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.2), rgba(255, 255, 255, 0));
  pointer-events: none;
}

.detail-back-button {
  padding-inline: 6px;
  border-radius: 999px;
  color: #475569;
  font-weight: 800;
}

.detail-header {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20px;
  align-items: stretch;
}

.detail-eyebrow,
.detail-section-title,
.mirror-label,
.mirror-subtitle,
.detail-grid-item__label {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.detail-product-tag {
  border: none;
  border-radius: 999px;
  background: linear-gradient(180deg, #ecfeff 0%, #eff6ff 100%);
  color: var(--fund-accent-strong);
  font-weight: 800;
  padding: 4px 12px;
}

.detail-header-meta {
  min-width: 220px;
  border-radius: 24px;
  border: 1px solid rgba(125, 211, 252, 0.3);
  background:
    linear-gradient(180deg, rgba(248, 252, 255, 0.98) 0%, rgba(240, 249, 255, 0.9) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
  padding: 20px;
}

.detail-header-meta__label {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.detail-header-meta__value {
  margin-top: 10px;
  color: var(--fund-ink);
  font-size: 18px;
  font-weight: 900;
}

.detail-header-meta__subvalue,
.detail-section-copy,
.mirror-card__copy,
.acquisition-card__copy,
.decision-copy,
.table-value,
.history-meta-value {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}

.detail-section-copy {
  margin: 10px 0 0;
}

.detail-section-copy-stack {
  display: grid;
  gap: 6px;
}

.detail-section-note {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.6;
}

.backend-account-table-shell {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.72) 0%, rgba(255, 255, 255, 0.98) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
  overflow: hidden;
}

.backend-account-table-scroll {
  overflow-x: auto;
}

.backend-account-table {
  width: 100%;
  min-width: 1320px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.backend-account-table th {
  background: linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%);
  border-bottom: 1px solid #dbe4ee;
  border-right: 1px solid #e8edf5;
  color: var(--fund-ink);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.45;
  padding: 13px 14px;
  text-align: left;
  vertical-align: top;
  white-space: normal;
}

.backend-account-table td {
  border-bottom: 1px solid #edf2f7;
  border-right: 1px solid #edf2f7;
  padding: 14px;
  vertical-align: top;
  background: rgba(255, 255, 255, 0.96);
}

.backend-account-table__row td {
  border-bottom: none;
}

.backend-account-table th:last-child,
.backend-account-table td:last-child {
  border-right: none;
}

.backend-account-table tbody tr:last-child td {
  border-bottom: none;
}

.backend-account-table__text {
  color: #475569;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
  word-break: break-word;
}

.backend-account-table__link {
  color: #0f766e;
  font-size: 12px;
  font-weight: 800;
  word-break: break-word;
  text-decoration: none;
}

.backend-account-table__link:hover {
  color: #0f172a;
  text-decoration: underline;
}

.backend-account-table__credential {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 7px 10px;
  color: #0f172a;
  font-size: 12px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  line-height: 1.5;
  word-break: break-all;
}

.backend-account-table__credential--password {
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96) 0%, rgba(224, 242, 254, 0.96) 100%);
  color: #075985;
}

.backend-account-table__remark-cell {
  padding: 16px 18px 18px;
  background: linear-gradient(180deg, rgba(251, 253, 255, 1) 0%, rgba(248, 250, 252, 0.92) 100%);
}

.backend-account-table__remark-label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.backend-account-table__remark-copy {
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.backend-account-empty-state {
  border-radius: 22px;
  border: 1px dashed #cbd5e1;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.78) 0%, rgba(255, 255, 255, 0.96) 100%);
  padding: 24px 22px 20px;
}

.backend-account-empty-state__title {
  color: #0f172a;
  font-size: 15px;
  font-weight: 900;
}

.backend-account-empty-state__copy {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}

.backend-account-table__remark-empty {
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: #fbfdff;
  padding: 14px 16px 16px;
  margin-top: 16px;
}

.mirror-card,
.mirror-note-card {
  border-radius: 26px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(250, 252, 255, 0.96) 0%, rgba(248, 250, 252, 0.98) 100%);
  padding: 24px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.mirror-card__heading {
  margin-bottom: 24px;
}

.mirror-card__title,
.decision-title {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
  font-weight: 900;
}

.mirror-subtitle {
  margin-bottom: 12px;
}

.mirror-subtitle--compact {
  margin-bottom: 10px;
}

.mirror-label {
  letter-spacing: 0.08em;
}

.mirror-textarea :deep(textarea) {
  background: #f8fafc;
}

.mirror-detail-card {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.86);
  padding: 18px 20px;
}

.mirror-detail-textarea :deep(textarea) {
  background: #f8fafc;
  line-height: 1.6;
  white-space: pre-wrap;
}

.readonly-display-stack {
  display: grid;
  gap: 24px;
}

.readonly-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.readonly-pill {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  border-radius: 999px;
  border: 1px solid #bae6fd;
  background: #ffffff;
  padding: 6px 13px;
  color: #0369a1;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.3;
}

.readonly-method-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.readonly-method-title {
  color: #0f172a;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.35;
}

.readonly-value-card {
  min-height: 54px;
  border-radius: 18px;
  border: 1px solid #dbeafe;
  background: #ffffff;
  padding: 14px 16px;
  color: #334155;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.readonly-value-card--large {
  min-height: 108px;
}

.readonly-value-card--compact {
  min-height: 42px;
}

.readonly-helper {
  margin-top: 10px;
  color: #64748b;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.6;
}

.readonly-empty,
.readonly-file-empty {
  border-radius: 18px;
  border: 1px dashed #bae6fd;
  background: #ffffff;
  color: #64748b;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.55;
}

.readonly-empty {
  padding: 14px 16px;
}

.readonly-file-empty {
  min-height: 124px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 22px;
  text-align: center;
}

.readonly-file-card {
  width: 100%;
  border-radius: 18px;
  border: 1px solid #dbeafe;
  background: #ffffff;
  padding: 12px 14px;
  text-align: left;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.readonly-file-card:hover {
  border-color: #7dd3fc;
  box-shadow: 0 14px 30px -24px rgba(2, 132, 199, 0.45);
}

.acquisition-card {
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  transition: all 0.2s ease;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.acquisition-card--active {
  background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%);
  border-color: #bfdbfe;
}

.acquisition-card--display {
  background: #ffffff;
}

.acquisition-card--idle {
  background: rgba(248, 250, 252, 0.7);
}

.acquisition-card__copy {
  margin: 10px 0 0;
  font-size: 12px;
}

.empty-block {
  border-radius: 24px;
  border: 2px dashed #e2e8f0;
  background: rgba(248, 250, 252, 0.7);
  padding: 56px 24px;
  text-align: center;
}

.empty-block__icon {
  margin-bottom: 16px;
  color: #cbd5e1;
  font-size: 48px;
}

.empty-block__title {
  color: #0f172a;
  font-size: 20px;
  font-weight: 900;
}

.empty-block__copy {
  margin-top: 8px;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
}

.timestamp-pill {
  border-radius: 999px;
  background: #f1f5f9;
  padding: 4px 10px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.pricing-proposal-panel {
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%);
  box-shadow: 0 18px 36px -28px rgba(15, 23, 42, 0.28);
}

:deep(.pricing-proposal-collapse .ant-collapse-item) {
  border-bottom: none !important;
}

:deep(.pricing-proposal-collapse .ant-collapse-header) {
  padding: 20px 24px !important;
  align-items: center !important;
}

:deep(.pricing-proposal-collapse .ant-collapse-content-box) {
  padding: 0 0 20px !important;
}

:deep(.fund-pricing-table .fund-pricing-row--interactive td) {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

:deep(.fund-pricing-table .fund-pricing-row--interactive:hover td) {
  background: #f8fbff !important;
}

.currency-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.currency-chip {
  min-width: 40px;
  border-radius: 6px;
  background: #f1f5f9;
  padding: 2px 8px;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  text-align: center;
}

.empty-inline {
  color: #cbd5e1;
  font-size: 13px;
  font-style: italic;
}

.decision-note-card {
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.88) 0%, rgba(255, 255, 255, 0.96) 100%);
  padding: 20px;
}

.approval-note-helper {
  margin: 14px 0 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}

.decision-note-card__label {
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 12px;
}

.decision-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.decision-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.detail-grid-item {
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  background: rgba(248, 250, 252, 0.75);
  padding: 18px;
}

.detail-grid-item--wide {
  grid-column: 1 / -1;
}

.detail-grid-item__value {
  margin-top: 10px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.6;
}

.fund-timeline-list {
  display: grid;
  gap: 16px;
  margin-top: 20px;
  min-width: 0;
}

.fund-history-card {
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.7);
  padding: 16px;
}

.fund-history-card--revoked {
  border-color: #fed7aa;
  background: rgba(255, 247, 237, 0.72);
}

.fund-history-header {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.fund-history-meta {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.fund-status-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  border: 1px solid;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 900;
  line-height: 1.2;
}

.fund-history-note {
  margin-top: 12px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.fund-history-attachments {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fund-history-attachment {
  display: inline-flex;
  max-width: 100%;
  cursor: pointer;
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #ffffff;
  color: #475569;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.fund-history-attachment:hover,
.fund-history-attachment:focus {
  border-color: #7dd3fc;
  background: #f0f9ff;
  color: #0369a1;
}

.fund-history-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.fund-revoke-decision-button {
  height: 36px;
  border-color: #fed7aa;
  border-radius: 10px;
  background: #fff7ed;
  padding-inline: 16px;
  color: #c2410c;
  font-weight: 800;
}

.fund-revoke-decision-button:hover,
.fund-revoke-decision-button:focus {
  border-color: #fb923c;
  background: #ffedd5;
  color: #9a3412;
}

.fund-revoked-badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid #fed7aa;
  border-radius: 999px;
  background: #ffedd5;
  color: #c2410c;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.fund-history-empty {
  margin-top: 20px;
  border: 1px dashed #e2e8f0;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.7);
  padding: 32px 16px;
  text-align: center;
}

.fund-history-empty__title {
  color: #94a3b8;
  font-size: 14px;
  font-weight: 900;
}

.fund-history-empty__copy {
  margin-top: 8px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .fund-detail-layout,
  .readonly-method-grid,
  .detail-header,
  .decision-grid,
  .grid.grid-cols-3,
  .grid.grid-cols-2 {
    grid-template-columns: 1fr;
  }

  .decision-actions {
    justify-content: stretch;
  }

  .decision-actions > * {
    width: 100%;
  }
}
</style>
