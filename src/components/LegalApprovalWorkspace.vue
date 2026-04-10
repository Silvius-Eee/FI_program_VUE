<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FileTextOutlined } from '@ant-design/icons-vue';
import { useAppStore } from '../stores/app';
import {
  getLatestLegalStatusEntry,
  getLegalDocumentStatusTheme,
  getLegalQueueGroup,
  getLegalQueueSubStatusOptions,
  type LegalDocType,
  type LegalQueueGroup,
  type LegalQueueSubStatus,
} from '../utils/workflowStatus';

const props = defineProps<{
  isStandalone?: boolean;
}>();

type LegalQueueRow = {
  id: string;
  channel: any;
  corridorName: string;
  fiOwner: string;
  submittedAt: string;
  latestNote: string;
  status: string;
  docType: LegalDocType;
  group: LegalQueueGroup;
};

const store = useAppStore();
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 900);

const activeDocType = ref<LegalDocType>('NDA');
const activeGroup = ref<LegalQueueGroup>('legal_pending');
const activeSubStatus = ref<LegalQueueSubStatus>('all');
const keyword = ref('');
const owner = ref('all');

watch(activeDocType, () => {
  activeGroup.value = 'legal_pending';
  activeSubStatus.value = 'all';
}, { immediate: true });

watch(activeGroup, () => {
  activeSubStatus.value = 'all';
});

const buildQueueRow = (channel: any, docType: LegalDocType): LegalQueueRow | null => {
  const status = docType === 'MSA'
    ? channel.contractStatus || channel.globalProgress?.contract
    : channel.ndaStatus || channel.globalProgress?.nda;
  const latestEvent = getLatestLegalStatusEntry(channel, docType);
  const group = getLegalQueueGroup(docType, status);

  if (group === 'inactive') return null;

  return {
    id: `${channel.id}-${docType.toLowerCase()}`,
    channel,
    corridorName: channel.channelName || 'Unnamed Corridor',
    fiOwner: channel.fiopOwner || 'Unassigned',
    submittedAt: latestEvent?.time || channel.lastModifiedAt || '',
    latestNote: latestEvent?.note || channel.legalRequestData?.[docType === 'MSA' ? 'msa' : 'nda']?.remarks || '',
    status,
    docType,
    group,
  };
};

const allRows = computed(() => store.channelList.flatMap((channel) => {
  const ndaRow = buildQueueRow(channel, 'NDA');
  const msaRow = buildQueueRow(channel, 'MSA');
  return [ndaRow, msaRow].filter(Boolean) as LegalQueueRow[];
}));

const docTypeRows = computed(() => allRows.value.filter((row) => row.docType === activeDocType.value));

const ownerOptions = computed(() => ([
  { label: 'All FI owners', value: 'all' },
  ...[...new Set(docTypeRows.value.map((row) => row.fiOwner))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((fiOwner) => ({ label: fiOwner, value: fiOwner })),
]));

const groupCounts = computed(() => ({
  NDA: {
    legal_pending: allRows.value.filter((row) => row.docType === 'NDA' && row.group === 'legal_pending').length,
    external_pending: allRows.value.filter((row) => row.docType === 'NDA' && row.group === 'external_pending').length,
    completed: allRows.value.filter((row) => row.docType === 'NDA' && row.group === 'completed').length,
    no_need: allRows.value.filter((row) => row.docType === 'NDA' && row.group === 'no_need').length,
  },
  MSA: {
    legal_pending: allRows.value.filter((row) => row.docType === 'MSA' && row.group === 'legal_pending').length,
    external_pending: allRows.value.filter((row) => row.docType === 'MSA' && row.group === 'external_pending').length,
    completed: allRows.value.filter((row) => row.docType === 'MSA' && row.group === 'completed').length,
    no_need: allRows.value.filter((row) => row.docType === 'MSA' && row.group === 'no_need').length,
  },
}));

const docTypeCounts = computed(() => ({
  NDA: allRows.value.filter((row) => row.docType === 'NDA').length,
  MSA: allRows.value.filter((row) => row.docType === 'MSA').length,
}));

const currentGroupOptions = computed(() => {
  const counts = groupCounts.value[activeDocType.value];
  const options: Array<{ label: string; value: LegalQueueGroup }> = [
    { label: `Legal action required (${counts.legal_pending})`, value: 'legal_pending' },
    { label: `Waiting on Corridor (${counts.external_pending})`, value: 'external_pending' },
    { label: `Completed (${counts.completed})`, value: 'completed' },
  ];

  if (activeDocType.value === 'NDA') {
    options.push({ label: `No Need (${counts.no_need})`, value: 'no_need' });
  }

  return options;
});

const currentSubStatusOptions = computed(() => {
  const baseOptions = getLegalQueueSubStatusOptions(activeDocType.value, activeGroup.value);
  const groupedRows = docTypeRows.value.filter((row) => row.group === activeGroup.value);

  return baseOptions.map((option) => ({
    label: `${option.label} (${option.value === 'all'
      ? groupedRows.length
      : groupedRows.filter((row) => row.status === option.value).length})`,
    value: option.value,
  }));
});

const showSubStatusFilter = computed(() => (
  activeGroup.value === 'legal_pending' || activeGroup.value === 'external_pending'
));

const filteredRows = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  return docTypeRows.value
    .filter((row) => row.group === activeGroup.value)
    .filter((row) => activeSubStatus.value === 'all' || row.status === activeSubStatus.value)
    .filter((row) => !normalizedKeyword || row.corridorName.toLowerCase().includes(normalizedKeyword))
    .filter((row) => owner.value === 'all' || row.fiOwner === owner.value)
    .sort((left, right) => new Date(right.submittedAt || 0).getTime() - new Date(left.submittedAt || 0).getTime());
});

