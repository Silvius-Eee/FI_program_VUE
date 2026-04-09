<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue';
import { useAppStore } from '../stores/app';
import {
  buildOnboardingQueueRows,
  getOnboardingStatusLabel,
  getOnboardingStatusTheme,
  getOnboardingTrackTitle,
  type OnboardingQueueRow,
  type OnboardingQueueTab,
} from '../constants/onboarding';

const props = defineProps<{
  isStandalone?: boolean;
}>();

const store = useAppStore();

const activeTab = computed<OnboardingQueueTab>({
  get: () => store.kycQueueTab,
  set: (value) => store.setKycQueueTab(value),
});

const filters = computed({
  get: () => store.kycQueueFilters,
  set: (value) => store.setKycQueueFilters(value),
});

const allRows = computed(() => buildOnboardingQueueRows(store.channelList, new Date()));

const ownerOptions = computed(() => ([
  { label: 'All FI owners', value: 'all' },
  ...[...new Set(allRows.value.map((row) => row.fiOwner))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((owner) => ({ label: owner, value: owner })),
]));

const tabCounts = computed(() => ({
  in_progress: allRows.value.filter((row) => row.queueTab === 'in_progress').length,
  need_fi_input: allRows.value.filter((row) => row.queueTab === 'need_fi_input').length,
  done: allRows.value.filter((row) => row.queueTab === 'done').length,
}));

const filteredRows = computed(() => {
  const keyword = filters.value.keyword.trim().toLowerCase();

  return allRows.value
    .filter((row) => row.queueTab === activeTab.value)
    .filter((row) => !keyword || row.corridorName.toLowerCase().includes(keyword))
    .filter((row) => filters.value.track === 'all' || row.track === filters.value.track)
    .filter((row) => filters.value.owner === 'all' || row.fiOwner === filters.value.owner)
    .sort((left, right) => {
      if (activeTab.value === 'in_progress') {
        return new Date(right.latestSubmissionAt).getTime() - new Date(left.latestSubmissionAt).getTime();
      }
      if (activeTab.value === 'need_fi_input') {
        return new Date(right.needInputSince).getTime() - new Date(left.needInputSince).getTime();
      }
      return new Date(right.updatedAt || right.decidedAt).getTime() - new Date(left.updatedAt || left.decidedAt).getTime();
    });
});

const columns = computed(() => {
  if (activeTab.value === 'in_progress') {
    return [
      { title: 'Corridor', key: 'corridorName' },
      { title: 'Track', key: 'track' },
      { title: 'FI Owner', key: 'fiOwner' },
      { title: 'Submitted At', key: 'latestSubmissionAt' },
      { title: 'Latest Note', key: 'latestNote' },
      { title: 'Action', key: 'action' },
    ];
  }

  if (activeTab.value === 'need_fi_input') {
    return [
      { title: 'Corridor', key: 'corridorName' },
      { title: 'Track', key: 'track' },
      { title: 'FI Owner', key: 'fiOwner' },
      { title: 'Need FI Input Since', key: 'needInputSince' },
      { title: 'Request Note', key: 'requestNote' },
      { title: 'Action', key: 'action' },
    ];
  }

  return [
    { title: 'Corridor', key: 'corridorName' },
    { title: 'Track', key: 'track' },
    { title: 'FI Owner', key: 'fiOwner' },
    { title: 'Final Status', key: 'finalStatus' },
    { title: 'Updated At', key: 'updatedAt' },
    { title: 'Action', key: 'action' },
  ];
});

const openTask = (row: OnboardingQueueRow) => {
  store.setKycQueueScrollTop(window.scrollY || 0);
  store.openKycReviewDetail(row.channel, { track: row.track });
};

const resetFilters = () => {
  store.resetKycQueueFilters();
};

const buildRowClick = (record: OnboardingQueueRow) => ({
  onClick: () => openTask(record),
});

onMounted(() => {
  nextTick(() => {
    window.scrollTo({ top: store.kycQueueScrollTop || 0 });
  });
});
</script>

<template>
  <div :class="['min-h-screen bg-transparent', isStandalone ? 'p-0' : 'p-6']">
    <div class="queue-shell">
      <section class="workspace-header">
        <div>
          <div class="workspace-kicker">Compliance Queue</div>
          <h2 class="workspace-title">KYC handoff queue by track</h2>
          <p class="workspace-subtitle">
            FI can still supplement material after the first handoff. Compliance uses this queue to find the right track, then enters the detail page to review and update status.
          </p>
        </div>
        <a-segmented
          v-model:value="activeTab"
          class="workspace-tab-switch"
          :options="[
            { label: `In Progress (${tabCounts.in_progress})`, value: 'in_progress' },
            { label: `Need FI Input (${tabCounts.need_fi_input})`, value: 'need_fi_input' },
            { label: `Done (${tabCounts.done})`, value: 'done' },
          ]"
        />
      </section>

      <section class="toolbar-card">
        <a-input
          :value="filters.keyword"
          allow-clear
          placeholder="Search Corridor"
          class="toolbar-control"
          @update:value="(value: string) => store.setKycQueueFilters({ keyword: value })"
        />
        <a-select
          :value="filters.track"
          class="toolbar-control"
          :options="[
            { label: 'All tracks', value: 'all' },
            { label: 'WooshPay onboarding', value: 'wooshpay' },
            { label: 'Corridor onboarding', value: 'corridor' },
          ]"
          @update:value="(value: 'all' | 'wooshpay' | 'corridor') => store.setKycQueueFilters({ track: value })"
        />
        <a-select
          :value="filters.owner"
          class="toolbar-control"
          :options="ownerOptions"
          @update:value="(value: string) => store.setKycQueueFilters({ owner: value })"
        />
        <a-button class="toolbar-reset" @click="resetFilters">Reset</a-button>
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
                <div class="corridor-subline">Click row for kickoff details and longer notes</div>
              </div>
            </template>

            <template v-else-if="column.key === 'track'">
              <a-tag class="track-tag">{{ getOnboardingTrackTitle(record.track) }}</a-tag>
            </template>

            <template v-else-if="column.key === 'fiOwner'">
              <a-tag class="owner-tag">{{ record.fiOwner }}</a-tag>
            </template>

            <template v-else-if="column.key === 'latestSubmissionAt' || column.key === 'needInputSince' || column.key === 'updatedAt'">
              <span class="value-text">{{ record[column.key] || '-' }}</span>
            </template>

            <template v-else-if="column.key === 'latestNote' || column.key === 'requestNote'">
              <div class="note-cell">{{ record[column.key] || 'No note yet' }}</div>
            </template>

            <template v-else-if="column.key === 'finalStatus'">
              <a-tag
                :style="{ backgroundColor: getOnboardingStatusTheme(record.status).bg, color: getOnboardingStatusTheme(record.status).text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
              >
                {{ record.finalStatus || getOnboardingStatusLabel(record.track, record.status) }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'action'">
              <a-button type="link" class="action-link" @click.stop="openTask(record)">View</a-button>
            </template>
          </template>

          <template #emptyText>
            <a-empty description="No KYC tasks match the current queue filter." />
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
  gap: 18px;
}

