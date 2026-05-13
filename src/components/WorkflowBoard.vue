<script setup lang="ts">
import { computed } from 'vue';
import {
  getLegalVisiblePricingProposals,
  getLatestVisiblePricingUnifiedHistoryEntry,
  getLaunchApprovalTheme,
  getPricingLegalAggregateStatus,
  normalizeLaunchApproval,
  normalizeFundApprovalStatus,
  normalizeLaunchApprovalStatus,
} from '../constants/initialData';
import {
  getChannelOnboardingWorkflow,
  getOnboardingStatusLabel,
  getOnboardingTrackTitle,
  type OnboardingStatusKey,
  type OnboardingTrack,
} from '../constants/onboarding';
import {
  getLatestLegalStatusEntry,
  getMsaStatusTheme,
  getNdaStatusTheme,
  getWorkflowStatusTheme,
  normalizeMsaStatusLabel,
  normalizeNdaStatusLabel,
} from '../utils/workflowStatus';
import { getFundApprovalLabel, getFundApprovalTheme, isFundReviewSubmitted } from '../utils/fund';

type HistoryEntry = {
  date: string | null;
  user?: string | null;
  notes?: string | null;
};

type WorkflowNodeKey = 'kyc' | 'legal' | 'fund' | 'launch';
type WorkflowSubItem = {
  key: string;
  title: string;
  statusLabel: string;
  updatedAt?: string;
  themeKey?: OnboardingStatusKey;
};

type BoardNode = {
  key: WorkflowNodeKey;
  title: string;
  statusLabel?: string;
  history?: HistoryEntry;
  detailText?: string;
  themeKey?: OnboardingStatusKey;
  items?: WorkflowSubItem[];
  actionText?: string;
};

const props = defineProps<{
  channel: any;
  globalProgress: {
    kyc: string;
    nda: string;
    pricing: string;
    contract: string;
    tech: string;
    otherAttachments?: string;
    [key: string]: string | undefined;
  };
  submissionHistory?: {
    cdd?: HistoryEntry;
    kyc?: HistoryEntry;
    nda?: HistoryEntry;
    msa?: HistoryEntry;
    otherAttachments?: HistoryEntry;
    pricing?: HistoryEntry;
    tech?: HistoryEntry;
  };
  pricingSummary?: string;
  pricingUpdatedAt?: string;
}>();

const emit = defineEmits(['nodeClick']);

const kycItems = computed<WorkflowSubItem[]>(() => (
  (['wooshpay', 'corridor'] as OnboardingTrack[]).map((track) => {
    const workflow = getChannelOnboardingWorkflow(props.channel, track);
    return {
      key: track,
      title: getOnboardingTrackTitle(track),
      statusLabel: getOnboardingStatusLabel(track, workflow.status),
      updatedAt: workflow.lastUpdatedAt || undefined,
      themeKey: workflow.status,
    };
  })
));
const kycSummary = computed(() => (
  'KYC can move independently for WooshPay onboarding and Corridor onboarding. Open either track to submit, supplement, or review it.'
));
const kycHistory = computed<HistoryEntry | undefined>(() => (
  [props.submissionHistory?.kyc, props.submissionHistory?.cdd]
    .filter((entry): entry is HistoryEntry => Boolean(entry?.date))
    .sort((left, right) => new Date(String(right.date || '')).getTime() - new Date(String(left.date || '')).getTime())[0]
));

