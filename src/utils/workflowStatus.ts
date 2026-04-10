export type WorkflowStatusTheme = {
  bg: string;
  text: string;
};

export type LegalDocType = 'NDA' | 'MSA';
export type LegalActorRole = 'FIOP' | 'Legal';
export type LegalQueueGroup = 'legal_pending' | 'external_pending' | 'completed' | 'no_need' | 'inactive';
export type LegalQueueSubStatus = 'all' | 'Under our review' | 'Pending our signature' | 'Under Corridor review' | 'Pending Corridor signature';

type CommonEditableLegalStatus =
  | 'Under our review'
  | 'Under Corridor review'
  | 'Pending our signature'
  | 'Pending Corridor signature'
  | 'Completed';

type CommonDisplayLegalStatus = CommonEditableLegalStatus | 'Not Started';

export type NdaStatusValue = CommonDisplayLegalStatus | 'No Need';
export type MsaStatusValue = CommonDisplayLegalStatus;
export type LegalStatusValue = NdaStatusValue | MsaStatusValue;

export type LegalAttachment = {
  uid: string;
  name: string;
  status: string;
  size: number;
  type: string;
};

export type LegalRequestPacket = {
  entities: string[];
  documentLink: string;
  remarks: string;
  attachments: LegalAttachment[];
  submittedAt: string;
  submittedBy: string;
};

export type LegalStatusHistoryEntry = {
  id: string;
  time: string;
  actorRole: LegalActorRole;
  actorName: string;
  fromStatus: LegalStatusValue | null;
  toStatus: LegalStatusValue;
  note: string;
  documentLink: string;
  attachments: LegalAttachment[];
};

type LegalStatusFieldKeys = {
  historyKey: 'nda' | 'msa';
  statusFieldKey: 'ndaStatus' | 'contractStatus';
  progressKey: 'nda' | 'contract';
};

const NDA_STATUS_VALUES = [
  'Under our review',
  'Under Corridor review',
  'Pending our signature',
  'Pending Corridor signature',
  'Completed',
  'No Need',
] as const;

const MSA_STATUS_VALUES = [
  'Under our review',
  'Under Corridor review',
  'Pending our signature',
  'Pending Corridor signature',
  'Completed',
] as const;

const NDA_ALLOWED_BY_ROLE: Record<LegalActorRole, NdaStatusValue[]> = {
  FIOP: ['Under our review', 'Pending our signature'],
  Legal: ['Under Corridor review', 'Pending Corridor signature', 'Completed', 'No Need'],
};

const MSA_ALLOWED_BY_ROLE: Record<LegalActorRole, MsaStatusValue[]> = {
  FIOP: ['Under our review', 'Pending our signature'],
  Legal: ['Under Corridor review', 'Pending Corridor signature', 'Completed'],
};

const NDA_STATUS_MIGRATION_MAP: Record<string, NdaStatusValue> = {
  completed: 'Completed',
  signed: 'Completed',
  approved: 'Completed',
  'no need': 'No Need',
  no_need: 'No Need',
  none: 'No Need',
  'not started': 'Not Started',
  'under our review': 'Under our review',
  'under review': 'Under our review',
  reviewing: 'Under our review',
  'in review': 'Under our review',
  'under legal review': 'Under our review',
  'pending our signature': 'Pending our signature',
  'pending fi signature': 'Pending our signature',
  'e-signature': 'Pending our signature',
  'pending corridor signature': 'Pending Corridor signature',
  'pending channel signature': 'Pending Corridor signature',
  'under corridor review': 'Under Corridor review',
  'under channel review': 'Under Corridor review',
  'corridor reviewing': 'Under Corridor review',
  corridor_reviewing: 'Under Corridor review',
  'counterparty reviewing': 'Under Corridor review',
};

