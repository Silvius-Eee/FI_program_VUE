<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FileTextOutlined } from '@ant-design/icons-vue';
import { useAppStore } from '../stores/app';
import {
  getLatestPricingApprovalHistoryEvent,
  getLatestVisiblePricingUnifiedHistoryEntry,
  getLegalVisiblePricingProposals,
  getPricingLegalQueueGroup,
  getPricingLegalStageStatus,
  PRICING_LEGAL_QUEUE_STATUS_VALUES,
} from '../constants/initialData';
import {
  COMMON_LEGAL_DOCUMENT_QUEUE_STATUS_VALUES,
  getLatestLegalStatusEntry,
  getLegalDocumentStatusTheme,
  getLegalQueueGroup,
  getWorkflowStatusTheme,
  NDA_QUEUE_STATUS_VALUES,
  normalizeLegalDocumentStatusLabel,
  type LegalDocType,
  type LegalQueueGroup,
} from '../utils/workflowStatus';
import { INPUT_LIMITS } from '../constants/inputLimits';

defineProps<{ isStandalone?: boolean }>();

type WorkspaceDocType = LegalDocType | 'PRICING';
type LegalQueueRow = {
  id: string;
  channel: any;
  corridorName: string;
  documentLabel: string;
  fiOwner: string;
  submittedAt: string;
  date: string;
  latestNote: string;
  note: string;
  status: string;
  docType: WorkspaceDocType;
  group: LegalQueueGroup;
  proposalId?: string | null;
};

const store = useAppStore();
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 900);
const activeDocType = ref<WorkspaceDocType>(store.legalQueuePreferredDocType || 'NDA');
const activeStatus = ref('');
const keyword = ref('');
const owner = ref('all');

const documentLabelMap: Record<WorkspaceDocType, string> = {
  NDA: 'NDA',
  MSA: 'MSA',
  OTHER_ATTACHMENTS: 'Other Attachments',
  PRICING: 'Pricing Schedule',
};

const statusValuesByDocType: Record<WorkspaceDocType, string[]> = {
  NDA: [...NDA_QUEUE_STATUS_VALUES],
  MSA: [...COMMON_LEGAL_DOCUMENT_QUEUE_STATUS_VALUES],
  OTHER_ATTACHMENTS: [...COMMON_LEGAL_DOCUMENT_QUEUE_STATUS_VALUES],
  PRICING: [...PRICING_LEGAL_QUEUE_STATUS_VALUES],
};

const buildCorridorRow = (channel: any, docType: LegalDocType): LegalQueueRow | null => {
  const rawStatus = docType === 'MSA'
    ? channel.contractStatus || channel.globalProgress?.contract
    : docType === 'OTHER_ATTACHMENTS'
      ? channel.otherAttachmentsStatus || channel.globalProgress?.otherAttachments
      : channel.ndaStatus || channel.globalProgress?.nda;
  const latestEvent = getLatestLegalStatusEntry(channel, docType);
  const status = normalizeLegalDocumentStatusLabel(docType, rawStatus);
  const group = getLegalQueueGroup(docType, status);

  if (group === 'inactive') {
    return null;
  }

  const submittedAt = latestEvent?.time || channel.lastModifiedAt || '';
  const latestNote = latestEvent?.note || channel.legalRequestData?.[docType === 'MSA' ? 'msa' : docType === 'OTHER_ATTACHMENTS' ? 'otherAttachments' : 'nda']?.remarks || '';

  return {
    id: `${channel.id}-${String(docType).toLowerCase()}`,
    channel,
    corridorName: channel.channelName || 'Unnamed Corridor',
    documentLabel: documentLabelMap[docType],
    fiOwner: channel.fiopOwner || 'Unassigned',
    submittedAt,
    date: submittedAt,
    latestNote,
    note: latestNote,
    status,
    docType,
    group,
  };
};

const buildPricingRows = (channel: any): LegalQueueRow[] => {
  const proposals: any[] = getLegalVisiblePricingProposals(channel?.pricingProposals);
  return proposals.reduce<LegalQueueRow[]>((rows, proposal: any) => {
    const latestVisibleEvent = getLatestVisiblePricingUnifiedHistoryEntry(proposal);
    const latestApproveEvent = getLatestPricingApprovalHistoryEvent(proposal, 'approve');
    const submittedAt = latestVisibleEvent?.time || latestApproveEvent?.time || proposal.updatedAt || '';
    const latestNote = latestVisibleEvent?.note || latestApproveEvent?.note || proposal.remark || '';
    const status = getPricingLegalStageStatus(proposal);
    const group = getPricingLegalQueueGroup(proposal);

    if (!PRICING_LEGAL_QUEUE_STATUS_VALUES.includes(status as any)) {
      return rows;
    }

    rows.push({
      id: `${channel.id}-${proposal.id}-pricing`,
      channel,
      corridorName: channel.channelName || 'Unnamed Corridor',
      documentLabel: documentLabelMap.PRICING,
      fiOwner: channel.fiopOwner || 'Unassigned',
      submittedAt,
      date: submittedAt,
      latestNote,
      note: latestNote,
      status,
      docType: 'PRICING',
      group,
      proposalId: proposal.id,
    });
    return rows;
  }, []);
};

