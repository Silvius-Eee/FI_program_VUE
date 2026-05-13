import {
  createHandoffLifecycle,
  createNormalLifecycle,
  createPendingHandoff,
  createTerminalDecisionLifecycle,
  getRevocableAction,
  isLegacyRevocationCopy,
  isPendingHandoffActive,
  markLifecycleConsumed,
  markLifecycleRevoked,
  normalizePendingHandoff,
  normalizeTerminalDecisionMeta,
  normalizeTimelineLifecycle,
  recordTerminalDecision,
  revokeTerminalDecision,
  type PendingHandoff,
  type RevocableAction,
  type TerminalDecisionMeta,
  type TimelineLifecycle,
  type WorkflowRole,
} from '../utils/workflowLifecycle';

export const ONBOARDING_TRACKS = ['wooshpay', 'corridor'] as const;

export type OnboardingTrack = typeof ONBOARDING_TRACKS[number];

export const ONBOARDING_STATUS_KEYS = [
  'completed',
  'no_need',
  'not_started',
  'wooshpay_preparation',
  'corridor_reviewing',
  'wooshpay_reviewing',
  'corridor_preparation',
] as const;

export type OnboardingStatusKey = typeof ONBOARDING_STATUS_KEYS[number];
export const COMPLIANCE_VISIBLE_ONBOARDING_STATUS_KEYS = [
  'wooshpay_preparation',
  'corridor_reviewing',
  'wooshpay_reviewing',
  'corridor_preparation',
  'completed',
  'no_need',
] as const satisfies readonly OnboardingStatusKey[];

export const ONBOARDING_QUEUE_TABS = ['reviewing', 'preparation', 'completed', 'no_need'] as const;

export type OnboardingQueueTab = typeof ONBOARDING_QUEUE_TABS[number];

export interface OnboardingAttachmentMeta {
  uid: string;
  name: string;
  size: number;
  type: string;
  status: string;
}

export interface OnboardingSubmission {
  entities: string[];
  documentLink: string;
  notes: string;
  contactName: string;
  contactMethod: string;
  contactValue: string;
  handoffNote: string;
  attachments: OnboardingAttachmentMeta[];
  submittedAt: string;
  submittedBy: string;
}

export interface OnboardingStatusHistoryEntry {
  id: string;
  status: OnboardingStatusKey;
  remark: string;
  updatedAt: string;
  updatedBy: string;
  lifecycle?: TimelineLifecycle;
}

export type OnboardingActivityEventType =
  | 'submission'
  | 'resubmission'
  | 'request_changes'
  | 'approval'
  | 'status_change'
  | 'revocation'
  | 'note';

export interface OnboardingActivityEntry {
  id: string;
  eventType: OnboardingActivityEventType;
  title: string;
  remark: string;
  status: OnboardingStatusKey;
  displayStatus?: OnboardingStatusKey;
  time: string;
  actorName: string;
  actorRole: string;
  attachments: OnboardingAttachmentMeta[];
  lifecycle?: TimelineLifecycle;
  terminalDecision?: TerminalDecisionMeta | null;
}

export interface OnboardingWorkflow {
  status: OnboardingStatusKey;
  submission: OnboardingSubmission;
  statusHistory: OnboardingStatusHistoryEntry[];
  activityHistory: OnboardingActivityEntry[];
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  pendingHandoff?: PendingHandoff | null;
}

export interface OnboardingQueueRow {
  id: string;
  corridorId: string;
  corridorName: string;
  track: OnboardingTrack;
  fiOwner: string;
  status: OnboardingStatusKey;
  queueTab: OnboardingQueueTab;
  currentVersion: number;
  attachmentCount: number;
  latestSubmissionAt: string;
  submittedBy: string;
  latestNote: string;
  updatedAt: string;
  updatedBy: string;
  needInputSince: string;
  requestNote: string;
  finalStatus: string;
  waitingSince: string;
  latestReviewerNote: string;
  lastReviewedAt: string;
  decidedAt: string;
  decidedBy: string;
  finalDecision: string;
  totalReviewCycles: number;
  agingHours: number;
  workflow: OnboardingWorkflow;
  channel: any;
}

type LegacyHistoryEntry = {
  date?: string | null;
  user?: string | null;
  notes?: string | null;
};

type LegacyGenericOnboardingStatusKey = 'self_preparation' | 'counterparty_reviewing';

const onboardingTrackMeta = {
  wooshpay: {
    title: 'WooshPay onboarding',
    legacyFieldKey: 'wooshpayOnboarding',
    submittedStatus: 'wooshpay_preparation',
    handoffStatus: 'corridor_reviewing',
  },
  corridor: {
    title: 'Corridor onboarding',
    legacyFieldKey: 'corridorOnboarding',
    submittedStatus: 'wooshpay_reviewing',
    handoffStatus: 'corridor_preparation',
  },
} as const;

const ONBOARDING_STATUS_LABELS: Record<OnboardingStatusKey, string> = {
  completed: 'Completed',
  no_need: 'No Need',
  not_started: 'Not Started',
  wooshpay_preparation: 'WooshPay preparation',
  corridor_reviewing: 'Corridor reviewing',
  wooshpay_reviewing: 'WooshPay reviewing',
  corridor_preparation: 'Corridor preparation',
};

const onboardingStatusAliasMap: Record<OnboardingStatusKey, string[]> = {
  completed: ['completed', 'approved', 'signed'],
  no_need: ['no need', 'no_need', 'noneed'],
  not_started: ['not started', 'not_started'],
  wooshpay_preparation: ['wooshpay preparation', 'wooshpay_preparation'],
  corridor_reviewing: ['corridor reviewing', 'corridor_reviewing'],
  wooshpay_reviewing: ['wooshpay reviewing', 'wooshpay_reviewing'],
  corridor_preparation: ['corridor preparation', 'corridor_preparation'],
};

const legacyGenericStatusAliasMap: Record<LegacyGenericOnboardingStatusKey, string[]> = {
  self_preparation: ['self preparation', 'self_preparation'],
  counterparty_reviewing: [
    'counterparty reviewing',
    'counterparty_reviewing',
    'channel reviewing',
    'in review',
    'under review',
    'in progress',
    'in process',
    'ongoing',
    'pending',
    'reviewing',
    'process',
  ],
};

