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
} from './workflowLifecycle';

export type WorkflowStatusTheme = {
  bg: string;
  text: string;
};

export type LegalDocType = 'NDA' | 'MSA' | 'OTHER_ATTACHMENTS';
export type LegalActorRole = 'FIOP' | 'Legal';
export type LegalQueueGroup = 'legal_pending' | 'external_pending' | 'completed' | 'no_need' | 'inactive';
export type LegalQueueSubStatus = 'all' | 'Under our review' | 'Under legal review' | 'Under Corridor review' | 'Pending Corridor signature';

type CommonEditableLegalStatus =
  | 'Under our review'
  | 'Under Corridor review'
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
  storageId?: string;
  url?: string;
  downloadUrl?: string;
  urlSessionId?: string;
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
  displayStatus?: LegalStatusValue;
  note: string;
  documentLink: string;
  attachments: LegalAttachment[];
  requestPacket?: LegalRequestPacket | null;
  title?: string;
  lifecycle?: TimelineLifecycle;
  terminalDecision?: TerminalDecisionMeta | null;
};

type LegalStatusFieldKeys = {
  historyKey: 'nda' | 'msa' | 'otherAttachments';
  statusFieldKey: 'ndaStatus' | 'contractStatus' | 'otherAttachmentsStatus';
  progressKey: 'nda' | 'contract' | 'otherAttachments';
};

export const LEGAL_NOT_STARTED_STATUS = 'Not Started';
export const LEGAL_UNDER_OUR_REVIEW_STATUS = 'Under our review';
export const LEGAL_UNDER_CORRIDOR_REVIEW_STATUS = 'Under Corridor review';
export const LEGAL_PENDING_CORRIDOR_SIGNATURE_STATUS = 'Pending Corridor signature';
export const LEGAL_COMPLETED_STATUS = 'Completed';
export const LEGAL_NO_NEED_STATUS = 'No Need';

export const NDA_DISPLAY_STATUS_VALUES = [
  LEGAL_NOT_STARTED_STATUS,
  LEGAL_UNDER_OUR_REVIEW_STATUS,
  LEGAL_UNDER_CORRIDOR_REVIEW_STATUS,
  LEGAL_PENDING_CORRIDOR_SIGNATURE_STATUS,
  LEGAL_COMPLETED_STATUS,
  LEGAL_NO_NEED_STATUS,
] as const;

export const COMMON_LEGAL_DOCUMENT_DISPLAY_STATUS_VALUES = [
  LEGAL_NOT_STARTED_STATUS,
  LEGAL_UNDER_OUR_REVIEW_STATUS,
  LEGAL_UNDER_CORRIDOR_REVIEW_STATUS,
  LEGAL_PENDING_CORRIDOR_SIGNATURE_STATUS,
  LEGAL_COMPLETED_STATUS,
] as const;

export const NDA_QUEUE_STATUS_VALUES = [
  'Under our review',
  'Under Corridor review',
  'Pending Corridor signature',
  'Completed',
  'No Need',
] as const;

export const COMMON_LEGAL_DOCUMENT_QUEUE_STATUS_VALUES = [
  'Under our review',
  'Under Corridor review',
  'Pending Corridor signature',
  'Completed',
] as const;

const NDA_STATUS_VALUES = NDA_QUEUE_STATUS_VALUES;
const MSA_STATUS_VALUES = COMMON_LEGAL_DOCUMENT_QUEUE_STATUS_VALUES;

const LEGAL_DOCUMENT_DISPLAY_NAME_MAP: Record<LegalDocType, string> = {
  NDA: 'Non-Disclosure Agreement',
  MSA: 'Master Services Agreement',
  OTHER_ATTACHMENTS: 'Other Attachments',
};

const NDA_ALLOWED_BY_ROLE: Record<LegalActorRole, NdaStatusValue[]> = {
  FIOP: ['Under our review'],
  Legal: ['Under Corridor review', 'Pending Corridor signature', 'Completed', 'No Need'],
};

