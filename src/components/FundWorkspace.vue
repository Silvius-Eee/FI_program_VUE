<script setup lang="ts">
import { computed, ref } from 'vue';
import { BankOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useAppStore } from '../stores/app';
import { buildFundQueueRows, getFundApprovalTheme, type FundQueueRow } from '../utils/fund';
import { INPUT_LIMITS } from '../constants/inputLimits';

const store = useAppStore();

const activeStatus = ref<'pending' | 'changes_requested' | 'approved'>('pending');
const keyword = ref('');
const productType = ref('all');

const allRows = computed(() => buildFundQueueRows(store.visibleChannels));
const tabCounts = computed(() => ({
  pending: allRows.value.filter((row) => row.approvalStatus === 'pending').length,
  changes_requested: allRows.value.filter((row) => row.approvalStatus === 'changes_requested').length,
  approved: allRows.value.filter((row) => row.approvalStatus === 'approved').length,
}));

const productOptions = computed(() => ([
  { label: 'All products', value: 'all' },
  ...[...new Set(allRows.value.map((row) => row.productType))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((label) => ({ label, value: label })),
]));

const filteredRows = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  return allRows.value
    .filter((row) => row.approvalStatus === activeStatus.value)
    .filter((row) => !normalizedKeyword || row.corridorName.toLowerCase().includes(normalizedKeyword))
    .filter((row) => productType.value === 'all' || row.productType === productType.value)
    .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
});

const columns = [
  { title: 'Corridor', key: 'corridorName', width: 180 },
  { title: 'Product', key: 'productType', width: 120 },
  { title: 'Acquisition Method', key: 'acquisitionMethod', width: 190 },
  { title: 'Settlement Account Details', key: 'settlementAccountDetails', width: 270 },
  { title: 'Dispute Handling Channel', key: 'disputeHandlingChannel', width: 220 },
  { title: 'Handling Notes & References', key: 'handlingNotesReferences', width: 290 },
  { title: 'Status', key: 'approvalStatus', width: 140 },
  { title: 'Updated', key: 'updatedAt', width: 170 },
  { title: 'Action', key: 'action', width: 100 },
];

const getFundWorkspaceApprovalLabel = (status: FundQueueRow['approvalStatus']) => {
  if (status === 'approved') return 'completed';
  if (status === 'pending') return 'Under fund review';
  if (status === 'changes_requested') return 'Revision Required';
  return 'not started';
};

const getFundWorkspaceStatusDescription = (status: FundQueueRow['approvalStatus']) => {
  if (status === 'approved') return 'Final fund decision recorded.';
  if (status === 'changes_requested') return 'Revision required from FIOP.';
  return 'Under fund review.';
};

const openTask = (row: FundQueueRow) => {
  store.openFundDetail(row.channel);
};

const buildRowClick = (record: FundQueueRow) => ({
  onClick: () => openTask(record),
});

const resetFilters = () => {
  keyword.value = '';
  productType.value = 'all';
};
</script>

