<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowLeftOutlined } from '@ant-design/icons-vue';
import { useAppStore } from '../stores/app';
import {
  buildPricingApprovalQueueRows,
  PRICING_COMPLETED_STATUS,
  PRICING_LEGAL_REVIEW_STATUS,
  type PricingApprovalQueueRow,
  type PricingApprovalQueueTab,
} from '../constants/initialData';
import { getWorkflowStatusTheme, normalizeWorkflowStatusLabel } from '../utils/workflowStatus';
import { INPUT_LIMITS } from '../constants/inputLimits';

defineProps<{
  isStandalone?: boolean;
}>();

const store = useAppStore();

type PricingApprovalWorkspaceTab = Exclude<PricingApprovalQueueTab, 'approved'> | 'legal_review' | 'completed';

const activeTab = ref<PricingApprovalWorkspaceTab>('pending');
const keyword = ref('');
const owner = ref('all');

const normalizeQueueText = (value: unknown, fallback = '') => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
};

const allRows = computed(() => {
  try {
    return buildPricingApprovalQueueRows(store.channelList);
  } catch (error) {
    console.error('Failed to build pricing approval queue rows.', error);
    return [];
  }
});

const getWorkspaceTab = (row: PricingApprovalQueueRow): PricingApprovalWorkspaceTab | null => {
  if (row.queueTab === 'pending' || row.queueTab === 'changes_requested') return row.queueTab;

  if (row.queueTab === 'approved') {
    const normalizedStatus = normalizeWorkflowStatusLabel(row.status);
    if (normalizedStatus === PRICING_LEGAL_REVIEW_STATUS) return 'legal_review';
    if (normalizedStatus === PRICING_COMPLETED_STATUS) return 'completed';
  }

  return null;
};

const tabCounts = computed(() => ({
  pending: allRows.value.filter((row) => getWorkspaceTab(row) === 'pending').length,
  changes_requested: allRows.value.filter((row) => getWorkspaceTab(row) === 'changes_requested').length,
  legal_review: allRows.value.filter((row) => getWorkspaceTab(row) === 'legal_review').length,
  completed: allRows.value.filter((row) => getWorkspaceTab(row) === 'completed').length,
}));

const tabOptions = computed(() => ([
  { label: 'Pending', value: 'pending' as const, count: tabCounts.value.pending },
  { label: 'Returned', value: 'changes_requested' as const, count: tabCounts.value.changes_requested },
  { label: 'Legal Review', value: 'legal_review' as const, count: tabCounts.value.legal_review },
  { label: 'Completed', value: 'completed' as const, count: tabCounts.value.completed },
]));

const ownerOptions = computed(() => ([
  { label: 'All FIOPs', value: 'all' },
  ...[...new Set(
    allRows.value
      .filter((row) => getWorkspaceTab(row) === activeTab.value)
      .map((row) => normalizeQueueText(row.fiOwner))
      .filter(Boolean),
  )]
    .sort((left, right) => left.localeCompare(right))
    .map((fiOwner) => ({ label: fiOwner, value: fiOwner })),
]));

const filteredRows = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  return allRows.value
    .filter((row) => getWorkspaceTab(row) === activeTab.value)
    .filter((row) => !normalizedKeyword || normalizeQueueText(row.corridorName).toLowerCase().includes(normalizedKeyword))
    .filter((row) => owner.value === 'all' || normalizeQueueText(row.fiOwner) === owner.value)
    .sort((left, right) => new Date(right.latestActionAt || 0).getTime() - new Date(left.latestActionAt || 0).getTime());
});

const columns = computed(() => {
  return [
    { title: 'Corridor', key: 'corridorName' },
    { title: 'Quotation', key: 'quotationName' },
    { title: 'Cooperation Mode', key: 'cooperationMode' },
    { title: 'FIOP', key: 'fiOwner' },
    { title: 'Submitted At', key: 'submittedAt' },
    { title: 'Status', key: 'status' },
    { title: 'Latest Update', key: 'latestActionAt' },
    { title: 'Actor', key: 'latestActionUser' },
    { title: 'Reviewer Note', key: 'latestActionNote' },
    { title: 'Action', key: 'action' },
  ];
});

const queueSubtitle = computed(() => {
  if (activeTab.value === 'changes_requested') {
    return 'Review quotations under corridor review and reopen any record to check the latest reviewer note.';
  }
  if (activeTab.value === 'legal_review') {
    return 'Track quotations after FI Supervisor approval while Legal is reviewing the pricing flow.';
  }
  if (activeTab.value === 'completed') {
    return 'Review quotations whose Legal pricing review has been completed.';
  }
  return 'Work the next quotation under FI supervisor review, then open the full approval record in one click.';
});

