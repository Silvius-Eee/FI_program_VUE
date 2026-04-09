export const ONBOARDING_TRACKS = ['wooshpay', 'corridor'] as const;

export type OnboardingTrack = typeof ONBOARDING_TRACKS[number];

export const ONBOARDING_STATUS_KEYS = [
  'completed',
  'no_need',
  'self_preparation',
  'not_started',
  'counterparty_reviewing',
] as const;

export type OnboardingStatusKey = typeof ONBOARDING_STATUS_KEYS[number];

export const ONBOARDING_QUEUE_TABS = ['in_progress', 'need_fi_input', 'done'] as const;

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
}

export type OnboardingActivityEventType =
  | 'submission'
  | 'resubmission'
  | 'request_changes'
  | 'approval'
  | 'status_change'
  | 'note';

export interface OnboardingActivityEntry {
  id: string;
  eventType: OnboardingActivityEventType;
  title: string;
  remark: string;
  status: OnboardingStatusKey;
  time: string;
  actorName: string;
  actorRole: string;
  attachments: OnboardingAttachmentMeta[];
}

export interface OnboardingWorkflow {
  status: OnboardingStatusKey;
  submission: OnboardingSubmission;
  statusHistory: OnboardingStatusHistoryEntry[];
  activityHistory: OnboardingActivityEntry[];
  lastUpdatedAt: string;
  lastUpdatedBy: string;
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

const onboardingTrackMeta = {
  wooshpay: {
    title: 'WooshPay onboarding',
    selfPreparationLabel: 'WooshPay Preparation',
    counterpartyReviewingLabel: 'Corridor Reviewing',
    legacyFieldKey: 'wooshpayOnboarding',
  },
  corridor: {
    title: 'Corridor onboarding',
    selfPreparationLabel: 'Corridor Preparation',
    counterpartyReviewingLabel: 'WooshPay Reviewing',
    legacyFieldKey: 'corridorOnboarding',
  },
} as const;

const onboardingStatusAliasMap: Record<OnboardingStatusKey, string[]> = {
  completed: ['completed', 'approved', 'signed'],
  no_need: ['no need', 'no_need', 'noneed'],
  self_preparation: ['self preparation', 'self_preparation', 'wooshpay preparation', 'corridor preparation'],
  not_started: ['not started', 'not_started'],
  counterparty_reviewing: [
    'counterparty reviewing',
    'counterparty_reviewing',
    'corridor reviewing',
    'channel reviewing',
    'wooshpay reviewing',
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
  self_preparation: { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' },
  not_started: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  counterparty_reviewing: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

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
});

export const getOnboardingTrackTitle = (track: OnboardingTrack) => onboardingTrackMeta[track].title;

export const getOnboardingWorkflowStatusLabel = (
  track: OnboardingTrack,
  status: OnboardingStatusKey | string | null | undefined,
) => {
  const normalizedStatus = normalizeOnboardingStatusKey(status, track);
  if (normalizedStatus === 'completed') return 'Completed';
  if (normalizedStatus === 'no_need') return 'No Need';
  if (normalizedStatus === 'self_preparation') return onboardingTrackMeta[track].selfPreparationLabel;
  if (normalizedStatus === 'counterparty_reviewing') return onboardingTrackMeta[track].counterpartyReviewingLabel;
  return 'Not Started';
};

const resolveDateValue = (value: unknown) => {
  const timestamp = new Date(normalizeTimestamp(value)).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isNoNeedDecisionEvent = (entry: OnboardingActivityEntry) => (
  entry.eventType === 'note' && entry.status === 'no_need'
);

const isReviewerEvent = (entry: OnboardingActivityEntry) => (
  entry.actorRole === 'reviewer'
  || reviewerDecisionEventTypes.has(entry.eventType)
  || entry.eventType === 'status_change'
  || isNoNeedDecisionEvent(entry)
);

const isSubmissionEvent = (entry: OnboardingActivityEntry) => submissionEventTypes.has(entry.eventType);

export const getOnboardingStatusLabel = (
  track: OnboardingTrack,
  status: OnboardingStatusKey | string | null | undefined,
) => {
  const normalizedStatus = normalizeOnboardingStatusKey(status, track);
  if (normalizedStatus === 'completed') return 'Completed';
  if (normalizedStatus === 'no_need') return 'No Need';
  if (normalizedStatus === 'self_preparation') return 'Need FI Input';
  if (normalizedStatus === 'counterparty_reviewing') return 'In Progress';
  return 'Not Started';
};

export const getOnboardingStatusTheme = (status: OnboardingStatusKey | string | null | undefined) => (
  onboardingStatusThemes[normalizeOnboardingStatusKey(status)] || onboardingStatusThemes.not_started
);

export const normalizeOnboardingStatusKey = (
  value: unknown,
  track?: OnboardingTrack,
): OnboardingStatusKey => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return 'not_started';
  if ((ONBOARDING_STATUS_KEYS as readonly string[]).includes(normalized)) {
    return normalized as OnboardingStatusKey;
  }

  for (const [statusKey, aliases] of Object.entries(onboardingStatusAliasMap)) {
    if (aliases.includes(normalized)) {
      return statusKey as OnboardingStatusKey;
    }
  }

  if (track) {
    if (normalized === onboardingTrackMeta[track].selfPreparationLabel.toLowerCase()) {
      return 'self_preparation';
    }
    if (normalized === onboardingTrackMeta[track].counterpartyReviewingLabel.toLowerCase()) {
      return 'counterparty_reviewing';
    }
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
    .map((entry, index) => {
      const candidate = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
      const status = normalizeOnboardingStatusKey(candidate.status, track);
      const updatedAt = normalizeTimestamp(candidate.updatedAt);
      const updatedBy = normalizeText(candidate.updatedBy);
      const remark = normalizeText(candidate.remark);
      if (!updatedAt && !updatedBy && !remark) return null;

      return {
        id: normalizeText(candidate.id) || `${buildStatusHistoryId()}-${index}`,
        status,
        remark,
        updatedAt,
        updatedBy,
      };
    })
    .filter((entry): entry is OnboardingStatusHistoryEntry => Boolean(entry))
    .sort((left, right) => getTimestampValue(right.updatedAt) - getTimestampValue(left.updatedAt));
};

const normalizeOnboardingActivityEventType = (value: unknown): OnboardingActivityEventType => {
  const normalized = normalizeText(value).toLowerCase();
  if (
    normalized === 'submission'
    || normalized === 'resubmission'
    || normalized === 'request_changes'
    || normalized === 'approval'
    || normalized === 'status_change'
    || normalized === 'note'
  ) {
    return normalized;
  }

  return 'note';
};

const buildDefaultActivityTitle = (
  track: OnboardingTrack,
  eventType: OnboardingActivityEventType,
  status: OnboardingStatusKey,
) => {
  if (eventType === 'submission') return `${getOnboardingTrackTitle(track)} package submitted`;
  if (eventType === 'resubmission') return `${getOnboardingTrackTitle(track)} package resubmitted`;
  if (eventType === 'request_changes') return `${getOnboardingTrackTitle(track)} needs FI input`;
  if (eventType === 'approval') return `${getOnboardingTrackTitle(track)} completed`;
  if (eventType === 'status_change') return `Status updated to ${getOnboardingStatusLabel(track, status)}`;
  return `${getOnboardingTrackTitle(track)} note added`;
};

const createActivityEntryFromSubmission = (
  track: OnboardingTrack,
  submission: OnboardingSubmission,
  eventType: 'submission' | 'resubmission' = 'submission',
): OnboardingActivityEntry | null => {
  if (!hasOnboardingSubmission(submission)) return null;

  return {
    id: buildActivityHistoryId(),
    eventType,
    title: buildDefaultActivityTitle(track, eventType, 'counterparty_reviewing'),
    remark: submission.notes,
    status: 'counterparty_reviewing',
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
      .map((entry, index) => {
        const candidate = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        const status = normalizeOnboardingStatusKey(candidate.status, track);
        const time = normalizeTimestamp(candidate.time ?? candidate.updatedAt ?? candidate.submittedAt);
        const actorName = normalizeText(candidate.actorName ?? candidate.updatedBy ?? candidate.submittedBy);
        const remark = normalizeText(candidate.remark ?? candidate.notes);
        const title = normalizeText(candidate.title) || buildDefaultActivityTitle(
          track,
          normalizeOnboardingActivityEventType(candidate.eventType),
          status,
        );
        const attachments = Array.isArray(candidate.attachments)
          ? candidate.attachments.map(normalizeAttachmentMeta)
          : [];

        if (!time && !actorName && !remark && !title) return null;

        return {
          id: normalizeText(candidate.id) || `${buildActivityHistoryId()}-${index}`,
          eventType: normalizeOnboardingActivityEventType(candidate.eventType),
          title,
          remark,
          status,
          time,
          actorName,
          actorRole: normalizeText(candidate.actorRole),
          attachments,
        };
      })
      .filter((entry): entry is OnboardingActivityEntry => Boolean(entry))
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
  const fallbackStatus = candidate.status ?? legacyStatus;
  let status = normalizeOnboardingStatusKey(fallbackStatus, track);

  if (status === 'not_started' && hasOnboardingSubmission(submission)) {
    status = 'counterparty_reviewing';
  }

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

  return {
    status,
    submission,
    statusHistory,
    activityHistory,
    lastUpdatedAt,
    lastUpdatedBy,
  };
};

export const buildOnboardingHistoryEntry = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  const latestActivityEntry = normalizedWorkflow.activityHistory[0];

  if (latestActivityEntry) {
    return {
      date: latestActivityEntry.time || null,
      user: latestActivityEntry.actorName || null,
      notes: latestActivityEntry.remark || latestActivityEntry.title || null,
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
): OnboardingStatusHistoryEntry => ({
  id: buildStatusHistoryId(),
  status: normalizeOnboardingStatusKey(status, track),
  remark: normalizeText(remark),
  updatedAt: normalizeTimestamp(updatedAt),
  updatedBy: normalizeText(updatedBy),
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
});

export const applyOnboardingSubmission = (
  channel: any,
  track: OnboardingTrack,
  payload: Partial<OnboardingSubmission>,
  actor: string,
  timestamp: string,
) => {
  const fieldKey = getOnboardingTrackFieldKey(track);
  const currentWorkflow = getWorkflowFromChannel(channel, track);
  const hadSubmission = hasOnboardingSubmission(currentWorkflow.submission);
  const submission = normalizeOnboardingSubmission({
    ...currentWorkflow.submission,
    ...payload,
    submittedAt: timestamp,
    submittedBy: actor,
  }, track);
  const nextStatus = (currentWorkflow.status === 'not_started' || currentWorkflow.status === 'self_preparation')
    ? 'counterparty_reviewing'
    : currentWorkflow.status;
  const nextHistory = currentWorkflow.status !== nextStatus
    ? [
        createOnboardingStatusHistoryEntry(track, nextStatus, 'Auto-updated after package submission.', timestamp, actor),
        ...currentWorkflow.statusHistory,
      ]
    : currentWorkflow.statusHistory;
  const activityEntry = createOnboardingActivityEntry(
    track,
    hadSubmission ? 'resubmission' : 'submission',
    nextStatus,
    submission.notes,
    timestamp,
    actor,
    'submitter',
    submission.attachments,
  );

  return {
    ...channel,
    [fieldKey]: {
      ...currentWorkflow,
      submission,
      status: nextStatus,
      statusHistory: nextHistory,
      activityHistory: [activityEntry, ...currentWorkflow.activityHistory],
      lastUpdatedAt: timestamp,
      lastUpdatedBy: actor,
    },
    lastModifiedAt: timestamp,
  };
};

const resolveActivityEventTypeByStatus = (status: OnboardingStatusKey): OnboardingActivityEventType => {
  if (status === 'completed') return 'approval';
  if (status === 'self_preparation') return 'request_changes';
  if (status === 'no_need') return 'note';
  return 'status_change';
};

const buildActivityTitleByStatus = (track: OnboardingTrack, status: OnboardingStatusKey) => {
  if (status === 'completed') return `${getOnboardingTrackTitle(track)} completed`;
  if (status === 'self_preparation') return `${getOnboardingTrackTitle(track)} needs FI input`;
  if (status === 'no_need') return `${getOnboardingTrackTitle(track)} marked as no need`;
  return `Status updated to ${getOnboardingStatusLabel(track, status)}`;
};

export const applyOnboardingStatusUpdate = (
  channel: any,
  track: OnboardingTrack,
  status: OnboardingStatusKey,
  remark: string,
  actor: string,
  timestamp: string,
) => {
  const fieldKey = getOnboardingTrackFieldKey(track);
  const currentWorkflow = getWorkflowFromChannel(channel, track);
  const historyEntry = createOnboardingStatusHistoryEntry(track, status, remark, timestamp, actor);
  const activityEntry = createOnboardingActivityEntry(
    track,
    resolveActivityEventTypeByStatus(status),
    status,
    remark,
    timestamp,
    actor,
    'reviewer',
    [],
    buildActivityTitleByStatus(track, status),
  );

  return {
    ...channel,
    [fieldKey]: {
      ...currentWorkflow,
      status,
      statusHistory: [historyEntry, ...currentWorkflow.statusHistory],
      activityHistory: [activityEntry, ...currentWorkflow.activityHistory],
      lastUpdatedAt: timestamp,
      lastUpdatedBy: actor,
    },
  lastModifiedAt: timestamp,
  };
};

export const getOnboardingQueueTab = (status: OnboardingStatusKey | string | null | undefined): OnboardingQueueTab | null => {
  const normalizedStatus = normalizeOnboardingStatusKey(status);
  if (normalizedStatus === 'counterparty_reviewing') return 'in_progress';
  if (normalizedStatus === 'self_preparation') return 'need_fi_input';
  if (normalizedStatus === 'completed' || normalizedStatus === 'no_need') return 'done';
  return null;
};

export const getOnboardingCurrentVersion = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  const versionCount = normalizedWorkflow.activityHistory.filter((entry) => isSubmissionEvent(entry)).length;

  if (versionCount > 0) return versionCount;
  return hasOnboardingSubmission(normalizedWorkflow.submission) ? 1 : 0;
};

export const getLatestOnboardingSubmissionEvent = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.find((entry) => isSubmissionEvent(entry)) || null;
};

export const getLatestOnboardingReviewerEvent = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.find((entry) => isReviewerEvent(entry)) || null;
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

export const getRecentOnboardingMilestones = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
  limit = 4,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.slice(0, Math.max(limit, 0));
};

export const getLatestOnboardingDecisionEvent = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.find((entry) => (
    entry.eventType === 'approval' || isNoNeedDecisionEvent(entry)
  )) || null;
};

export const getOnboardingTotalReviewCycles = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.filter((entry) => (
    reviewerDecisionEventTypes.has(entry.eventType) || isNoNeedDecisionEvent(entry)
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

  const latestSubmissionEvent = getLatestOnboardingSubmissionEvent(track, workflow);
  const latestReviewerEvent = getLatestOnboardingReviewerEvent(track, workflow);
  const latestDecisionEvent = getLatestOnboardingDecisionEvent(track, workflow);
  const latestRequestChangesEvent = workflow.activityHistory.find((entry) => entry.eventType === 'request_changes') || null;
  const latestReviewerNote = getLatestOnboardingReviewerNote(track, workflow);
  const finalStatus = queueTab === 'done' ? getOnboardingStatusLabel(track, workflow.status) : '';

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
    latestNote: latestReviewerNote,
    updatedAt: workflow.lastUpdatedAt || '',
    updatedBy: workflow.lastUpdatedBy || '',
    needInputSince: latestRequestChangesEvent?.time || '',
    requestNote: latestRequestChangesEvent?.remark || '',
    finalStatus,
    waitingSince: latestRequestChangesEvent?.time || '',
    latestReviewerNote: latestRequestChangesEvent?.remark || latestReviewerNote,
    lastReviewedAt: latestReviewerEvent?.time || '',
    decidedAt: latestDecisionEvent?.time || (queueTab === 'done' ? workflow.lastUpdatedAt : ''),
    decidedBy: latestDecisionEvent?.actorName || (queueTab === 'done' ? workflow.lastUpdatedBy : ''),
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
  const legacyStatus = track === 'wooshpay'
    ? channel?.globalProgress?.kyc
    : channel?.complianceStatus;
  const legacyHistory = track === 'wooshpay'
    ? channel?.submissionHistory?.kyc
    : channel?.submissionHistory?.cdd;
  const fieldKey = getOnboardingTrackFieldKey(track);
  return normalizeOnboardingWorkflow(track, channel?.[fieldKey], legacyStatus, legacyHistory);
};

export const getLatestOnboardingReviewRequirement = (
  track: OnboardingTrack,
  workflow?: Partial<OnboardingWorkflow> | null,
) => {
  const normalizedWorkflow = normalizeOnboardingWorkflow(track, workflow);
  return normalizedWorkflow.activityHistory.find((entry) => entry.eventType === 'request_changes') || null;
};
