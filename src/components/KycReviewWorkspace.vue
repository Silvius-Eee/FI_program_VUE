<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAppStore } from '../stores/app';
import {
  buildOnboardingQueueRows,
  getOnboardingQueueTabLabel,
  getOnboardingStatusLabel,
  getOnboardingStatusTheme,
  getOnboardingTrackTitle,
  type OnboardingQueueRow,
  type OnboardingQueueTab,
  type OnboardingTrack,
} from '../constants/onboarding';

const props = defineProps<{
  isStandalone?: boolean;
}>();

const store = useAppStore();
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 900);

const activeStatus = computed<OnboardingQueueTab>({
  get: () => store.kycQueueTab,
  set: (value) => store.setKycQueueTab(value),
});

const filters = computed({
  get: () => store.kycQueueFilters,
  set: (value) => store.setKycQueueFilters(value),
});

const activeTrack = computed<OnboardingTrack>({
  get: () => filters.value.track === 'corridor' ? 'corridor' : 'wooshpay',
  set: (value) => store.setKycQueueFilters({ track: value }),
});

const allRows = computed(() => buildOnboardingQueueRows(store.channelList, new Date()));

const ownerOptions = computed(() => ([
  { label: 'All FI owners', value: 'all' },
  ...[...new Set(
    allRows.value
      .filter((row) => row.track === activeTrack.value)
      .map((row) => row.fiOwner),
  )]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((owner) => ({ label: owner, value: owner })),
]));

const statusOrder: OnboardingQueueTab[] = ['preparation', 'reviewing', 'completed', 'no_need'];

const statusCounts = computed(() => (
  statusOrder.reduce<Record<OnboardingQueueTab, number>>((counts, tab) => {
    counts[tab] = allRows.value.filter((row) => row.track === activeTrack.value && row.queueTab === tab).length;
    return counts;
  }, {
    preparation: 0,
    reviewing: 0,
    completed: 0,
    no_need: 0,
  })
));

const statusOptions = computed(() => (
  statusOrder.map((tab) => ({
    label: `${getOnboardingQueueTabLabel(activeTrack.value, tab)} (${statusCounts.value[tab]})`,
    value: tab,
  }))
));

const filteredRows = computed(() => {
  const keyword = filters.value.keyword.trim().toLowerCase();

  return allRows.value
    .filter((row) => row.track === activeTrack.value)
    .filter((row) => row.queueTab === activeStatus.value)
    .filter((row) => !keyword || row.corridorName.toLowerCase().includes(keyword))
    .filter((row) => filters.value.owner === 'all' || row.fiOwner === filters.value.owner)
    .sort((left, right) => {
      if (activeStatus.value === 'reviewing') {
        return new Date(right.latestSubmissionAt).getTime() - new Date(left.latestSubmissionAt).getTime();
      }
      if (activeStatus.value === 'preparation') {
        return new Date(right.needInputSince).getTime() - new Date(left.needInputSince).getTime();
      }
      return new Date(right.decidedAt || right.updatedAt).getTime() - new Date(left.decidedAt || left.updatedAt).getTime();
    });
});

const columns = computed(() => {
  if (activeStatus.value === 'reviewing') {
    return [
      { title: 'Corridor', key: 'corridorName' },
      { title: 'Review track', key: 'track' },
      { title: 'FI owner', key: 'fiOwner' },
      { title: 'Submitted for review', key: 'latestSubmissionAt' },
      { title: 'What FI shared', key: 'latestNote' },
      { title: 'Action', key: 'action' },
    ];
  }

  if (activeStatus.value === 'preparation') {
    return [
      { title: 'Corridor', key: 'corridorName' },
      { title: 'Update track', key: 'track' },
      { title: 'FI owner', key: 'fiOwner' },
      { title: 'Update requested on', key: 'needInputSince' },
      { title: 'Reviewer note', key: 'requestNote' },
      { title: 'Action', key: 'action' },
    ];
  }

  return [
    { title: 'Corridor', key: 'corridorName' },
    { title: 'Track', key: 'track' },
    { title: 'FI owner', key: 'fiOwner' },
    { title: 'Decision', key: 'finalStatus' },
    { title: 'Closed on', key: 'decidedAt' },
    { title: 'Action', key: 'action' },
  ];
});

const topTrackDescription = computed(() => (
  activeTrack.value === 'wooshpay'
    ? 'Start with the WooshPay onboarding track, then open the next task that needs a review decision or FI follow-up.'
    : 'Start with the Corridor onboarding track, then open the next task that needs a review decision or FI follow-up.'
));