const MSA_STATUS_MIGRATION_MAP: Record<string, MsaStatusValue> = {
  completed: 'Completed',
  signed: 'Completed',
  approved: 'Completed',
  none: 'Completed',
  'no need': 'Completed',
  no_need: 'Completed',
  'not started': 'Not Started',
  'under our review': 'Under our review',
  'under review': 'Under our review',
  reviewing: 'Under our review',
  'in review': 'Under our review',
  'under legal review': 'Under our review',
  'pending our signature': 'Pending our signature',
  'pending fi signature': 'Pending our signature',
  'e-signature': 'Pending our signature',
  'pending corridor signature': 'Pending Corridor signature',
  'pending channel signature': 'Pending Corridor signature',
  'under corridor review': 'Under Corridor review',
  'under channel review': 'Under Corridor review',
  'corridor reviewing': 'Under Corridor review',
  corridor_reviewing: 'Under Corridor review',
  'counterparty reviewing': 'Under Corridor review',
};

const WORKFLOW_STATUS_LABEL_MAP: Record<string, string> = {
  completed: 'Completed',
  signed: 'Signed',
  approved: 'Approved',
  'changes requested': 'Changes Requested',
  request_changes: 'Changes Requested',
  'request changes': 'Changes Requested',
  'in review': 'In Review',
  'under review': 'Under Review',
  reviewing: 'Under Review',
  'under our review': 'Under our review',
  'under corridor review': 'Under Corridor review',
  'under channel review': 'Under Corridor review',
  'corridor reviewing': 'Under Corridor review',
  corridor_reviewing: 'Under Corridor review',
  pending: 'Pending',
  'pending our signature': 'Pending our signature',
  'pending corridor signature': 'Pending Corridor signature',
  'pending fi signature': 'Pending our signature',
  'pending channel signature': 'Pending Corridor signature',
  'under legal review': 'Under Review',
  'in progress': 'In Progress',
  'in process': 'In Progress',
  ongoing: 'In Progress',
  'not started': 'Not Started',
  'e-signature': 'E-signature',
  none: 'None',
  'no need': 'No Need',
  no_need: 'No Need',
};

const WORKFLOW_STATUS_THEME_MAP: Record<string, WorkflowStatusTheme> = {
  Completed: { bg: '#DCFCE7', text: '#166534' },
  Signed: { bg: '#DCFCE7', text: '#166534' },
  Approved: { bg: '#DBEAFE', text: '#1D4ED8' },
  'Changes Requested': { bg: '#FFEDD5', text: '#C2410C' },
  'In Review': { bg: '#E0E7FF', text: '#4338CA' },
  'Under Review': { bg: '#E0E7FF', text: '#4338CA' },
  'Under our review': { bg: '#DBEAFE', text: '#1D4ED8' },
  'Under Corridor review': { bg: '#F3E8FF', text: '#7E22CE' },
  'E-signature': { bg: '#ECFDF5', text: '#047857' },
  Pending: { bg: '#FEF3C7', text: '#B45309' },
  'Pending our signature': { bg: '#FEF3C7', text: '#B45309' },
  'Pending Corridor signature': { bg: '#FED7AA', text: '#C2410C' },
  'In Progress': { bg: '#FEF3C7', text: '#B45309' },
  'Not Started': { bg: '#F1F5F9', text: '#475569' },
  None: { bg: '#F8FAFC', text: '#64748B' },
  'No Need': { bg: '#F8FAFC', text: '#64748B' },
};

const normalizeStatusToken = (value: unknown) => String(value ?? '').trim().toLowerCase();
const normalizeText = (value: unknown) => String(value ?? '').trim();
const LEGAL_ACTOR_NAME_TOKENS = new Set(['legal', 'legal team']);

const resolveTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const resolveLegalFieldKeys = (docType: LegalDocType): LegalStatusFieldKeys => (
  docType === 'MSA'
    ? { historyKey: 'msa', statusFieldKey: 'contractStatus', progressKey: 'contract' }
    : { historyKey: 'nda', statusFieldKey: 'ndaStatus', progressKey: 'nda' }
);

const buildLegalHistoryId = (docType: LegalDocType, index = Date.now()) => (
  `${docType.toLowerCase()}-${index}-${Math.random().toString(36).slice(2, 8)}`
);

