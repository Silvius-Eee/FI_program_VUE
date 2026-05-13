<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import dayjs from 'dayjs';
import {
  ArrowLeftOutlined,
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { useAppStore } from '../stores/app';
import { chargebackHandlingOptions } from '../constants/channelOptions';
import { openAttachmentRecord } from '../utils/attachment';
import {
  buildFundPrerequisiteSnapshot,
  getSettlementCycleDisplay,
  getSettlementThresholdDisplay,
  normalizeFundApprovalStatus,
  normalizeLaunchApprovalStatus,
} from '../constants/initialData';
import {
  applyFundReviewRevocation,
  applyFundReviewSubmission,
  canRevokeFundReviewSubmission,
  getFundApprovalLabel,
  getFundApprovalTheme,
  getFundPricingScheduleList,
  isFundReviewSubmitted,
  type FundPaymentMethodRecord,
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

type FundTimelineAttachment = {
  uid: string;
  name: string;
  url?: string;
  downloadUrl?: string;
  storageId?: string;
};

const store = useAppStore();
const channel = computed(() => store.selectedChannel || null);
const actorName = computed(() => store.currentUserName);
const timestampFormat = 'YYYY-MM-DD HH:mm:ss';
const canEdit = computed(() => (
  ['FIOP', 'FIBD'].includes(store.currentUserRole)
  && Boolean(channel.value)
  && store.canAccessChannel(channel.value)
));

const approvalStatus = computed(() => normalizeFundApprovalStatus(channel.value?.fundApproval?.status));
const launchStatus = computed(() => normalizeLaunchApprovalStatus(channel.value?.launchApproval?.status));
const approvalTheme = computed(() => getFundApprovalTheme(approvalStatus.value));
const approvalLabel = computed(() => getFundApprovalLabel(approvalStatus.value));
const prerequisites = computed(() => buildFundPrerequisiteSnapshot(channel.value));
const reviewSubmitted = computed(() => Boolean(channel.value && isFundReviewSubmitted(channel.value)));
const canSubmit = computed(() => (
  canEdit.value
  && prerequisites.value.ready
  && approvalStatus.value !== 'approved'
  && (!reviewSubmitted.value || approvalStatus.value === 'changes_requested')
));
const canRevoke = computed(() => (
  canEdit.value
  && Boolean(channel.value)
  && canRevokeFundReviewSubmission(channel.value)
));
const requiresFundResubmission = computed(() => (
  launchStatus.value === 'fund_returned' || launchStatus.value === 'supervisor_returned'
));
const submitButtonText = computed(() => (
  requiresFundResubmission.value || (reviewSubmitted.value && approvalStatus.value === 'changes_requested') ? 'Resubmit to Fund' : 'Submit to Fund'
));
const submitBlockReason = computed(() => {
  if (!canEdit.value) return 'Only assigned FIOP/FIBD users can submit fund review.';
  if (!prerequisites.value.ready) return prerequisites.value.missingItems.join('; ');
  if (approvalStatus.value === 'approved') return 'Fund review is already approved.';
  if (reviewSubmitted.value && approvalStatus.value === 'pending') return 'Fund review has already been submitted.';
  return '';
});

const backendAccounts = ref<BackendAccountRow[]>([]);
const submissionNote = ref('');
const activeProposalKeys = ref<string[]>([]);

const normalizeText = (value: unknown) => String(value ?? '').trim();
const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : normalizeText(value)
      ? [normalizeText(value)]
      : []
);
const cloneBackendAccounts = (value: unknown): BackendAccountRow[] => (
  Array.isArray(value)
    ? value.map((row: any) => ({
        environmentType: normalizeText(row?.environmentType),
        environmentDetail: normalizeText(row?.environmentDetail),
        legalName: normalizeText(row?.legalName),
        tradingName: normalizeText(row?.tradingName),
        address: normalizeText(row?.address),
        account: normalizeText(row?.account),
        password: normalizeText(row?.password),
        remark: normalizeText(row?.remark),
      }))
    : []
);
const normalizeTimelineAttachments = (value: unknown): FundTimelineAttachment[] => (
  Array.isArray(value)
    ? value.map((item: any, index: number) => ({
        ...item,
        uid: normalizeText(item?.uid) || `fund-timeline-attachment-${index}`,
        name: normalizeText(item?.name),
      })).filter((item) => item.name)
    : []
);
const buildTimestamp = () => dayjs().format(timestampFormat);

const pricingSchedules = computed(() => (
  channel.value ? getFundPricingScheduleList(channel.value) : []
));
const reconMethods = computed(() => normalizeStringList(channel.value?.reconMethods));
const chargebackHandling = computed(() => normalizeStringList(channel.value?.chargebackHandling));
const chargebackOptionLabelMap = computed(() => new Map(chargebackHandlingOptions.map((option) => [option.value, option.label])));
const selectedChargebackHandlingLabels = computed(() => (
  chargebackHandling.value.map((value) => chargebackOptionLabelMap.value.get(value) || value).filter(Boolean)
));
const reconciliationMethodCards = [
  { key: 'API', desc: 'Fetch reconciliation files or raw data through an API endpoint.' },
  { key: 'Portal', desc: 'Download files manually from the corridor portal.' },
  { key: 'SFTP', desc: 'Receive files through an agreed SFTP path.' },
  { key: 'Email', desc: 'Receive recurring files by email from the corridor team.' },
  { key: 'Other', desc: 'Use another method that needs to be documented in notes.' },
];
const selectedReconciliationMethodCards = computed(() => (
  reconciliationMethodCards.filter((method) => reconMethods.value.includes(method.key))
));

const hydrateDraft = () => {
  const source = channel.value;
  backendAccounts.value = cloneBackendAccounts(source?.backendAccounts);
  submissionNote.value = normalizeText(source?.fundApproval?.submitNote);
  activeProposalKeys.value = pricingSchedules.value.length ? [pricingSchedules.value[0].proposalId] : [];
};

watch(() => channel.value?.id, hydrateDraft, { immediate: true });

const handleSubmit = () => {
  if (!channel.value) return;
  if (!canSubmit.value) {
    message.warning(submitBlockReason.value || 'This fund review cannot be submitted now.');
    return;
  }
  const isResubmission = submitButtonText.value === 'Resubmit to Fund';
  Modal.confirm({
    title: isResubmission ? 'Resubmit fund review to Fund?' : 'Submit fund review to Fund?',
    content: 'Please confirm before sending this Fund submission for treasury review.',
    okText: isResubmission ? 'Resubmit' : 'Submit',
    onOk: () => {
      if (!channel.value) return;
      const time = buildTimestamp();
      store.updateChannel(applyFundReviewSubmission(
        channel.value,
        actorName.value,
        time,
        submissionNote.value,
      ));
      message.success('Fund review submitted.');
    },
  });
};

const handleRevoke = () => {
  if (!channel.value || !canRevoke.value) return;
  Modal.confirm({
    title: 'Revoke fund review submission?',
    content: 'This removes the active Fund pending task and keeps the previous submission in the timeline as revoked.',
    okText: 'Revoke',
    okButtonProps: { danger: true },
    onOk: () => {
      const time = buildTimestamp();
      store.updateChannel(applyFundReviewRevocation(
        channel.value,
        actorName.value,
        time,
      ));
      hydrateDraft();
      message.success('Fund review submission revoked.');
    },
  });
};

const openPricingProposal = (proposalId: string) => {
  if (!channel.value) return;
  store.openFundPricingProposal(channel.value, proposalId, null, 'fundSubmit');
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(timestampFormat) : value;
};
const formatMethodFxSummary = (record: FundPaymentMethodRecord) => {
  if (record.settlement?.fxCostValue !== null && record.settlement?.fxCostValue !== undefined) {
    return `${record.settlement?.fxCostOperator || '+'} ${record.settlement.fxCostValue}%`;
  }
  return normalizeText(record.settlement?.fxCostDetails) || 'Not set';
};
const formatMethodCurrencies = (record: FundPaymentMethodRecord, source: 'acquiring' | 'settlement') => {
  const rawValue = source === 'acquiring'
    ? record.settlement?.acquiringCurrency
    : record.settlement?.settlementCurrency;
  const values = normalizeStringList(rawValue).map((item) => item.toUpperCase());
  return values.length ? values.join(', ') : 'Not set';
};

const timelineEntries = computed(() => {
  const approval = channel.value?.fundApproval || {};
  const history = Array.isArray(approval.history) ? [...approval.history] : [];
  const hasSubmitHistory = history.some((entry: any) => entry.type === 'submit');
  if ((approval.submittedAt || approval.submittedBy) && !hasSubmitHistory) {
    history.push({
      id: `fund-submit-fallback-${approval.submittedAt || approval.submittedBy}`,
      type: 'submit',
      status: 'pending',
      user: approval.submittedBy,
      time: approval.submittedAt,
      note: approval.submitNote,
    });
  }
  return history.sort((left: any, right: any) => (
    new Date(String(right?.time || '')).getTime() - new Date(String(left?.time || '')).getTime()
  ));
});
const visibleTimelineEntries = computed(() => timelineEntries.value.filter((entry: any) => entry.type !== 'revoke'));
const rechargeFlowAttachments = computed(() => (
  normalizeTimelineAttachments(channel.value?.rechargeFlowAttachments)
));
const fundTimelineFallbackAttachments = computed(() => (
  normalizeTimelineAttachments(channel.value?.corridorPayoutAccountAttachments)
));
const revocableSubmitEventId = computed(() => {
  if (!canRevoke.value) return '';
  const latestSubmit = timelineEntries.value.find((entry: any) => (
    entry.type === 'submit'
    && entry.lifecycle?.state !== 'revoked'
  ));
  return latestSubmit?.id || '';
});
const getHistoryDisplayStatus = (entry: any, index: number) => {
  if (entry?.lifecycle?.state !== 'revoked') {
    return normalizeFundApprovalStatus(entry?.status || (entry?.type === 'reopened' ? 'not_started' : 'pending'));
  }

  const previousVisibleEntry = visibleTimelineEntries.value.slice(index + 1).find((candidate: any) => (
    candidate?.lifecycle?.state !== 'revoked'
  ));
  return normalizeFundApprovalStatus(
    entry?.previousStatus
    || entry?.terminalDecision?.previousStatus
    || previousVisibleEntry?.status
    || 'not_started',
  );
};
const getTimelineAttachments = (entry: any) => {
  const entryAttachments = normalizeTimelineAttachments(entry?.attachments);
  if (entryAttachments.length) return entryAttachments;
  return entry?.type === 'submit' ? fundTimelineFallbackAttachments.value : [];
};
const openTimelineAttachment = async (attachment: FundTimelineAttachment) => {
  const opened = await openAttachmentRecord(attachment);
  if (!opened) {
    message.info('This attachment file is not available. Re-upload it or use the shared document link.');
  }
};
const openRechargeFlowAttachment = async (attachment: FundTimelineAttachment) => {
  const opened = await openAttachmentRecord(attachment);
  if (!opened) {
    message.info('This attachment file is not available. Re-upload it or use the shared document link.');
  }
};
</script>

<template>
  <div class="fund-submit-page">
    <div v-if="!channel" class="fund-submit-empty">
      <a-empty description="No corridor selected for Fund submission." />
      <a-button type="primary" class="mt-6 h-[42px] rounded-lg px-6 font-bold" @click="store.closeFundSubmit()">
        Return
      </a-button>
    </div>

    <template v-else>
      <section class="fund-submit-header">
        <div class="fund-submit-header__top">
          <a-button type="text" class="fund-submit-back" @click="store.closeFundSubmit()">
            <template #icon><arrow-left-outlined /></template>
            Back to Corridor
          </a-button>
          <div class="fund-submit-owner">
            <span>FIOP</span>
            <strong>{{ actorName }}</strong>
          </div>
        </div>

        <div class="fund-submit-title-row">
          <div class="min-w-0">
            <div class="fund-submit-kicker">Fund submission</div>
            <div class="mt-2 flex flex-wrap items-center gap-3">
              <h1 class="fund-submit-title">{{ channel.channelName || 'Unnamed Corridor' }}</h1>
              <a-tag
                :style="{
                  backgroundColor: approvalTheme.bg,
                  color: approvalTheme.text,
                  borderColor: approvalTheme.border,
                  borderRadius: '999px',
                  fontWeight: 900,
                  padding: '4px 12px',
                }"
              >
                {{ approvalLabel }}
              </a-tag>
            </div>
          </div>
          <div class="fund-submit-status-note">
            {{ reviewSubmitted ? 'Fund package has an active or processed submission record.' : 'Prepare fund facts and submit when all gates are ready.' }}
          </div>
        </div>

        <div class="fund-gate-strip">
          <div
            v-for="item in prerequisites.legalItems"
            :key="item.key"
            class="fund-gate"
            :class="{ 'fund-gate--ready': item.ready, 'fund-gate--optional': item.key === 'otherAttachments' }"
          >
            <span>{{ item.label }}{{ item.key === 'otherAttachments' ? ' (Optional)' : '' }}</span>
            <strong>{{ item.status }}</strong>
          </div>
          <div class="fund-gate" :class="{ 'fund-gate--ready': prerequisites.kycReady }">
            <span>KYC verification</span>
            <strong>WooshPay {{ prerequisites.wooshpayKycStatus }} / Corridor {{ prerequisites.corridorKycStatus }}</strong>
          </div>
        </div>
      </section>

      <div class="fund-submit-layout">
        <main class="fund-submit-main">
          <section class="fund-card">
            <div class="fund-card__heading">
              <div>
                <div class="fund-section-label">Backend Account</div>
                <p>Portal credentials and backend access information mirrored from corridor setup.</p>
              </div>
            </div>

            <div v-if="backendAccounts.length" class="fund-readonly-table-shell">
              <div class="fund-readonly-table-scroll">
                <table class="fund-readonly-table">
                  <thead>
                    <tr>
                      <th>Environment</th>
                      <th>Detail</th>
                      <th>Legal Name</th>
                      <th>Trading Name</th>
                      <th>Address</th>
                      <th>Account</th>
                      <th>Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="(row, index) in backendAccounts" :key="`backend-${index}`">
                      <tr>
                        <td>{{ row.environmentType || '-' }}</td>
                        <td>{{ row.environmentDetail || '-' }}</td>
                        <td>{{ row.legalName || '-' }}</td>
                        <td>{{ row.tradingName || '-' }}</td>
                        <td>{{ row.address || '-' }}</td>
                        <td>{{ row.account || '-' }}</td>
                        <td>{{ row.password || '-' }}</td>
                      </tr>
                      <tr class="fund-readonly-table__remark-row">
                        <td colspan="7">
                          <span>Remarks</span>
                          <strong>{{ row.remark || 'No remarks provided.' }}</strong>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-else class="fund-readonly-empty">
              <file-text-outlined />
              <strong>No backend account rows yet.</strong>
              <span>Backend account information will appear here after it is maintained in corridor detail.</span>
            </div>
          </section>

          <section class="fund-card">
            <div class="fund-card__heading">
              <div>
                <div class="fund-section-label">Recharge Flow</div>
                <p>Process for funding the corridor from our side, including negative balances, pre-funding, and other fee payments.</p>
              </div>
            </div>
            <div class="fund-readonly-stack">
              <div>
                <div class="fund-readonly-label">Remark</div>
                <div class="fund-readonly-value">
                  {{ normalizeText(channel.rechargeFlowRemark) || 'No recharge flow remark captured.' }}
                </div>
              </div>
              <div>
                <div class="fund-readonly-label">Supporting Files</div>
                <div v-if="rechargeFlowAttachments.length" class="fund-readonly-attachment-row">
                  <button
                    v-for="attachment in rechargeFlowAttachments"
                    :key="attachment.uid"
                    type="button"
                    class="fund-history-attachment"
                    @click="openRechargeFlowAttachment(attachment)"
                  >
                    <span class="truncate">{{ attachment.name }}</span>
                  </button>
                </div>
                <div v-else class="fund-readonly-empty-inline mt-2">No recharge files uploaded.</div>
              </div>
            </div>
          </section>

          <section class="fund-card">
            <div class="fund-card__heading">
              <div>
                <div class="fund-section-label">Dispute SOP</div>
                <p>Chargeback handling method and operational remarks for Fund review.</p>
              </div>
            </div>
            <div class="fund-readonly-stack">
              <div>
                <div class="fund-readonly-label">Dispute Handling Channel</div>
                <div v-if="selectedChargebackHandlingLabels.length" class="fund-readonly-pill-row">
                  <span v-for="label in selectedChargebackHandlingLabels" :key="label" class="fund-readonly-pill">{{ label }}</span>
                </div>
                <div v-else class="fund-readonly-empty-inline">No dispute handling channel captured.</div>
              </div>
              <div>
                <div class="fund-readonly-label">Handling Notes & References</div>
                <div class="fund-readonly-value">
                  {{ normalizeText(channel.chargebackRemarks) || 'No dispute SOP notes captured.' }}
                </div>
              </div>
            </div>
          </section>

          <section class="fund-card">
            <div class="fund-card__heading">
              <div>
                <div class="fund-section-label">Reconciliation</div>
                <p>Data acquisition, parsing notes, and settlement account details.</p>
              </div>
            </div>
            <div class="fund-readonly-stack">
              <div>
                <div class="fund-readonly-label">Acquisition Method</div>
                <div v-if="selectedReconciliationMethodCards.length" class="fund-readonly-method-grid">
                  <div v-for="method in selectedReconciliationMethodCards" :key="method.key" class="fund-readonly-method-card">
                    <strong>{{ method.key }}</strong>
                    <span>{{ method.desc }}</span>
                  </div>
                </div>
                <div v-else class="fund-readonly-empty-inline">No acquisition method captured.</div>
              </div>
              <div class="fund-readonly-two-col">
                <div>
                  <div class="fund-readonly-label">Detail</div>
                  <div class="fund-readonly-value">
                    {{ normalizeText(channel.reconMethodDetail) || 'No acquisition detail captured.' }}
                  </div>
                </div>
                <div>
                  <div class="fund-readonly-label">Settlement Account Details</div>
                  <div class="fund-readonly-value">
                    {{ normalizeText(channel.corridorPayoutAccount) || 'No settlement account details captured.' }}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="fund-card">
            <div class="fund-card__heading">
              <div>
                <div class="fund-section-label">Pricing Schedule list</div>
                <p>Expand a schedule to view fund-facing payment method fields.</p>
              </div>
            </div>

            <a-collapse v-if="pricingSchedules.length" v-model:activeKey="activeProposalKeys" :bordered="false" class="fund-pricing-collapse">
              <a-collapse-panel v-for="proposal in pricingSchedules" :key="proposal.proposalId">
                <template #header>
                  <div>
                    <strong>{{ proposal.proposalName }}</strong>
                    <span class="fund-panel-time">Updated {{ formatTimestamp(proposal.updatedAt) }}</span>
                  </div>
                </template>
                <template #extra>
                  <a-button type="link" class="fund-link-button" @click.stop.prevent="openPricingProposal(proposal.proposalId)">
                    <template #icon><file-text-outlined /></template>
                    View detail
                  </a-button>
                </template>

                <a-table :data-source="proposal.paymentMethodRecords" :pagination="false" row-key="methodId" :scroll="{ x: 920 }">
                  <a-table-column title="Payment Method" key="method" :width="220">
                    <template #default="{ record }">
                      <strong>{{ record.methodName }}</strong>
                    </template>
                  </a-table-column>
                  <a-table-column title="Acquiring" key="acquiringCurrency" :width="150">
                    <template #default="{ record }">{{ formatMethodCurrencies(record, 'acquiring') }}</template>
                  </a-table-column>
                  <a-table-column title="Settlement" key="settlementCurrency" :width="150">
                    <template #default="{ record }">{{ formatMethodCurrencies(record, 'settlement') }}</template>
                  </a-table-column>
                  <a-table-column title="Cycle" key="cycle" :width="140">
                    <template #default="{ record }">{{ getSettlementCycleDisplay(record.settlement) }}</template>
                  </a-table-column>
                  <a-table-column title="Threshold" key="threshold" :width="150">
                    <template #default="{ record }">{{ getSettlementThresholdDisplay(record.settlement) || 'Not set' }}</template>
                  </a-table-column>
                  <a-table-column title="FX" key="fx" :width="180">
                    <template #default="{ record }">{{ formatMethodFxSummary(record) }}</template>
                  </a-table-column>
                </a-table>
              </a-collapse-panel>
            </a-collapse>
            <a-empty v-else description="No approved pricing schedule is available for Fund review." />
          </section>

          <section class="fund-card fund-submit-action-card">
            <div>
              <div class="fund-section-label">Submission note</div>
              <p>Optional context for Fund before treasury review starts.</p>
            </div>
            <a-textarea v-model:value="submissionNote" :disabled="!canSubmit" :rows="4" placeholder="Optional context for Fund." />
            <div v-if="submitBlockReason" class="fund-block-note">{{ submitBlockReason }}</div>
            <div class="fund-submit-actions">
              <a-button type="primary" class="fund-primary-button fund-submit-button" :disabled="!canSubmit" @click="handleSubmit">
                {{ submitButtonText }}
              </a-button>
            </div>
          </section>
        </main>

        <aside class="fund-card fund-timeline">
          <div class="fund-section-label">Fund timeline</div>
          <div v-if="visibleTimelineEntries.length" class="fund-timeline-list">
            <div
              v-for="(entry, index) in visibleTimelineEntries"
              :key="entry.id"
              class="fund-history-card"
              :class="entry.lifecycle?.state === 'revoked' ? 'fund-history-card--revoked' : ''"
            >
              <div
                class="fund-history-header"
              >
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

              <div v-if="revocableSubmitEventId === entry.id" class="fund-history-action">
                <a-button class="fund-revoke-button fund-history-revoke-button" @click="handleRevoke">
                  Revoke
                </a-button>
              </div>
            </div>
          </div>
          <div v-else class="fund-history-empty">
            <strong>No fund timeline yet.</strong>
            <span>Submit this package to start the Fund review record.</span>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.fund-submit-page {
  min-height: calc(100vh - 96px);
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 26%),
    linear-gradient(180deg, #f7fbff 0%, #f8fafc 56%, #f8fafc 100%);
}