export const onboardingStatusThemes: Record<OnboardingStatusKey, { bg: string; text: string; border: string }> = {
  completed: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  no_need: { bg: '#e5e7eb', text: '#4b5563', border: '#d1d5db' },
  not_started: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  wooshpay_preparation: { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' },
  corridor_preparation: { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' },
  corridor_reviewing: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  wooshpay_reviewing: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

const getNormalizedOnboardingStatusToken = (value: unknown) => normalizeText(value).toLowerCase();

const normalizeTimestamp = (value: unknown) => {
  const text = normalizeText(value);
  return text || '';
};

const getTimestampValue = (value: unknown) => {
  const timestamp = new Date(normalizeTimestamp(value)).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const buildStatusHistoryId = () => `onboarding-status-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const buildActivityHistoryId = () => `onboarding-activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const submissionEventTypes = new Set<OnboardingActivityEventType>(['submission', 'resubmission']);
const reviewerDecisionEventTypes = new Set<OnboardingActivityEventType>(['request_changes', 'approval']);

const createEmptySubmission = (): OnboardingSubmission => ({
  entities: [],
  documentLink: '',
  notes: '',
  contactName: '',
  contactMethod: '',
  contactValue: '',
  handoffNote: '',
  attachments: [],
  submittedAt: '',
  submittedBy: '',
});

export const createEmptyOnboardingWorkflow = (): OnboardingWorkflow => ({
  status: 'not_started',
  submission: createEmptySubmission(),
  statusHistory: [],
  activityHistory: [],
  lastUpdatedAt: '',
  lastUpdatedBy: '',
  pendingHandoff: null,
});

export const getOnboardingTrackTitle = (track: OnboardingTrack) => onboardingTrackMeta[track].title;

export const getSubmittedStatus = (track: OnboardingTrack): OnboardingStatusKey => (
  onboardingTrackMeta[track].submittedStatus
);

export const getComplianceHandoffStatus = (track: OnboardingTrack): OnboardingStatusKey => (
  onboardingTrackMeta[track].handoffStatus
);

const getLegacyPreparationStatus = (track: OnboardingTrack): OnboardingStatusKey => (
  track === 'wooshpay' ? 'wooshpay_preparation' : 'corridor_preparation'
);

const getLegacyReviewingStatus = (track: OnboardingTrack): OnboardingStatusKey => (
  track === 'wooshpay' ? 'corridor_reviewing' : 'wooshpay_reviewing'
);

export const isOnboardingFiActionStatus = (
  track: OnboardingTrack,
  status: OnboardingStatusKey | string | null | undefined,
) => normalizeOnboardingStatusKey(status, track) === getComplianceHandoffStatus(track);

export const getOnboardingWorkflowStatusLabel = (
  track: OnboardingTrack,
  status: OnboardingStatusKey | string | null | undefined,
) => getOnboardingStatusLabel(track, status);

const resolveDateValue = (value: unknown) => {
  const timestamp = new Date(normalizeTimestamp(value)).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isNoNeedDecisionEvent = (entry: OnboardingActivityEntry) => (
  entry.eventType === 'note' && entry.status === 'no_need'
);

const isReviewerEvent = (entry: OnboardingActivityEntry) => (
  entry.eventType !== 'revocation'
  && (
    entry.actorRole === 'reviewer'
    || reviewerDecisionEventTypes.has(entry.eventType)
    || entry.eventType === 'status_change'
    || isNoNeedDecisionEvent(entry)
  )
);

const isSubmissionEvent = (entry: OnboardingActivityEntry) => submissionEventTypes.has(entry.eventType);

const isCurrentOnboardingStatusKey = (normalized: string): normalized is OnboardingStatusKey => (
  (ONBOARDING_STATUS_KEYS as readonly string[]).includes(normalized)
);

const resolveDirectOnboardingStatusKey = (value: unknown): OnboardingStatusKey | null => {
  const normalized = getNormalizedOnboardingStatusToken(value);
  if (!normalized) return null;
  if (isCurrentOnboardingStatusKey(normalized)) {
    return normalized;
  }

  for (const [statusKey, aliases] of Object.entries(onboardingStatusAliasMap)) {
    if (aliases.includes(normalized)) {
      return statusKey as OnboardingStatusKey;
    }
  }

  return null;
};

const resolveLegacyGenericOnboardingStatusKey = (value: unknown): LegacyGenericOnboardingStatusKey | null => {
  const normalized = getNormalizedOnboardingStatusToken(value);
  if (!normalized) return null;

  for (const [statusKey, aliases] of Object.entries(legacyGenericStatusAliasMap)) {
    if (aliases.includes(normalized)) {
      return statusKey as LegacyGenericOnboardingStatusKey;
    }
  }

  return null;
};

const isPreparationPhaseStatus = (status: OnboardingStatusKey) => (
  status === 'corridor_reviewing' || status === 'corridor_preparation'
);

const isReviewingPhaseStatus = (status: OnboardingStatusKey) => (
  status === 'wooshpay_preparation' || status === 'wooshpay_reviewing'
);

const STATUS_UPDATE_TITLE_TOKENS = new Set<string>([
  'status updated to self preparation',
  'status updated to counterparty reviewing',
  'status updated to wooshpay preparation',
  'status updated to corridor preparation',
  'status updated to wooshpay reviewing',
  'status updated to corridor reviewing',
]);

export const getOnboardingStatusLabel = (
  trackOrStatus: OnboardingTrack | OnboardingStatusKey | string | null | undefined,
  maybeStatus?: OnboardingStatusKey | string | null | undefined,
) => {
  const rawStatus = maybeStatus === undefined ? trackOrStatus : maybeStatus;
  const track = maybeStatus === undefined
    ? undefined
    : trackOrStatus === 'wooshpay' || trackOrStatus === 'corridor'
      ? trackOrStatus
      : undefined;
  const normalizedStatus = normalizeOnboardingStatusKey(rawStatus, track);
  return ONBOARDING_STATUS_LABELS[normalizedStatus] || ONBOARDING_STATUS_LABELS.not_started;
};

export const getOnboardingQueueTabLabel = (
  track: OnboardingTrack,
  queueTab: OnboardingQueueTab,
) => {
  if (queueTab === 'reviewing') return getOnboardingStatusLabel(getSubmittedStatus(track));
  if (queueTab === 'preparation') return getOnboardingStatusLabel(getComplianceHandoffStatus(track));
  if (queueTab === 'completed') return getOnboardingStatusLabel('completed');
  return getOnboardingStatusLabel('no_need');
};

export const getComplianceVisibleOnboardingStatuses = (track: OnboardingTrack) => (
  [
    getSubmittedStatus(track),
    getComplianceHandoffStatus(track),
    'completed',
    'no_need',
  ] as const satisfies readonly OnboardingStatusKey[]
);

export const getAggregatedOnboardingStatusKey = (
  statuses: Array<OnboardingStatusKey | string | null | undefined>,
): OnboardingStatusKey => {
  const normalizedStatuses = statuses.map((status) => normalizeOnboardingStatusKey(status));
  if (normalizedStatuses.length === 0) return 'not_started';
  const activeStatuses = normalizedStatuses.filter((status) => (
    status !== 'not_started' && !isTerminalOnboardingStatus(status)
  ));
  if (activeStatuses.length > 0) {
    return activeStatuses.reduce<OnboardingStatusKey>((current, candidate) => (
      KYC_OVERVIEW_STATUS_RANK[candidate] < KYC_OVERVIEW_STATUS_RANK[current] ? candidate : current
    ), activeStatuses[0]);
  }
  if (normalizedStatuses.every((status) => status === 'no_need')) return 'no_need';
  if (normalizedStatuses.every((status) => status === 'completed' || status === 'no_need')) return 'completed';
  if (normalizedStatuses.some((status) => status === 'not_started')) return 'not_started';
  return normalizedStatuses[0];
};

export const getAggregatedOnboardingStatusLabel = (
  _track: OnboardingTrack,
  statuses: Array<OnboardingStatusKey | string | null | undefined>,
) => getOnboardingStatusLabel(getAggregatedOnboardingStatusKey(statuses));

export interface KycOverviewAggregate {
  displayStatus: string;
  driverTrack: OnboardingTrack;
  driverUpdatedAt: string;
  isTerminal: boolean;
}

interface KycOverviewDriverState {
  track: OnboardingTrack;
  status: OnboardingStatusKey;
  updatedAt: string;
}

const KYC_OVERVIEW_STATUS_RANK: Record<OnboardingStatusKey, number> = {
  not_started: 0,
  wooshpay_preparation: 1,
  wooshpay_reviewing: 1,
  corridor_reviewing: 2,
  corridor_preparation: 2,
  completed: 3,
  no_need: 3,
};

const isTerminalOnboardingStatus = (status: OnboardingStatusKey) => (
  status === 'completed' || status === 'no_need'
);

const pickMostRecentKycOverviewState = (
  states: KycOverviewDriverState[],
  status: OnboardingStatusKey,
) => {
  const matchedStates = states.filter((state) => state.status === status);
  if (!matchedStates.length) return null;
  return [...matchedStates].sort((left, right) => getTimestampValue(right.updatedAt) - getTimestampValue(left.updatedAt))[0];
};

export const getKycOverviewAggregate = (channel: any): KycOverviewAggregate => {
  const corridorWorkflow = getChannelOnboardingWorkflow(channel, 'corridor');
  const wooshpayWorkflow = getChannelOnboardingWorkflow(channel, 'wooshpay');
  const corridorState: KycOverviewDriverState = {
    track: 'corridor',
    status: corridorWorkflow.status,
    updatedAt: corridorWorkflow.lastUpdatedAt,
  };
  const wooshpayState: KycOverviewDriverState = {
    track: 'wooshpay',
    status: wooshpayWorkflow.status,
    updatedAt: wooshpayWorkflow.lastUpdatedAt,
  };
  const states: KycOverviewDriverState[] = [corridorState, wooshpayState];
  const aggregateStatus = getAggregatedOnboardingStatusKey(states.map(({ status }) => status));
  const isTerminal = states.every(({ status }) => isTerminalOnboardingStatus(status));

  let driverState: KycOverviewDriverState = corridorState;
  let displayStatus = getOnboardingStatusLabel(aggregateStatus);

  if (isTerminal) {
    const allNoNeed = states.every(({ status }) => status === 'no_need');
    const completedState = states.find(({ status }) => status === 'completed');

    if (allNoNeed) {
      displayStatus = 'No Need';
    } else {
      displayStatus = 'Completed';
      if (completedState && states.some(({ status }) => status === 'no_need')) {
        driverState = completedState;
      }
    }
  } else {
    driverState = pickMostRecentKycOverviewState(states, aggregateStatus) || corridorState;
  }

  return {
    displayStatus,
    driverTrack: driverState.track,
    driverUpdatedAt: driverState.updatedAt,
    isTerminal,
  };
};

export const getOnboardingStatusTheme = (status: OnboardingStatusKey | string | null | undefined) => (
  onboardingStatusThemes[normalizeOnboardingStatusKey(status)] || onboardingStatusThemes.not_started
);

export const normalizeOnboardingStatusKey = (
  value: unknown,
  track?: OnboardingTrack,
): OnboardingStatusKey => {
  const directStatus = resolveDirectOnboardingStatusKey(value);
  if (directStatus) return directStatus;

  const legacyStatus = resolveLegacyGenericOnboardingStatusKey(value);
  if (legacyStatus && track) {
    return legacyStatus === 'self_preparation'
      ? getLegacyPreparationStatus(track)
      : getLegacyReviewingStatus(track);
  }
  return 'not_started';
};

const normalizeAttachmentMeta = (attachment: any, index: number): OnboardingAttachmentMeta => ({
  uid: normalizeText(attachment?.uid) || `attachment-${Date.now()}-${index}`,
  name: normalizeText(attachment?.name) || `Attachment ${index + 1}`,
  size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : 0,
  type: normalizeText(attachment?.type),
  status: normalizeText(attachment?.status) || 'done',
});

export const normalizeOnboardingSubmission = (
  value: unknown,
  track: OnboardingTrack,
  fallbackHistory?: LegacyHistoryEntry,
): OnboardingSubmission => {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const attachments = Array.isArray(candidate.attachments)
    ? candidate.attachments.map(normalizeAttachmentMeta)
    : [];
  const entities = track === 'wooshpay' && Array.isArray(candidate.entities)
    ? candidate.entities.map((entity) => normalizeText(entity)).filter(Boolean)
    : [];
  const normalizedNote = normalizeText(
    candidate.notes ?? (track === 'corridor' ? candidate.handoffNote : fallbackHistory?.notes) ?? fallbackHistory?.notes,
  );
  const normalizedHandoffNote = normalizeText(
    candidate.handoffNote ?? (track === 'corridor' ? candidate.notes : '') ?? fallbackHistory?.notes,
  );
  const submission: OnboardingSubmission = {
    entities,
    documentLink: normalizeText(candidate.documentLink),
    notes: normalizedNote,
    contactName: normalizeText(candidate.contactName),
    contactMethod: normalizeText(candidate.contactMethod),
    contactValue: normalizeText(candidate.contactValue),
    handoffNote: normalizedHandoffNote,
    attachments,
    submittedAt: normalizeTimestamp(candidate.submittedAt ?? fallbackHistory?.date),
    submittedBy: normalizeText(candidate.submittedBy ?? fallbackHistory?.user),
  };

  const hasContent = submission.entities.length
    || submission.documentLink
    || submission.notes
    || submission.contactName
    || submission.contactMethod
    || submission.contactValue
    || submission.handoffNote
    || submission.attachments.length
    || submission.submittedAt
    || submission.submittedBy;

  return hasContent ? submission : createEmptySubmission();
};

export const normalizeOnboardingStatusHistory = (
  value: unknown,
  track: OnboardingTrack,
): OnboardingStatusHistoryEntry[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index): OnboardingStatusHistoryEntry | null => {
      const candidate = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
      const updatedAt = normalizeTimestamp(candidate.updatedAt);
      const updatedBy = normalizeText(candidate.updatedBy);
      const remark = normalizeText(candidate.remark);
      if (!updatedAt && !updatedBy && !remark) return null;
      const status = migrateLegacyStatusHistoryStatus(track, candidate.status, remark);

      const normalizedEntry: OnboardingStatusHistoryEntry = {
        id: normalizeText(candidate.id) || `${buildStatusHistoryId()}-${index}`,
        status,
        remark,
        updatedAt,
        updatedBy,
        lifecycle: candidate.lifecycle ? normalizeTimelineLifecycle(candidate.lifecycle, 'normal') : undefined,
      };

      return normalizedEntry;
    })
    .filter((entry): entry is OnboardingStatusHistoryEntry => entry !== null)
    .sort((left, right) => getTimestampValue(right.updatedAt) - getTimestampValue(left.updatedAt));
};

const LEGACY_AUTO_SUBMISSION_STATUS_REMARK = 'Auto-updated after package submission.';

const normalizeOnboardingActivityEventType = (value: unknown): OnboardingActivityEventType => {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === 'submission'
    || normalized === 'resubmission'
    || normalized === 'request_changes'
    || normalized === 'approval'
    || normalized === 'status_change'
    || normalized === 'revocation'
    || normalized === 'note'
  ) {
    return normalized;
  }

  return 'note';
};

const isLegacyAutoSubmissionRemark = (remark: string) => normalizeText(remark) === LEGACY_AUTO_SUBMISSION_STATUS_REMARK;

const migrateLegacyStatusHistoryStatus = (
  track: OnboardingTrack,
  rawStatus: unknown,
  remark: string,
): OnboardingStatusKey => {
  const directStatus = resolveDirectOnboardingStatusKey(rawStatus);
  if (directStatus) return directStatus;

  const legacyStatus = resolveLegacyGenericOnboardingStatusKey(rawStatus);
  if (!legacyStatus) return normalizeOnboardingStatusKey(rawStatus, track);
  if (legacyStatus === 'counterparty_reviewing' || isLegacyAutoSubmissionRemark(remark)) {
    return getSubmittedStatus(track);
  }
  return getComplianceHandoffStatus(track);
};

const migrateLegacyActivityStatus = (
  track: OnboardingTrack,
  rawStatus: unknown,
  eventType: OnboardingActivityEventType,
  actorRole: string,
): OnboardingStatusKey => {
  const directStatus = resolveDirectOnboardingStatusKey(rawStatus);
  if (directStatus) return directStatus;

  const legacyStatus = resolveLegacyGenericOnboardingStatusKey(rawStatus);
  if (!legacyStatus) return normalizeOnboardingStatusKey(rawStatus, track);
  if (legacyStatus === 'counterparty_reviewing') {
    return getSubmittedStatus(track);
  }

  const normalizedActorRole = normalizeText(actorRole).toLowerCase();
  if (normalizedActorRole === 'reviewer' || eventType === 'request_changes' || eventType === 'status_change') {
    return getComplianceHandoffStatus(track);
  }
  return getSubmittedStatus(track);
};

const buildDefaultActivityTitle = (
  track: OnboardingTrack,
  eventType: OnboardingActivityEventType,
  status: OnboardingStatusKey,
) => {
  if (eventType === 'submission') return `${getOnboardingTrackTitle(track)} package submitted`;
  if (eventType === 'resubmission') return `${getOnboardingTrackTitle(track)} package resubmitted`;
  if (eventType === 'approval') return `${getOnboardingTrackTitle(track)} completed`;
  if (status === 'no_need') return `${getOnboardingTrackTitle(track)} marked as no need`;
  if (eventType === 'revocation') return 'Action revoked';
  if (eventType === 'request_changes' || eventType === 'status_change') {
    return `Status updated to ${getOnboardingStatusLabel(status)}`;
  }
  return `${getOnboardingTrackTitle(track)} note added`;
};

const normalizeOnboardingActivityTitle = (
  track: OnboardingTrack,
  eventType: OnboardingActivityEventType,
  status: OnboardingStatusKey,
  value: unknown,
) => {
  const normalizedTitle = normalizeText(value);
  if (!normalizedTitle) {
    return buildDefaultActivityTitle(track, eventType, status);
  }

  if (STATUS_UPDATE_TITLE_TOKENS.has(normalizedTitle.toLowerCase())) {
    return `Status updated to ${getOnboardingStatusLabel(status)}`;
  }

  return normalizedTitle;
};

const createActivityEntryFromSubmission = (
  track: OnboardingTrack,
  submission: OnboardingSubmission,
  eventType: 'submission' | 'resubmission' = 'submission',
): OnboardingActivityEntry | null => {
  if (!hasOnboardingSubmission(submission)) return null;
  const submittedStatus = getSubmittedStatus(track);

  return {
    id: buildActivityHistoryId(),
    eventType,
    title: buildDefaultActivityTitle(track, eventType, submittedStatus),
    remark: submission.handoffNote || submission.notes,
    status: submittedStatus,
    time: submission.submittedAt,
    actorName: submission.submittedBy,
    actorRole: 'submitter',
    attachments: submission.attachments,
  };
};

const createActivityEntryFromStatusHistory = (
  track: OnboardingTrack,
  entry: OnboardingStatusHistoryEntry,
): OnboardingActivityEntry | null => {
  if (!entry.updatedAt && !entry.updatedBy && !entry.remark) return null;

  return {
    id: buildActivityHistoryId(),
    eventType: 'status_change',
    title: buildDefaultActivityTitle(track, 'status_change', entry.status),
    remark: entry.remark,
    status: entry.status,
    time: entry.updatedAt,
    actorName: entry.updatedBy,
    actorRole: 'reviewer',
    attachments: [],
  };
};

export const normalizeOnboardingActivityHistory = (
  value: unknown,
  track: OnboardingTrack,
  submission: OnboardingSubmission,
  statusHistory: OnboardingStatusHistoryEntry[],
): OnboardingActivityEntry[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry, index): OnboardingActivityEntry | null => {
        const candidate = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        const time = normalizeTimestamp(candidate.time ?? candidate.updatedAt ?? candidate.submittedAt);
        const actorName = normalizeText(candidate.actorName ?? candidate.updatedBy ?? candidate.submittedBy);
        const remark = normalizeText(candidate.remark ?? candidate.notes);
        const eventType = normalizeOnboardingActivityEventType(candidate.eventType);
        const status = migrateLegacyActivityStatus(
          track,
          candidate.status,
          eventType,
          normalizeText(candidate.actorRole),
        );
        const title = normalizeOnboardingActivityTitle(track, eventType, status, candidate.title);
        const attachments = Array.isArray(candidate.attachments)
          ? candidate.attachments.map(normalizeAttachmentMeta)
          : [];

        if (eventType === 'revocation' || isLegacyRevocationCopy(title, remark)) return null;
        if (!time && !actorName && !remark && !title) return null;

        const normalizedEntry: OnboardingActivityEntry = {
          id: normalizeText(candidate.id) || `${buildActivityHistoryId()}-${index}`,
          eventType,
          title,
          remark,
          status,
          displayStatus: Object.prototype.hasOwnProperty.call(candidate, 'displayStatus')
            ? normalizeOnboardingStatusKey(candidate.displayStatus, track)
            : undefined,
          time,
          actorName,
          actorRole: normalizeText(candidate.actorRole),
          attachments,
          lifecycle: candidate.lifecycle ? normalizeTimelineLifecycle(candidate.lifecycle, 'normal') : undefined,
          terminalDecision: normalizeTerminalDecisionMeta(candidate.terminalDecision),
        };

        return normalizedEntry;
      })
      .filter((entry): entry is OnboardingActivityEntry => entry !== null)
      .sort((left, right) => getTimestampValue(right.time) - getTimestampValue(left.time));
  }

  const fallbackEntries = [
    ...statusHistory
      .map((entry) => createActivityEntryFromStatusHistory(track, entry))
      .filter((entry): entry is OnboardingActivityEntry => Boolean(entry)),
  ];
  const submissionEntry = createActivityEntryFromSubmission(track, submission);
  if (submissionEntry) {
    fallbackEntries.push(submissionEntry);
  }

  return fallbackEntries.sort((left, right) => getTimestampValue(right.time) - getTimestampValue(left.time));
};