const emptyDescription = computed(() => {
  if (activeTab.value === 'changes_requested') {
    return 'No returned pricing approvals match the current filters.';
  }
  if (activeTab.value === 'legal_review') {
    return 'No Legal review pricing records match the current filters.';
  }
  if (activeTab.value === 'completed') {
    return 'No completed pricing records match the current filters.';
  }
  return 'No pending pricing approvals match the current filters.';
});

const setActiveTab = (tab: PricingApprovalWorkspaceTab) => {
  activeTab.value = tab;
};

const openTask = (row: PricingApprovalQueueRow) => {
  store.openPricingApprovalDetail(row.channel, row.proposalId, { returnView: 'pricingApprovalWorkspace' });
};

const resetFilters = () => {
  keyword.value = '';
  owner.value = 'all';
};

const returnToDashboard = () => {
  store.setView('dashboard');
};

const buildRowClick = (record: PricingApprovalQueueRow) => ({
  onClick: () => openTask(record),
});
</script>

<template>
  <div class="min-h-screen bg-transparent p-0">
    <div class="queue-shell">
      <section class="workspace-control-card">
        <div class="workspace-control-card__copy">
          <a-button type="text" class="workspace-back-button" @click="returnToDashboard">
            <template #icon><arrow-left-outlined /></template>
            Back to Dashboard
          </a-button>
          <div class="workspace-kicker">FI Supervisor queue</div>
          <h2 class="workspace-title">Pricing approval workbench</h2>
          <p class="workspace-subtitle">
            {{ queueSubtitle }}
          </p>
        </div>

        <div class="workspace-control-panel">
          <div class="workspace-filter-group">
            <div class="workspace-filter-label">Status</div>
            <div class="status-queue-list" role="tablist" aria-label="Pricing approval status">
              <button
                v-for="option in tabOptions"
                :key="option.value"
                type="button"
                role="tab"
                :aria-selected="activeTab === option.value"
                :class="['status-queue-card', { 'status-queue-card--active': activeTab === option.value }]"
                @click="setActiveTab(option.value)"
              >
                <span class="status-queue-card__label">{{ option.label }}</span>
                <span class="status-queue-card__count">{{ option.count }}</span>
              </button>
            </div>
          </div>

          <div class="workspace-inline-tools">
            <a-input
              v-model:value="keyword"
              :maxlength="INPUT_LIMITS.search"
              allow-clear
              placeholder="Search corridor"
              class="toolbar-control toolbar-control--search"
            />
            <a-select
              v-model:value="owner"
              class="toolbar-control toolbar-control--owner"
              :options="ownerOptions"
            />
            <a-button class="toolbar-reset" @click="resetFilters">Reset</a-button>
          </div>
        </div>
      </section>

      <a-card class="table-card" :body-style="{ padding: '0' }">
        <a-table
          :data-source="filteredRows"
          :columns="columns"
          :pagination="{ pageSize: 8 }"
          :custom-row="buildRowClick"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'corridorName'">
              <div class="corridor-cell">
                <div class="corridor-name">{{ record.corridorName }}</div>
                <div class="corridor-subline">
                  {{
                    activeTab === 'pending'
                      ? 'Open to review the submitted quotation.'
                      : activeTab === 'changes_requested'
                        ? 'Open to review what FI needs to revise next.'
                        : activeTab === 'legal_review'
                          ? 'Open to trace Legal review progress.'
                          : 'Open to trace the completed Legal decision.'
                  }}
                </div>
              </div>
            </template>

            <template v-else-if="column.key === 'quotationName'">
              <div class="quotation-cell">
                <div class="quotation-name">{{ record.quotationName }}</div>
                <div class="quotation-subline">{{ record.paymentMethodCount }} payment methods</div>
              </div>
            </template>

            <template v-else-if="column.key === 'cooperationMode' || column.key === 'fiOwner' || column.key === 'submittedAt' || column.key === 'latestActionAt' || column.key === 'latestActionUser'">
              <span class="value-text">{{ record[column.key] || '-' }}</span>
            </template>

            <template v-else-if="column.key === 'status'">
              <a-tag
                :style="{
                  backgroundColor: getWorkflowStatusTheme(record.status).bg,
                  color: getWorkflowStatusTheme(record.status).text,
                  border: 'none',
                  borderRadius: '999px',
                  fontWeight: 800,
                  padding: '4px 12px',
                }"
              >
                {{ normalizeWorkflowStatusLabel(record.status) }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'latestActionNote'">
              <div class="note-cell">{{ record.latestActionNote || 'No note recorded.' }}</div>
            </template>

            <template v-else-if="column.key === 'action'">
              <a-button type="link" class="action-link" @click.stop="openTask(record)">
                Details
              </a-button>
            </template>
          </template>

          <template #emptyText>
            <a-empty :description="emptyDescription" />
          </template>
        </a-table>
      </a-card>
    </div>
  </div>
</template>

<style scoped>
.queue-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: calc(100vh - 48px);
}