.fund-submit-empty {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.fund-submit-header,
.fund-card {
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 22px 56px -38px rgba(15, 23, 42, 0.34);
}

.fund-submit-header {
  max-width: 1280px;
  margin: 0 auto 20px;
  padding: 24px;
}

.fund-submit-header__top,
.fund-submit-title-row,
.fund-card__heading,
.fund-row-title,
.fund-submit-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.fund-submit-back {
  padding-inline: 4px;
  color: #475569;
  font-weight: 800;
}

.fund-submit-owner {
  display: grid;
  gap: 6px;
  min-width: 96px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 12px 16px;
  text-align: center;
}

.fund-submit-owner span,
.fund-section-label,
.fund-submit-kicker {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.fund-submit-owner strong,
.fund-row-title {
  color: #0f172a;
  font-size: 14px;
  font-weight: 900;
}

.fund-submit-title-row {
  margin-top: 18px;
  align-items: flex-end;
}

.fund-submit-title {
  margin: 0;
  color: #020617;
  font-size: 30px;
  font-weight: 900;
  line-height: 1.08;
}

.fund-submit-status-note,
.fund-card p,
.fund-panel-time,
.fund-history-meta,
.fund-history-note,
.fund-history-empty span {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.55;
}

.fund-submit-status-note {
  max-width: 360px;
  text-align: right;
}

.fund-gate-strip {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(172px, 1fr));
  gap: 10px;
}

.fund-gate {
  min-width: 0;
  min-height: 58px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #f8fafc;
  padding: 10px 12px;
}

.fund-gate--ready {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.fund-gate--optional {
  background: #f8fafc;
}

.fund-gate span,
.fund-gate strong {
  display: block;
}

.fund-gate span {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.fund-gate strong {
  margin-top: 6px;
  color: #0f172a;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.fund-block-note {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  border: 1px solid #fecdd3;
  border-radius: 14px;
  background: #fff1f2;
  color: #be123c;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 800;
  min-width: 0;
}

.fund-submit-layout {
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(340px, 32vw, 440px);
  gap: 20px;
  align-items: stretch;
  min-width: 0;
}

.fund-submit-main {
  min-width: 0;
  display: grid;
  gap: 18px;
}

.fund-card {
  max-width: 100%;
  overflow: hidden;
  padding: 22px;
}

.fund-card__heading {
  margin-bottom: 18px;
  min-width: 0;
}

.fund-card__heading > div:first-child {
  min-width: 0;
}

.fund-card__heading p {
  overflow-wrap: anywhere;
}

.fund-card__heading p,
.fund-submit-action-card p {
  margin: 6px 0 0;
}

.fund-primary-button {
  border: none;
  border-radius: 10px;
  background: #0284c7;
  font-weight: 900;
}

.fund-revoke-button {
  border-radius: 10px;
  font-weight: 900;
}

.fund-card :deep(.ant-input),
.fund-card :deep(.ant-input-affix-wrapper),
.fund-card :deep(.ant-input-textarea) {
  max-width: 100%;
  min-width: 0;
}

.fund-readonly-table-shell {
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #f8fafc;
  overflow: hidden;
}

.fund-readonly-table-scroll {
  overflow-x: auto;
}

.fund-readonly-table {
  width: 100%;
  min-width: 980px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.fund-readonly-table th,
.fund-readonly-table td {
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  padding: 12px;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

.fund-readonly-table th {
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fund-readonly-table td {
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
}

.fund-readonly-table__remark-row td {
  background: #ffffff;
}

.fund-readonly-table__remark-row span {
  display: block;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.fund-readonly-table__remark-row strong {
  display: block;
  margin-top: 4px;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.fund-readonly-empty {
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  border: 1px dashed #dbe3ef;
  border-radius: 18px;
  background: #f8fafc;
  color: #94a3b8;
  text-align: center;
}

.fund-readonly-empty strong,
.fund-readonly-empty span {
  display: block;
}

.fund-readonly-empty strong {
  color: #475569;
  font-size: 14px;
  font-weight: 900;
}

.fund-readonly-empty span,
.fund-readonly-empty-inline {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
}

.fund-readonly-stack {
  display: grid;
  gap: 18px;
}

.fund-readonly-label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.fund-readonly-pill-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fund-readonly-pill {
  border: 1px solid #bae6fd;
  border-radius: 999px;
  background: #f0f9ff;
  color: #0369a1;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 900;
}

.fund-readonly-attachment-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fund-readonly-value {
  margin-top: 10px;
  min-height: 72px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #f8fafc;
  color: #475569;
  padding: 14px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.fund-readonly-method-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.fund-readonly-method-card {
  border: 1px solid #dbeafe;
  border-radius: 16px;
  background: #f8fbff;
  padding: 14px;
}

.fund-readonly-method-card strong {
  display: block;
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
}

.fund-readonly-method-card span {
  display: block;
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.fund-readonly-two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.fund-pricing-collapse :deep(.ant-collapse-item) {
  border: 1px solid #e2e8f0;
  border-radius: 18px !important;
  background: #f8fafc;
  overflow: hidden;
  margin-bottom: 10px;
}

.fund-panel-time {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}

.fund-link-button {
  font-weight: 900;
}

.fund-submit-action-card {
  display: grid;
  gap: 14px;
}

.fund-submit-actions {
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.fund-revoke-button {
  border-color: #fdba74;
  background: #fff7ed;
  color: #c2410c;
}

.fund-submit-button {
  min-width: 150px;
}

.fund-timeline {
  min-width: 0;
  width: 100%;
  align-self: stretch;
  position: static;
  z-index: 0;
  display: flex;
  flex-direction: column;
  min-height: 100%;
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
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.fund-history-revoke-button {
  height: 36px;
  padding-inline: 16px;
}

.fund-revoked-badge {
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

.fund-history-empty strong {
  display: block;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 900;
}

.fund-history-empty span {
  display: block;
  margin-top: 8px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

  @media (max-width: 1100px) {
  .fund-submit-layout {
    grid-template-columns: minmax(0, 1fr) clamp(300px, 30vw, 360px);
  }

  .fund-submit-title-row,
  .fund-readonly-two-col {
    grid-template-columns: 1fr;
    display: grid;
  }

  .fund-submit-status-note {
    text-align: left;
  }

  .fund-readonly-method-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .fund-submit-layout {
    grid-template-columns: 1fr;
  }

  .fund-gate-strip,
  .fund-readonly-method-grid {
    grid-template-columns: 1fr;
  }

  .fund-submit-actions,
  .fund-card__heading {
    flex-direction: column;
    align-items: stretch;
  }

  .fund-submit-actions {
    width: 100%;
  }

  .fund-timeline {
    position: static;
    min-height: auto;
  }
}
</style>