export const hasOnboardingSubmission = (submission?: Partial<OnboardingSubmission> | null) => {
  if (!submission) return false;
  return Boolean(
    (Array.isArray(submission.entities) && submission.entities.length)
    || normalizeText(submission.documentLink)
    || normalizeText(submission.notes)
    || normalizeText(submission.contactName)
    || normalizeText(submission.contactMethod)
    || normalizeText(submission.contactValue)
    || normalizeText(submission.handoffNote)
    || (Array.isArray(submission.attachments) && submission.attachments.length)
    || normalizeTimestamp(submission.submittedAt)
    || normalizeText(submission.submittedBy),
  );
};

export const normalizeOnboardingWorkflow = (
  track: OnboardingTrack,
  value: unknown,
  legacyStatus?: unknown,
  legacyHistory?: LegacyHistoryEntry,
): OnboardingWorkflow => {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const submission = normalizeOnboardingSubmission(candidate.submission, track, legacyHistory);
  const statusHistory = normalizeOnboardingStatusHistory(candidate.statusHistory, track);
  const activityHistory = normalizeOnboardingActivityHistory(candidate.activityHistory, track, submission, statusHistory);
  const visibleStatusHistory = statusHistory.filter((entry) => entry.lifecycle?.state !== 'revoked');
  const visibleActivityHistory = activityHistory.filter((entry) => entry.lifecycle?.state !== 'revoked');
  const fallbackStatus = candidate.status ?? legacyStatus;
  const normalizedFallbackStatus = resolveDirectOnboardingStatusKey(fallbackStatus);
  const latestActiveEntry = visibleActivityHistory.find((entry) => !isTerminalOnboardingStatus(entry.status)) || null;
  const latestActiveStatusHistoryEntry = visibleStatusHistory.find((entry) => !isTerminalOnboardingStatus(entry.status)) || null;
  const legacyFallbackStatus = resolveLegacyGenericOnboardingStatusKey(fallbackStatus);
  const hasExplicitWorkflowStatus = Object.prototype.hasOwnProperty.call(candidate, 'status');
  const hasSubmission = hasOnboardingSubmission(submission);
  const shouldIgnoreNotStartedFallback = normalizedFallbackStatus === 'not_started'
    && !hasExplicitWorkflowStatus
    && Boolean(
      latestActiveEntry
      || latestActiveStatusHistoryEntry
      || hasSubmission
      || legacyFallbackStatus,
    );
  const effectiveFallbackStatus = shouldIgnoreNotStartedFallback ? null : normalizedFallbackStatus;
  const status = effectiveFallbackStatus
    || latestActiveEntry?.status
    || latestActiveStatusHistoryEntry?.status
    || (hasSubmission ? getSubmittedStatus(track) : null)
    || (legacyFallbackStatus === 'self_preparation' ? getComplianceHandoffStatus(track) : null)
    || (legacyFallbackStatus === 'counterparty_reviewing' ? getSubmittedStatus(track) : null)
    || 'not_started';

  const lastUpdatedAt = normalizeTimestamp(candidate.lastUpdatedAt)
    || activityHistory[0]?.time
    || statusHistory[0]?.updatedAt
    || submission.submittedAt
    || normalizeTimestamp(legacyHistory?.date);
  const lastUpdatedBy = normalizeText(candidate.lastUpdatedBy)
    || activityHistory[0]?.actorName
    || statusHistory[0]?.updatedBy
    || submission.submittedBy
    || normalizeText(legacyHistory?.user);
  const pendingHandoff = normalizePendingHandoff(candidate.pendingHandoff);

  return {
    status,
    submission,
    statusHistory,
    activityHistory,
    lastUpdatedAt,
    lastUpdatedBy,
    pendingHandoff: isPendingHandoffActive(pendingHandoff) ? pendingHandoff : null,
  };
};