const ndaHistory = computed<HistoryEntry | undefined>(() => {
  const latestEntry = getLatestLegalStatusEntry(props.channel, 'NDA');
  if (!latestEntry) return props.submissionHistory?.nda?.date ? props.submissionHistory.nda : undefined;
  return {
    date: latestEntry.time,
    user: latestEntry.actorName,
    notes: latestEntry.note,
  };
});
const msaHistory = computed<HistoryEntry | undefined>(() => {
  const latestEntry = getLatestLegalStatusEntry(props.channel, 'MSA');
  if (!latestEntry) return props.submissionHistory?.msa?.date ? props.submissionHistory.msa : undefined;
  return {
    date: latestEntry.time,
    user: latestEntry.actorName,
    notes: latestEntry.note,
  };
});
const otherAttachmentsHistory = computed<HistoryEntry | undefined>(() => {
  const latestEntry = getLatestLegalStatusEntry(props.channel, 'OTHER_ATTACHMENTS');
  if (!latestEntry) return props.submissionHistory?.otherAttachments?.date ? props.submissionHistory.otherAttachments : undefined;
  return {
    date: latestEntry.time,
    user: latestEntry.actorName,
    notes: latestEntry.note,
  };
});
const legalVisiblePricingProposals = computed(() => (
  getLegalVisiblePricingProposals(props.channel?.pricingProposals || [])
));
const pricingLegalHistory = computed<HistoryEntry | undefined>(() => {
  const latestEvent = legalVisiblePricingProposals.value
    .map((proposal) => getLatestVisiblePricingUnifiedHistoryEntry(proposal))
    .filter(Boolean)
    .sort((left: any, right: any) => new Date(right.time).getTime() - new Date(left.time).getTime())[0];

  if (!latestEvent) return undefined;
  return {
    date: latestEvent.time,
    user: latestEvent.user,
    notes: latestEvent.note,
  };
});

const legalItems = computed<WorkflowSubItem[]>(() => {
  const ndaStatus = normalizeNdaStatusLabel(props.channel?.ndaStatus || props.globalProgress.nda);
  const msaStatus = normalizeMsaStatusLabel(props.channel?.contractStatus || props.globalProgress.contract);
  const pricingStatus = getPricingLegalAggregateStatus(legalVisiblePricingProposals.value);
  const otherAttachmentsStatus = normalizeMsaStatusLabel(props.channel?.otherAttachmentsStatus || props.globalProgress.otherAttachments);

  return [
    {
      key: 'nda',
      title: 'NDA',
      statusLabel: ndaStatus,
      updatedAt: ndaHistory.value?.date || undefined,
    },
    {
      key: 'msa',
      title: 'MSA',
      statusLabel: msaStatus,
      updatedAt: msaHistory.value?.date || undefined,
    },
    {
      key: 'pricing',
      title: 'Pricing Schedule',
      statusLabel: pricingStatus,
      updatedAt: pricingLegalHistory.value?.date || undefined,
    },
    {
      key: 'otherAttachments',
      title: 'Other Attachments',
      statusLabel: otherAttachmentsStatus,
      updatedAt: otherAttachmentsHistory.value?.date || undefined,
    },
  ];
});

const legalHistory = computed<HistoryEntry | undefined>(() => (
  [pricingLegalHistory.value, ndaHistory.value, msaHistory.value, otherAttachmentsHistory.value]
    .filter((entry): entry is HistoryEntry => Boolean(entry?.date))
    .sort((left, right) => new Date(String(right.date || '')).getTime() - new Date(String(left.date || '')).getTime())[0]
));

const fundHistory = computed<HistoryEntry | undefined>(() => {
  const approval = props.channel?.fundApproval || {};
  const latestHistory = Array.isArray(approval.history)
    ? [...approval.history].sort((left: any, right: any) => new Date(String(right?.time || '')).getTime() - new Date(String(left?.time || '')).getTime())[0]
    : null;
  const date = approval.lastActionAt || approval.submittedAt || latestHistory?.time;
  if (!date) return undefined;

  return {
    date,
    user: approval.lastActionBy || approval.submittedBy || latestHistory?.user,
    notes: approval.note || approval.submitNote || latestHistory?.note,
  };
});

const fundStatusLabel = computed(() => getFundApprovalLabel(
  normalizeFundApprovalStatus(props.channel?.fundApproval?.status),
));
const launchApproval = computed(() => normalizeLaunchApproval(props.channel?.launchApproval, props.channel));
const launchStatus = computed(() => normalizeLaunchApprovalStatus(launchApproval.value.status));
const supervisorReviewStatusLabel = computed(() => {
  if (
    launchStatus.value === 'not_submitted'
    || launchStatus.value === 'under_fund_review'
    || launchStatus.value === 'fund_returned'
  ) {
    return 'Not Started';
  }
  if (launchStatus.value === 'under_fi_supervisor_review') return 'Under FI Supervisor review';
  if (launchStatus.value === 'supervisor_returned') return 'Revision Required';
  return 'Completed';
});