const MSA_ALLOWED_BY_ROLE: Record<LegalActorRole, MsaStatusValue[]> = {
  FIOP: ['Under our review'],
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
  'pending our signature': 'Under our review',
  'pending fi signature': 'Under our review',
  'e-signature': 'Under our review',
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
  'pending our signature': 'Under our review',
  'pending fi signature': 'Under our review',
  'e-signature': 'Under our review',
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
  'under fi supervisor review': 'Under FI supervisor review',
  'under legal review': 'Under legal review',
  'under corridor review': 'Under Corridor review',
  'under channel review': 'Under Corridor review',
  'corridor reviewing': 'Under Corridor review',
  corridor_reviewing: 'Under Corridor review',
  pending: 'Pending',
  'pending our signature': 'Under our review',
  'pending corridor signature': 'Pending Corridor signature',
  'pending fi signature': 'Under our review',
  'pending channel signature': 'Pending Corridor signature',
  'in progress': 'In Progress',
  'in process': 'In Progress',
  ongoing: 'In Progress',
  'pending fi supervisor': 'Under FI supervisor review',
  'returned by fi supervisor': 'Under Corridor review',
  'approved by fi supervisor': 'Under legal review',
  'ready for legal': 'Under legal review',
  'not started': 'Not Started',
  'e-signature': 'Under our review',
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
  'Under FI supervisor review': { bg: '#FEF3C7', text: '#B45309' },
  'Under legal review': { bg: '#DBEAFE', text: '#1D4ED8' },
  'Under Corridor review': { bg: '#F3E8FF', text: '#7E22CE' },
  Pending: { bg: '#FEF3C7', text: '#B45309' },
  'Pending Corridor signature': { bg: '#FED7AA', text: '#C2410C' },
  'In Progress': { bg: '#FEF3C7', text: '#B45309' },
  'Pending FI Supervisor': { bg: '#FEF3C7', text: '#B45309' },
  'Returned by FI Supervisor': { bg: '#FFEDD5', text: '#C2410C' },
  'Approved by FI Supervisor': { bg: '#D1FAE5', text: '#047857' },
  'Ready for Legal': { bg: '#DBEAFE', text: '#1D4ED8' },
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
    : docType === 'OTHER_ATTACHMENTS'
      ? { historyKey: 'otherAttachments', statusFieldKey: 'otherAttachmentsStatus', progressKey: 'otherAttachments' }
      : { historyKey: 'nda', statusFieldKey: 'ndaStatus', progressKey: 'nda' }
);

const buildLegalHistoryId = (docType: LegalDocType, index = Date.now()) => (
  `${docType.toLowerCase()}-${index}-${Math.random().toString(36).slice(2, 8)}`
);

const getLegalPendingHandoff = (
  channel: any,
  docType: LegalDocType,
) => {
  const { historyKey } = resolveLegalFieldKeys(docType);
  return normalizePendingHandoff(channel?.legalPendingHandoffs?.[historyKey]);
};

const updateLegalHistoryEntryById = (
  entries: LegalStatusHistoryEntry[],
  entryId: string | undefined,
  updater: (entry: LegalStatusHistoryEntry) => LegalStatusHistoryEntry,
) => {
  if (!entryId) return entries;
  return entries.map((entry) => (entry.id === entryId ? updater(entry) : entry));
};

const getLatestVisibleLegalEvent = (
  channel: any,
  docType: LegalDocType,
) => getLegalStatusHistory(channel, docType).find((entry) => entry.lifecycle?.state !== 'revoked') || null;

const isTerminalLegalStatus = (status: LegalStatusValue) => (
  status === 'Completed' || status === 'No Need'
);

const normalizeAttachmentUrl = (value: unknown) => {
  const normalized = normalizeText((value as any)?.url || (value as any)?.downloadUrl);
  return /^https?:/i.test(normalized) ? normalized : '';
};

