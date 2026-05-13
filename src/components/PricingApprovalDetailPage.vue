<script setup lang="ts">
import { computed, reactive } from 'vue';
import dayjs from 'dayjs';
import { ArrowLeftOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { useAppStore } from '../stores/app';
import {
  applyPricingApprovalDecision,
  buildPricingUnifiedHistory,
  getLatestPricingApprovalHistoryEvent,
  getLatestVisiblePricingUnifiedHistoryEntry,
  getPricingApprovalQueueTab,
  getPricingLegalStageStatus,
  getPricingRevocableAction,
  PRICING_FI_SUPERVISOR_REVIEW_STATUS,
  revokePricingPendingHandoff,
  revokePricingSupervisorDecision,
  type PricingUnifiedHistoryEntry,
} from '../constants/initialData';
import { getWorkflowStatusTheme, normalizeWorkflowStatusLabel } from '../utils/workflowStatus';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';

const store = useAppStore();

const reviewDecisionForm = reactive({
  note: '',
});

const channel = computed(() => store.selectedChannel || null);
const proposal = computed(() => (
  channel.value?.pricingProposals?.find((item: any) => item.id === store.selectedPricingProposalId) || null
));
const proposalDisplayStatus = computed(() => getPricingLegalStageStatus(proposal.value));
const queueTab = computed(() => getPricingApprovalQueueTab(proposalDisplayStatus.value));
const canReview = computed(() => queueTab.value === 'pending');

const latestSubmitEvent = computed(() => getLatestPricingApprovalHistoryEvent(proposal.value, 'submit'));
const latestApproveEvent = computed(() => getLatestPricingApprovalHistoryEvent(proposal.value, 'approve'));
const latestRequestChangesEvent = computed(() => getLatestPricingApprovalHistoryEvent(proposal.value, 'request_changes'));
const latestWorkflowEvent = computed(() => getLatestVisiblePricingUnifiedHistoryEntry(proposal.value));
const revocableAction = computed(() => getPricingRevocableAction(proposal.value, 'FI Supervisor', 'FI Supervisor'));

const paymentMethodRows = computed(() => Array.isArray(proposal.value?.paymentMethods) ? proposal.value.paymentMethods : []);
const historyEntries = computed(() => {
  if (!proposal.value) return [] as PricingUnifiedHistoryEntry[];
  return buildPricingUnifiedHistory(proposal.value);
});
const getHistoryDisplayStatus = (entry: PricingUnifiedHistoryEntry, index: number) => {
  if (entry.displayStatus) return entry.displayStatus;
  if (entry.lifecycle?.state !== 'revoked') return entry.status || getHistoryMeta(entry).status;

  const previousVisibleEntry = historyEntries.value.slice(index + 1).find((candidate) => candidate.lifecycle?.state !== 'revoked');
  return normalizeWorkflowStatusLabel(
    entry.terminalDecision?.previousStatus || previousVisibleEntry?.status || 'Not Started',
  );
};

const latestDecisionEvent = computed(() => {
  if (queueTab.value === 'pending') {
    return latestSubmitEvent.value || latestWorkflowEvent.value || null;
  }
  if (queueTab.value === 'approved') {
    return latestWorkflowEvent.value || latestApproveEvent.value || latestSubmitEvent.value || null;
  }
  if (queueTab.value === 'changes_requested') {
    return latestWorkflowEvent.value || latestRequestChangesEvent.value || latestSubmitEvent.value || null;
  }
  return latestWorkflowEvent.value || latestSubmitEvent.value || null;
});

const formatTimestamp = (value?: string | null) => {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
};

const formatFee = (method: any) => {
  const firstRow = method?.pricingRows?.[0];
  if (!firstRow) return 'Not set';
  const parts = [];
  if (firstRow.variableRate !== null && firstRow.variableRate !== undefined) {
    parts.push(`${firstRow.variableRate}%`);
  }
  if (firstRow.fixedFeeAmount !== null && firstRow.fixedFeeAmount !== undefined) {
    parts.push(`+ ${firstRow.fixedFeeCurrency || 'USD'} ${firstRow.fixedFeeAmount}`);
  }
  return parts.length ? parts.join(' ') : 'Not set';
};

const formatConsumerRegion = (method: any) => {
  if (!Array.isArray(method?.consumerRegion) || method.consumerRegion.length === 0) return 'Not set';
  return method.consumerRegion
    .map((item: any) => Array.isArray(item) ? item.join(' / ') : String(item))
    .join(', ');
};

const formatSettlementCurrency = (method: any) => {
  const currencies = method?.settlement?.settlementCurrency;
  return Array.isArray(currencies) && currencies.length ? currencies.join(', ') : 'Not set';
};

const getHistoryMeta = (entry: PricingUnifiedHistoryEntry) => {
  const displayStatus = entry.displayStatus || entry.status;
  return {
    title: entry.title || 'Pricing update',
    status: displayStatus || PRICING_FI_SUPERVISOR_REVIEW_STATUS,
  };
};

const getHistoryEntryId = (entry: PricingUnifiedHistoryEntry) => (
  entry.eventId || `${entry.stage}:${entry.status}:${entry.time}:${entry.user}`
);
const getHistoryStatusTheme = (status: string) => getWorkflowStatusTheme(status);

const detailSummaryRows = computed(() => ([
  { label: 'Quotation Name', value: proposal.value?.customProposalType || 'Pricing Schedule' },
  { label: 'Corridor', value: channel.value?.channelName || 'Unnamed Corridor' },
  { label: 'Cooperation Mode', value: proposal.value?.mode || 'N/A' },
  { label: 'FIOP', value: channel.value?.fiopOwner || 'Unassigned' },
  { label: 'Document Link', value: proposal.value?.link || 'Not provided' },
  { label: 'Remark', value: proposal.value?.remark || 'No remark provided' },
]));

const decisionSummary = computed(() => {
  if (queueTab.value === 'approved') {
    return {
      eyebrow: 'Decision summary',
      title: 'Moved to Legal review',
      copy: 'This quotation has left the FI Supervisor queue and is tracked in the Legal pricing workflow.',
      timeLabel: 'Moved At',
      actorLabel: 'Approver',
      noteLabel: 'Approval Note',
      noteFallback: 'No approval note recorded.',
      event: latestDecisionEvent.value,
    };
  }

  if (queueTab.value === 'changes_requested') {
    return {
      eyebrow: 'Decision summary',
      title: 'Returned to FI',
      copy: 'This quotation is under corridor review until FIOP updates and resubmits it.',
      timeLabel: 'Returned At',
      actorLabel: 'Reviewer',
      noteLabel: 'Reviewer Note',
      noteFallback: 'No reviewer note recorded.',
      event: latestDecisionEvent.value,
    };
  }

  if (!proposal.value) return null;

  return {
    eyebrow: 'Review decision',
    title: 'Choose the next outcome',
    copy: 'Approve this quotation or return it to FI with a short reason.',
    timeLabel: 'Submitted At',
    actorLabel: 'Submitted By',
    noteLabel: 'Reviewer Note',
    noteFallback: '',
    event: latestDecisionEvent.value,
  };
});

const applyReviewAction = (historyType: 'approve' | 'request_changes', note = '') => {
  if (!channel.value || !proposal.value) return;

  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const actor = 'FI Supervisor';

  store.updateChannel({
    ...applyPricingApprovalDecision(
      channel.value,
      proposal.value.id,
      historyType as 'approve' | 'request_changes',
      actor,
      timestamp,
      note,
    ),
    auditLogs: [
      {
        time: timestamp,
        user: actor,
        action: `${historyType === 'approve' ? 'Approved' : 'Requested changes for'} pricing schedule "${proposal.value.customProposalType || 'Pricing Schedule'}".${note ? ` ${note}` : ''}`,
        color: historyType === 'approve' ? 'green' : 'orange',
      },
      ...(channel.value.auditLogs || []),
    ],
  });

  reviewDecisionForm.note = '';
  message.success(historyType === 'approve' ? 'Pricing schedule moved to Legal review.' : 'Pricing schedule returned to FIOP.');
  store.closePricingApprovalDetail();
};

const handleRevokeAction = () => {
  if (!channel.value || !proposal.value || !revocableAction.value) return;
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = revocableAction.value.type === 'handoff_revoke'
    ? revokePricingPendingHandoff(
        channel.value,
        proposal.value.id,
        'FI Supervisor',
        'FI Supervisor',
        timestamp,
      )
    : revokePricingSupervisorDecision(
        channel.value,
        proposal.value.id,
        'FI Supervisor',
        timestamp,
      );
  store.updateChannel(updated);
  message.success(revocableAction.value.type === 'handoff_revoke' ? 'Pricing send revoked.' : 'Pricing status revoked.');
};

const handleApprove = () => {
  if (!proposal.value) return;
  const note = reviewDecisionForm.note.trim();
  if (showTextLimitWarning(message.warning, [
    { label: 'FI Supervisor note', value: reviewDecisionForm.note, max: INPUT_LIMITS.note },
  ])) return;

  Modal.confirm({
    title: 'Approve this pricing schedule?',
    content: 'This quotation will move to Legal as Under legal review.',
    okText: 'Approve',
    onOk: () => applyReviewAction('approve', note),
  });
};

const handleRequestChanges = () => {
  const note = reviewDecisionForm.note.trim();
  if (!note) {
    message.warning('Please enter the reason for changes.');
    return;
  }
  if (showTextLimitWarning(message.warning, [
    { label: 'FI Supervisor note', value: reviewDecisionForm.note, max: INPUT_LIMITS.note },
  ])) return;

  applyReviewAction('request_changes', note);
};

const openPricingSchedule = () => {
  if (!proposal.value) return;
  store.openPricingProposal(proposal.value.id, {
    returnView: 'pricingApprovalDetail',
    entryMode: 'approvalReviewScoped',
  });
};
</script>

<template>
  <div class="pricing-review-page min-h-screen px-5 py-6">
    <div class="mx-auto max-w-[1280px] space-y-5">
      <div
        v-if="!channel || !proposal"
        class="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)]"
      >
        <a-empty description="No pricing approval task selected." />
        <a-button type="primary" class="mt-6 h-[42px] rounded-lg px-6 font-bold" @click="store.closePricingApprovalDetail()">
          Return to Queue
        </a-button>
      </div>

      <template v-else>
        <section class="detail-card">
          <a-button type="text" class="detail-back-button" @click="store.closePricingApprovalDetail()">
            <template #icon><arrow-left-outlined /></template>
            Back to Queue
          </a-button>

          <div class="detail-header">
            <div class="min-w-0 flex-1">
              <div class="detail-eyebrow">FI Supervisor review</div>
              <div class="mt-3 flex flex-wrap items-center gap-3">
                <h2 class="m-0 text-[28px] font-black tracking-[-0.02em] text-slate-950">
                  {{ proposal.customProposalType || 'Pricing Schedule' }}
                </h2>
                <a-tag
                  :style="{
                    backgroundColor: getWorkflowStatusTheme(proposalDisplayStatus).bg,
                    color: getWorkflowStatusTheme(proposalDisplayStatus).text,
                    border: 'none',
                    borderRadius: '999px',
                    fontWeight: 800,
                    padding: '4px 12px',
                  }"
                >
                  {{ proposalDisplayStatus }}
                </a-tag>
              </div>
              <div class="mt-3 text-[13px] font-semibold leading-relaxed text-slate-500">
                Review the quotation package, then record the approval outcome or read back the final decision trail.
              </div>
              <div class="mt-5 flex flex-wrap gap-3">
                <a-button class="detail-secondary-action" @click="openPricingSchedule">
                  Open Pricing Schedule
                </a-button>
              </div>
            </div>

            <div class="detail-header-meta">
              <div class="detail-header-meta__label">
                {{ canReview ? 'Submitted At' : decisionSummary?.timeLabel }}
              </div>
              <div class="detail-header-meta__value">
                {{ formatTimestamp(latestDecisionEvent?.time || proposal.updatedAt) }}
              </div>
              <div class="detail-header-meta__subvalue">
                {{ latestDecisionEvent?.user || '-' }}
              </div>
            </div>
          </div>
        </section>

        <section class="detail-content-grid">
          <div class="detail-content-main space-y-5">
            <section class="detail-card">
              <div class="detail-section-title">Quotation Summary</div>
              <div class="detail-grid mt-4">
                <div
                  v-for="item in detailSummaryRows"
                  :key="item.label"
                  class="detail-grid-item"
                >
                  <div class="detail-grid-item__label">{{ item.label }}</div>
                  <div class="detail-grid-item__value">{{ item.value }}</div>
                </div>
              </div>
            </section>

            <section class="detail-card">
              <div class="detail-section-title">Payment Method List</div>
              <div class="detail-table-scroll">
                <a-table
                  class="mt-4"
                  :data-source="paymentMethodRows"
                  :pagination="false"
                  row-key="id"
                >
                  <a-table-column title="Payment Method" data-index="method" key="method" />
                  <a-table-column title="Consumer Region" key="consumerRegion">
                    <template #default="{ record }">
                      {{ formatConsumerRegion(record) }}
                    </template>
                  </a-table-column>
                  <a-table-column title="Fee" key="fee">
                    <template #default="{ record }">
                      {{ formatFee(record) }}
                    </template>
                  </a-table-column>
                  <a-table-column title="Settlement Currency" key="settlementCurrency">
                    <template #default="{ record }">
                      {{ formatSettlementCurrency(record) }}
                    </template>
                  </a-table-column>
                </a-table>
              </div>
            </section>

            <section class="detail-card">
              <div class="detail-section-title">{{ decisionSummary?.eyebrow }}</div>
              <h3 class="mt-2 mb-0 text-[24px] font-black text-slate-950">{{ decisionSummary?.title }}</h3>
              <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                {{ decisionSummary?.copy }}
              </p>

              <div class="detail-grid mt-5">
                <div class="detail-grid-item">
                  <div class="detail-grid-item__label">{{ decisionSummary?.timeLabel }}</div>
                  <div class="detail-grid-item__value">{{ formatTimestamp(latestDecisionEvent?.time || proposal.updatedAt) }}</div>
                </div>
                <div class="detail-grid-item">
                  <div class="detail-grid-item__label">{{ decisionSummary?.actorLabel }}</div>
                  <div class="detail-grid-item__value">{{ latestDecisionEvent?.user || '-' }}</div>
                </div>
                <div class="detail-grid-item detail-grid-item--wide">
                  <div class="detail-grid-item__label">{{ decisionSummary?.noteLabel }}</div>
                  <a-textarea
                    v-if="canReview"
                    v-model:value="reviewDecisionForm.note"
                    :maxlength="INPUT_LIMITS.note"
                    :rows="4"
                    show-count
                    class="review-note-input"
                    placeholder="Add FI Supervisor note. Required when requesting changes; optional when approving."
                  />
                  <div v-else class="detail-grid-item__value">
                    {{ latestDecisionEvent?.note || decisionSummary?.noteFallback }}
                  </div>
                </div>
              </div>

              <div v-if="canReview" class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <a-button
                  danger
                  class="h-[44px] rounded-lg px-5 font-bold"
                  @click="handleRequestChanges"
                >
                  Request Changes
                </a-button>
                <a-button
                  type="primary"
                  class="h-[44px] rounded-lg border-none bg-[#0284c7] px-5 font-bold"
                  @click="handleApprove"
                >
                  Approve
                </a-button>
              </div>
            </section>
          </div>

          <aside class="detail-card detail-history-panel">
            <div class="detail-section-title">Approval History</div>
            <div v-if="historyEntries.length" class="mt-4 space-y-3">
              <div v-for="(entry, index) in historyEntries" :key="entry.key" class="history-card">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="history-stage-pill">{{ entry.stageLabel }}</span>
                      <div class="text-[15px] font-black text-slate-900">{{ getHistoryMeta(entry).title }}</div>
                      <span
                        v-if="entry.lifecycle?.state === 'revoked'"
                        class="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-orange-700"
                      >
                        Revoked
                      </span>
                    </div>
                    <div class="mt-1 text-[12px] font-semibold text-slate-500">{{ formatTimestamp(entry.time) }}</div>
                  </div>
                  <a-tag
                    :style="{
                      backgroundColor: getHistoryStatusTheme(getHistoryDisplayStatus(entry, index)).bg,
                      color: getHistoryStatusTheme(getHistoryDisplayStatus(entry, index)).text,
                      border: 'none',
                      borderRadius: '999px',
                      fontWeight: 800,
                      padding: '4px 10px',
                    }"
                  >
                    {{ getHistoryDisplayStatus(entry, index) }}
                  </a-tag>
                </div>
                <div class="history-meta-grid">
                  <div>
                    <div class="history-meta-label">Actor</div>
                    <div class="history-meta-value">{{ entry.user }}</div>
                  </div>
                  <div class="history-meta-grid__note">
                    <div class="history-meta-label">Note</div>
                    <div class="history-meta-value">{{ entry.note || 'No note recorded.' }}</div>
                  </div>
                </div>
                <div
                  v-if="revocableAction && revocableAction.eventId === getHistoryEntryId(entry)"
                  class="mt-4 flex justify-end"
                >
                  <a-button
                    class="h-[36px] rounded-lg border-orange-200 bg-orange-50 px-4 font-bold text-orange-700"
                    @click="handleRevokeAction"
                  >
                    {{ revocableAction.label }}
                  </a-button>
                </div>
              </div>
            </div>
            <a-empty v-else class="mt-4" description="No approval history yet." />
          </aside>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.pricing-review-page {
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 24%),
    linear-gradient(180deg, #f8fbff 0%, #f8fafc 42%, #f8fafc 100%);
}