export const buildOnboardingHistoryEntry = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  const latestActivityEntry = normalizedWorkflow.activityHistory.find((entry) => entry.lifecycle?.state !== 'revoked');
  const latestStatusEntry = normalizedWorkflow.statusHistory.find((entry) => entry.lifecycle?.state !== 'revoked');
  const hasRecordedWorkflowHistory = normalizedWorkflow.activityHistory.length > 0 || normalizedWorkflow.statusHistory.length > 0;

  if (latestActivityEntry) {
    return {
      date: latestActivityEntry.time || null,
      user: latestActivityEntry.actorName || null,
      notes: latestActivityEntry.remark || latestActivityEntry.title || null,
    };
  }

  if (latestStatusEntry) {
    return {
      date: latestStatusEntry.updatedAt || null,
      user: latestStatusEntry.updatedBy || null,
      notes: latestStatusEntry.remark || getOnboardingStatusLabel(track, latestStatusEntry.status) || null,
    };
  }

  if (hasRecordedWorkflowHistory) {
    return {
      date: null,
      user: null,
      notes: null,
    };
  }

  if (hasOnboardingSubmission(normalizedWorkflow.submission)) {
    return {
      date: normalizedWorkflow.submission.submittedAt || null,
      user: normalizedWorkflow.submission.submittedBy || null,
      notes: normalizedWorkflow.submission.handoffNote || normalizedWorkflow.submission.notes || null,
    };
  }

  return {
    date: null,
    user: null,
    notes: null,
  };
};