const fundDetailText = computed(() => {
  const approval = props.channel?.fundApproval || {};
  if (launchStatus.value === 'supervisor_returned') {
    return 'FI Supervisor returned the final launch review. FIOP must resubmit Fund review after corrections.';
  }
  if (normalizeFundApprovalStatus(approval.status) === 'approved') {
    return 'Fund approval is complete. The launch task moves to FI Supervisor automatically.';
  }
  if (normalizeFundApprovalStatus(approval.status) === 'changes_requested') {
    return approval.note || 'Fund requested updates. Resubmit after the mirrored fund facts are corrected.';
  }
  if (approval.submittedAt) {
    return 'Submitted to Fund and waiting for treasury review.';
  }
  return 'Submit to Fund only after KYC, NDA, MSA, and Pricing Schedule are ready.';
});

const launchHistory = computed<HistoryEntry | undefined>(() => {
  const approval = launchApproval.value;
  const latestHistory = Array.isArray(approval.history)
    ? [...approval.history].sort((left: any, right: any) => (
        new Date(String(right?.time || '')).getTime() - new Date(String(left?.time || '')).getTime()
      ))[0]
    : null;
  const date = latestHistory?.time || approval.supervisorDecisionAt || approval.fundDecisionAt || approval.submittedAt;
  if (!date) return undefined;

  return {
    date,
    user: latestHistory?.actor || approval.supervisorDecisionBy || approval.fundDecisionBy || approval.submittedBy,
    notes: latestHistory?.note || approval.supervisorNote || approval.fundNote,
  };
});

const launchDetailText = computed(() => {
  const approval = launchApproval.value;
  if (launchStatus.value === 'live') {
    return 'FI Supervisor approved the final launch review. Corridor status is Live.';
  }
  if (launchStatus.value === 'under_fi_supervisor_review') {
    return 'Fund approved this corridor. Waiting for FI Supervisor final launch decision.';
  }
  if (launchStatus.value === 'supervisor_returned') {
    return approval.supervisorNote || 'FI Supervisor returned this launch. FIOP must resubmit Fund review.';
  }
  if (launchStatus.value === 'under_fund_review') {
    return 'Submitted to Fund. FI Supervisor review opens automatically after Fund approval.';
  }
  return 'Fund review must be submitted and approved before FI Supervisor final review starts.';
});

const fundActionText = computed(() => {
  const status = normalizeFundApprovalStatus(props.channel?.fundApproval?.status);
  if (launchStatus.value === 'supervisor_returned') return 'Resubmit to Fund';
  if (status === 'changes_requested') return 'Resubmit to Fund';
  if (status === 'approved') return 'View Fund record';
  if (isFundReviewSubmitted(props.channel)) return 'View Fund submission';
  return 'Submit to Fund';
});

const launchActionText = computed(() => {
  if (launchStatus.value === 'under_fi_supervisor_review') return 'Waiting for supervisor';
  if (launchStatus.value === 'supervisor_returned') return 'Review return reason';
  if (launchStatus.value === 'live') return 'Final decision recorded';
  return 'View status';
});

const nodes = computed<BoardNode[]>(() => [
  {
    key: 'kyc',
    title: 'KYC Verification',
    history: kycHistory.value,
    detailText: kycSummary.value,
    items: kycItems.value,
    actionText: 'Open KYC',
  },
  {
    key: 'legal',
    title: 'Legal',
    history: legalHistory.value,
    detailText: 'NDA, MSA, and Pricing Schedule can move in parallel with KYC. Use this workbench to keep legal and pricing materials ready.',
    items: legalItems.value,
    actionText: 'Open Legal',
  },
  {
    key: 'fund',
    title: 'Fund Review',
    statusLabel: fundStatusLabel.value,
    history: fundHistory.value,
    detailText: fundDetailText.value,
    actionText: fundActionText.value,
  },
  {
    key: 'launch',
    title: 'FI Supervisor Review',
    statusLabel: supervisorReviewStatusLabel.value,
    history: launchHistory.value,
    detailText: launchDetailText.value,
    actionText: launchActionText.value,
  },
]);