.detail-card {
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: #ffffff;
  padding: 24px;
  box-shadow: 0 24px 56px -34px rgba(15, 23, 42, 0.28);
}

.detail-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(340px, 0.92fr);
  gap: 20px;
  align-items: stretch;
}

.detail-content-main,
.detail-history-panel {
  min-width: 0;
}

.detail-history-panel {
  align-self: stretch;
  height: 100%;
}

.detail-back-button {
  margin-bottom: 16px;
  padding-inline: 0;
  color: #64748b;
  font-weight: 800;
}

.detail-secondary-action {
  height: 38px;
  border-radius: 999px;
  border-color: #dbe3ef;
  background: #f8fbff;
  color: #0369a1;
  font-weight: 800;
}

.detail-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 20px;
}

.detail-eyebrow,
.detail-section-title,
.detail-grid-item__label,
.history-meta-label,
.detail-header-meta__label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.detail-header-meta {
  min-width: 220px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #f8fafc;
  padding: 14px 16px;
}

.detail-header-meta__value {
  margin-top: 10px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.5;
}

.detail-header-meta__subvalue {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.detail-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.detail-grid-item {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #f8fafc;
  padding: 16px;
}

.detail-grid-item--wide {
  grid-column: 1 / -1;
}

.detail-grid-item__value,
.history-meta-value {
  margin-top: 8px;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.7;
  word-break: break-word;
}

.review-note-input {
  margin-top: 10px;
  border-radius: 14px;
  border-color: #cbd5e1;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.6;
}

.detail-table-scroll {
  overflow-x: auto;
}

.detail-table-scroll :deep(.ant-table) {
  min-width: 720px;
}

.history-card {
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #f8fafc;
  padding: 16px;
}

.history-stage-pill {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  border-radius: 999px;
  background: #e0f2fe;
  padding: 2px 9px;
  color: #0369a1;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.history-meta-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(120px, 0.45fr) minmax(0, 1fr);
  margin-top: 14px;
}

.history-meta-grid__note {
  min-width: 0;
}

:deep(.ant-table-thead > tr > th) {
  background: #f8fafc !important;
  color: #64748b !important;
  font-size: 12px !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

:deep(.ant-table-tbody > tr > td) {
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .detail-content-grid {
    grid-template-columns: 1fr;
  }

  .detail-grid,
  .history-meta-grid {
    grid-template-columns: 1fr;
  }

  .detail-table-scroll :deep(.ant-table) {
    min-width: 640px;
  }
}

@media (max-width: 720px) {
  .detail-card {
    padding: 20px 18px;
    border-radius: 20px;
  }

  .detail-header-meta {
    width: 100%;
  }
}
</style>