const allRows = computed(() => store.channelList.flatMap((channel) => {
  const ndaRow = buildCorridorRow(channel, 'NDA');
  const msaRow = buildCorridorRow(channel, 'MSA');
  const otherAttachmentsRow = buildCorridorRow(channel, 'OTHER_ATTACHMENTS');
  return [ndaRow, msaRow, otherAttachmentsRow, ...buildPricingRows(channel)].filter((row): row is LegalQueueRow => Boolean(row));
}));

const docTypeRows = computed(() => allRows.value.filter((row) => row.docType === activeDocType.value));
const ownerOptions = computed(() => ([
  { label: 'All FIOPs', value: 'all' },
  ...[...new Set(docTypeRows.value.map((row) => row.fiOwner))].filter(Boolean).sort((left, right) => left.localeCompare(right)).map((fiOwner) => ({ label: fiOwner, value: fiOwner })),
]));
const docTypeCounts = computed(() => ({
  NDA: allRows.value.filter((row) => row.docType === 'NDA').length,
  MSA: allRows.value.filter((row) => row.docType === 'MSA').length,
  OTHER_ATTACHMENTS: allRows.value.filter((row) => row.docType === 'OTHER_ATTACHMENTS').length,
  PRICING: allRows.value.filter((row) => row.docType === 'PRICING').length,
}));

const countStatusFor = (docType: WorkspaceDocType, status: string) => (
  allRows.value.filter((row) => row.docType === docType && row.status === status).length
);
const getDefaultStatus = (docType: WorkspaceDocType) => (
  statusValuesByDocType[docType].find((status) => countStatusFor(docType, status) > 0)
  || statusValuesByDocType[docType][0]
);
const statusOptions = computed(() => statusValuesByDocType[activeDocType.value].map((status) => ({
  label: `${status} (${countStatusFor(activeDocType.value, status)})`,
  value: status,
})));

watch(() => store.legalQueuePreferredDocType, (docType) => {
  if (docType && docType !== activeDocType.value) {
    activeDocType.value = docType;
  }
}, { immediate: true });

watch(activeDocType, () => {
  store.legalQueuePreferredDocType = activeDocType.value;
  activeStatus.value = getDefaultStatus(activeDocType.value);
}, { immediate: true });

watch(statusOptions, () => {
  if (!statusValuesByDocType[activeDocType.value].includes(activeStatus.value)) {
    activeStatus.value = getDefaultStatus(activeDocType.value);
  }
});

const filteredRows = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();
  return docTypeRows.value
    .filter((row) => row.status === activeStatus.value)
    .filter((row) => !normalizedKeyword || row.corridorName.toLowerCase().includes(normalizedKeyword))
    .filter((row) => owner.value === 'all' || row.fiOwner === owner.value)
    .sort((left, right) => new Date(right.submittedAt || 0).getTime() - new Date(left.submittedAt || 0).getTime());
});

const columns = [
  { title: 'Corridor', key: 'corridorName' },
  { title: 'Document', key: 'documentLabel' },
  { title: 'FIOP', key: 'fiOwner' },
  { title: 'Status', key: 'status' },
  { title: 'Date', key: 'date' },
  { title: 'Note', key: 'note' },
  { title: 'Action', key: 'action' },
];

const tableScrollY = computed(() => Math.max(360, windowHeight.value - 320));
const getRowTheme = (row: LegalQueueRow) => row.docType === 'PRICING' ? getWorkflowStatusTheme(row.status) : getLegalDocumentStatusTheme(row.docType, row.status);
const openTask = (row: LegalQueueRow) => {
  store.setSelectedChannel(row.channel);
  if (row.docType === 'PRICING') {
    store.openLegalDetail('PRICING', 'dashboard', { proposalId: row.proposalId || null });
    return;
  }
  store.openLegalDetail(row.docType, 'dashboard');
};
const buildRowClick = (record: LegalQueueRow) => ({ onClick: () => openTask(record) });
const resetFilters = () => { keyword.value = ''; owner.value = 'all'; activeStatus.value = getDefaultStatus(activeDocType.value); };
const syncWindowHeight = () => { if (typeof window !== 'undefined') windowHeight.value = window.innerHeight; };
onMounted(() => { syncWindowHeight(); window.addEventListener('resize', syncWindowHeight); });
onBeforeUnmount(() => { if (typeof window !== 'undefined') window.removeEventListener('resize', syncWindowHeight); });
</script>

