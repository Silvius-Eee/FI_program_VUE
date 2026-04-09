<script setup lang="ts">
import { computed } from 'vue';
import {
  getChannelOnboardingWorkflow,
  getLatestOnboardingReviewerNote,
  getOnboardingStatusLabel,
} from '../constants/onboarding';

type HistoryEntry = {
  date: string | null;
  user?: string | null;
  notes?: string | null;
};

type WorkflowNodeKey = 'kyc' | 'nda' | 'msa' | 'pricing' | 'tech';
type KycWorkflowPanelKey = 'kyc-cdd' | 'kyc-onboarding';

const props = defineProps<{
  channel: any;
  globalProgress: {
    kyc: string;
    nda: string;
    pricing: string;
    contract: string;
    tech: string;
  };
  submissionHistory?: {
    cdd?: HistoryEntry;
    kyc?: HistoryEntry;
    nda?: HistoryEntry;
    msa?: HistoryEntry;
    pricing?: HistoryEntry;
    tech?: HistoryEntry;
  };
  complianceStatus?: string;
  pricingSummary?: string;
  pricingUpdatedAt?: string;
}>();

const emit = defineEmits(['nodeClick']);

const resolveHistoryEntryTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const latestKycHistory = computed<HistoryEntry | undefined>(() => {
  const entries = [props.submissionHistory?.cdd, props.submissionHistory?.kyc]
    .filter((entry): entry is HistoryEntry => Boolean(entry?.date))
    .sort((left, right) => resolveHistoryEntryTimestamp(right.date) - resolveHistoryEntryTimestamp(left.date));

  return entries[0];
});

const corridorOnboarding = computed(() => getChannelOnboardingWorkflow(props.channel, 'corridor'));
const wooshpayOnboarding = computed(() => getChannelOnboardingWorkflow(props.channel, 'wooshpay'));
const getKycTrackCtaLabel = (status: string) => {
  if (status === 'not_started') return 'Start';
  if (status === 'self_preparation') return 'Need Action';
  if (status === 'counterparty_reviewing') return 'Add Supplement';
  return '';
};

const kycAggregateState = computed(() => {
  const statuses = [corridorOnboarding.value.status, wooshpayOnboarding.value.status];
  const allFinished = statuses.every((status) => ['completed', 'no_need'].includes(status));
  const allNoNeed = statuses.every((status) => status === 'no_need');
  const allNotStarted = statuses.every((status) => status === 'not_started');
  const hasOngoingStage = statuses.some((status) => ['self_preparation', 'counterparty_reviewing'].includes(status));

  if (allNoNeed) return 'No need';
  if (allFinished) return 'Completed';
  if (allNotStarted) return 'Not Started';
  if (hasOngoingStage || statuses.some((status) => status === 'completed')) return 'In Progress';

  return 'Not Started';
});

const nodes = computed(() => [
  {
    key: 'kyc' as WorkflowNodeKey,
    title: 'KYC Verification',
    state: kycAggregateState.value,
    history: latestKycHistory.value,
    checklist: [
      {
        label: 'Corridor onboarding',
        checked: ['completed', 'no_need'].includes(corridorOnboarding.value.status),
        statusLabel: getOnboardingStatusLabel('corridor', corridorOnboarding.value.status),
        updatedAt: corridorOnboarding.value.lastUpdatedAt,
        latestNote: getLatestOnboardingReviewerNote('corridor', corridorOnboarding.value)
          || 'Compliance will continue the corridor handoff directly once FI submits the contact.',
        ctaLabel: getKycTrackCtaLabel(corridorOnboarding.value.status),
        panelKey: 'kyc-cdd' as KycWorkflowPanelKey,
      },
      {
        label: 'WooshPay onboarding',
        checked: ['completed', 'no_need'].includes(wooshpayOnboarding.value.status),
        statusLabel: getOnboardingStatusLabel('wooshpay', wooshpayOnboarding.value.status),
        updatedAt: wooshpayOnboarding.value.lastUpdatedAt,
        latestNote: getLatestOnboardingReviewerNote('wooshpay', wooshpayOnboarding.value)
          || 'Compliance will continue the onboarding directly with the corridor after the first package.',
        ctaLabel: getKycTrackCtaLabel(wooshpayOnboarding.value.status),
        panelKey: 'kyc-onboarding' as KycWorkflowPanelKey,
      },
    ],
  },
  {
    key: 'nda' as WorkflowNodeKey,
    title: 'Non-Disclosure Agreement',
    state: props.globalProgress.nda,
    history: props.submissionHistory?.nda,
  },
  {
    key: 'msa' as WorkflowNodeKey,
    title: 'Master Services Agreement',
    state: props.globalProgress.contract,
    history: props.submissionHistory?.msa,
  },
  {
    key: 'pricing' as WorkflowNodeKey,
    title: 'Pricing Schedule',
    state: props.globalProgress.pricing,
    history: props.pricingUpdatedAt ? { date: props.pricingUpdatedAt } : props.submissionHistory?.pricing,
    detailText: props.pricingSummary,
  },
  {
    key: 'tech' as WorkflowNodeKey,
    title: 'Technical Integration',
    state: props.globalProgress.tech,
    history: props.submissionHistory?.tech,
  },
]);

