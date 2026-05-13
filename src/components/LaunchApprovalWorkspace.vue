<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import dayjs from 'dayjs';
import { ArrowLeftOutlined, RocketOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { useAppStore } from '../stores/app';
import {
  applyLaunchSupervisorDecision,
  buildLaunchApprovalQueueRows,
  buildLaunchPrerequisiteSnapshot,
  getLaunchApprovalLabel,
  getLaunchApprovalTheme,
  isLaunchApprovalBlocked,
  normalizeFundApprovalStatus,
  normalizeLaunchApproval,
  normalizeLaunchApprovalStatus,
  type LaunchApprovalQueueRow,
  type LaunchApprovalQueueTab,
} from '../constants/initialData';
import { getFundApprovalLabel } from '../utils/fund';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';

const store = useAppStore();

const activeTab = ref<LaunchApprovalQueueTab>('pending');
const keyword = ref('');
const owner = ref('all');
const drawerOpen = ref(false);
const selectedChannelId = ref<string | null>(null);
const reviewForm = reactive({
  note: '',
});

const normalizeText = (value: unknown, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const getChannelKey = (channel: any) => normalizeText(channel?.id || channel?.channelId || channel?.channelName);

const allRows = computed(() => buildLaunchApprovalQueueRows(store.channelList));
const tabCounts = computed(() => ({
  pending: allRows.value.filter((row) => row.queueTab === 'pending').length,
  returned: allRows.value.filter((row) => row.queueTab === 'returned').length,
  live: allRows.value.filter((row) => row.queueTab === 'live').length,
}));

const tabOptions = computed(() => ([
  { label: `Under FI Supervisor review (${tabCounts.value.pending})`, value: 'pending' },
  { label: `Revision Required (${tabCounts.value.returned})`, value: 'returned' },
  { label: `Completed (${tabCounts.value.live})`, value: 'live' },
]));

const ownerOptions = computed(() => ([
  { label: 'All FIOPs', value: 'all' },
  ...[...new Set(
    allRows.value
      .filter((row) => row.queueTab === activeTab.value)
      .map((row) => normalizeText(row.fiOwner))
      .filter(Boolean),
  )]
    .sort((left, right) => left.localeCompare(right))
    .map((fiOwner) => ({ label: fiOwner, value: fiOwner })),
]));

const filteredRows = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  return allRows.value
    .filter((row) => row.queueTab === activeTab.value)
    .filter((row) => !normalizedKeyword || normalizeText(row.corridorName).toLowerCase().includes(normalizedKeyword))
    .filter((row) => owner.value === 'all' || normalizeText(row.fiOwner) === owner.value)
    .sort((left, right) => new Date(right.latestActionAt || 0).getTime() - new Date(left.latestActionAt || 0).getTime());
});