const normalizeAttachment = (value: any, index = 0): LegalAttachment => {
  const url = normalizeAttachmentUrl(value);

  return {
    uid: normalizeText(value?.uid) || `attachment-${Date.now()}-${index}`,
    name: normalizeText(value?.name) || 'Attachment',
    status: normalizeText(value?.status) || 'done',
    size: Number.isFinite(Number(value?.size)) ? Number(value.size) : 0,
    type: normalizeText(value?.type),
    storageId: normalizeText(value?.storageId),
    url,
    downloadUrl: url,
    urlSessionId: normalizeText(value?.urlSessionId),
  };
};

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

const createEmptyLegalRequestPacket = (): LegalRequestPacket => ({
  entities: [],
  documentLink: '',
  remarks: '',
  attachments: [],
  submittedAt: '',
  submittedBy: '',
});

const normalizeLegalRequestPacket = (
  value: unknown,
  fallback: Partial<LegalRequestPacket> = {},
): LegalRequestPacket => {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const entities = normalizeStringArray(candidate.entities);
  const fallbackEntities = normalizeStringArray(fallback.entities);
  const attachments = normalizeAttachmentList(candidate.attachments);
  const fallbackAttachments = normalizeAttachmentList(fallback.attachments);

  return {
    entities: entities.length ? entities : fallbackEntities,
    documentLink: normalizeText(candidate.documentLink) || normalizeText(fallback.documentLink),
    remarks: normalizeText(candidate.remarks) || normalizeText(fallback.remarks),
    attachments: attachments.length ? attachments : fallbackAttachments,
    submittedAt: normalizeText(candidate.submittedAt) || normalizeText(fallback.submittedAt),
    submittedBy: normalizeText(candidate.submittedBy) || normalizeText(fallback.submittedBy),
  };
};