const handleNodeClick = (key: WorkflowNodeKey | KycWorkflowPanelKey) => {
  emit('nodeClick', key);
};

const getStatusTheme = (state: string) => {
  const s = (state || 'Not Started').toLowerCase();
  if (s === 'completed' || s === 'approved' || s === 'signed') {
    return {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      accent: '#16a34a',
      text: '#166534',
      chipBg: '#dcfce7',
      label: 'Completed',
      status: 'success',
    };
  }
  if (s.includes('review') || s.includes('process') || s.includes('ongoing') || s.includes('pending')) {
    return {
      bg: '#eff6ff',
      border: '#bfdbfe',
      accent: '#2563eb',
      text: '#1d4ed8',
      chipBg: '#dbeafe',
      label: 'In Progress',
      status: 'processing',
    };
  }
  return {
    bg: '#ffffff',
    border: '#e2e8f0',
    accent: '#94a3b8',
    text: '#64748b',
    chipBg: '#f1f5f9',
    label: 'Not Started',
    status: 'default',
  };
};
</script>

<template>
  <a-card
    class="clean-card shadow-sm border border-slate-100 rounded-2xl overflow-hidden mb-0 bg-white"
    :body-style="{ padding: '32px' }"
  >
    <div class="mb-8">
      <h3 class="m-0 text-[24px] font-black text-slate-900 leading-tight">Go-live Management</h3>
      <div class="text-slate-500 text-[14px] mt-2 font-medium">Parallel approval tracks across Compliance, Legal, Pricing Schedule, and Technical Integration.</div>
    </div>

    <div class="grid grid-cols-5 gap-4">
      <div
        v-for="node in nodes"
        :key="node.key"
        class="flex flex-col p-5 rounded-2xl transition-all duration-300 border relative group overflow-hidden"
        :class="'cursor-pointer hover:-translate-y-1'"
        :style="{
          background: getStatusTheme(node.state).bg,
          borderColor: getStatusTheme(node.state).border,
          boxShadow: getStatusTheme(node.state).status === 'processing' ? '0 0 0 3px #2563eb14' : '0 1px 2px 0 rgba(15, 23, 42, 0.03)',
        }"
        @click="handleNodeClick(node.key)"
      >
        <div
          class="absolute top-4 right-4 w-2.5 h-2.5 rounded-full z-10"
          :style="{ background: getStatusTheme(node.state).accent }"
        ></div>

        <div class="mb-3 pr-6">
          <span class="text-[14px] font-black text-slate-900 leading-tight block">{{ node.title }}</span>
        </div>

        <div class="mb-3">
          <span class="text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider" :style="{ background: getStatusTheme(node.state).chipBg, color: getStatusTheme(node.state).text }">
            {{ getStatusTheme(node.state).label }}
          </span>
        </div>

        <div class="flex-1 mb-4">
          <div v-if="node.key === 'kyc'" class="kyc-milestone-list">
            <button
              v-for="item in node.checklist"
              :key="item.panelKey"
              type="button"
              class="kyc-milestone-item kyc-milestone-item--action"
              :class="item.checked ? 'is-complete' : 'is-pending'"
              @click.stop="handleNodeClick(item.panelKey)"
            >
              <span class="kyc-milestone-icon" aria-hidden="true">
                <svg
                  v-if="item.checked"
                  class="kyc-milestone-check"
                  width="10"
                  height="8"
                  viewBox="0 0 10 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="kyc-milestone-content">
                <span class="kyc-milestone-label">{{ item.label }}</span>
                <span class="kyc-milestone-meta">
                  <span class="kyc-milestone-status">{{ item.statusLabel }}</span>
                  <span v-if="item.updatedAt" class="kyc-milestone-time">{{ item.updatedAt }}</span>
                </span>
                <span class="kyc-milestone-note">{{ item.latestNote }}</span>
              </span>
              <span v-if="item.ctaLabel" class="kyc-milestone-cta">{{ item.ctaLabel }}</span>
              <svg
                class="kyc-milestone-arrow"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
          <div v-else-if="node.key === 'pricing' && node.detailText" class="text-[13px] font-bold text-slate-700 leading-snug">
            {{ node.detailText }}
          </div>
          <div v-else-if="node.state && node.state !== getStatusTheme(node.state).label" class="text-[13px] font-bold text-slate-700 leading-snug">
            {{ node.state }}
          </div>
          <div v-if="node.history?.date" class="text-[11px] text-slate-400 mt-1.5 font-medium">Updated {{ node.history.date }}</div>
          <div v-else class="text-[11px] text-slate-400 mt-1.5 font-medium italic">No update records</div>
        </div>

        <div class="flex items-center gap-2 mt-auto pt-4 border-t border-slate-200/50">
          <div class="w-1.5 h-1.5 rounded-full" :style="{ background: getStatusTheme(node.state).accent }"></div>
          <span class="text-[12px] font-black text-sky-600 group-hover:underline">
            {{ node.key === 'kyc' ? 'Manage KYC' : 'View details' }}
          </span>
        </div>
      </div>
    </div>
  </a-card>