const selectedChannel = computed(() => (
  store.channelList.find((channel) => getChannelKey(channel) === selectedChannelId.value) || null
));
const selectedApproval = computed(() => normalizeLaunchApproval(selectedChannel.value?.launchApproval, selectedChannel.value));
const selectedStatus = computed(() => normalizeLaunchApprovalStatus(selectedApproval.value.status));
const selectedTheme = computed(() => getLaunchApprovalTheme(selectedStatus.value));
const selectedPrerequisites = computed(() => buildLaunchPrerequisiteSnapshot(selectedChannel.value));
const selectedBlocked = computed(() => Boolean(selectedChannel.value && isLaunchApprovalBlocked(selectedChannel.value)));
const canReviewSelected = computed(() => selectedStatus.value === 'under_fi_supervisor_review' && !selectedBlocked.value);
const selectedFundApproval = computed<any>(() => (
  selectedChannel.value?.fundApproval && typeof selectedChannel.value.fundApproval === 'object'
    ? selectedChannel.value.fundApproval
    : {}
));
const selectedFundStatus = computed(() => normalizeFundApprovalStatus(selectedFundApproval.value.status));
const selectedFundHistory = computed(() => (
  Array.isArray(selectedFundApproval.value.history)
    ? [...selectedFundApproval.value.history].sort((left: any, right: any) => (
        new Date(String(right?.time || '')).getTime() - new Date(String(left?.time || '')).getTime()
      ))
    : []
));
const selectedFundLatestEntry = computed<any | null>(() => selectedFundHistory.value[0] || null);
const selectedFundRecordAt = computed(() => (
  normalizeText(selectedFundLatestEntry.value?.time)
  || normalizeText(selectedFundApproval.value.lastActionAt)
  || normalizeText(selectedFundApproval.value.submittedAt)
));
const selectedFundRecordUser = computed(() => (
  normalizeText(selectedFundLatestEntry.value?.user)
  || normalizeText(selectedFundApproval.value.lastActionBy)
  || normalizeText(selectedFundApproval.value.submittedBy)
  || '-'
));
const selectedFundRecordNote = computed(() => (
  normalizeText(selectedFundLatestEntry.value?.note)
  || normalizeText(selectedFundApproval.value.note)
  || normalizeText(selectedFundApproval.value.submitNote)
  || 'No note recorded.'
));
const selectedLaunchHistory = computed(() => (
  Array.isArray(selectedApproval.value.history)
    ? [...selectedApproval.value.history].sort((left: any, right: any) => (
        new Date(String(right?.time || '')).getTime() - new Date(String(left?.time || '')).getTime()
      ))
    : []
));

const columns = computed(() => {
  return [
    { title: 'Corridor', key: 'corridorName' },
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

const emptyDescription = computed(() => {
  if (activeTab.value === 'returned') return 'No Revision Required launch approvals match the current filters.';
  if (activeTab.value === 'live') return 'No Completed launch records match the current filters.';
  return 'No Under FI Supervisor review launch approvals match the current filters.';
});

const formatTimestamp = (value?: string | null) => {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
};

const getLaunchHistoryTitle = (entry: any) => {
  if (entry.type === 'supervisor_approve') return 'FI Supervisor approved';
  if (entry.type === 'supervisor_return') return 'FI Supervisor returned';
  return 'FI Supervisor decision updated';
};

const getLaunchHistoryColor = (entry: any) => {
  if (entry.type === 'supervisor_approve' || entry.status === 'live') return 'green';
  if (entry.type === 'supervisor_return') return 'red';
  return 'blue';
};

const resetFilters = () => {
  keyword.value = '';
  owner.value = 'all';
};

const openApprovalDrawer = (row: LaunchApprovalQueueRow) => {
  selectedChannelId.value = getChannelKey(row.channel);
  drawerOpen.value = true;
  reviewForm.note = '';
};

const openDetails = (row: LaunchApprovalQueueRow) => {
  store.openLaunchApprovalReadonlyDetail(row.channel);
};

const closeDrawer = () => {
  drawerOpen.value = false;
  reviewForm.note = '';
};

const returnToDashboard = () => {
  store.setView('dashboard');
};

const applySupervisorDecision = (type: 'approve' | 'request_changes', note = '') => {
  if (!selectedChannel.value) return;
  if (!canReviewSelected.value) {
    message.warning(selectedBlocked.value ? 'Fund approval or prerequisites changed. FIOP must resubmit Fund review before final launch approval.' : 'This launch is not waiting for FI Supervisor review.');
    return;
  }

  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const actor = store.currentUserName || 'FI Supervisor';
  const corridorName = normalizeText(selectedChannel.value.channelName, 'This corridor');
  store.updateChannel(applyLaunchSupervisorDecision(selectedChannel.value, type, actor, timestamp, note));
  if (type === 'approve') {
    Modal.success({
      title: 'Go-live confirmed',
      content: `${corridorName} is now live.`,
    });
  } else {
    message.success('Launch approval returned to FIOP.');
  }
  closeDrawer();
};

const handleApprove = () => {
  if (!selectedChannel.value) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Remark', value: reviewForm.note, max: INPUT_LIMITS.note },
  ])) return;

  Modal.confirm({
    title: 'Approve and go live?',
    content: 'This will mark the corridor as Live.',
    okText: 'Approve & Go Live',
    onOk: () => {
      applySupervisorDecision('approve', reviewForm.note.trim() || 'FI Supervisor approved final launch.');
    },
  });
};