const primaryNodes = computed(() => nodes.value.filter((node) => node.key === 'kyc' || node.key === 'legal'));
const launchReviewNodes = computed(() => nodes.value.filter((node) => node.key === 'fund' || node.key === 'launch'));

const handleNodeClick = (node: BoardNode) => {
  emit('nodeClick', node.key);
};

const getKycStatusTheme = (status: OnboardingStatusKey) => {
  if (status === 'completed') {
    return {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      accent: '#16a34a',
      text: '#166534',
      chipBg: '#dcfce7',
      status: 'success',
    };
  }
  if (status === 'no_need') {
    return {
      bg: '#f8fafc',
      border: '#d1d5db',
      accent: '#6b7280',
      text: '#4b5563',
      chipBg: '#e5e7eb',
      status: 'default',
    };
  }
  if (status === 'wooshpay_preparation' || status === 'corridor_preparation') {
    return {
      bg: '#fff7ed',
      border: '#fdba74',
      accent: '#c2410c',
      text: '#c2410c',
      chipBg: '#ffedd5',
      status: 'processing',
    };
  }
  if (status === 'corridor_reviewing' || status === 'wooshpay_reviewing') {
    return {
      bg: '#eff6ff',
      border: '#93c5fd',
      accent: '#2563eb',
      text: '#1d4ed8',
      chipBg: '#dbeafe',
      status: 'processing',
    };
  }

  return {
    bg: '#f8fafc',
    border: '#cbd5e1',
    accent: '#64748b',
    text: '#475569',
    chipBg: '#e2e8f0',
    status: 'default',
  };
};

const getCardStatusTheme = (node: BoardNode) => {
  if (node.key === 'fund') {
    const theme = getFundApprovalTheme(normalizeFundApprovalStatus(props.channel?.fundApproval?.status));
    return {
      bg: '#ffffff',
      border: theme.border,
      accent: theme.text,
      text: theme.text,
      chipBg: theme.bg,
      status: 'processing',
    };
  }

  if (node.key === 'launch') {
    if (
      launchStatus.value === 'not_submitted'
      || launchStatus.value === 'under_fund_review'
      || launchStatus.value === 'fund_returned'
    ) {
      return {
        bg: '#ffffff',
        border: '#e2e8f0',
        accent: '#64748b',
        text: '#475569',
        chipBg: '#f1f5f9',
        status: 'default',
      };
    }

    const theme = getLaunchApprovalTheme(launchStatus.value);
    return {
      bg: '#ffffff',
      border: theme.border,
      accent: theme.text,
      text: theme.text,
      chipBg: theme.bg,
      status: launchStatus.value === 'live' ? 'success' : 'processing',
    };
  }

  if (node.key === 'kyc') {
    return {
      bg: '#ffffff',
      border: '#dbeafe',
      accent: '#2563eb',
      text: '#1d4ed8',
      chipBg: '#dbeafe',
      status: 'processing',
    };
  }

  const theme = getWorkflowStatusTheme(node.statusLabel || 'Not Started');
  return {
    bg: '#ffffff',
    border: node.key === 'legal' ? '#dbeafe' : '#e2e8f0',
    accent: theme.text,
    text: theme.text,
    chipBg: theme.bg,
    status: theme.text === '#475569' ? 'default' : 'processing',
  };
};

const getSubItemTheme = (item: WorkflowSubItem) => {
  if ((item.key === 'wooshpay' || item.key === 'corridor') && item.themeKey) {
    return getKycStatusTheme(item.themeKey);
  }
  if (item.key === 'nda') return getNdaStatusTheme(item.statusLabel);
  if (item.key === 'msa' || item.key === 'otherAttachments') return getMsaStatusTheme(item.statusLabel);
  return getWorkflowStatusTheme(item.statusLabel);
};
</script>