export const getOnboardingTrackFieldKey = (track: OnboardingTrack) => onboardingTrackMeta[track].legacyFieldKey;

const getWorkflowFromChannel = (channel: any, track: OnboardingTrack) => {
  const fieldKey = getOnboardingTrackFieldKey(track);
  return normalizeOnboardingWorkflow(track, channel?.[fieldKey]);
};

export const createOnboardingStatusHistoryEntry = (
  track: OnboardingTrack,
  status: OnboardingStatusKey,
  remark: string,
  updatedAt: string,
  updatedBy: string,
  options: {
    lifecycle?: TimelineLifecycle;
  } = {},
): OnboardingStatusHistoryEntry => ({
  id: buildStatusHistoryId(),
  status: normalizeOnboardingStatusKey(status, track),
  remark: normalizeText(remark),
  updatedAt: normalizeTimestamp(updatedAt),
  updatedBy: normalizeText(updatedBy),
  lifecycle: options.lifecycle,
});

export const createOnboardingActivityEntry = (
  track: OnboardingTrack,
  eventType: OnboardingActivityEventType,
  status: OnboardingStatusKey,
  remark: string,
  time: string,
  actorName: string,
  actorRole: string,
  attachments: OnboardingAttachmentMeta[] = [],
  title?: string,
  options: {
    lifecycle?: TimelineLifecycle;
    terminalDecision?: TerminalDecisionMeta | null;
  } = {},
): OnboardingActivityEntry => ({
  id: buildActivityHistoryId(),
  eventType,
  title: normalizeText(title) || buildDefaultActivityTitle(track, eventType, status),
  remark: normalizeText(remark),
  status: normalizeOnboardingStatusKey(status, track),
  time: normalizeTimestamp(time),
  actorName: normalizeText(actorName),
  actorRole: normalizeText(actorRole),
  attachments: Array.isArray(attachments) ? attachments.map(normalizeAttachmentMeta) : [],
  lifecycle: options.lifecycle,
  terminalDecision: options.terminalDecision || null,
});

const updateActivityEntryById = (
  entries: OnboardingActivityEntry[],
  entryId: string | undefined,
  updater: (entry: OnboardingActivityEntry) => OnboardingActivityEntry,
) => {
  if (!entryId) return entries;
  return entries.map((entry) => (entry.id === entryId ? updater(entry) : entry));
};