const handleReturn = () => {
  if (!reviewForm.note.trim()) {
    message.warning('Please enter the return reason.');
    return;
  }
  if (showTextLimitWarning(message.warning, [
    { label: 'Remark', value: reviewForm.note, max: INPUT_LIMITS.note },
  ])) return;

  Modal.confirm({
    title: 'Mark as Revision Required?',
    content: 'This will return the launch approval to FIOP for revision.',
    okText: 'Revision Required',
    onOk: () => {
      applySupervisorDecision('request_changes', reviewForm.note.trim());
    },
  });
};
</script>

<template>
  <div class="launch-workspace min-h-screen">
    <div class="launch-workspace__shell">
      <section class="launch-hero">
        <div class="launch-hero__copy">
          <a-button type="text" class="launch-back-button" @click="returnToDashboard">
            <template #icon><arrow-left-outlined /></template>
            Back to Dashboard
          </a-button>
          <div class="launch-kicker">FI Supervisor queue</div>
          <h2 class="launch-title">Launch approval workbench</h2>
          <p class="launch-subtitle">
            Review Fund-approved launch submissions and make the final go-live decision without mixing them into pricing approvals.
          </p>
        </div>

        <div class="launch-panel">
          <div class="launch-filter-group">
            <div class="launch-filter-label">Status</div>
            <a-segmented v-model:value="activeTab" class="launch-segmented" :options="tabOptions" />
          </div>

          <div class="launch-tools">
            <a-input v-model:value="keyword" :maxlength="INPUT_LIMITS.search" allow-clear placeholder="Search corridor" class="toolbar-control toolbar-control--search" />
            <a-select v-model:value="owner" class="toolbar-control toolbar-control--owner" :options="ownerOptions" />
            <a-button class="toolbar-reset" @click="resetFilters">Reset</a-button>
          </div>
        </div>
      </section>

      <a-card class="launch-table-card" :body-style="{ padding: '0' }">
        <a-table
          :data-source="filteredRows"
          :columns="columns"
          :pagination="{ pageSize: 8 }"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'corridorName'">
              <div class="corridor-cell">
                <div class="corridor-name">
                  <rocket-outlined class="corridor-icon" />
                  <span>{{ record.corridorName }}</span>
                </div>
                <div class="corridor-subline">{{ getLaunchApprovalLabel(record.status) }}</div>
              </div>
            </template>

            <template v-else-if="column.key === 'submittedAt' || column.key === 'latestActionAt'">
              <span class="value-text">{{ formatTimestamp(record[column.key]) }}</span>
            </template>

            <template v-else-if="column.key === 'cooperationMode' || column.key === 'fiOwner' || column.key === 'latestActionUser'">
              <span class="value-text">{{ record[column.key] || '-' }}</span>
            </template>

            <template v-else-if="column.key === 'status'">
              <a-tag
                :style="{
                  backgroundColor: getLaunchApprovalTheme(record.status).bg,
                  color: getLaunchApprovalTheme(record.status).text,
                  border: 'none',
                  borderRadius: '999px',
                  fontWeight: 900,
                  padding: '4px 12px',
                }"
              >
                {{ getLaunchApprovalLabel(record.status) }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'latestActionNote'">
              <div class="note-cell">{{ record.latestActionNote || 'No note recorded.' }}</div>
            </template>

            <template v-else-if="column.key === 'action'">
              <div class="action-pair">
                <a-button type="link" class="action-link" @click.stop="openDetails(record)">
                  Details
                </a-button>
                <a-button
                  type="link"
                  class="action-link"
                  :disabled="record.status !== 'under_fi_supervisor_review' || record.blocked"
                  @click.stop="openApprovalDrawer(record)"
                >
                  Approval
                </a-button>
              </div>
            </template>
          </template>

          <template #emptyText>
            <a-empty :description="emptyDescription" />
          </template>
        </a-table>
      </a-card>
    </div>

    <a-drawer v-model:open="drawerOpen" width="560" title="Launch approval detail" @close="closeDrawer">
      <div v-if="selectedChannel" class="drawer-stack">
        <section class="drawer-header">
          <div class="drawer-kicker">Final launch review</div>
          <div class="drawer-title-row">
            <h3>{{ selectedChannel.channelName || 'Unnamed Corridor' }}</h3>
            <a-tag
              :style="{
                backgroundColor: selectedTheme.bg,
                color: selectedTheme.text,
                border: 'none',
                borderRadius: '999px',
                fontWeight: 900,
                padding: '4px 12px',
              }"
            >
              {{ getLaunchApprovalLabel(selectedStatus) }}
            </a-tag>
          </div>
          <p>Fund approval is complete. FI Supervisor approval is the only action that can change the corridor to Live.</p>
        </section>

        <section class="drawer-section">
          <div class="drawer-section-title">Prerequisites</div>
          <div class="gate-grid">
            <div class="gate-item" :class="{ 'gate-item--ready': selectedPrerequisites.kycReady }">
              <span>KYC verification</span>
              <strong>WooshPay {{ selectedPrerequisites.wooshpayKycStatus }} / Corridor {{ selectedPrerequisites.corridorKycStatus }}</strong>
            </div>
            <div
              v-for="item in selectedPrerequisites.legalItems"
              :key="item.key"
              class="gate-item"
              :class="{ 'gate-item--ready': item.ready, 'gate-item--optional': item.key === 'otherAttachments' }"
            >
              <span>{{ item.label }}{{ item.key === 'otherAttachments' ? ' (Optional)' : '' }}</span>
              <strong>{{ item.status }}</strong>
            </div>
            <div
              class="gate-item"
              :class="{ 'gate-item--ready': selectedPrerequisites.fundReady }"
            >
              <span>Fund approval</span>
              <strong>{{ getFundApprovalLabel(selectedPrerequisites.fundStatus || 'pending') }}</strong>
            </div>
          </div>
          <div v-if="selectedBlocked" class="blocked-note">
            <div>Fund approval or prerequisites changed. FIOP must resubmit Fund review before final launch approval.</div>
            <ul v-if="selectedPrerequisites.missingItems.length" class="blocked-note__list">
              <li v-for="item in selectedPrerequisites.missingItems" :key="item">{{ item }}</li>
            </ul>
          </div>
        </section>

        <section class="drawer-section">
          <div class="drawer-section-title">Fund approval record</div>
          <div class="gate-grid">
            <div class="gate-item" :class="{ 'gate-item--ready': selectedFundStatus === 'approved' }">
              <span>Status</span>
              <strong>{{ getFundApprovalLabel(selectedFundStatus) }}</strong>
            </div>
            <div class="gate-item">
              <span>Latest Action At</span>
              <strong>{{ formatTimestamp(selectedFundRecordAt) }}</strong>
            </div>
            <div class="gate-item">
              <span>Latest Action By</span>
              <strong>{{ selectedFundRecordUser }}</strong>
            </div>
            <div class="gate-item gate-item--stacked">
              <span>Latest Note</span>
              <strong>{{ selectedFundRecordNote }}</strong>
            </div>
          </div>
        </section>

        <section class="drawer-section">
          <div class="drawer-section-title">FI Supervisor history</div>
          <a-timeline v-if="selectedLaunchHistory.length" class="launch-history">
            <a-timeline-item
              v-for="entry in selectedLaunchHistory"
              :key="entry.id"
              :color="getLaunchHistoryColor(entry)"
            >
              <div class="history-title">{{ getLaunchHistoryTitle(entry) }}</div>
              <div class="history-meta">{{ formatTimestamp(entry.time) }} · {{ entry.actor || 'System' }}</div>
              <div v-if="entry.note" class="history-note">{{ entry.note }}</div>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-else class="mt-3" description="No FI Supervisor final decision history yet." />
        </section>

        <section class="drawer-section">
          <div class="drawer-section-title">Review action</div>
          <div v-if="!canReviewSelected" class="review-disabled-note">
            {{ selectedBlocked ? 'Fund approval or prerequisites changed. FIOP must resubmit Fund review before final launch approval.' : 'This launch is not waiting for FI Supervisor review.' }}
          </div>
          <a-form layout="vertical" class="mt-4">
            <a-form-item label="Remark">
              <a-textarea
                v-model:value="reviewForm.note"
                :maxlength="INPUT_LIMITS.note"
                :rows="4"
                show-count
                :disabled="!canReviewSelected"
              />
            </a-form-item>
          </a-form>
          <div class="action-strip">
            <a-button class="return-button" :disabled="!canReviewSelected" @click="handleReturn">Revision Required</a-button>
            <a-button type="primary" class="go-live-button" :disabled="!canReviewSelected" @click="handleApprove">
              <template #icon><safety-certificate-outlined /></template>
              Approve & Go Live
            </a-button>
          </div>
        </section>
      </div>

      <a-empty v-else description="No launch approval selected." />
    </a-drawer>
  </div>