.workspace-control-card,
.table-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 10px 30px -24px rgba(15, 23, 42, 0.3);
}

.workspace-control-card {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.92fr);
  gap: 18px;
  align-items: start;
  padding: 20px 22px;
}

.workspace-control-card__copy {
  min-width: 0;
}

.workspace-back-button {
  height: 34px;
  padding-inline: 8px;
  margin: -4px 0 10px -8px;
  border-radius: 10px;
  color: #475569;
  font-weight: 800;
}

.workspace-back-button:hover {
  color: #0f172a;
  background: #f8fafc;
}

.workspace-kicker {
  color: #0284c7;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.workspace-title {
  margin: 8px 0 0;
  color: #111827;
  font-size: 24px;
  font-weight: 900;
  line-height: 1.1;
}

.workspace-subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.55;
  max-width: 620px;
}

.workspace-control-panel {
  display: grid;
  gap: 10px;
}

.workspace-filter-group {
  display: grid;
  gap: 6px;
}

.workspace-filter-label {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.status-queue-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.status-queue-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 50px;
  padding: 10px 12px 10px 16px;
  overflow: hidden;
  color: #475569;
  background: #ffffff;
  border: 1px solid #dbe3ef;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 10px 24px -22px rgba(15, 23, 42, 0.45);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.status-queue-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  content: '';
  background: transparent;
  transition: background-color 0.16s ease;
}

.status-queue-card:hover {
  color: #1e3a8a;
  background: #f0f7ff;
  border-color: #bfdbfe;
  box-shadow: 0 14px 28px -24px rgba(37, 99, 235, 0.8);
  transform: translateY(-1px);
}

.status-queue-card:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.status-queue-card--active {
  color: #0f172a;
  background: #edf6ff;
  border-color: #60a5fa;
  box-shadow: 0 16px 32px -24px rgba(37, 99, 235, 0.85);
}

.status-queue-card--active::before {
  background: #2563eb;
}

.status-queue-card__label {
  min-width: 0;
  color: inherit;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.25;
}

.status-queue-card__count {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 24px;
  padding: 0 8px;
  color: #475569;
  font-size: 12px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  background: #e2e8f0;
  border-radius: 999px;
}

.status-queue-card--active .status-queue-card__count {
  color: #ffffff;
  background: #2563eb;
}

.workspace-inline-tools {
  display: grid;
  grid-template-columns: minmax(240px, 1.45fr) minmax(210px, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.toolbar-control {
  width: 100%;
}

.toolbar-control :deep(.ant-select-selector),
.toolbar-control :deep(.ant-input),
.toolbar-control :deep(.ant-input-affix-wrapper) {
  min-height: 40px;
  border-radius: 11px !important;
}

.toolbar-control--search,
.toolbar-control--owner {
  min-width: 0;
}

.toolbar-reset {
  height: 40px;
  border-radius: 11px;
  font-weight: 800;
  padding-inline: 16px;
  color: #475569;
  border-color: #dbe3ef;
  background: #f8fafc;
}

.corridor-cell,
.quotation-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.corridor-name,
.quotation-name {
  color: #111827;
  font-size: 14px;
  font-weight: 800;
}

.corridor-subline,
.quotation-subline {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
}

.value-text,
.note-cell {
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.note-cell {
  line-height: 1.6;
  max-width: 360px;
}

.action-link {
  padding: 0;
  font-weight: 800;
}

.table-card {
  flex: 1;
  overflow: hidden;
}

:deep(.ant-table-thead > tr > th) {
  background: #f8fafc !important;
  color: #64748b !important;
  font-size: 12px !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.06em !important;
  border-bottom: 1px solid #e2e8f0 !important;
}

:deep(.ant-table-tbody > tr > td) {
  border-bottom: 1px solid #f1f5f9 !important;
}

:deep(.ant-table-row) {
  cursor: pointer;
}

@media (max-width: 1180px) {
  .workspace-control-card {
    grid-template-columns: 1fr;
  }

  .workspace-inline-tools {
    grid-template-columns: minmax(0, 1fr) minmax(220px, 0.9fr) auto;
  }
}

@media (max-width: 720px) {
  .queue-shell {
    min-height: auto;
  }

  .workspace-control-card {
    padding: 18px 16px;
  }

  .status-queue-list {
    grid-template-columns: 1fr;
  }

  .workspace-inline-tools {
    grid-template-columns: 1fr;
  }
}
</style>
