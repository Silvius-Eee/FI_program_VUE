<script setup lang="ts">
import { computed } from 'vue';
import {
  getChannelOnboardingWorkflow,
  getKycOverviewAggregate,
  getOnboardingTrackTitle,
  type OnboardingStatusKey,
} from '../constants/onboarding';
import {
  getLatestLegalStatusEntry,
  getMsaStatusTheme,
  getNdaStatusTheme,
  getWorkflowStatusTheme,
  normalizeMsaStatusLabel,
  normalizeNdaStatusLabel,
  normalizeWorkflowStatusLabel,
} from '../utils/workflowStatus';

type HistoryEntry = {
  date: string | null;
  user?: string | null;
  notes?: string | null;
};

type WorkflowNodeKey = 'kyc' | 'nda' | 'msa' | 'pricing' | 'tech';
type BoardNode = {
  key: WorkflowNodeKey;
  title: string;
  state: string;
  statusLabel: string;
  history?: HistoryEntry;
  detailText?: string;
  themeKey?: OnboardingStatusKey;
};

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

const kycOverview = computed(() => getKycOverviewAggregate(props.channel));
const kycDriverWorkflow = computed(() => getChannelOnboardingWorkflow(props.channel, kycOverview.value.driverTrack));
const kycThemeKey = computed<OnboardingStatusKey>(() => {
  if (kycOverview.value.isTerminal) {
    return kycOverview.value.displayStatus === 'No Need' ? 'no_need' : 'completed';
  }

  return kycDriverWorkflow.value.status;
});
const kycSummary = computed(() => (
  kycOverview.value.isTerminal
    ? 'Both onboarding tracks closed'
    : `Driven by ${getOnboardingTrackTitle(kycOverview.value.driverTrack)}`
));
const kycHistory = computed<HistoryEntry | undefined>(() => (
  kycOverview.value.driverUpdatedAt ? { date: kycOverview.value.driverUpdatedAt } : undefined
));
const ndaHistory = computed<HistoryEntry | undefined>(() => {
  const latestEntry = getLatestLegalStatusEntry(props.channel, 'NDA');
  if (!latestEntry) return props.submissionHistory?.nda;
  return {
    date: latestEntry.time,
    user: latestEntry.actorName,
    notes: latestEntry.note,
  };
});
const msaHistory = computed<HistoryEntry | undefined>(() => {
  const latestEntry = getLatestLegalStatusEntry(props.channel, 'MSA');
  if (!latestEntry) return props.submissionHistory?.msa;
  return {
    date: latestEntry.time,
    user: latestEntry.actorName,
    notes: latestEntry.note,
  };
});

const nodes = computed<BoardNode[]>(() => [
  {
    key: 'kyc',
    title: 'KYC Verification',
    state: kycOverview.value.displayStatus,
    statusLabel: kycOverview.value.displayStatus,
    history: kycHistory.value,
    detailText: kycSummary.value,
    themeKey: kycThemeKey.value,
  },
  {
    key: 'nda',
    title: 'Non-Disclosure Agreement',
    state: props.globalProgress.nda,
    statusLabel: normalizeNdaStatusLabel(props.globalProgress.nda),
    history: ndaHistory.value,
  },
  {
    key: 'msa',
    title: 'Master Services Agreement',
    state: props.globalProgress.contract,
    statusLabel: normalizeMsaStatusLabel(props.globalProgress.contract),
    history: msaHistory.value,
  },
  {
    key: 'pricing',
    title: 'Pricing Schedule',
    state: props.globalProgress.pricing,
    statusLabel: normalizeWorkflowStatusLabel(props.globalProgress.pricing),
    history: props.pricingUpdatedAt ? { date: props.pricingUpdatedAt } : props.submissionHistory?.pricing,
    detailText: props.pricingSummary,
  },
  {
    key: 'tech',
    title: 'Technical Integration',
    state: props.globalProgress.tech,
    statusLabel: normalizeWorkflowStatusLabel(props.globalProgress.tech),
    history: props.submissionHistory?.tech,
  },
]);

const handleNodeClick = (key: WorkflowNodeKey) => {
  emit('nodeClick', key);
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
  if (status === 'self_preparation') {
    return {
      bg: '#fff7ed',
      border: '#fdba74',
      accent: '#c2410c',
      text: '#c2410c',
      chipBg: '#ffedd5',
      status: 'processing',
    };
  }
  if (status === 'counterparty_reviewing') {
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

const resolveNodeStatusTheme = (key: WorkflowNodeKey, state: string) => {
  if (key === 'nda') return getNdaStatusTheme(state);
  if (key === 'msa') return getMsaStatusTheme(state);
  return getWorkflowStatusTheme(state);
};

const getStatusTheme = (node: BoardNode) => {
  if (node.key === 'kyc') {
    return getKycStatusTheme(node.themeKey || 'not_started');
  }

  const theme = resolveNodeStatusTheme(node.key, node.statusLabel);
  const normalizedState = node.statusLabel.toLowerCase();
  if (normalizedState.includes('pending')) {
    return {
      bg: '#fff7ed',
      border: '#fed7aa',
      accent: theme.text,
      text: theme.text,
      chipBg: theme.bg,
      status: 'processing',
    };
  }
  if (normalizedState === 'completed' || normalizedState === 'approved' || normalizedState === 'signed') {
    return {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      accent: theme.text,
      text: theme.text,
      chipBg: theme.bg,
      status: 'success',
    };
  }
  if (normalizedState.includes('review') || normalizedState.includes('process') || normalizedState.includes('ongoing')) {
    return {
      bg: '#eff6ff',
      border: '#bfdbfe',
      accent: theme.text,
      text: theme.text,
      chipBg: theme.bg,
      status: 'processing',
    };
  }

  return {
    bg: '#ffffff',
    border: '#e2e8f0',
    accent: theme.text,
    text: theme.text,
    chipBg: theme.bg,
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
        class="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1"
        :style="{
          background: getStatusTheme(node).bg,
          borderColor: getStatusTheme(node).border,
          boxShadow: getStatusTheme(node).status === 'processing' ? '0 0 0 3px #2563eb14' : '0 1px 2px 0 rgba(15, 23, 42, 0.03)',
        }"
        @click="handleNodeClick(node.key)"
      >
        <div
          class="absolute top-4 right-4 z-10 h-2.5 w-2.5 rounded-full"
          :style="{ background: getStatusTheme(node).accent }"
        ></div>

        <div class="mb-3 pr-6">
          <span class="block text-[14px] font-black leading-tight text-slate-900">{{ node.title }}</span>
        </div>

        <div class="mb-3">
          <span
            class="rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
            :style="{ background: getStatusTheme(node).chipBg, color: getStatusTheme(node).text }"
          >
            {{ node.statusLabel }}
          </span>
        </div>

        <div class="mb-4 flex-1">
          <div v-if="node.detailText" class="text-[13px] font-bold leading-snug text-slate-700">
            {{ node.detailText }}
          </div>
          <div v-if="node.history?.date" class="mt-1.5 text-[11px] font-medium text-slate-400">Updated {{ node.history.date }}</div>
          <div v-else :class="node.key === 'kyc' ? 'mt-1.5 text-[11px] font-medium text-slate-400' : 'mt-1.5 text-[11px] font-medium italic text-slate-400'">No update records</div>
        </div>

        <div class="mt-auto flex items-center gap-2 border-t border-slate-200/50 pt-4">
          <div class="h-1.5 w-1.5 rounded-full" :style="{ background: getStatusTheme(node).accent }"></div>
          <span class="text-[12px] font-black text-sky-600 group-hover:underline">
            View details
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
</style>