const updateStatusHistoryLifecycle = (
  entries: OnboardingStatusHistoryEntry[],
  status: OnboardingStatusKey,
  updatedAt: string,
  updatedBy: string,
  updater: (entry: OnboardingStatusHistoryEntry) => OnboardingStatusHistoryEntry,
) => {
  let matched = false;
  return entries.map((entry) => {
    if (
      !matched
      && entry.status === status
      && entry.updatedAt === updatedAt
      && entry.updatedBy === updatedBy
    ) {
      matched = true;
      return updater(entry);
    }
    return entry;
  });
};

const getLatestVisibleOnboardingEvent = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.find((entry) => entry.lifecycle?.state !== 'revoked') || null;
};

export const applyOnboardingSubmission = (
  channel: any,
  track: OnboardingTrack,
  payload: Partial<OnboardingSubmission>,
  actor: string,
  timestamp: string,
) => {
  const fieldKey = getOnboardingTrackFieldKey(track);
  const currentWorkflow = getWorkflowFromChannel(channel, track);
  const currentVersion = getOnboardingCurrentVersion(track, currentWorkflow);
  const isFirstSubmission = currentVersion === 0;
  const hadSubmission = !isFirstSubmission;
  const activePendingHandoff = isPendingHandoffActive(currentWorkflow.pendingHandoff)
    ? currentWorkflow.pendingHandoff
    : null;
  const submission = normalizeOnboardingSubmission({
    ...currentWorkflow.submission,
    ...payload,
    submittedAt: timestamp,
    submittedBy: actor,
  }, track);
  const nextStatus = getSubmittedStatus(track);
  let nextActivityHistory = currentWorkflow.activityHistory;
  let nextStatusHistory = currentWorkflow.statusHistory;

  if (activePendingHandoff) {
    nextActivityHistory = updateActivityEntryById(
      nextActivityHistory,
      activePendingHandoff.originEventId,
      (entry) => ({
        ...entry,
        lifecycle: markLifecycleConsumed(entry.lifecycle),
      }),
    );

    const originEvent = currentWorkflow.activityHistory.find((entry) => entry.id === activePendingHandoff.originEventId);
    if (originEvent) {
      nextStatusHistory = updateStatusHistoryLifecycle(
        nextStatusHistory,
        originEvent.status,
        originEvent.time,
        originEvent.actorName,
        (entry) => ({
          ...entry,
          lifecycle: markLifecycleConsumed(entry.lifecycle),
        }),
      );
    }
  }

  const activityEntry = createOnboardingActivityEntry(
    track,
    hadSubmission ? 'resubmission' : 'submission',
    nextStatus,
    submission.handoffNote || submission.notes,
    timestamp,
    actor,
    'submitter',
    submission.attachments,
    undefined,
    { lifecycle: createHandoffLifecycle() },
  );
  const nextPendingHandoff = createPendingHandoff({
    flowType: 'onboarding',
    flowKey: track,
    senderRole: 'FIOP',
    senderName: actor,
    receiverRole: 'Compliance',
    createdAt: timestamp,
    sourceStatus: currentWorkflow.status,
    targetStatus: nextStatus,
    originEventId: activityEntry.id,
    payloadSnapshot: submission,
  });
  const nextHistory = currentWorkflow.status !== nextStatus
    ? [
        createOnboardingStatusHistoryEntry(
          track,
          nextStatus,
          'Auto-updated after package submission.',
          timestamp,
          actor,
          { lifecycle: createHandoffLifecycle() },
        ),
        ...nextStatusHistory,
      ]
    : nextStatusHistory;

  return {
    ...channel,
    [fieldKey]: {
      ...currentWorkflow,
      submission,
      status: nextStatus,
      statusHistory: nextHistory,
      activityHistory: [activityEntry, ...nextActivityHistory],
      lastUpdatedAt: timestamp,
      lastUpdatedBy: actor,
      pendingHandoff: nextPendingHandoff,
    },
    lastModifiedAt: timestamp,
  };
};

const resolveActivityEventTypeByStatus = (
  track: OnboardingTrack,
  status: OnboardingStatusKey,
): OnboardingActivityEventType => {
  if (status === 'completed') return 'approval';
  if (status === 'no_need') return 'note';
  if (status === getComplianceHandoffStatus(track)) return 'request_changes';
  return 'status_change';
};

const buildActivityTitleByStatus = (track: OnboardingTrack, status: OnboardingStatusKey) => {
  if (status === 'completed') return `${getOnboardingTrackTitle(track)} completed`;
  if (status === 'no_need') return `${getOnboardingTrackTitle(track)} marked as no need`;
  return `Status updated to ${getOnboardingStatusLabel(status)}`;
};

export const applyOnboardingStatusUpdate = (
  channel: any,
  track: OnboardingTrack,
  status: OnboardingStatusKey,
  remark: string,
  actor: string,
  timestamp: string,
  attachments: OnboardingAttachmentMeta[] = [],
) => {
  const fieldKey = getOnboardingTrackFieldKey(track);
  const currentWorkflow = getWorkflowFromChannel(channel, track);
  const activePendingHandoff = isPendingHandoffActive(currentWorkflow.pendingHandoff)
    ? currentWorkflow.pendingHandoff
    : null;
  let nextActivityHistory = currentWorkflow.activityHistory;
  let nextStatusHistory = currentWorkflow.statusHistory;

  if (activePendingHandoff && activePendingHandoff.receiverRole === 'Compliance') {
    nextActivityHistory = updateActivityEntryById(
      nextActivityHistory,
      activePendingHandoff.originEventId,
      (entry) => ({
        ...entry,
        lifecycle: markLifecycleConsumed(entry.lifecycle),
      }),
    );

    const originEvent = currentWorkflow.activityHistory.find((entry) => entry.id === activePendingHandoff.originEventId);
    if (originEvent) {
      nextStatusHistory = updateStatusHistoryLifecycle(
        nextStatusHistory,
        originEvent.status,
        originEvent.time,
        originEvent.actorName,
        (entry) => ({
          ...entry,
          lifecycle: markLifecycleConsumed(entry.lifecycle),
        }),
      );
    }
  }

  const isTerminalDecision = status === 'completed' || status === 'no_need';
  const lifecycle = isTerminalDecision
    ? createTerminalDecisionLifecycle()
    : status === getComplianceHandoffStatus(track)
      ? createHandoffLifecycle()
      : createNormalLifecycle();
  let historyEntry = createOnboardingStatusHistoryEntry(track, status, remark, timestamp, actor, { lifecycle });
  let activityEntry = createOnboardingActivityEntry(
    track,
    resolveActivityEventTypeByStatus(track, status),
    status,
    remark,
    timestamp,
    actor,
    'reviewer',
    attachments,
    buildActivityTitleByStatus(track, status),
    { lifecycle },
  );
  const reviewerAction = recordTerminalDecision({
    decisionEventId: activityEntry.id,
    revocableByActor: actor,
    previousStatus: currentWorkflow.status,
    previousQueueState: getOnboardingQueueTab(currentWorkflow.status),
  });
  let pendingHandoff: PendingHandoff | null = null;

  activityEntry = {
    ...activityEntry,
    terminalDecision: reviewerAction,
  };

  if (isTerminalDecision) {
    historyEntry = {
      ...historyEntry,
      lifecycle: createTerminalDecisionLifecycle(),
    };
    activityEntry = {
      ...activityEntry,
      lifecycle: createTerminalDecisionLifecycle(),
    };
  } else if (status === getComplianceHandoffStatus(track)) {
    pendingHandoff = createPendingHandoff({
      flowType: 'onboarding',
      flowKey: track,
      senderRole: 'Compliance',
      senderName: actor,
      receiverRole: 'FIOP',
      createdAt: timestamp,
      sourceStatus: currentWorkflow.status,
      targetStatus: status,
      originEventId: activityEntry.id,
      payloadSnapshot: currentWorkflow.submission,
    });
  }

  return {
    ...channel,
    [fieldKey]: {
      ...currentWorkflow,
      status,
      statusHistory: [historyEntry, ...nextStatusHistory],
      activityHistory: [activityEntry, ...nextActivityHistory],
      lastUpdatedAt: timestamp,
      lastUpdatedBy: actor,
      pendingHandoff,
    },
    lastModifiedAt: timestamp,
  };
};