</template>

<style scoped>
.launch-workspace__shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.launch-hero,
.launch-table-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 10px 30px -24px rgba(15, 23, 42, 0.3);
}

.launch-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.92fr);
  gap: 20px;
  padding: 24px;
}

.launch-back-button {
  margin: -8px 0 12px -8px;
  padding-inline: 8px;
  color: #64748b;
  font-weight: 800;
}

.launch-kicker,
.launch-filter-label,
.drawer-kicker {
  color: #0369a1;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.launch-title {
  margin: 8px 0 0;
  color: #0f172a;
  font-size: 28px;
  font-weight: 900;
  line-height: 1.05;
}

.launch-subtitle {
  margin: 10px 0 0;
  max-width: 720px;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.6;
}

.launch-panel,
.launch-filter-group {
  display: grid;
  gap: 10px;
}

.launch-tools {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) 200px auto;
  gap: 10px;
  align-items: center;
}

.toolbar-reset,
.toolbar-control {
  border-radius: 10px;
  font-weight: 800;
}

.corridor-cell {
  display: grid;
  gap: 4px;
}

.corridor-name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #0f172a;
  font-weight: 900;
}

.corridor-icon {
  color: #0284c7;
}

.corridor-subline,
.value-text,
.note-cell {
  color: #64748b;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.5;
}