</template>

<style scoped>
.clean-card {
  border-radius: 16px;
}

.kyc-milestone-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kyc-milestone-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 24px;
  width: 100%;
}

.kyc-milestone-item--action {
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
}

.kyc-milestone-item--action:hover {
  transform: translateX(2px);
  border-color: #dbeafe;
  background: rgba(239, 246, 255, 0.72);
}

.kyc-milestone-icon {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1.5px solid #cbd5e1;
  background: #ffffff;
}

.kyc-milestone-check {
  color: #ffffff;
}

.kyc-milestone-label {
  font-size: 12px;
  line-height: 1.45;
  font-weight: 700;
}

.kyc-milestone-content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.kyc-milestone-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.kyc-milestone-status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.82);
  color: #475569;
  font-size: 10px;
  font-weight: 800;
}

.kyc-milestone-time {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
}

.kyc-milestone-note {
  color: #64748b;
  font-size: 11px;
  line-height: 1.5;
  font-weight: 600;
}

.kyc-milestone-cta {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  background: #f5f3ff;
  color: #7c3aed;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.kyc-milestone-arrow {
  color: #94a3b8;
  flex-shrink: 0;
  transition: color 0.18s ease, transform 0.18s ease;
}

.kyc-milestone-item--action:hover .kyc-milestone-arrow {
  color: #0284c7;
  transform: translateX(1px);
}

.kyc-milestone-item.is-complete .kyc-milestone-icon {
  border-color: #16a34a;
  background: #16a34a;
  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.08);
}

.kyc-milestone-item.is-complete .kyc-milestone-label {
  color: #1f2937;
}

.kyc-milestone-item.is-pending .kyc-milestone-icon {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.kyc-milestone-item.is-pending .kyc-milestone-label {
  color: #64748b;
}
</style>