const normalizeAttachment = (value: any, index = 0): LegalAttachment => ({
  uid: normalizeText(value?.uid) || `attachment-${Date.now()}-${index}`,
  name: normalizeText(value?.name) || 'Attachment',
  status: normalizeText(value?.status) || 'done',
  size: Number.isFinite(Number(value?.size)) ? Number(value.size) : 0,
  type: normalizeText(value?.type),
});

const normalizeAttachmentList = (attachments: unknown) => (
  Array.isArray(attachments)
    ? attachments.map((attachment, index) => normalizeAttachment(attachment, index))
    : []
);

const normalizeStringArray = (value: unknown) => (
  Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : []
);

const buildAllowedStatusSet = (
  docType: LegalDocType,
  actorRole: LegalActorRole | 'all' = 'all',
) => {
  if (actorRole === 'all') {
    return new Set<string>(docType === 'NDA' ? NDA_STATUS_VALUES : MSA_STATUS_VALUES);
  }

  return new Set<string>(
    (docType === 'NDA' ? NDA_ALLOWED_BY_ROLE[actorRole] : MSA_ALLOWED_BY_ROLE[actorRole]).map(String),
  );
};

const normalizeLegalActorRole = (value: unknown, fallback: LegalActorRole = 'FIOP'): LegalActorRole => {
  const normalized = normalizeStatusToken(value);
  if (normalized === 'legal') return 'Legal';
  if (normalized === 'fiop') return 'FIOP';
  return fallback;
};

const isLegalDepartmentActorName = (value: unknown) => LEGAL_ACTOR_NAME_TOKENS.has(normalizeStatusToken(value));

const resolveFiopActorName = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized && !isLegalDepartmentActorName(normalized)) {
      return normalized;
    }
  }

  return 'Current User';
};

const resolveLegalActorName = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }

  return 'Legal Team';
};

const resolveHistoryActorRoleByStatus = (
  status: LegalStatusValue,
  fallback: LegalActorRole = 'FIOP',
): LegalActorRole => {
  if (
    status === 'Under Corridor review'
    || status === 'Pending Corridor signature'
    || status === 'Completed'
    || status === 'No Need'
  ) {
    return 'Legal';
  }

  if (status === 'Under our review' || status === 'Pending our signature') {
    return 'FIOP';
  }

  return fallback;
};

