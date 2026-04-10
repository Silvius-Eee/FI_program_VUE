<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppStore } from '../stores/app';
import {
  buildPricingApprovalQueueRows,
  type PricingApprovalQueueRow,
  type PricingApprovalQueueTab,
} from '../constants/initialData';
import { getWorkflowStatusTheme, normalizeWorkflowStatusLabel } from '../utils/workflowStatus';

defineProps<{
  isStandalone?: boolean;
}>();

const store = useAppStore();

const activeTab = ref<PricingApprovalQueueTab>('pending');
const keyword = ref('');
const owner = ref('all');

const allRows = computed(() => buildPricingApprovalQueueRows(store.channelList));

const tabCounts = computed(() => ({
  pending: allRows.value.filter((row) => row.queueTab === 'pending').length,
  changes_requested: allRows.value.filter((row) => row.queueTab === 'changes_requested').length,
  approved: allRows.value.filter((row) => row.queueTab === 'approved').length,
}));

const tabOptions = computed(() => ([
  { label: `Pending (${tabCounts.value.pending})`, value: 'pending' },
  { label: `Returned (${tabCounts.value.changes_requested})`, value: 'changes_requested' },
  { label: `Approved (${tabCounts.value.approved})`, value: 'approved' },
]));

const ownerOptions = computed(() => ([
  { label: 'All FI owners', value: 'all' },
  ...[...new Set(
    allRows.value
      .filter((row) => row.queueTab === activeTab.value)
      .map((row) => row.fiOwner),
  )]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((fiOwner) => ({ label: fiOwner, value: fiOwner })),
]));

const filteredRows = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  return allRows.value
    .filter((row) => row.queueTab === activeTab.value)
    .filter((row) => !normalizedKeyword || row.corridorName.toLowerCase().includes(normalizedKeyword))
    .filter((row) => owner.value === 'all' || row.fiOwner === owner.value)
    .sort((left, right) => new Date(right.latestActionAt || 0).getTime() - new Date(left.latestActionAt || 0).getTime());
});

const columns = computed(() => {
  if (activeTab.value === 'changes_requested') {
    return [
      { title: 'Corridor', key: 'corridorName' },
      { title: 'Quotation', key: 'quotationName' },
      { title: 'FI Owner', key: 'fiOwner' },
      { title: 'Returned At', key: 'latestActionAt' },
      { title: 'Reviewer Note', key: 'latestActionNote' },
      { title: 'Action', key: 'action' },
    ];
  }

  if (activeTab.value === 'approved') {
    return [
      { title: 'Corridor', key: 'corridorName' },
      { title: 'Quotation', key: 'quotationName' },
      { title: 'FI Owner', key: 'fiOwner' },
      { title: 'Approved At', key: 'latestActionAt' },
      { title: 'Approver', key: 'latestActionUser' },
      { title: 'Action', key: 'action' },
    ];
  }

  return [
    { title: 'Corridor', key: 'corridorName' },
    { title: 'Quotation', key: 'quotationName' },
    { title: 'Cooperation Mode', key: 'cooperationMode' },
    { title: 'FI Owner', key: 'fiOwner' },
    { title: 'Submitted At', key: 'submittedAt' },
    { title: 'Status', key: 'status' },
    { title: 'Action', key: 'action' },
  ];
});

const queueSubtitle = computed(() => {
  if (activeTab.value === 'changes_requested') {
    return 'Review quotations that were sent back to FI and reopen any record to check the latest reviewer note.';
  }
  if (activeTab.value === 'approved') {
    return 'Review completed approvals and reopen any record to confirm the final pricing package and approval trail.';
  }
  return 'Work the next quotation waiting for FI Supervisor review, then open the full approval record in one click.';
});

const emptyDescription = computed(() => {
  if (activeTab.value === 'changes_requested') {
    return 'No returned pricing approvals match the current filters.';
  }
  if (activeTab.value === 'approved') {
    return 'No approved pricing records match the current filters.';
  }
  return 'No pending pricing approvals match the current filters.';
});

const openTask = (row: PricingApprovalQueueRow) => {
  store.openPricingApprovalDetail(row.channel, row.proposalId);
};

const resetFilters = () => {
  keyword.value = '';
  owner.value = 'all';
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
          <div class="workspace-kicker">FI Supervisor queue</div>
          <h2 class="workspace-title">Pricing approval workbench</h2>
          <p class="workspace-subtitle">
            {{ queueSubtitle }}
          </p>
        </div>

        <div class="workspace-control-panel">
          <div class="workspace-filter-group">
            <div class="workspace-filter-label">Status</div>
            <a-segmented
              v-model:value="activeTab"
              class="workspace-segmented workspace-segmented--status"
              :options="tabOptions"
            />
          </div>

          <div class="workspace-inline-tools">
            <a-input
              v-model:value="keyword"
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
                        : 'Open to review the completed approval record.'
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
                {{ activeTab === 'pending' ? 'Review' : 'View' }}
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

.workspace-segmented {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 3px;
}

.workspace-segmented :deep(.ant-segmented-item) {
  min-height: 36px;
  border-radius: 9px;
}

.workspace-segmented :deep(.ant-segmented-item-label) {
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
  white-space: normal;
}

.workspace-segmented :deep(.ant-segmented-item-selected) {
  color: #0f172a !important;
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

  .workspace-inline-tools {
    grid-template-columns: 1fr;
  }
}
</style>