<template>
  <div class="fund-workspace min-h-screen">
    <div class="fund-workspace__shell">
      <section class="fund-workspace__hero">
        <div class="fund-workspace__copy">
          <div class="fund-workspace__kicker">Fund workspace</div>
          <h2 class="fund-workspace__title">Launch control for treasury review</h2>
          <p class="fund-workspace__subtitle">
            Focus the fund team on channels that FIOP has submitted for treasury review: acquisition method, settlement account details, dispute handling, and the latest approval status.
          </p>
        </div>

        <div class="fund-workspace__panel">
          <div class="fund-workspace__group">
            <div class="fund-workspace__label">Approval status</div>
            <a-segmented
              v-model:value="activeStatus"
              class="fund-workspace__segmented"
              :options="[
                { label: `Under fund review (${tabCounts.pending})`, value: 'pending' },
                { label: `Revision Required (${tabCounts.changes_requested})`, value: 'changes_requested' },
                { label: `completed (${tabCounts.approved})`, value: 'approved' },
              ]"
            />
          </div>

          <div class="fund-workspace__tools">
            <a-input v-model:value="keyword" :maxlength="INPUT_LIMITS.search" allow-clear placeholder="Search corridor" class="toolbar-control toolbar-control--search">
              <template #prefix><search-outlined class="text-slate-300" /></template>
            </a-input>
            <a-select v-model:value="productType" class="toolbar-control toolbar-control--select" :options="productOptions" />
            <a-button class="toolbar-reset" @click="resetFilters">Reset</a-button>
          </div>
        </div>
      </section>

      <a-card class="fund-workspace__table-card" :body-style="{ padding: '0' }">
        <a-table
          :data-source="filteredRows"
          :columns="columns"
          :pagination="{ pageSize: 8 }"
          :scroll="{ x: 1680 }"
          row-key="id"
          :custom-row="buildRowClick"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'corridorName'">
              <div class="corridor-cell">
                <div class="corridor-cell__title">
                  <span class="corridor-cell__icon"><bank-outlined /></span>
                  <span>{{ record.corridorName }}</span>
                </div>
                <div class="corridor-cell__meta">
                  {{ getFundWorkspaceStatusDescription(record.approvalStatus) }}
                </div>
              </div>
            </template>

            <template v-else-if="column.key === 'productType'">
              <a-tag class="table-tag">{{ record.productType }}</a-tag>
            </template>

            <template v-else-if="column.key === 'acquisitionMethod' || column.key === 'disputeHandlingChannel' || column.key === 'updatedAt'">
              <span class="value-text">{{ record[column.key] || '-' }}</span>
            </template>

            <template v-else-if="column.key === 'settlementAccountDetails' || column.key === 'handlingNotesReferences'">
              <div class="value-text value-text--multiline">
                {{ record[column.key] || '-' }}
              </div>
            </template>

            <template v-else-if="column.key === 'approvalStatus'">
              <a-tag
                :style="{
                  backgroundColor: getFundApprovalTheme(record.approvalStatus).bg,
                  color: getFundApprovalTheme(record.approvalStatus).text,
                  borderColor: getFundApprovalTheme(record.approvalStatus).border,
                  borderRadius: '999px',
                  fontWeight: 900,
                  padding: '4px 12px',
                }"
              >
                {{ getFundWorkspaceApprovalLabel(record.approvalStatus) }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'action'">
              <a-button type="link" class="action-link" @click.stop="openTask(record)">Details</a-button>
            </template>
          </template>

          <template #emptyText>
            <a-empty description="No fund tasks match the current filters." />
          </template>
        </a-table>
      </a-card>
    </div>
  </div>
</template>

<style scoped>
.fund-workspace__shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fund-workspace__hero,
.fund-workspace__table-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 24px;
  box-shadow: 0 18px 50px -32px rgba(15, 23, 42, 0.25);
}

.fund-workspace__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 1fr);
  gap: 20px;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(245, 158, 11, 0.14), transparent 42%),
    linear-gradient(135deg, #fffef7 0%, #ffffff 58%, #f8fafc 100%);
}

.fund-workspace__kicker,
.fund-workspace__label {
  color: #92400e;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.fund-workspace__title {
  margin: 8px 0 0;
  color: #111827;
  font-size: 28px;
  font-weight: 900;
  line-height: 1.02;
}

.fund-workspace__subtitle {
  margin: 10px 0 0;
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.6;
  max-width: 720px;
}

.fund-workspace__panel,
.fund-workspace__group {
  display: grid;
  gap: 10px;
}

.fund-workspace__segmented {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  padding: 4px;
}

.fund-workspace__tools {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1.2fr) 220px auto;
  align-items: center;
}

.toolbar-reset {
  border-radius: 12px;
  font-weight: 800;
}

.corridor-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.corridor-cell__title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #111827;
  font-weight: 900;
}

.corridor-cell__icon {
  color: #b45309;
}

.corridor-cell__meta,
.value-text {
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.value-text--multiline {
  max-width: 100%;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.table-tag {
  border: none;
  border-radius: 999px;
  background: #f8fafc;
  color: #475569;
  font-weight: 800;
}

.action-link {
  padding: 0;
  font-weight: 900;
}

@media (max-width: 1100px) {
  .fund-workspace__hero {
    grid-template-columns: 1fr;
  }

  .fund-workspace__tools {
    grid-template-columns: 1fr;
  }
}
</style>