const dedupeLegalHistory = (entries: LegalStatusHistoryEntry[]) => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = [
      entry.time,
      entry.actorRole,
      entry.actorName,
      entry.fromStatus || '',
      entry.toStatus,
      entry.note,
      entry.documentLink,
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeWorkflowStatusLabel = (
  value: unknown,
  fallback = 'Not Started',
) => {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;

  return WORKFLOW_STATUS_LABEL_MAP[normalized.toLowerCase()] || normalized;
};

export const normalizeNdaStatusLabel = (
  value: unknown,
  fallback: NdaStatusValue = 'Not Started',
) => {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;

  return NDA_STATUS_MIGRATION_MAP[normalized.toLowerCase()] || fallback;
};

export const normalizeMsaStatusLabel = (
  value: unknown,
  fallback: MsaStatusValue = 'Not Started',
) => {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;

  return MSA_STATUS_MIGRATION_MAP[normalized.toLowerCase()] || fallback;
};

export const normalizeLegalDocumentStatusLabel = (
  docType: LegalDocType,
  value: unknown,
) => (docType === 'NDA' ? normalizeNdaStatusLabel(value) : normalizeMsaStatusLabel(value));

export const getWorkflowStatusTheme = (value: unknown): WorkflowStatusTheme => {
  const normalized = normalizeWorkflowStatusLabel(value);
  return WORKFLOW_STATUS_THEME_MAP[normalized] || WORKFLOW_STATUS_THEME_MAP['Not Started'];
};

export const getNdaStatusTheme = (value: unknown): WorkflowStatusTheme => (
  getWorkflowStatusTheme(normalizeNdaStatusLabel(value))
);

export const getMsaStatusTheme = (value: unknown): WorkflowStatusTheme => (
  getWorkflowStatusTheme(normalizeMsaStatusLabel(value))
);

export const getLegalDocumentStatusTheme = (
  docType: LegalDocType,
  value: unknown,
): WorkflowStatusTheme => (
  docType === 'NDA' ? getNdaStatusTheme(value) : getMsaStatusTheme(value)
);

export const getNdaStatusOptions = (actorRole: LegalActorRole | 'all' = 'all') => {
  const allowedStatuses = buildAllowedStatusSet('NDA', actorRole);
  return NDA_STATUS_VALUES
    .filter((value) => allowedStatuses.has(value))
    .map((value) => ({ label: value, value }));
};

export const getMsaStatusOptions = (actorRole: LegalActorRole | 'all' = 'all') => {
  const allowedStatuses = buildAllowedStatusSet('MSA', actorRole);
  return MSA_STATUS_VALUES
    .filter((value) => allowedStatuses.has(value))
    .map((value) => ({ label: value, value }));
};

export const getLegalStatusOptions = (
  docType: LegalDocType,
  actorRole: LegalActorRole | 'all' = 'all',
) => (docType === 'NDA' ? getNdaStatusOptions(actorRole) : getMsaStatusOptions(actorRole));

export const getLegalQueueGroup = (docType: LegalDocType, value: unknown): LegalQueueGroup => {
  const normalized = normalizeLegalDocumentStatusLabel(docType, value);

  if (normalized === 'Completed') return 'completed';
  if (normalized === 'No Need') return docType === 'NDA' ? 'no_need' : 'completed';
  if (normalized === 'Under our review' || normalized === 'Pending our signature') return 'legal_pending';
  if (normalized === 'Under Corridor review' || normalized === 'Pending Corridor signature') return 'external_pending';
  return 'inactive';
};

export const getLegalQueueSubStatusOptions = (
  docType: LegalDocType,
  group: LegalQueueGroup,
): Array<{ label: string; value: LegalQueueSubStatus }> => {
  if (group === 'legal_pending') {
    return [
      { label: 'All', value: 'all' },
      { label: 'Under our review', value: 'Under our review' },
      { label: 'Pending our signature', value: 'Pending our signature' },
    ];
  }

  if (group === 'external_pending') {
    return [
      { label: 'All', value: 'all' },
      { label: 'Under Corridor review', value: 'Under Corridor review' },
      { label: 'Pending Corridor signature', value: 'Pending Corridor signature' },
    ];
  }

  if (group === 'no_need' && docType === 'NDA') {
    return [{ label: 'All', value: 'all' }];
  }

  if (group === 'completed') {
    return [{ label: 'All', value: 'all' }];
  }

  return [{ label: 'All', value: 'all' }];
};

export const getNdaQueueGroup = (value: unknown): LegalQueueGroup => (
  getLegalQueueGroup('NDA', value)
);

export const getMsaQueueGroup = (value: unknown): LegalQueueGroup => (
  getLegalQueueGroup('MSA', value)
);

export const getDefaultLegalSubmissionStatus = (
  _docType: LegalDocType,
): NdaStatusValue | MsaStatusValue => 'Under our review';

export const isClosedLegalStatus = (docType: LegalDocType, value: unknown) => {
  const normalized = normalizeLegalDocumentStatusLabel(docType, value);
  return normalized === 'Completed' || normalized === 'No Need';
};

export const matchesLegalAuditLog = (
  docType: LegalDocType,
  action: unknown,
) => {
  const normalized = normalizeStatusToken(action);
  if (!normalized) return false;

  if (docType === 'NDA') {
    return normalized.includes('nda') || normalized.includes('non-disclosure');
  }

  return normalized.includes('msa')
    || normalized.includes('master services agreement')
    || normalized.includes('contract');
};

export const getLegalRequestPacket = (
  channel: any,
  docType: LegalDocType,
): LegalRequestPacket => {
  const { historyKey } = resolveLegalFieldKeys(docType);
  const savedRequest = channel?.legalRequestData?.[historyKey] || {};
  const savedHistory = channel?.submissionHistory?.[historyKey] || {};

  return {
    entities: normalizeStringArray(savedRequest.entities),
    documentLink: normalizeText(savedRequest.documentLink),
    remarks: normalizeText(savedRequest.remarks || savedHistory.notes),
    attachments: normalizeAttachmentList(savedRequest.attachments),
    submittedAt: normalizeText(savedRequest.submittedAt || savedHistory.date),
    submittedBy: resolveFiopActorName(savedRequest.submittedBy, channel?.fiopOwner, savedHistory.user),
  };
};

const normalizeLegalHistoryEntry = (
  channel: any,
  docType: LegalDocType,
  requestPacket: LegalRequestPacket,
  entry: any,
  index = 0,
): LegalStatusHistoryEntry | null => {
  if (!entry || typeof entry !== 'object') return null;

  const toStatus = normalizeLegalDocumentStatusLabel(docType, entry.toStatus || entry.status);
  if (toStatus === 'Not Started') return null;

  const fallbackRole = resolveHistoryActorRoleByStatus(toStatus);
  const actorRole = normalizeLegalActorRole(entry.actorRole, fallbackRole);
  const normalizedEntry: LegalStatusHistoryEntry = {
    id: normalizeText(entry.id) || buildLegalHistoryId(docType, index),
    time: normalizeText(entry.time),
    actorRole,
    actorName: actorRole === 'Legal'
      ? resolveLegalActorName(entry.actorName, entry.user)
      : resolveFiopActorName(
        entry.actorName,
        entry.user,
        entry.submittedBy,
        requestPacket.submittedBy,
        channel?.fiopOwner,
      ),
    fromStatus: normalizeText(entry.fromStatus)
      ? normalizeLegalDocumentStatusLabel(docType, entry.fromStatus)
      : null,
    toStatus,
    note: normalizeText(entry.note || entry.notes || entry.remark),
    documentLink: normalizeText(entry.documentLink),
    attachments: normalizeAttachmentList(entry.attachments),
  };

  return normalizedEntry;
};

const buildMigratedLegalStatusHistory = (
  channel: any,
  docType: LegalDocType,
): LegalStatusHistoryEntry[] => {
  const { historyKey, statusFieldKey, progressKey } = resolveLegalFieldKeys(docType);
  const currentStatus = normalizeLegalDocumentStatusLabel(
    docType,
    channel?.[statusFieldKey] || channel?.globalProgress?.[progressKey],
  );
  const requestPacket = getLegalRequestPacket(channel, docType);
  const historySnapshot = channel?.submissionHistory?.[historyKey] || {};
  const initialStatus = getDefaultLegalSubmissionStatus(docType);
  const entries: LegalStatusHistoryEntry[] = [];
  const packetTime = requestPacket.submittedAt || normalizeText(historySnapshot.date);

  if (
    packetTime
    || requestPacket.documentLink
    || requestPacket.remarks
    || requestPacket.entities.length
    || requestPacket.attachments.length
  ) {
    entries.push({
      id: buildLegalHistoryId(docType, 0),
      time: packetTime || normalizeText(channel?.lastModifiedAt),
      actorRole: 'FIOP',
      actorName: resolveFiopActorName(requestPacket.submittedBy, channel?.fiopOwner),
      fromStatus: null,
      toStatus: initialStatus,
      note: requestPacket.remarks || normalizeText(historySnapshot.notes),
      documentLink: requestPacket.documentLink,
      attachments: requestPacket.attachments,
    });
  }

  if (currentStatus !== 'Not Started') {
    const latestKnownTime = normalizeText(channel?.lastModifiedAt) || packetTime;
    const latestKnownNote = normalizeText(historySnapshot.notes);
    const hasInitialEntry = entries.length > 0;
    const latestStatus = hasInitialEntry ? entries[entries.length - 1].toStatus : null;
    if (!hasInitialEntry && latestKnownTime) {
      const actorRole = resolveHistoryActorRoleByStatus(currentStatus);
      entries.push({
        id: buildLegalHistoryId(docType, 1),
        time: latestKnownTime,
        actorRole,
        actorName: actorRole === 'Legal'
          ? resolveLegalActorName(historySnapshot.user)
          : resolveFiopActorName(requestPacket.submittedBy, channel?.fiopOwner),
        fromStatus: null,
        toStatus: currentStatus,
        note: latestKnownNote,
        documentLink: requestPacket.documentLink,
        attachments: requestPacket.attachments,
      });
    } else if (latestStatus && latestStatus !== currentStatus) {
      const actorRole = resolveHistoryActorRoleByStatus(currentStatus);
      entries.push({
        id: buildLegalHistoryId(docType, 2),
        time: latestKnownTime || packetTime,
        actorRole,
        actorName: actorRole === 'Legal'
          ? resolveLegalActorName(historySnapshot.user)
          : resolveFiopActorName(requestPacket.submittedBy, channel?.fiopOwner),
        fromStatus: latestStatus,
        toStatus: currentStatus,
        note: latestKnownNote,
        documentLink: requestPacket.documentLink,
        attachments: requestPacket.attachments,
      });
    }
  }

  return entries
    .filter((entry) => entry.time || entry.note || entry.documentLink || entry.attachments.length)
    .sort((left, right) => resolveTimestamp(right.time) - resolveTimestamp(left.time));
};

export const getLegalStatusHistory = (
  channel: any,
  docType: LegalDocType,
): LegalStatusHistoryEntry[] => {
  const { historyKey } = resolveLegalFieldKeys(docType);
  const requestPacket = getLegalRequestPacket(channel, docType);
  const storedEntries = Array.isArray(channel?.legalStatusHistory?.[historyKey])
    ? channel.legalStatusHistory[historyKey]
        .map((entry: any, index: number) => normalizeLegalHistoryEntry(channel, docType, requestPacket, entry, index))
        .filter(Boolean) as LegalStatusHistoryEntry[]
    : [];

  const normalizedEntries = storedEntries.length > 0
    ? storedEntries
    : buildMigratedLegalStatusHistory(channel, docType);

  return dedupeLegalHistory(normalizedEntries)
    .sort((left, right) => resolveTimestamp(right.time) - resolveTimestamp(left.time));
};

export const getLatestLegalStatusEntry = (
  channel: any,
  docType: LegalDocType,
): LegalStatusHistoryEntry | null => {
  const history = getLegalStatusHistory(channel, docType);
  return history[0] || null;
};

export const buildLegalSubmissionHistoryEntry = (
  channel: any,
  docType: LegalDocType,
  historyEntries: LegalStatusHistoryEntry[] = getLegalStatusHistory(channel, docType),
) => {
  const latestEntry = historyEntries[0];
  const fallbackHistory = channel?.submissionHistory?.[resolveLegalFieldKeys(docType).historyKey] || {};

  return {
    date: latestEntry?.time || normalizeText(fallbackHistory.date) || null,
    user: latestEntry?.actorName || normalizeText(fallbackHistory.user) || null,
    notes: latestEntry?.note || normalizeText(fallbackHistory.notes) || null,
    proposalId: fallbackHistory.proposalId || null,
    proposalName: fallbackHistory.proposalName || null,
  };
};

const buildLegalAuditAction = (
  docType: LegalDocType,
  actorRole: LegalActorRole,
  previousStatus: LegalStatusValue,
  nextStatus: LegalStatusValue,
) => {
  const documentLabel = docType === 'NDA' ? 'NDA' : 'MSA';
  if (previousStatus === 'Not Started') {
    return `${actorRole} started ${documentLabel} and set status to ${nextStatus}.`;
  }

  return `${actorRole} updated ${documentLabel} from ${previousStatus} to ${nextStatus}.`;
};

const getAuditColorForStatus = (status: LegalStatusValue) => {
  const queueGroup = getLegalQueueGroup(status === 'No Need' ? 'NDA' : 'MSA', status);
  if (queueGroup === 'completed' || queueGroup === 'no_need') return 'green';
  if (queueGroup === 'external_pending') return 'orange';
  return 'blue';
};

export const getInitialLegalStatusForActor = (
  docType: LegalDocType,
  actorRole: LegalActorRole,
  currentStatus: unknown,
) => {
  const normalizedStatus = normalizeLegalDocumentStatusLabel(docType, currentStatus);
  const allowedOptions = getLegalStatusOptions(docType, actorRole);
  if (allowedOptions.some((option) => option.value === normalizedStatus)) {
    return normalizedStatus;
  }

  return allowedOptions[0]?.value || getDefaultLegalSubmissionStatus(docType);
};

export const applyLegalStatusUpdate = ({
  channel,
  docType,
  actorRole,
  actorName,
  nextStatus,
  note,
  timestamp,
  packetUpdate,
}: {
  channel: any;
  docType: LegalDocType;
  actorRole: LegalActorRole;
  actorName: string;
  nextStatus: NdaStatusValue | MsaStatusValue;
  note?: string;
  timestamp: string;
  packetUpdate?: Partial<LegalRequestPacket>;
}) => {
  const { historyKey, statusFieldKey, progressKey } = resolveLegalFieldKeys(docType);
  const previousStatus = normalizeLegalDocumentStatusLabel(
    docType,
    channel?.[statusFieldKey] || channel?.globalProgress?.[progressKey],
  );
  const existingPacket = getLegalRequestPacket(channel, docType);
  const mergedPacket: LegalRequestPacket = {
    entities: normalizeStringArray(packetUpdate?.entities ?? existingPacket.entities),
    documentLink: normalizeText(packetUpdate?.documentLink ?? existingPacket.documentLink),
    remarks: normalizeText(packetUpdate?.remarks ?? existingPacket.remarks),
    attachments: normalizeAttachmentList(packetUpdate?.attachments ?? existingPacket.attachments),
    submittedAt: actorRole === 'FIOP'
      ? timestamp
      : normalizeText(existingPacket.submittedAt),
    submittedBy: actorRole === 'FIOP'
      ? normalizeText(actorName)
      : normalizeText(existingPacket.submittedBy),
  };
  const statusNote = normalizeText(note) || mergedPacket.remarks || buildLegalAuditAction(docType, actorRole, previousStatus, nextStatus);
  const existingHistory = getLegalStatusHistory(channel, docType);
  const nextHistoryEntry: LegalStatusHistoryEntry = {
    id: buildLegalHistoryId(docType),
    time: timestamp,
    actorRole,
    actorName: normalizeText(actorName) || (actorRole === 'Legal' ? 'Legal Team' : 'Current User'),
    fromStatus: previousStatus === 'Not Started' ? null : previousStatus,
    toStatus: normalizeLegalDocumentStatusLabel(docType, nextStatus),
    note: statusNote,
    documentLink: mergedPacket.documentLink,
    attachments: mergedPacket.attachments,
  };
  const nextHistory = dedupeLegalHistory([nextHistoryEntry, ...existingHistory])
    .sort((left, right) => resolveTimestamp(right.time) - resolveTimestamp(left.time));

  return {
    ...channel,
    [statusFieldKey]: nextHistoryEntry.toStatus,
    globalProgress: {
      ...(channel?.globalProgress || {}),
      [progressKey]: nextHistoryEntry.toStatus,
    },
    legalRequestData: {
      ...(channel?.legalRequestData || {}),
      [historyKey]: mergedPacket,
    },
    legalStatusHistory: {
      ...(channel?.legalStatusHistory || {}),
      [historyKey]: nextHistory,
    },
    submissionHistory: {
      ...(channel?.submissionHistory || {}),
      [historyKey]: {
        date: timestamp,
        user: nextHistoryEntry.actorName,
        notes: statusNote,
      },
    },
    lastModifiedAt: timestamp,
    auditLogs: [
      {
        time: timestamp,
        user: nextHistoryEntry.actorName,
        action: `${buildLegalAuditAction(docType, actorRole, previousStatus, nextHistoryEntry.toStatus)}${normalizeText(note) ? ` ${normalizeText(note)}` : ''}`,
        color: getAuditColorForStatus(nextHistoryEntry.toStatus),
      },
      ...(Array.isArray(channel?.auditLogs) ? channel.auditLogs : []),
    ],
  };
};