export const getOnboardingRevocableAction = (
  track: OnboardingTrack,
  workflow: Partial<OnboardingWorkflow> | null | undefined,
  actorRole: WorkflowRole | null | undefined,
  actorName: string,
): RevocableAction | null => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  const latestVisibleEvent = getLatestVisibleOnboardingEvent(track, normalizedWorkflow);
  if (!latestVisibleEvent) return null;

  return getRevocableAction({
    pendingHandoff: normalizedWorkflow.pendingHandoff,
    terminalDecision: latestVisibleEvent.terminalDecision,
    actorRole,
    actorName,
    eventId: latestVisibleEvent.id,
    isLatestEvent: true,
  });
};

export const revokeOnboardingPendingHandoff = (
  channel: any,
  track: OnboardingTrack,
  actorRole: WorkflowRole,
  actorName: string,
  timestamp: string,
  _reason = '',
) => {
  const fieldKey = getOnboardingTrackFieldKey(track);
  const currentWorkflow = getWorkflowFromChannel(channel, track);
  const activePendingHandoff = isPendingHandoffActive(currentWorkflow.pendingHandoff)
    ? currentWorkflow.pendingHandoff
    : null;
  if (!activePendingHandoff || activePendingHandoff.senderRole !== actorRole) {
    return channel;
  }

  const restoredStatus = normalizeOnboardingStatusKey(activePendingHandoff.sourceStatus, track);
  const originalEvent = currentWorkflow.activityHistory.find((entry) => entry.id === activePendingHandoff.originEventId) || null;
  const activityHistory = updateActivityEntryById(
    currentWorkflow.activityHistory,
    activePendingHandoff.originEventId,
    (entry) => ({
      ...entry,
      displayStatus: restoredStatus,
      lifecycle: markLifecycleRevoked(entry.lifecycle),
    }),
  );
  const statusHistory = originalEvent
    ? updateStatusHistoryLifecycle(
        currentWorkflow.statusHistory,
        originalEvent.status,
        originalEvent.time,
        originalEvent.actorName,
        (entry) => ({
          ...entry,
          lifecycle: markLifecycleRevoked(entry.lifecycle),
        }),
      )
    : currentWorkflow.statusHistory;

  return {
    ...channel,
    [fieldKey]: {
      ...currentWorkflow,
      status: restoredStatus,
      statusHistory,
      activityHistory,
      lastUpdatedAt: timestamp,
      lastUpdatedBy: actorName,
      pendingHandoff: null,
    },
    lastModifiedAt: timestamp,
  };
};

export const revokeOnboardingTerminalDecision = (
  channel: any,
  track: OnboardingTrack,
  actorName: string,
  timestamp: string,
  reason = '',
) => {
  const fieldKey = getOnboardingTrackFieldKey(track);
  const currentWorkflow = getWorkflowFromChannel(channel, track);
  const latestVisibleEvent = getLatestVisibleOnboardingEvent(track, currentWorkflow);
  const terminalDecision = latestVisibleEvent?.terminalDecision || null;
  if (
    !latestVisibleEvent
    || !terminalDecision
    || !terminalDecision.revocable
    || terminalDecision.revocableByActor !== actorName
  ) {
    return channel;
  }

  const restoredStatus = normalizeOnboardingStatusKey(terminalDecision.previousStatus, track);
  const revokedDecision = revokeTerminalDecision(
    terminalDecision,
    actorName,
    reason || `Restored ${getOnboardingStatusLabel(restoredStatus)} after reviewer status revoke.`,
    timestamp,
  );
  const activityHistory = updateActivityEntryById(
    currentWorkflow.activityHistory,
    latestVisibleEvent.id,
    (entry) => ({
      ...entry,
      displayStatus: restoredStatus,
      lifecycle: markLifecycleRevoked(entry.lifecycle),
      terminalDecision: revokedDecision,
    }),
  );
  const statusHistory = updateStatusHistoryLifecycle(
    currentWorkflow.statusHistory,
    latestVisibleEvent.status,
    latestVisibleEvent.time,
    latestVisibleEvent.actorName,
    (entry) => ({
      ...entry,
      lifecycle: markLifecycleRevoked(entry.lifecycle),
    }),
  );

  return {
    ...channel,
    [fieldKey]: {
      ...currentWorkflow,
      status: restoredStatus,
      statusHistory,
      activityHistory,
      lastUpdatedAt: timestamp,
      lastUpdatedBy: actorName,
      pendingHandoff: null,
    },
    lastModifiedAt: timestamp,
  };
};

export const getOnboardingQueueTab = (status: OnboardingStatusKey | string | null | undefined): OnboardingQueueTab | null => {
  const normalizedStatus = normalizeOnboardingStatusKey(status);
  if (isReviewingPhaseStatus(normalizedStatus)) return 'reviewing';
  if (isPreparationPhaseStatus(normalizedStatus)) return 'preparation';
  if (normalizedStatus === 'completed') return 'completed';
  if (normalizedStatus === 'no_need') return 'no_need';
  return null;
};

export const getOnboardingCurrentVersion = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  const hasRecordedWorkflowHistory = normalizedWorkflow.activityHistory.length > 0 || normalizedWorkflow.statusHistory.length > 0;
  const versionCount = normalizedWorkflow.activityHistory.filter((entry) => (
    entry.lifecycle?.state !== 'revoked' && isSubmissionEvent(entry)
  )).length;

  if (versionCount > 0) return versionCount;
  if (hasRecordedWorkflowHistory) return 0;
  return hasOnboardingSubmission(normalizedWorkflow.submission) ? 1 : 0;
};

export const getLatestOnboardingSubmissionEvent = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.find((entry) => (
    entry.lifecycle?.state !== 'revoked' && isSubmissionEvent(entry)
  )) || null;
};

export const getLatestOnboardingReviewerEvent = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.find((entry) => (
    entry.lifecycle?.state !== 'revoked' && isReviewerEvent(entry)
  )) || null;
};

export const getLatestOnboardingReviewerNote = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const reviewerEvent = getLatestOnboardingReviewerEvent(track, workflow);
  if (reviewerEvent?.remark) return reviewerEvent.remark;

  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.submission.handoffNote || normalizedWorkflow.submission.notes || '';
};