<template>
  <div class="min-h-screen bg-transparent p-0">
    <div class="queue-shell">
      <section class="workspace-control-card">
        <div class="workspace-control-card__copy">
          <div class="workspace-kicker">Legal Queue</div>
          <h2 class="workspace-title">Unified legal workbench</h2>
          <p class="workspace-subtitle">Legal works from the same corridor record as FI, with NDA, MSA, Pricing Schedule, and Other Attachments managed in one queue.</p>
        </div>

        <div class="workspace-control-panel">
          <div class="workspace-filter-group">
            <div class="workspace-filter-label">Document</div>
            <a-segmented v-model:value="activeDocType" class="workspace-segmented workspace-segmented--doc" :options="[
              { label: `NDA (${docTypeCounts.NDA})`, value: 'NDA' },
              { label: `MSA (${docTypeCounts.MSA})`, value: 'MSA' },
              { label: `Pricing (${docTypeCounts.PRICING})`, value: 'PRICING' },
              { label: `Other (${docTypeCounts.OTHER_ATTACHMENTS})`, value: 'OTHER_ATTACHMENTS' },
            ]" />
          </div>

          <div class="workspace-filter-group">
            <div class="workspace-filter-label">Status</div>
            <a-segmented v-model:value="activeStatus" class="workspace-segmented workspace-segmented--status" :options="statusOptions" />
          </div>

          <div class="workspace-inline-tools">
            <a-input v-model:value="keyword" :maxlength="INPUT_LIMITS.search" allow-clear placeholder="Search corridor" class="toolbar-control toolbar-control--search" />
            <a-select v-model:value="owner" class="toolbar-control toolbar-control--owner" :options="ownerOptions" />
            <a-button class="toolbar-reset" @click="resetFilters">Reset</a-button>
          </div>
        </div>
      </section>

      <a-card class="table-card" :body-style="{ padding: '0' }">
        <a-table :data-source="filteredRows" :columns="columns" :pagination="{ pageSize: 8 }" :scroll="{ x: 1180, y: tableScrollY }" :custom-row="buildRowClick" row-key="id">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'corridorName'">
              <div class="corridor-cell">
                <div class="corridor-name"><span class="corridor-icon"><file-text-outlined /></span><span>{{ record.corridorName }}</span></div>
                <div class="corridor-subline">{{ record.docType === 'PRICING' ? 'Pricing schedule after FI Supervisor handoff' : 'Open the shared legal packet from FIOP' }}</div>
              </div>
            </template>
            <template v-else-if="column.key === 'documentLabel'"><a-tag class="document-tag">{{ record.documentLabel }}</a-tag></template>
            <template v-else-if="column.key === 'fiOwner'"><a-tag class="owner-tag">{{ record.fiOwner }}</a-tag></template>
            <template v-else-if="column.key === 'status'">
              <a-tag :style="{ backgroundColor: getRowTheme(record).bg, color: getRowTheme(record).text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }">{{ record.status }}</a-tag>
            </template>
            <template v-else-if="column.key === 'date'"><span class="value-text">{{ record.date || '-' }}</span></template>
            <template v-else-if="column.key === 'note'"><div class="note-cell">{{ record.note || 'No note yet' }}</div></template>
            <template v-else-if="column.key === 'action'"><a-button type="link" class="action-link" @click.stop="openTask(record)">Details</a-button></template>
          </template>
          <template #emptyText><a-empty description="No legal tasks match the current filters." /></template>
        </a-table>
      </a-card>
    </div>
  </div>
</template>

<style scoped>
.queue-shell { display: flex; flex-direction: column; gap: 14px; min-height: calc(100vh - 48px); }
.workspace-control-card, .table-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; box-shadow: 0 10px 30px -24px rgba(15, 23, 42, 0.3); }
.workspace-control-card { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.95fr); gap: 18px; align-items: start; padding: 20px 22px; }
.workspace-kicker, .workspace-filter-label { color: #64748b; font-size: 11px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; }
.workspace-title { margin: 8px 0 0; color: #111827; font-size: 24px; font-weight: 900; line-height: 1.1; }
.workspace-subtitle { margin: 8px 0 0; color: #6b7280; font-size: 13px; font-weight: 600; line-height: 1.55; max-width: 640px; }
.workspace-control-panel, .workspace-filter-group { display: grid; gap: 8px; }
.workspace-segmented { background: #f8fafc; border: 1px solid #e2e8f0; padding: 3px; }
.workspace-segmented--doc { background: #f0f9ff; border-color: #bae6fd; }
.workspace-subsegmented { background: #fff; border: 1px solid #e2e8f0; padding: 3px; }
.workspace-inline-tools { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr) 180px auto; }
.corridor-cell { display: flex; flex-direction: column; gap: 4px; }
.corridor-name { display: flex; align-items: center; gap: 8px; color: #0f172a; font-weight: 800; }
.corridor-subline, .note-cell, .value-text { color: #64748b; font-size: 12px; font-weight: 600; line-height: 1.5; }
.corridor-icon { color: #0284c7; }
.document-tag, .owner-tag { border: none; border-radius: 999px; font-weight: 800; }
.document-tag { background: #eef2ff; color: #4338ca; }
.owner-tag { background: #f8fafc; color: #475569; }
.action-link { padding: 0; font-weight: 800; }
</style>