.workspace-header,
.toolbar-card,
.table-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 10px 30px -24px rgba(15, 23, 42, 0.3);
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 24px;
}

.workspace-kicker {
  color: #8256fc;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.workspace-title {
  margin: 10px 0 0;
  color: #111827;
  font-size: 26px;
  font-weight: 900;
  line-height: 1.1;
}

.workspace-subtitle {
  margin: 10px 0 0;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.6;
  max-width: 760px;
}

.workspace-tab-switch {
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  padding: 4px;
}

.workspace-tab-switch :deep(.ant-segmented-item-selected) {
  color: #8256fc !important;
  font-weight: 700;
}

.toolbar-card {
  display: grid;
  grid-template-columns: minmax(320px, 1.2fr) minmax(220px, 0.85fr) minmax(220px, 0.85fr) auto;
  gap: 12px;
  padding: 16px;
  align-items: center;
}

.toolbar-control {
  width: 100%;
}

.toolbar-control :deep(.ant-select-selector),
.toolbar-control :deep(.ant-input),
.toolbar-control :deep(.ant-input-affix-wrapper) {
  min-height: 42px;
  border-radius: 12px !important;
}

.toolbar-reset {
  height: 42px;
  border-radius: 12px;
  font-weight: 800;
}

.corridor-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.corridor-name {
  color: #111827;
  font-size: 14px;
  font-weight: 800;
}

.corridor-subline {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
}

.track-tag,
.owner-tag {
  border: none;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 800;
}

.track-tag {
  background: #eef2ff;
  color: #4338ca;
}

.owner-tag {
  background: #f8fafc;
  color: #475569;
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

@media (max-width: 1180px) {
  .toolbar-card {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .workspace-header {
    flex-direction: column;
  }

  .toolbar-card {
    grid-template-columns: 1fr;
  }
}
</style>
