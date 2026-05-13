export type WorkflowRole = 'FIOP' | 'Compliance' | 'Legal' | 'FI Supervisor';

export type HandoffState = 'pending' | 'consumed' | 'revoked';
export type TimelineLifecycleKind = 'normal' | 'handoff' | 'terminal_decision';
export type TimelineLifecycleState = 'active' | 'consumed' | 'revoked';
export type TimelineRevokeAction = 'handoff_revoke' | 'terminal_revoke' | null;

export interface TimelineLifecycle {
  kind: TimelineLifecycleKind;
  state: TimelineLifecycleState;
  revocable: boolean;
  revokeAction: TimelineRevokeAction;
}

export interface PendingHandoff {
  id: string;
  flowType: 'onboarding' | 'legal' | 'pricing';
  flowKey: string;
  senderRole: WorkflowRole;
  senderName: string;
  receiverRole: WorkflowRole;
  createdAt: string;
  consumedAt?: string;
  consumedBy?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokedReason?: string;
  sourceStatus?: string | null;
  targetStatus?: string | null;
  originEventId?: string;
  payloadSnapshot?: any;
  state: HandoffState;
}

export interface TerminalDecisionMeta {
  decisionEventId: string;
  revocable: boolean;
  revocableByActor: string;
  previousStatus: string;
  previousQueueState?: string | null;
  revokedAt?: string;
  revokedBy?: string;
  revokedReason?: string;
}

export interface RevocableAction {
  type: 'handoff_revoke' | 'terminal_revoke';
  eventId: string;
  label: string;
}

const normalizeText = (value: unknown) => String(value ?? '').trim();
const legacyRevocationCopyMarkers = [
  'revoked handoff',
  'before receiver action',
  'before legal acted',
  'before compliance acted',
  'mistaken terminal decision',
];

const buildId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const isLegacyRevocationCopy = (...values: unknown[]) => values.some((value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized || !normalized.includes('revoked')) return false;
  return legacyRevocationCopyMarkers.some((marker) => normalized.includes(marker));
});

export const createNormalLifecycle = (): TimelineLifecycle => ({
  kind: 'normal',
  state: 'active',
  revocable: false,
  revokeAction: null,
});

export const createHandoffLifecycle = (): TimelineLifecycle => ({
  kind: 'handoff',
  state: 'active',
  revocable: true,
  revokeAction: 'handoff_revoke',
});

export const createTerminalDecisionLifecycle = (): TimelineLifecycle => ({
  kind: 'terminal_decision',
  state: 'active',
  revocable: true,
  revokeAction: 'terminal_revoke',
});

export const normalizeTimelineLifecycle = (
  value: unknown,
  fallbackKind: TimelineLifecycleKind = 'normal',
): TimelineLifecycle => {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const fallback = fallbackKind === 'handoff'
    ? createHandoffLifecycle()
    : fallbackKind === 'terminal_decision'
      ? createTerminalDecisionLifecycle()
      : createNormalLifecycle();

  const kind = candidate.kind === 'handoff' || candidate.kind === 'terminal_decision' || candidate.kind === 'normal'
    ? candidate.kind
    : fallback.kind;
  const state = candidate.state === 'consumed' || candidate.state === 'revoked' || candidate.state === 'active'
    ? candidate.state
    : fallback.state;

  return {
    kind,
    state,
    revocable: candidate.revocable === undefined ? fallback.revocable : Boolean(candidate.revocable),
    revokeAction: candidate.revokeAction === 'handoff_revoke' || candidate.revokeAction === 'terminal_revoke'
      ? candidate.revokeAction
      : null,
  };
};

export const normalizePendingHandoff = (value: unknown): PendingHandoff | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const senderRole = normalizeText(candidate.senderRole) as WorkflowRole;
  const receiverRole = normalizeText(candidate.receiverRole) as WorkflowRole;
  if (!senderRole || !receiverRole) return null;

  return {
    id: normalizeText(candidate.id) || buildId('handoff'),
    flowType: candidate.flowType === 'legal' || candidate.flowType === 'pricing' ? candidate.flowType : 'onboarding',
    flowKey: normalizeText(candidate.flowKey),
    senderRole,
    senderName: normalizeText(candidate.senderName),
    receiverRole,
    createdAt: normalizeText(candidate.createdAt),
    consumedAt: normalizeText(candidate.consumedAt) || undefined,
    consumedBy: normalizeText(candidate.consumedBy) || undefined,
    revokedAt: normalizeText(candidate.revokedAt) || undefined,
    revokedBy: normalizeText(candidate.revokedBy) || undefined,
    revokedReason: normalizeText(candidate.revokedReason) || undefined,
    sourceStatus: candidate.sourceStatus === undefined || candidate.sourceStatus === null ? null : normalizeText(candidate.sourceStatus),
    targetStatus: candidate.targetStatus === undefined || candidate.targetStatus === null ? null : normalizeText(candidate.targetStatus),
    originEventId: normalizeText(candidate.originEventId) || undefined,
    payloadSnapshot: candidate.payloadSnapshot,
    state: candidate.state === 'consumed' || candidate.state === 'revoked' ? candidate.state : 'pending',
  };
};

export const normalizeTerminalDecisionMeta = (value: unknown): TerminalDecisionMeta | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const decisionEventId = normalizeText(candidate.decisionEventId);
  const previousStatus = normalizeText(candidate.previousStatus);
  const revocableByActor = normalizeText(candidate.revocableByActor);
  if (!decisionEventId || !previousStatus || !revocableByActor) return null;

  return {
    decisionEventId,
    revocable: candidate.revocable === undefined ? true : Boolean(candidate.revocable),
    revocableByActor,
    previousStatus,
    previousQueueState: candidate.previousQueueState === undefined || candidate.previousQueueState === null
      ? null
      : normalizeText(candidate.previousQueueState),
    revokedAt: normalizeText(candidate.revokedAt) || undefined,
    revokedBy: normalizeText(candidate.revokedBy) || undefined,
    revokedReason: normalizeText(candidate.revokedReason) || undefined,
  };
};

