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
import { INPUT_LIMITS } from '../constants/inputLimits';

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

const trackOptions: { label: string; value: OnboardingTrack }[] = [
  { label: 'WooshPay onboarding', value: 'wooshpay' },
  { label: 'Corridor onboarding', value: 'corridor' },
];

const setActiveTrack = (track: OnboardingTrack) => {
  activeTrack.value = track;
};

const allRows = computed(() => buildOnboardingQueueRows(store.channelList, new Date()));

const ownerOptions = computed(() => ([
  { label: 'All FIOPs', value: 'all' },
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
    label: getOnboardingQueueTabLabel(activeTrack.value, tab),
    value: tab,
    count: statusCounts.value[tab],
  }))
));

const setActiveStatus = (status: OnboardingQueueTab) => {
  activeStatus.value = status;
};

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

const columns = [
  { title: 'Corridor', key: 'corridorName' },
  { title: 'Track', key: 'track' },
  { title: 'FIOP', key: 'fiOwner' },
  { title: 'Status', key: 'status' },
  { title: 'Date', key: 'queueDate' },
  { title: 'Note', key: 'queueNote' },
  { title: 'Action', key: 'action' },
];

const getQueueDate = (row: OnboardingQueueRow) => {
  if (row.queueTab === 'reviewing') return row.latestSubmissionAt;
  if (row.queueTab === 'preparation') return row.needInputSince;
  return row.decidedAt || row.updatedAt;
};

const getQueueNote = (row: OnboardingQueueRow) => {
  if (row.queueTab === 'reviewing') return row.latestNote;
  if (row.queueTab === 'preparation') return row.requestNote;
  return row.latestReviewerNote || row.latestNote;
};

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
            <div class="track-tab-list" role="tablist" aria-label="Onboarding track">
              <button
                v-for="option in trackOptions"
                :key="option.value"
                type="button"
                role="tab"
                :aria-selected="activeTrack === option.value"
                :class="['track-tab', { 'track-tab--active': activeTrack === option.value }]"
                @click="setActiveTrack(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="workspace-filter-group">
            <div class="workspace-filter-label">Status</div>
            <div class="status-queue-list" role="tablist" aria-label="KYC queue status">
              <button
                v-for="option in statusOptions"
                :key="option.value"
                type="button"
                role="tab"
                :aria-selected="activeStatus === option.value"
                :class="['status-queue-card', { 'status-queue-card--active': activeStatus === option.value }]"
                @click="setActiveStatus(option.value)"
              >
                <span class="status-queue-card__label">{{ option.label }}</span>
                <span class="status-queue-card__count">{{ option.count }}</span>
              </button>
            </div>
          </div>

          <div class="workspace-inline-tools">
            <a-input
              :value="filters.keyword"
              :maxlength="INPUT_LIMITS.search"
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
          :scroll="{ x: 1180, y: tableScrollY }"
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

            <template v-else-if="column.key === 'queueDate'">
              <span class="value-text">{{ getQueueDate(record) || '-' }}</span>
            </template>

            <template v-else-if="column.key === 'queueNote'">
              <div class="note-cell">{{ getQueueNote(record) || 'No note yet' }}</div>
            </template>

            <template v-else-if="column.key === 'status'">
              <a-tag
                :style="{ backgroundColor: getOnboardingStatusTheme(record.status).bg, color: getOnboardingStatusTheme(record.status).text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
              >
                {{ record.finalStatus || getOnboardingStatusLabel(record.track, record.status) }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'action'">
              <a-button type="link" class="action-link" @click.stop="openTask(record)">Details</a-button>
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

.track-tab-list {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  padding: 3px;
  background: #f8fbff;
  border-radius: 12px;
}

.track-tab {
  position: relative;
  min-height: 38px;
  padding: 8px 14px 10px;
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.3;
  white-space: nowrap;
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.track-tab::after {
  content: '';
  position: absolute;
  right: 14px;
  bottom: 5px;
  left: 14px;
  height: 2px;
  border-radius: 999px;
  background: transparent;
}

.track-tab:hover {
  color: #2563eb;
  background: #eef6ff;
}

.track-tab:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.track-tab--active {
  color: #1d4ed8;
  background: #eaf3ff;
}

.track-tab--active::after {
  background: #2563eb;
}

.status-queue-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(142px, 1fr));
  gap: 7px;
}

.status-queue-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 46px;
  padding: 9px 10px 9px 14px;
  overflow: hidden;
  color: #475569;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.status-queue-card:hover {
  color: #1e3a8a;
  background: #f0f7ff;
  border-color: #bfdbfe;
}

.status-queue-card:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.status-queue-card--active {
  color: #0f172a;
  background: #edf6ff;
  border-color: #bfdbfe;
}

.status-queue-card__label {
  min-width: 0;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.3;
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
  color: #1d4ed8;
  background: #dbeafe;
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