export const getOnboardingTimelineEvents = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const activityHistory = normalizeOnboardingWorkflow(track, workflow).activityHistory;

  return activityHistory.map((entry, index) => {
    const fallbackDisplayStatus = entry.lifecycle?.state === 'revoked'
      ? normalizeOnboardingStatusKey(
          entry.terminalDecision?.previousStatus
          || activityHistory.slice(index + 1).find((candidate) => candidate.lifecycle?.state !== 'revoked')?.status
          || 'not_started',
          track,
        )
      : entry.status;

    return {
      ...entry,
      displayStatus: entry.lifecycle?.state === 'revoked'
        ? entry.displayStatus || fallbackDisplayStatus
        : entry.status,
    };
  });
};

export const getRecentOnboardingMilestones = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
  limit = 4,
) => {
  return getOnboardingTimelineEvents(track, workflow).slice(0, Math.max(limit, 0));
};

export const getLatestOnboardingDecisionEvent = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.find((entry) => (
    entry.lifecycle?.state !== 'revoked'
    && (entry.eventType === 'approval' || isNoNeedDecisionEvent(entry))
  )) || null;
};

export const getOnboardingTotalReviewCycles = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.filter((entry) => (
    entry.lifecycle?.state !== 'revoked'
    && (reviewerDecisionEventTypes.has(entry.eventType) || isNoNeedDecisionEvent(entry))
  )).length;
};

export const getOnboardingAgingHours = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
  nowValue: Date | string | number = new Date(),
) => {
  const latestSubmissionEvent = getLatestOnboardingSubmissionEvent(track, workflow);
  const submittedAt = latestSubmissionEvent?.time || normalizeOnboardingWorkflow(track, workflow).submission.submittedAt;
  const submittedTimestamp = resolveDateValue(submittedAt);
  const nowTimestamp = new Date(nowValue).getTime();

  if (!submittedTimestamp || Number.isNaN(nowTimestamp) || nowTimestamp <= submittedTimestamp) {
    return 0;
  }

  return Math.floor((nowTimestamp - submittedTimestamp) / (1000 * 60 * 60));
};

export const buildOnboardingQueueRow = (
  channel: any,
  track: OnboardingTrack,
  nowValue: Date | string | number = new Date(),
): OnboardingQueueRow | null => {
  const workflow = getChannelOnboardingWorkflow(channel, track);
  const queueTab = getOnboardingQueueTab(workflow.status);
  if (!queueTab) return null;
  const handoffStatus = getComplianceHandoffStatus(track);

  const latestSubmissionEvent = getLatestOnboardingSubmissionEvent(track, workflow);
  const latestReviewerEvent = getLatestOnboardingReviewerEvent(track, workflow);
  const latestDecisionEvent = getLatestOnboardingDecisionEvent(track, workflow);
  const latestSharedNoteEvent = workflow.activityHistory.find((entry) => (
    entry.lifecycle?.state !== 'revoked' && entry.remark
  )) || null;
  const latestRequestChangesEvent = workflow.activityHistory.find((entry) => (
    entry.lifecycle?.state !== 'revoked'
    && (
      entry.eventType === 'request_changes'
      || (entry.actorRole === 'reviewer' && entry.status === handoffStatus)
    )
  )) || null;
  const latestPreparationStatusEntry = workflow.statusHistory.find((entry) => (
    entry.lifecycle?.state !== 'revoked' && entry.status === handoffStatus
  )) || null;
  const latestPreparationEvent = workflow.activityHistory.find((entry) => (
    entry.lifecycle?.state !== 'revoked'
    && entry.status === handoffStatus
    && entry.actorRole === 'reviewer'
  )) || null;
  const latestReviewerNote = getLatestOnboardingReviewerNote(track, workflow);
  const finalStatus = ['completed', 'no_need'].includes(queueTab)
    ? getOnboardingStatusLabel(workflow.status)
    : '';

  return {
    id: `${String(channel?.id ?? '')}:${track}`,
    corridorId: String(channel?.id ?? ''),
    corridorName: String(channel?.channelName || 'Unnamed Corridor'),
    track,
    fiOwner: String(channel?.fiopOwner || 'Unassigned'),
    status: workflow.status,
    queueTab,
    currentVersion: getOnboardingCurrentVersion(track, workflow),
    attachmentCount: workflow.submission.attachments.length,
    latestSubmissionAt: latestSubmissionEvent?.time || workflow.submission.submittedAt || '',
    submittedBy: latestSubmissionEvent?.actorName || workflow.submission.submittedBy || '',
    latestNote: latestSharedNoteEvent?.remark || latestReviewerNote,
    updatedAt: workflow.lastUpdatedAt || '',
    updatedBy: workflow.lastUpdatedBy || '',
    needInputSince: latestPreparationStatusEntry?.updatedAt || latestRequestChangesEvent?.time || '',
    requestNote: latestRequestChangesEvent?.remark || latestPreparationEvent?.remark || '',
    finalStatus,
    waitingSince: latestPreparationStatusEntry?.updatedAt || latestRequestChangesEvent?.time || '',
    latestReviewerNote: latestRequestChangesEvent?.remark || latestReviewerNote,
    lastReviewedAt: latestReviewerEvent?.time || '',
    decidedAt: latestDecisionEvent?.time || (['completed', 'no_need'].includes(queueTab) ? workflow.lastUpdatedAt : ''),
    decidedBy: latestDecisionEvent?.actorName || (['completed', 'no_need'].includes(queueTab) ? workflow.lastUpdatedBy : ''),
    finalDecision: finalStatus,
    totalReviewCycles: getOnboardingTotalReviewCycles(track, workflow),
    agingHours: getOnboardingAgingHours(track, workflow, nowValue),
    workflow,
    channel,
  };
};

export const buildOnboardingQueueRows = (
  channels: any[] = [],
  nowValue: Date | string | number = new Date(),
) => (
  channels.flatMap((channel) => (
    ONBOARDING_TRACKS
      .map((track) => buildOnboardingQueueRow(channel, track, nowValue))
      .filter((row): row is OnboardingQueueRow => Boolean(row))
  ))
);

export const getChannelOnboardingWorkflow = (channel: any, track: OnboardingTrack) => {
  const fieldKey = getOnboardingTrackFieldKey(track);
  const rawWorkflow = channel?.[fieldKey];
  const hasWorkflowPayload = Boolean(
    rawWorkflow
    && typeof rawWorkflow === 'object'
    && Object.keys(rawWorkflow as Record<string, unknown>).length,
  );
  const legacyStatus = hasWorkflowPayload
    ? undefined
    : track === 'wooshpay'
      ? channel?.globalProgress?.kyc
      : channel?.complianceStatus;
  const legacyHistory = hasWorkflowPayload
    ? undefined
    : track === 'wooshpay'
      ? channel?.submissionHistory?.kyc
      : channel?.submissionHistory?.cdd;
  return normalizeOnboardingWorkflow(track, rawWorkflow, legacyStatus, legacyHistory);
};

export const getLatestOnboardingReviewRequirement = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  const handoffStatus = getComplianceHandoffStatus(track);
  return normalizedWorkflow.activityHistory.find((entry) => (
    entry.lifecycle?.state !== 'revoked'
    && (
      entry.eventType === 'request_changes'
      || (entry.actorRole === 'reviewer' && entry.status === handoffStatus)
    )
  )) || null;
};