const hasLegalRequestPacketContent = (packet: LegalRequestPacket) => Boolean(
  packet.entities.length
  || packet.documentLink
  || packet.remarks
  || packet.attachments.length
  || packet.submittedAt,
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

  if (status === 'Under our review') {
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

const buildRequestPacketFromHistoryEntry = (
  entry: any,
  actorName: string,
  note: string,
): LegalRequestPacket => (
  normalizeLegalRequestPacket(
    entry?.requestPacket,
    {
      entities: normalizeStringArray(entry?.entities),
      documentLink: normalizeText(entry?.documentLink),
      remarks: note,
      attachments: normalizeAttachmentList(entry?.attachments),
      submittedAt: normalizeText(entry?.time),
      submittedBy: actorName,
    },
  )
);

const resolveLatestActiveFiopPacketFromEntries = (
  entries: LegalStatusHistoryEntry[],
) => {
  const fiopEntries = entries.filter((entry) => entry.actorRole === 'FIOP');
  const latestActiveEntry = fiopEntries.find((entry) => entry.lifecycle?.state !== 'revoked');
  if (!latestActiveEntry) {
    return {
      packet: null as LegalRequestPacket | null,
      sawFiopHistory: fiopEntries.length > 0,
    };
  }

  const packet = normalizeLegalRequestPacket(
    latestActiveEntry.requestPacket,
    {
      documentLink: latestActiveEntry.documentLink,
      remarks: latestActiveEntry.note,
      attachments: latestActiveEntry.attachments,
      submittedAt: latestActiveEntry.time,
      submittedBy: latestActiveEntry.actorName,
    },
  );

  return {
    packet: hasLegalRequestPacketContent(packet) ? packet : null,
    sawFiopHistory: true,
  };
};

const resolveLatestActiveFiopPacketFromRawHistory = (
  channel: any,
  docType: LegalDocType,
) => {
  const { historyKey } = resolveLegalFieldKeys(docType);
  const rawEntries = Array.isArray(channel?.legalStatusHistory?.[historyKey])
    ? channel.legalStatusHistory[historyKey]
    : [];
  let sawFiopHistory = false;

  const candidates = rawEntries
    .reduce<Array<{ packet: LegalRequestPacket; time: number; index: number }>>((packets, entry, index) => {
      if (!entry || typeof entry !== 'object') return packets;
      const toStatus = normalizeLegalDocumentStatusLabel(docType, (entry as any).toStatus || (entry as any).status);
      if (toStatus === 'Not Started') return packets;

      const fallbackRole = resolveHistoryActorRoleByStatus(toStatus);
      const actorRole = normalizeLegalActorRole((entry as any).actorRole, fallbackRole);
      if (actorRole !== 'FIOP') return packets;

      sawFiopHistory = true;
      const lifecycle = (entry as any).lifecycle ? normalizeTimelineLifecycle((entry as any).lifecycle, 'handoff') : undefined;
      if (lifecycle?.state === 'revoked') return packets;

      const actorName = resolveFiopActorName(
        (entry as any).actorName,
        (entry as any).user,
        (entry as any).submittedBy,
        channel?.fiopOwner,
      );
      const note = normalizeText((entry as any).note || (entry as any).notes || (entry as any).remark);
      const packet = buildRequestPacketFromHistoryEntry(entry, actorName, note);
      if (!hasLegalRequestPacketContent(packet)) return packets;

      packets.push({
        packet,
        time: resolveTimestamp(packet.submittedAt || normalizeText((entry as any).time)),
        index,
      });
      return packets;
    }, [])
    .sort((left, right) => (right.time - left.time) || (left.index - right.index));

  return {
    packet: candidates[0]?.packet || null,
    sawFiopHistory,
  };
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

export const getLegalDocumentDisplayName = (docType: LegalDocType) => (
  LEGAL_DOCUMENT_DISPLAY_NAME_MAP[docType]
);

export const getLegalStatusOptions = (
  docType: LegalDocType,
  actorRole: LegalActorRole | 'all' = 'all',
) => (docType === 'NDA' ? getNdaStatusOptions(actorRole) : getMsaStatusOptions(actorRole));

export const getLegalQueueGroup = (docType: LegalDocType, value: unknown): LegalQueueGroup => {
  const normalized = normalizeLegalDocumentStatusLabel(docType, value);

  if (normalized === 'Completed') return 'completed';
  if (normalized === 'No Need') return docType === 'NDA' ? 'no_need' : 'completed';
  if (normalized === 'Under our review') return 'legal_pending';
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

  if (docType === 'OTHER_ATTACHMENTS') {
    return normalized.includes('attachment') || normalized.includes('attachments');
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
  const latestHistoryPacket = resolveLatestActiveFiopPacketFromRawHistory(channel, docType);

  if (latestHistoryPacket.packet) {
    return latestHistoryPacket.packet;
  }

  if (latestHistoryPacket.sawFiopHistory) {
    return createEmptyLegalRequestPacket();
  }

  return normalizeLegalRequestPacket(
    savedRequest,
    {
      remarks: normalizeText(savedHistory.notes),
      submittedAt: normalizeText(savedHistory.date),
      submittedBy: resolveFiopActorName(savedRequest.submittedBy, channel?.fiopOwner, savedHistory.user),
    },
  );
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
  const note = normalizeText(entry.note || entry.notes || entry.remark);
  const title = normalizeText(entry.title) || undefined;
  if (isLegacyRevocationCopy(title, note)) return null;
  const actorName = actorRole === 'Legal'
    ? resolveLegalActorName(entry.actorName, entry.user)
    : resolveFiopActorName(
      entry.actorName,
      entry.user,
      entry.submittedBy,
      requestPacket.submittedBy,
      channel?.fiopOwner,
    );
  const normalizedEntry: LegalStatusHistoryEntry = {
    id: normalizeText(entry.id) || buildLegalHistoryId(docType, index),
    time: normalizeText(entry.time),
    actorRole,
    actorName,
    fromStatus: normalizeText(entry.fromStatus)
      ? normalizeLegalDocumentStatusLabel(docType, entry.fromStatus)
      : null,
    toStatus,
    displayStatus: normalizeText(entry.displayStatus)
      ? normalizeLegalDocumentStatusLabel(docType, entry.displayStatus)
      : undefined,
    note,
    documentLink: normalizeText(entry.documentLink),
    attachments: normalizeAttachmentList(entry.attachments),
    requestPacket: actorRole === 'FIOP'
      ? buildRequestPacketFromHistoryEntry(entry, actorName, note)
      : null,
    title,
    lifecycle: entry.lifecycle ? normalizeTimelineLifecycle(entry.lifecycle, 'normal') : undefined,
    terminalDecision: normalizeTerminalDecisionMeta(entry.terminalDecision),
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
      requestPacket,
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
        requestPacket: actorRole === 'FIOP' ? requestPacket : null,
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
        requestPacket: actorRole === 'FIOP' ? requestPacket : null,
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
  return getLatestVisibleLegalEvent(channel, docType);
};

export const buildLegalSubmissionHistoryEntry = (
  channel: any,
  docType: LegalDocType,
  historyEntries: LegalStatusHistoryEntry[] = getLegalStatusHistory(channel, docType),
) => {
  const latestEntry = historyEntries.find((entry) => entry.lifecycle?.state !== 'revoked');
  const fallbackHistory = channel?.submissionHistory?.[resolveLegalFieldKeys(docType).historyKey] || {};
  const hasRecordedHistory = historyEntries.length > 0;

  if (latestEntry) {
    return {
      date: latestEntry.time || null,
      user: latestEntry.actorName || null,
      notes: latestEntry.note || null,
      proposalId: fallbackHistory.proposalId || null,
      proposalName: fallbackHistory.proposalName || null,
    };
  }

  if (hasRecordedHistory) {
    return {
      date: null,
      user: null,
      notes: null,
      proposalId: fallbackHistory.proposalId || null,
      proposalName: fallbackHistory.proposalName || null,
    };
  }

  return {
    date: normalizeText(fallbackHistory.date) || null,
    user: normalizeText(fallbackHistory.user) || null,
    notes: normalizeText(fallbackHistory.notes) || null,
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
  const documentLabel = getLegalDocumentDisplayName(docType);
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
  historyAttachments,
}: {
  channel: any;
  docType: LegalDocType;
  actorRole: LegalActorRole;
  actorName: string;
  nextStatus: NdaStatusValue | MsaStatusValue;
  note?: string;
  timestamp: string;
  packetUpdate?: Partial<LegalRequestPacket>;
  historyAttachments?: LegalAttachment[];
}) => {
  const { historyKey, statusFieldKey, progressKey } = resolveLegalFieldKeys(docType);
  const previousStatus = normalizeLegalDocumentStatusLabel(
    docType,
    channel?.[statusFieldKey] || channel?.globalProgress?.[progressKey],
  );
  const activePendingHandoff = isPendingHandoffActive(getLegalPendingHandoff(channel, docType))
    ? getLegalPendingHandoff(channel, docType)
    : null;
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
  const historyEntryAttachments = actorRole === 'Legal'
    ? normalizeAttachmentList(historyAttachments)
    : mergedPacket.attachments;
  const statusNote = normalizeText(note)
    || (actorRole === 'FIOP' ? mergedPacket.remarks : '');
  let existingHistory = getLegalStatusHistory(channel, docType);

  if (activePendingHandoff && activePendingHandoff.receiverRole === 'Legal' && actorRole === 'Legal') {
    existingHistory = updateLegalHistoryEntryById(
      existingHistory,
      activePendingHandoff.originEventId,
      (entry) => ({
        ...entry,
        lifecycle: markLifecycleConsumed(entry.lifecycle),
      }),
    );
  }

  const isLegalReviewerAction = actorRole === 'Legal';
  const isTerminalDecision = isLegalReviewerAction && isTerminalLegalStatus(normalizeLegalDocumentStatusLabel(docType, nextStatus));
  const lifecycle = actorRole === 'FIOP'
    ? createHandoffLifecycle()
    : isTerminalDecision
      ? createTerminalDecisionLifecycle()
      : createNormalLifecycle();
  let nextHistoryEntry: LegalStatusHistoryEntry = {
    id: buildLegalHistoryId(docType),
    time: timestamp,
    actorRole,
    actorName: normalizeText(actorName) || (actorRole === 'Legal' ? 'Legal Team' : 'Current User'),
    fromStatus: previousStatus === 'Not Started' ? null : previousStatus,
    toStatus: normalizeLegalDocumentStatusLabel(docType, nextStatus),
    note: statusNote,
    documentLink: actorRole === 'FIOP' ? mergedPacket.documentLink : '',
    attachments: historyEntryAttachments,
    requestPacket: actorRole === 'FIOP' ? mergedPacket : null,
    title: '',
    lifecycle,
    terminalDecision: null,
  };

  if (actorRole === 'FIOP') {
    nextHistoryEntry.title = `${getLegalDocumentDisplayName(docType)} package submitted`;
  } else if (nextHistoryEntry.toStatus === 'Completed') {
    nextHistoryEntry.title = `${getLegalDocumentDisplayName(docType)} archived`;
  } else if (nextHistoryEntry.toStatus === 'No Need') {
    nextHistoryEntry.title = `${getLegalDocumentDisplayName(docType)} marked as No Need`;
  } else {
    nextHistoryEntry.title = `Status updated to ${nextHistoryEntry.toStatus}`;
  }

  if (isLegalReviewerAction) {
    const terminalDecision = recordTerminalDecision({
      decisionEventId: nextHistoryEntry.id,
      revocableByActor: normalizeText(actorName) || 'Legal Team',
      previousStatus,
      previousQueueState: getLegalQueueGroup(docType, previousStatus),
    });
    nextHistoryEntry = {
      ...nextHistoryEntry,
      terminalDecision,
    };
    if (isTerminalDecision) {
      nextHistoryEntry = {
        ...nextHistoryEntry,
        lifecycle: createTerminalDecisionLifecycle(),
      };
    }
  }

  const nextHistory = dedupeLegalHistory([nextHistoryEntry, ...existingHistory])
    .sort((left, right) => resolveTimestamp(right.time) - resolveTimestamp(left.time));
  let nextPendingHandoff: PendingHandoff | null = null;

  if (actorRole === 'FIOP') {
    nextPendingHandoff = createPendingHandoff({
      flowType: 'legal',
      flowKey: docType,
      senderRole: 'FIOP',
      senderName: nextHistoryEntry.actorName,
      receiverRole: 'Legal',
      createdAt: timestamp,
      sourceStatus: previousStatus,
      targetStatus: nextHistoryEntry.toStatus,
      originEventId: nextHistoryEntry.id,
      payloadSnapshot: mergedPacket,
    });
  }

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
    legalPendingHandoffs: {
      ...(channel?.legalPendingHandoffs || {}),
      [historyKey]: nextPendingHandoff,
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

export const getLegalRevocableAction = (
  channel: any,
  docType: LegalDocType,
  actorRole: WorkflowRole | null | undefined,
  actorName: string,
): RevocableAction | null => {
  const latestVisibleEvent = getLatestVisibleLegalEvent(channel, docType);
  if (!latestVisibleEvent) return null;

  return getRevocableAction({
    pendingHandoff: getLegalPendingHandoff(channel, docType),
    terminalDecision: latestVisibleEvent.terminalDecision,
    actorRole,
    actorName,
    eventId: latestVisibleEvent.id,
    isLatestEvent: true,
  });
};

export const revokeLegalPendingHandoff = (
  channel: any,
  docType: LegalDocType,
  actorRole: WorkflowRole,
  _actorName: string,
  timestamp: string,
  _reason = '',
) => {
  const { historyKey, statusFieldKey, progressKey } = resolveLegalFieldKeys(docType);
  const activePendingHandoff = isPendingHandoffActive(getLegalPendingHandoff(channel, docType))
    ? getLegalPendingHandoff(channel, docType)
    : null;
  if (!activePendingHandoff || activePendingHandoff.senderRole !== actorRole) {
    return channel;
  }

  const restoredStatus = normalizeLegalDocumentStatusLabel(docType, activePendingHandoff.sourceStatus);
  const existingHistory = getLegalStatusHistory(channel, docType);
  const nextHistory = dedupeLegalHistory(
    updateLegalHistoryEntryById(
      existingHistory,
      activePendingHandoff.originEventId,
      (entry) => ({
        ...entry,
        displayStatus: restoredStatus,
        lifecycle: markLifecycleRevoked(entry.lifecycle),
      }),
    ),
  ).sort((left, right) => resolveTimestamp(right.time) - resolveTimestamp(left.time));
  const restoredPacketResult = resolveLatestActiveFiopPacketFromEntries(nextHistory);
  const restoredPacket = restoredPacketResult.packet || createEmptyLegalRequestPacket();

  return {
    ...channel,
    [statusFieldKey]: restoredStatus,
    globalProgress: {
      ...(channel?.globalProgress || {}),
      [progressKey]: restoredStatus,
    },
    legalStatusHistory: {
      ...(channel?.legalStatusHistory || {}),
      [historyKey]: nextHistory,
    },
    legalRequestData: {
      ...(channel?.legalRequestData || {}),
      [historyKey]: restoredPacket,
    },
    legalPendingHandoffs: {
      ...(channel?.legalPendingHandoffs || {}),
      [historyKey]: null,
    },
    submissionHistory: {
      ...(channel?.submissionHistory || {}),
      [historyKey]: {
        date: restoredPacket.submittedAt || null,
        user: restoredPacket.submittedBy || null,
        notes: restoredPacket.remarks || null,
      },
    },
    lastModifiedAt: timestamp,
  };
};

export const revokeLegalTerminalDecision = (
  channel: any,
  docType: LegalDocType,
  actorName: string,
  timestamp: string,
  reason = '',
) => {
  const { historyKey, statusFieldKey, progressKey } = resolveLegalFieldKeys(docType);
  const existingHistory = getLegalStatusHistory(channel, docType);
  const latestVisibleEvent = existingHistory.find((entry) => entry.lifecycle?.state !== 'revoked') || null;
  const terminalDecision = latestVisibleEvent?.terminalDecision || null;
  if (
    !latestVisibleEvent
    || !terminalDecision
    || !terminalDecision.revocable
    || terminalDecision.revocableByActor !== normalizeText(actorName)
  ) {
    return channel;
  }

  const restoredStatus = normalizeLegalDocumentStatusLabel(docType, terminalDecision.previousStatus);
  const revokedDecision = revokeTerminalDecision(
    terminalDecision,
    actorName,
    reason || `Restored ${restoredStatus} after legal status revoke.`,
    timestamp,
  );
  const nextHistory = dedupeLegalHistory(
    updateLegalHistoryEntryById(
      existingHistory,
      latestVisibleEvent.id,
      (entry) => ({
        ...entry,
        displayStatus: restoredStatus,
        lifecycle: markLifecycleRevoked(entry.lifecycle),
        terminalDecision: revokedDecision,
      }),
    ),
  ).sort((left, right) => resolveTimestamp(right.time) - resolveTimestamp(left.time));

  return {
    ...channel,
    [statusFieldKey]: restoredStatus,
    globalProgress: {
      ...(channel?.globalProgress || {}),
      [progressKey]: restoredStatus,
    },
    legalStatusHistory: {
      ...(channel?.legalStatusHistory || {}),
      [historyKey]: nextHistory,
    },
    legalPendingHandoffs: {
      ...(channel?.legalPendingHandoffs || {}),
      [historyKey]: null,
    },
    lastModifiedAt: timestamp,
  };
};