<template>
  <a-card
    class="clean-card shadow-sm border border-slate-100 rounded-2xl overflow-hidden mb-0 bg-white"
    :body-style="{ padding: '32px' }"
  >
    <div class="mb-8">
      <h3 class="m-0 text-[24px] font-black text-slate-900 leading-tight">Go-live Management</h3>
      <div class="text-slate-500 text-[14px] mt-2 font-medium">
        KYC and legal/pricing can progress in parallel; Fund and FI Supervisor follow after the package is ready.
      </div>
    </div>

    <div class="workflow-board-grid">
      <div
        v-for="node in primaryNodes"
        :key="node.key"
        class="group relative flex cursor-pointer flex-col overflow-hidden rounded-[28px] border p-6 transition-all duration-300 hover:-translate-y-1"
        :style="{
          background: getCardStatusTheme(node).bg,
          borderColor: getCardStatusTheme(node).border,
          boxShadow: node.key === 'legal'
            ? '0 16px 42px -34px rgba(37, 99, 235, 0.28)'
            : '0 12px 30px -30px rgba(15, 23, 42, 0.24)',
        }"
        @click="handleNodeClick(node)"
      >
        <div
          class="absolute top-5 right-5 z-10 h-2.5 w-2.5 rounded-full"
          :style="{ background: getCardStatusTheme(node).accent }"
        ></div>

        <div class="pr-8">
          <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">
            {{ node.key === 'kyc' ? 'Compliance' : 'Legal Workbench' }}
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <span class="block text-[18px] font-black leading-tight text-slate-900">{{ node.title }}</span>
            <span
              v-if="node.statusLabel"
              class="rounded-full px-3 py-1 text-[11px] font-black"
              :class="node.key === 'fund' ? '' : 'uppercase tracking-[0.12em]'"
              :style="{ background: getCardStatusTheme(node).chipBg, color: getCardStatusTheme(node).text }"
            >
              {{ node.statusLabel }}
            </span>
          </div>
        </div>

        <div class="mt-4 text-[13px] font-medium leading-relaxed text-slate-600">
          {{ node.detailText }}
        </div>

        <div v-if="node.items?.length" class="mt-5 flex-1 space-y-3">
          <div
            v-for="item in node.items"
            :key="item.key"
            class="rounded-[20px] border border-white/80 bg-white/80 px-4 py-3 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.28)]"
          >
            <div class="flex min-w-0 flex-col gap-2">
              <div class="min-w-0">
                <div class="workflow-subitem-title">{{ item.title }}</div>
                <div v-if="item.updatedAt" class="mt-1 text-[11px] font-medium leading-snug text-slate-400">Updated {{ item.updatedAt }}</div>
                <div v-else class="mt-1 text-[11px] font-medium leading-snug text-slate-400">No update records</div>
              </div>
              <span
                class="workflow-subitem-status"
                :style="{ backgroundColor: getSubItemTheme(item).bg, color: getSubItemTheme(item).text }"
              >
                {{ item.statusLabel }}
              </span>
            </div>
          </div>
        </div>

        <div v-else class="mt-5 flex-1 rounded-[20px] border border-slate-200/80 bg-white/80 px-4 py-4">
          <div v-if="node.history?.date" class="text-[12px] font-semibold text-slate-500">Updated {{ node.history.date }}</div>
          <div v-else class="text-[12px] font-semibold italic text-slate-400">No update records</div>
        </div>

        <div class="mt-5 flex items-center gap-2 border-t border-slate-200/70 pt-4">
          <div class="h-1.5 w-1.5 rounded-full" :style="{ background: getCardStatusTheme(node).accent }"></div>
          <span class="text-[12px] font-black text-sky-600 group-hover:underline">
            {{ node.actionText || 'View details' }}
          </span>
        </div>
      </div>

      <section class="launch-approval-panel">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Launch Approval</div>
            <h4 class="m-0 mt-3 text-[18px] font-black leading-tight text-slate-900">Fund & FI Supervisor</h4>
          </div>
          <div class="launch-approval-count">2 steps</div>
        </div>

        <div class="mt-3 text-[13px] font-medium leading-relaxed text-slate-600">
          Fund review and final launch approval run in sequence after KYC and legal materials are ready.
        </div>

        <div class="launch-review-steps">
          <button
            v-for="node in launchReviewNodes"
            :key="node.key"
            type="button"
            class="launch-review-step"
            :style="{
              borderColor: getCardStatusTheme(node).border,
              '--step-accent': getCardStatusTheme(node).accent,
              '--step-chip-bg': getCardStatusTheme(node).chipBg,
              '--step-chip-text': getCardStatusTheme(node).text,
            }"
            @click="handleNodeClick(node)"
          >
            <div class="launch-review-step-marker">
              {{ node.key === 'fund' ? '1' : '2' }}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {{ node.key === 'fund' ? 'Fund' : 'Final Launch' }}
                </span>
                <span class="launch-review-status">
                  {{ node.statusLabel }}
                </span>
              </div>

              <div class="mt-1 text-[16px] font-black leading-tight text-slate-900">
                {{ node.title }}
              </div>

              <div class="mt-2 text-[13px] font-medium leading-relaxed text-slate-600">
                {{ node.detailText }}
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-slate-500">
                <span v-if="node.history?.date">Updated {{ node.history.date }}</span>
                <span v-else class="italic text-slate-400">No update records</span>
              </div>

              <div class="launch-review-action">
                <span class="h-1.5 w-1.5 rounded-full bg-[var(--step-accent)]"></span>
                <span>{{ node.actionText || 'View details' }}</span>
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  </a-card>
</template>