const emptyDescription = computed(() => {
  const statusLabel = getOnboardingQueueTabLabel(activeTrack.value, activeStatus.value);
  return `No ${statusLabel} tasks match the current filters.`;
});

const tableScrollY = computed(() => (
  Math.max(360, windowHeight.value - (props.isStandalone ? 250 : 320))
));

const openTask = (row: OnboardingQueueRow) => {
  store.setKycQueueScrollTop(window.scrollY || 0);
  store.openKycReviewDetail(row.channel, { track: row.track });
};

const resetFilters = () => {
  store.setKycQueueFilters({
    keyword: '',
    owner: 'all',
    track: activeTrack.value,
  });
};

const buildRowClick = (record: OnboardingQueueRow) => ({
  onClick: () => openTask(record),
});

const syncWindowHeight = () => {
  if (typeof window !== 'undefined') {
    windowHeight.value = window.innerHeight;
  }
};

onMounted(() => {
  if (filters.value.track === 'all') {
    store.setKycQueueFilters({ track: 'wooshpay' });
  }

  syncWindowHeight();
  window.addEventListener('resize', syncWindowHeight);

  nextTick(() => {
    window.scrollTo({ top: store.kycQueueScrollTop || 0 });
  });
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncWindowHeight);
  }
});
</script>

<template>
  <div :class="['min-h-screen bg-transparent', isStandalone ? 'p-0' : 'p-6']">
    <div class="queue-shell">
      <section class="workspace-control-card">
        <div class="workspace-control-card__copy">
          <div class="workspace-kicker">Compliance queue</div>
          <h2 class="workspace-title">Work the next onboarding task</h2>
          <p class="workspace-subtitle">
            {{ topTrackDescription }}
          </p>
        </div>

        <div class="workspace-control-panel">
          <div class="workspace-filter-group">
            <div class="workspace-filter-label">Track</div>
            <a-segmented
              v-model:value="activeTrack"
              class="workspace-segmented workspace-segmented--track"
              :options="[
                { label: 'WooshPay onboarding', value: 'wooshpay' },
                { label: 'Corridor onboarding', value: 'corridor' },
              ]"
            />
          </div>

          <div class="workspace-filter-group">
            <div class="workspace-filter-label">Status</div>
            <a-segmented
              v-model:value="activeStatus"
              class="workspace-segmented workspace-segmented--status"
              :options="statusOptions"
            />
          </div>

          <div class="workspace-inline-tools">
            <a-input
              :value="filters.keyword"
              allow-clear
              placeholder="Search corridor"
              class="toolbar-control toolbar-control--search"
              @update:value="(value: string) => store.setKycQueueFilters({ keyword: value })"
            />
            <a-select
              :value="filters.owner"
              class="toolbar-control toolbar-control--owner"
              :options="ownerOptions"
              @update:value="(value: string) => store.setKycQueueFilters({ owner: value })"
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
          :scroll="{ x: 980, y: tableScrollY }"
          :custom-row="buildRowClick"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'corridorName'">
              <div class="corridor-cell">
                <div class="corridor-name">{{ record.corridorName }}</div>
                <div class="corridor-subline">
                  {{
                    activeStatus === 'reviewing'
                      ? 'Open the task to review the current submission.'
                      : activeStatus === 'preparation'
                        ? 'Open the task to see what FI needs to update.'
                        : 'Open the task to read the closed workflow record.'
                  }}
                </div>
              </div>
            </template>

            <template v-else-if="column.key === 'track'">
              <a-tag class="track-tag">{{ getOnboardingTrackTitle(record.track) }}</a-tag>
            </template>

            <template v-else-if="column.key === 'fiOwner'">
              <a-tag class="owner-tag">{{ record.fiOwner }}</a-tag>
            </template>

            <template v-else-if="['latestSubmissionAt', 'needInputSince', 'decidedAt'].includes(String(column.key))">
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
              <a-button type="link" class="action-link" @click.stop="openTask(record)">Open</a-button>
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
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.9fr);
  gap: 18px;
  align-items: start;
  padding: 20px 22px;
}

.workspace-control-card__copy {
  min-width: 0;
}

.workspace-kicker {
  color: #8256fc;
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
  color: #6b7280;
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

.workspace-segmented--track {
  background: #eef2ff;
  border-color: #c7d2fe;
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

.toolbar-control--search {
  min-width: 0;
}

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

.table-card {
  flex: 1;
  overflow: hidden;
}

.table-card :deep(.ant-card-body) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-card :deep(.ant-table-wrapper) {
  flex: 1;
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
