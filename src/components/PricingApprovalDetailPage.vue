<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import dayjs from 'dayjs';
import { ArrowLeftOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { useAppStore } from '../stores/app';
import {
  getLatestPricingApprovalHistoryEvent,
  getPricingApprovalQueueTab,
  type PricingApprovalHistoryEntry,
} from '../constants/initialData';
import { getWorkflowStatusTheme, normalizeWorkflowStatusLabel } from '../utils/workflowStatus';

const store = useAppStore();

const requestChangesOpen = ref(false);
const requestChangesForm = reactive({
  note: '',
});

const channel = computed(() => store.selectedChannel || null);
const proposal = computed(() => (
  channel.value?.pricingProposals?.find((item: any) => item.id === store.selectedPricingProposalId) || null
));
const queueTab = computed(() => getPricingApprovalQueueTab(proposal.value?.approvalStatus));
const canReview = computed(() => queueTab.value === 'pending');

const latestSubmitEvent = computed(() => getLatestPricingApprovalHistoryEvent(proposal.value, 'submit'));
const latestApproveEvent = computed(() => getLatestPricingApprovalHistoryEvent(proposal.value, 'approve'));
const latestRequestChangesEvent = computed(() => getLatestPricingApprovalHistoryEvent(proposal.value, 'request_changes'));

const paymentMethodRows = computed(() => Array.isArray(proposal.value?.paymentMethods) ? proposal.value.paymentMethods : []);
const historyEntries = computed(() => {
  const history = Array.isArray(proposal.value?.approvalHistory) ? proposal.value.approvalHistory : [];
  return [...history].sort((left: PricingApprovalHistoryEntry, right: PricingApprovalHistoryEntry) => (
    new Date(right.time).getTime() - new Date(left.time).getTime()
  ));
});

const latestDecisionEvent = computed(() => {
  if (queueTab.value === 'approved') {
    return latestApproveEvent.value || latestSubmitEvent.value || null;
  }
  if (queueTab.value === 'changes_requested') {
    return latestRequestChangesEvent.value || latestSubmitEvent.value || null;
  }
  return latestSubmitEvent.value || null;
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

const getHistoryMeta = (entry: PricingApprovalHistoryEntry) => {
  if (entry.type === 'approve') {
    return { title: 'Approved by FI Supervisor', status: 'Approved' };
  }
  if (entry.type === 'request_changes') {
    return { title: 'Returned to FI', status: 'Changes Requested' };
  }
  return { title: 'Submitted for review', status: 'In Review' };
};

const detailSummaryRows = computed(() => ([
  { label: 'Quotation Name', value: proposal.value?.customProposalType || 'Pricing Schedule' },
  { label: 'Corridor', value: channel.value?.channelName || 'Unnamed Corridor' },
  { label: 'Cooperation Mode', value: proposal.value?.mode || 'N/A' },
  { label: 'FI Owner', value: channel.value?.fiopOwner || 'Unassigned' },
  { label: 'Document Link', value: proposal.value?.link || 'Not provided' },
  { label: 'Remark', value: proposal.value?.remark || 'No remark provided' },
]));

const decisionSummary = computed(() => {
  if (queueTab.value === 'approved') {
    return {
      eyebrow: 'Decision summary',
      title: 'Approved by FI Supervisor',
      copy: 'This quotation is already approved and kept here as a completed review record.',
      timeLabel: 'Approved At',
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
      copy: 'This quotation was sent back to FI and stays here until the pricing package is updated and resubmitted.',
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
    noteLabel: 'Submission Note',
    noteFallback: 'No submission note recorded.',
    event: latestDecisionEvent.value,
  };
});

const applyReviewAction = (nextStatus: string, historyType: PricingApprovalHistoryEntry['type'], note = '') => {
  if (!channel.value || !proposal.value) return;

  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const actor = 'FI Supervisor';
  const nextProposals = channel.value.pricingProposals.map((item: any) => (
    item.id === proposal.value.id
      ? {
          ...item,
          approvalStatus: nextStatus,
          updatedAt: timestamp,
          approvalHistory: [
            ...(Array.isArray(item.approvalHistory) ? item.approvalHistory : []),
            {
              type: historyType,
              time: timestamp,
              user: actor,
              note,
            },
          ],
        }
      : item
  ));

  store.updateChannel({
    ...channel.value,
    lastModifiedAt: timestamp,
    pricingProposals: nextProposals,
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

  requestChangesOpen.value = false;
  requestChangesForm.note = '';
  message.success(historyType === 'approve' ? 'Pricing schedule approved.' : 'Change request sent.');
  store.closePricingApprovalDetail();
};

const handleApprove = () => {
  if (!proposal.value) return;
  Modal.confirm({
    title: 'Approve this pricing schedule?',
    content: 'This quotation will be marked as approved and moved to the Approved queue.',
    okText: 'Approve',
    onOk: () => applyReviewAction('Approved', 'approve'),
  });
};

const handleRequestChanges = () => {
  if (!requestChangesForm.note.trim()) {
    message.warning('Please enter the reason for changes.');
    return;
  }
  applyReviewAction('Changes Requested', 'request_changes', requestChangesForm.note.trim());
};
</script>

<template>
  <div class="pricing-review-page min-h-screen px-5 py-6">
    <div class="mx-auto max-w-[1180px] space-y-5">
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
                    backgroundColor: getWorkflowStatusTheme(proposal.approvalStatus).bg,
                    color: getWorkflowStatusTheme(proposal.approvalStatus).text,
                    border: 'none',
                    borderRadius: '999px',
                    fontWeight: 800,
                    padding: '4px 12px',
                  }"
                >
                  {{ normalizeWorkflowStatusLabel(proposal.approvalStatus) }}
                </a-tag>
              </div>
              <div class="mt-3 text-[13px] font-semibold leading-relaxed text-slate-500">
                Review the quotation package, then record the approval outcome or read back the final decision trail.
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
              <div class="detail-grid-item__value">
                {{ latestDecisionEvent?.note || decisionSummary?.noteFallback }}
              </div>
            </div>
          </div>

          <div v-if="canReview" class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <a-button
              danger
              class="h-[44px] rounded-lg px-5 font-bold"
              @click="requestChangesOpen = true"
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

        <section class="detail-card">
          <div class="detail-section-title">Approval History</div>
          <div v-if="historyEntries.length" class="mt-4 space-y-3">
            <div v-for="entry in historyEntries" :key="`${entry.type}-${entry.time}`" class="history-card">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="text-[15px] font-black text-slate-900">{{ getHistoryMeta(entry).title }}</div>
                  <div class="mt-1 text-[12px] font-semibold text-slate-500">{{ formatTimestamp(entry.time) }}</div>
                </div>
                <a-tag
                  :style="{
                    backgroundColor: getWorkflowStatusTheme(getHistoryMeta(entry).status).bg,
                    color: getWorkflowStatusTheme(getHistoryMeta(entry).status).text,
                    border: 'none',
                    borderRadius: '999px',
                    fontWeight: 800,
                    padding: '4px 10px',
                  }"
                >
                  {{ getHistoryMeta(entry).status }}
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
            </div>
          </div>
          <a-empty v-else class="mt-4" description="No approval history yet." />
        </section>
      </template>
    </div>

    <a-modal
      v-model:open="requestChangesOpen"
      title="Request Changes"
      :ok-button-props="{ class: 'bg-[#0284c7] border-none rounded-lg font-bold h-10 px-6' }"
      :cancel-button-props="{ class: 'rounded-lg font-bold h-10 px-6' }"
      @ok="handleRequestChanges"
    >
      <a-form layout="vertical" class="mt-4">
        <a-form-item required>
          <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Reason</span></template>
          <a-textarea
            v-model:value="requestChangesForm.note"
            :rows="4"
            class="rounded-xl border-slate-200 p-4"
            placeholder="Describe what FI needs to update before resubmitting..."
          />
        </a-form-item>
      </a-form>
    </a-modal>
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

.detail-back-button {
  margin-bottom: 16px;
  padding-inline: 0;
  color: #64748b;
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

.history-card {
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #f8fafc;
  padding: 16px;
}

.history-meta-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(180px, 0.5fr) minmax(0, 1fr);
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
  .detail-grid,
  .history-meta-grid {
    grid-template-columns: 1fr;
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