<style scoped>
.clean-card {
  border-radius: 16px;
}

.workflow-board-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr);
}

.launch-approval-panel {
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #dbeafe;
  border-radius: 28px;
  box-shadow: 0 16px 42px -34px rgba(15, 23, 42, 0.28);
  overflow: hidden;
  padding: 24px;
}

.launch-approval-count {
  align-items: center;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #475569;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  padding: 8px 10px;
  text-transform: uppercase;
}

.launch-review-steps {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
  position: relative;
}

.launch-review-steps::before {
  background: #e2e8f0;
  bottom: 38px;
  content: '';
  left: 19px;
  position: absolute;
  top: 38px;
  width: 1px;
}

.launch-review-step {
  align-items: flex-start;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid;
  border-radius: 20px;
  color: inherit;
  cursor: pointer;
  display: flex;
  font: inherit;
  gap: 14px;
  min-height: 44px;
  padding: 16px;
  position: relative;
  text-align: left;
  touch-action: manipulation;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  width: 100%;
  z-index: 1;
}

.launch-review-step:hover {
  box-shadow: 0 16px 30px -26px rgba(15, 23, 42, 0.32);
  transform: translateY(-2px);
}

.launch-review-step:focus-visible {
  outline: 3px solid rgba(14, 165, 233, 0.2);
  outline-offset: 2px;
}

.launch-review-step-marker {
  align-items: center;
  background: var(--step-chip-bg);
  border: 1px solid var(--step-accent);
  border-radius: 999px;
  color: var(--step-chip-text);
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 900;
  height: 40px;
  justify-content: center;
  width: 40px;
}

.launch-review-status {
  background: var(--step-chip-bg);
  border-radius: 999px;
  color: var(--step-chip-text);
  display: inline-flex;
  font-size: 10px;
  font-weight: 900;
  line-height: 1.25;
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 5px 10px;
  text-transform: uppercase;
}

.launch-review-action {
  align-items: center;
  color: #0284c7;
  display: inline-flex;
  font-size: 12px;
  font-weight: 900;
  gap: 8px;
  margin-top: 12px;
}

.launch-review-step:hover .launch-review-action span:last-child {
  text-decoration: underline;
}

.workflow-subitem-title {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1.3;
  overflow-wrap: anywhere;
  text-transform: uppercase;
}

.workflow-subitem-status {
  align-self: flex-start;
  border-radius: 999px;
  display: inline-flex;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.06em;
  line-height: 1.25;
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 5px 12px;
  text-transform: uppercase;
  white-space: normal;
}

@media (min-width: 768px) {
  .workflow-board-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .launch-approval-panel {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1280px) {
  .workflow-board-grid {
    align-items: stretch;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(320px, 0.82fr);
  }

  .launch-approval-panel {
    grid-column: auto;
  }
}
</style>