.action-link {
  padding: 0;
  font-weight: 900;
}

.action-pair {
  display: flex;
  align-items: center;
  gap: 14px;
}

.review-disabled-note {
  margin-top: 12px;
  border-radius: 12px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.5;
  padding: 10px 12px;
}

.drawer-stack {
  display: grid;
  gap: 16px;
}

.drawer-header,
.drawer-section {
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  padding: 18px;
}

.drawer-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.drawer-title-row h3 {
  margin: 0;
  color: #0f172a;
  font-size: 22px;
  font-weight: 900;
  line-height: 1.1;
}

.drawer-header p {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}

.drawer-section-title {
  color: #0f172a;
  font-size: 14px;
  font-weight: 900;
}

.gate-grid {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.gate-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 14px;
  background: #f8fafc;
  padding: 12px;
}

.gate-item--ready {
  background: #ecfdf5;
}

.gate-item--optional {
  border: 1px dashed #cbd5e1;
}

.gate-item--stacked {
  align-items: flex-start;
  flex-direction: column;
}

.gate-item span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.gate-item strong {
  color: #0f172a;
  font-size: 13px;
}

.blocked-note {
  margin-top: 12px;
  border-radius: 14px;
  background: #fff1f2;
  color: #be123c;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.5;
  padding: 12px;
}

.blocked-note__list {
  margin: 8px 0 0;
  padding-left: 18px;
}

.history-title {
  color: #0f172a;
  font-size: 13px;
  font-weight: 900;
}

.history-meta,
.history-note {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.5;
}

.launch-history {
  margin-top: 14px;
}

.action-strip {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}

.return-button,
.go-live-button {
  height: 40px;
  border-radius: 10px;
  font-weight: 900;
}

.return-button {
  border-color: #fecdd3;
  background: #fff1f2;
  color: #be123c;
}
</style>