export const createPendingHandoff = ({
  flowType,
  flowKey,
  senderRole,
  senderName,
  receiverRole,
  createdAt,
  sourceStatus,
  targetStatus,
  originEventId,
  payloadSnapshot,
}: Omit<PendingHandoff, 'id' | 'state'>): PendingHandoff => ({
  id: buildId('handoff'),
  flowType,
  flowKey,
  senderRole,
  senderName: normalizeText(senderName),
  receiverRole,
  createdAt: normalizeText(createdAt),
  consumedAt: undefined,
  consumedBy: undefined,
  revokedAt: undefined,
  revokedBy: undefined,
  revokedReason: undefined,
  sourceStatus: sourceStatus ?? null,
  targetStatus: targetStatus ?? null,
  originEventId: normalizeText(originEventId) || undefined,
  payloadSnapshot,
  state: 'pending',
});

export const consumePendingHandoff = (
  handoff: PendingHandoff,
  actorName: string,
  timestamp: string,
): PendingHandoff => ({
  ...handoff,
  state: 'consumed',
  consumedAt: normalizeText(timestamp),
  consumedBy: normalizeText(actorName),
});

export const revokePendingHandoff = (
  handoff: PendingHandoff,
  actorName: string,
  reason: string,
  timestamp: string,
): PendingHandoff => ({
  ...handoff,
  state: 'revoked',
  revokedAt: normalizeText(timestamp),
  revokedBy: normalizeText(actorName),
  revokedReason: normalizeText(reason),
});

export const recordTerminalDecision = ({
  decisionEventId,
  revocableByActor,
  previousStatus,
  previousQueueState,
}: Omit<TerminalDecisionMeta, 'revocable'>): TerminalDecisionMeta => ({
  decisionEventId,
  revocable: true,
  revocableByActor: normalizeText(revocableByActor),
  previousStatus: normalizeText(previousStatus),
  previousQueueState: previousQueueState ?? null,
  revokedAt: undefined,
  revokedBy: undefined,
  revokedReason: undefined,
});

export const revokeTerminalDecision = (
  decision: TerminalDecisionMeta,
  actorName: string,
  reason: string,
  timestamp: string,
): TerminalDecisionMeta => ({
  ...decision,
  revocable: false,
  revokedAt: normalizeText(timestamp),
  revokedBy: normalizeText(actorName),
  revokedReason: normalizeText(reason),
});

export const markLifecycleConsumed = (value?: TimelineLifecycle | null): TimelineLifecycle => ({
  ...normalizeTimelineLifecycle(value, 'handoff'),
  state: 'consumed',
  revocable: false,
  revokeAction: null,
});

export const markLifecycleRevoked = (value?: TimelineLifecycle | null): TimelineLifecycle => ({
  ...normalizeTimelineLifecycle(value, value?.kind || 'normal'),
  state: 'revoked',
  revocable: false,
  revokeAction: null,
});

export const isPendingHandoffActive = (handoff?: PendingHandoff | null) => Boolean(handoff && handoff.state === 'pending');

export const isLifecycleRevoked = (lifecycle?: TimelineLifecycle | null) => lifecycle?.state === 'revoked';

export const canRevokePendingHandoff = (
  handoff: PendingHandoff | null | undefined,
  actorRole: WorkflowRole | null | undefined,
  isLatestEvent = true,
) => Boolean(handoff && handoff.state === 'pending' && actorRole && handoff.senderRole === actorRole && isLatestEvent);

export const canRevokeTerminalDecision = (
  decision: TerminalDecisionMeta | null | undefined,
  actorName: string,
  isLatestEvent = true,
) => Boolean(
  decision
  && decision.revocable
  && !decision.revokedAt
  && normalizeText(actorName)
  && decision.revocableByActor === normalizeText(actorName)
  && isLatestEvent,
);

export const getRevocableAction = ({
  pendingHandoff,
  terminalDecision,
  actorRole,
  actorName,
  eventId,
  isLatestEvent = true,
}: {
  pendingHandoff?: PendingHandoff | null;
  terminalDecision?: TerminalDecisionMeta | null;
  actorRole?: WorkflowRole | null;
  actorName?: string;
  eventId?: string;
  isLatestEvent?: boolean;
}): RevocableAction | null => {
  if (
    eventId
    && terminalDecision?.decisionEventId === eventId
    && canRevokeTerminalDecision(terminalDecision, normalizeText(actorName), isLatestEvent)
  ) {
    return {
      type: 'terminal_revoke',
      eventId,
      label: 'Revoke',
    };
  }

  if (
    eventId
    && pendingHandoff?.originEventId === eventId
    && canRevokePendingHandoff(pendingHandoff, actorRole, isLatestEvent)
  ) {
    return {
      type: 'handoff_revoke',
      eventId,
      label: 'Revoke send',
    };
  }

  return null;
};

export const getWorkflowRoleFromStoreRole = (role: string): WorkflowRole | null => {
  const normalized = normalizeText(role);
  if (normalized === 'FI') return 'FIOP';
  if (normalized === 'Compliance') return 'Compliance';
  if (normalized === 'Legal') return 'Legal';
  if (normalized === 'FI Supervisor') return 'FI Supervisor';
  return null;
};