const columns = [
  { title: 'Corridor', key: 'corridorName' },
  { title: 'FI Owner', key: 'fiOwner' },
  { title: 'Submitted At', key: 'submittedAt' },
  { title: 'Latest Note', key: 'latestNote' },
  { title: 'Current Status', key: 'status' },
  { title: 'Action', key: 'action' },
];

const tableScrollY = computed(() => (
  Math.max(360, windowHeight.value - (props.isStandalone ? 250 : 320))
));

const getRowTheme = (row: LegalQueueRow) => getLegalDocumentStatusTheme(row.docType, row.status);

const openTask = (row: LegalQueueRow) => {
  store.setSelectedChannel(row.channel);
  store.openLegalDetail(row.docType, 'dashboard');
};

const buildRowClick = (record: LegalQueueRow) => ({
  onClick: () => openTask(record),
});

const resetFilters = () => {
  keyword.value = '';
  owner.value = 'all';
  activeSubStatus.value = 'all';
};

const syncWindowHeight = () => {
  if (typeof window !== 'undefined') {
    windowHeight.value = window.innerHeight;
  }
};

onMounted(() => {
  syncWindowHeight();
  window.addEventListener('resize', syncWindowHeight);
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
          <div class="workspace-kicker">Legal Queue</div>
          <h2 class="workspace-title">NDA and MSA status handoff</h2>
          <p class="workspace-subtitle">
            Legal works from the same corridor record as FI. Open a row to review the submitted packet and sync the latest legal status back to the FI cards.
          </p>
        </div>

        <div class="workspace-control-panel">
          <div class="workspace-filter-group">
            <div class="workspace-filter-label">Document</div>
            <a-segmented
              v-model:value="activeDocType"
              class="workspace-segmented workspace-segmented--doc"
              :options="[
                { label: `NDA (${docTypeCounts.NDA})`, value: 'NDA' },
                { label: `MSA (${docTypeCounts.MSA})`, value: 'MSA' },
              ]"
            />
          </div>

          <div class="workspace-filter-group">
            <div class="workspace-filter-label">Status</div>
            <a-segmented
              v-model:value="activeGroup"
              class="workspace-segmented workspace-segmented--status"
              :options="currentGroupOptions"
            />
          </div>

          <div v-if="showSubStatusFilter" class="workspace-filter-group">
            <div class="workspace-filter-label">Sub Status</div>
            <a-segmented
              v-model:value="activeSubStatus"
              class="workspace-subsegmented"
              :options="currentSubStatusOptions"
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
          :scroll="{ x: 980, y: tableScrollY }"
          :custom-row="buildRowClick"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'corridorName'">
              <div class="corridor-cell">
                <div class="corridor-name">
                  <span class="corridor-icon"><file-text-outlined /></span>
                  <span>{{ record.corridorName }}</span>
                </div>
                <div class="corridor-subline">{{ record.docType }} packet from FIOP</div>
              </div>
            </template>

            <template v-else-if="column.key === 'fiOwner'">
              <a-tag class="owner-tag">{{ record.fiOwner }}</a-tag>
            </template>

            <template v-else-if="column.key === 'submittedAt'">
              <span class="value-text">{{ record.submittedAt || '-' }}</span>
            </template>

            <template v-else-if="column.key === 'latestNote'">
              <div class="note-cell">{{ record.latestNote || 'No note yet' }}</div>
            </template>

            <template v-else-if="column.key === 'status'">
              <a-tag
                :style="{ backgroundColor: getRowTheme(record).bg, color: getRowTheme(record).text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
              >
                {{ record.status }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'action'">
              <a-button type="link" class="action-link" @click.stop="openTask(record)">View</a-button>
            </template>
          </template>

          <template #emptyText>
            <a-empty description="No legal tasks match the current filters." />
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
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.95fr);
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
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.55;
  max-width: 640px;
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

.workspace-segmented--doc {
  background: #f0f9ff;
  border-color: #bae6fd;
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
  color: #0284c7 !important;
}

.workspace-subsegmented {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 3px;
}

.workspace-subsegmented :deep(.ant-segmented-item) {
  min-height: 32px;
  border-radius: 8px;
}

.workspace-subsegmented :deep(.ant-segmented-item-label) {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  white-space: normal;
}

.workspace-subsegmented :deep(.ant-segmented-item-selected) {
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

.corridor-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.corridor-name {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #111827;
  font-size: 14px;
  font-weight: 800;
}

.corridor-icon {
  display: inline-flex;
  height: 28px;
  width: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #f0f9ff;
  color: #0284c7;
}

.corridor-subline {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
}

.owner-tag {
  border: none;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 800;
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
