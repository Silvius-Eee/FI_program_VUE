
import {
  buildOnboardingHistoryEntry,
  getAggregatedOnboardingStatusKey,
  getChannelOnboardingWorkflow,
  getKycOverviewAggregate,
  getOnboardingStatusLabel,
} from './onboarding';
import {
  buildLegalSubmissionHistoryEntry,
  getLegalRequestPacket,
  getLegalStatusHistory,
  normalizeNdaStatusLabel,
  normalizeMsaStatusLabel,
  normalizeWorkflowStatusLabel,
} from '../utils/workflowStatus';
import {
  createHandoffLifecycle,
  createPendingHandoff,
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
  type RevocableAction,
  type TerminalDecisionMeta,
  type TimelineLifecycle,
  type WorkflowRole,
} from '../utils/workflowLifecycle';

// --- 基础配置 ---
export const APP_HEADER_HEIGHT = 64;
export const DEFAULT_DETAIL_TOOLBAR_HEIGHT = 76;
export const DASHBOARD_VIEW_STATE_STORAGE_KEY = 'fi-dashboard-original-view';

export type DashboardViewMode = 'corridor' | 'matrix';

export type DashboardFieldKind = 'system' | 'custom';

export interface DashboardViewFilterCondition {
  id: string;
  fieldKey?: string;
  operator: string;
  value?: string;
}

export interface SavedDashboardView {
  id: string;
  mode: DashboardViewMode;
  name: string;
  description: string;
  columns: string[];
  filters: DashboardViewFilterCondition[];
  isPreset: boolean;
}

export interface DashboardFieldDefinition {
  key: string;
  mode: DashboardViewMode;
  label: string;
  kind: DashboardFieldKind;
  sourceKey?: string;
  groupId?: string;
  order: number;
  filterable: boolean;
}

export interface DashboardFieldGroup {
  id: string;
  mode: DashboardViewMode;
  name: string;
  order: number;
}

export interface DashboardFieldSchema {
  fields: DashboardFieldDefinition[];
  groups: DashboardFieldGroup[];
}
export type AppUserRole =
  | 'FI_SUPERVISOR'
  | 'FIOP'
  | 'FIBD'
  | 'COMPLIANCE'
  | 'LEGAL'
  | 'TECH'
  | 'FUND';

export interface AppUser {
  id: string;
  name: string;
  role: AppUserRole;
  active: boolean;
}

export type FundApprovalStatus = 'not_started' | 'pending' | 'changes_requested' | 'approved';

export interface FundApprovalHistoryEntry {
  id: string;
  type: 'submit' | 'revoke' | 'approve' | 'request_changes' | 'reopened';
  status: FundApprovalStatus;
  user: string;
  time: string;
  note: string;
  lifecycle?: TimelineLifecycle;
  terminalDecision?: TerminalDecisionMeta | null;
  originEventId?: string;
  previousStatus?: FundApprovalStatus;
}

export interface FundApproval {
  status: FundApprovalStatus;
  note: string;
  lastActionAt: string;
  lastActionBy: string;
  submittedAt: string;
  submittedBy: string;
  submitNote: string;
  history: FundApprovalHistoryEntry[];
}

export type LaunchApprovalStatus =
  | 'not_submitted'
  | 'under_fund_review'
  | 'fund_returned'
  | 'under_fi_supervisor_review'
  | 'supervisor_returned'
  | 'live';

export type LaunchApprovalHistoryType =
  | 'submit'
  | 'fund_approve'
  | 'fund_return'
  | 'supervisor_approve'
  | 'supervisor_return'
  | 'reopened';

export type LaunchApprovalQueueTab = 'pending' | 'returned' | 'live';

export interface LaunchPrerequisiteItem {
  key: string;
  label: string;
  status: string;
  ready: boolean;
}

export interface LaunchPrerequisiteSnapshot {
  legalStatus?: string;
  legalItems: LaunchPrerequisiteItem[];
  wooshpayKycStatus: string;
  corridorKycStatus: string;
  legalReady: boolean;
  kycReady: boolean;
  fundStatus?: FundApprovalStatus;
  fundReady?: boolean;
  ready: boolean;
  missingItems: string[];
}

export interface LaunchApprovalHistoryEntry {
  id: string;
  type: LaunchApprovalHistoryType;
  status: LaunchApprovalStatus;
  actor: string;
  actorRole: string;
  time: string;
  note: string;
}

export interface LaunchApproval {
  status: LaunchApprovalStatus;
  submittedBy: string;
  submittedAt: string;
  fundDecisionBy: string;
  fundDecisionAt: string;
  fundNote: string;
  supervisorDecisionBy: string;
  supervisorDecisionAt: string;
  supervisorNote: string;
  prerequisiteSnapshot: LaunchPrerequisiteSnapshot;
  history: LaunchApprovalHistoryEntry[];
}

export interface LaunchApprovalQueueRow {
  id: string;
  channel: any;
  corridorName: string;
  cooperationMode: string;
  fiOwner: string;
  submittedAt: string;
  status: LaunchApprovalStatus;
  queueTab: LaunchApprovalQueueTab;
  latestActionAt: string;
  latestActionUser: string;
  latestActionNote: string;
  fundDecisionAt: string;
  fundDecisionBy: string;
  prerequisiteSnapshot: LaunchPrerequisiteSnapshot;
  blocked: boolean;
}

export interface ChannelAssignment {
  primaryFiopUserId: string | null;
  primaryFibdUserId: string | null;
  fiopCollaboratorUserIds: string[];
  fibdCollaboratorUserIds: string[];
  updatedAt: string;
  updatedByUserId: string | null;
}

export const APP_USERS: AppUser[] = [
  { id: 'user-fi-supervisor-ivy', name: 'Ivy', role: 'FI_SUPERVISOR', active: true },
  { id: 'user-fiop-alice', name: 'Alice', role: 'FIOP', active: true },
  { id: 'user-fiop-bob', name: 'Bob', role: 'FIOP', active: true },
  { id: 'user-fiop-charlie', name: 'Charlie', role: 'FIOP', active: true },
  { id: 'user-fiop-diana', name: 'Diana', role: 'FIOP', active: true },
  { id: 'user-fibd-emma', name: 'Emma', role: 'FIBD', active: true },
  { id: 'user-fibd-frank', name: 'Frank', role: 'FIBD', active: true },
  { id: 'user-fibd-grace', name: 'Grace', role: 'FIBD', active: true },
  { id: 'user-fibd-henry', name: 'Henry', role: 'FIBD', active: true },
  { id: 'user-fibd-isla', name: 'Isla', role: 'FIBD', active: true },
  { id: 'user-fibd-jack', name: 'Jack', role: 'FIBD', active: true },
  { id: 'user-compliance-luna', name: 'Luna', role: 'COMPLIANCE', active: true },
  { id: 'user-legal-noah', name: 'Noah', role: 'LEGAL', active: true },
  { id: 'user-tech-mason', name: 'Mason', role: 'TECH', active: true },
  { id: 'user-fund-olivia', name: 'Olivia', role: 'FUND', active: true },
];

export const DEFAULT_CURRENT_USER_ID = 'user-fiop-alice';

const APP_USER_MAP = new Map(APP_USERS.map((user) => [user.id, user]));
const APP_USER_NAME_MAP = new Map(APP_USERS.map((user) => [user.name.trim().toLowerCase(), user]));
const DEFAULT_FIBD_USER_IDS = APP_USERS.filter((user) => user.role === 'FIBD').map((user) => user.id);

export const getAppUserById = (userId?: string | null) => {
  if (!userId) return null;
  return APP_USER_MAP.get(String(userId).trim()) || null;
};

export const getAppUserByName = (name?: string | null) => {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) return null;
  return APP_USER_NAME_MAP.get(normalizedName) || null;
};

export const getAppUserDisplayName = (userId?: string | null, fallback = 'Unassigned') => (
  getAppUserById(userId)?.name || fallback
);

const dedupeUserIds = (values: Array<string | null | undefined>) => (
  [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
);

const hasOwnAssignmentField = (assignment: Partial<ChannelAssignment>, key: keyof ChannelAssignment) => (
  Object.prototype.hasOwnProperty.call(assignment, key)
);

const createDefaultChannelAssignment = (channel: any = {}): ChannelAssignment => {
  const fallbackFibdIndex = DEFAULT_FIBD_USER_IDS.length
    ? Math.max((Number(channel.id) || 1) - 1, 0) % DEFAULT_FIBD_USER_IDS.length
    : 0;
  const legacyFiopUserId = getAppUserById(channel.primaryFiopUserId)?.id
    || getAppUserByName(channel.fiopOwner)?.id
    || null;
  const legacyFibdUserId = getAppUserById(channel.primaryFibdUserId)?.id
    || getAppUserByName(channel.fibdOwner)?.id
    || DEFAULT_FIBD_USER_IDS[fallbackFibdIndex]
    || null;

  return {
    primaryFiopUserId: legacyFiopUserId,
    primaryFibdUserId: legacyFibdUserId,
    fiopCollaboratorUserIds: dedupeUserIds([legacyFiopUserId]),
    fibdCollaboratorUserIds: dedupeUserIds([legacyFibdUserId]),
    updatedAt: String(channel.lastModifiedAt || channel.createdAt || '2026-04-17 09:00:00').trim(),
    updatedByUserId: null,
  };
};

export const normalizeChannelAssignment = (channel: any = {}): ChannelAssignment => {
  const fallback = createDefaultChannelAssignment(channel);
  const candidate = channel.assignment && typeof channel.assignment === 'object'
    ? channel.assignment as Partial<ChannelAssignment>
    : {};

  const primaryFiopUserId = hasOwnAssignmentField(candidate, 'primaryFiopUserId')
    ? (candidate.primaryFiopUserId == null ? null : getAppUserById(candidate.primaryFiopUserId)?.id || null)
    : (
      getAppUserById(channel.primaryFiopUserId)?.id
      || getAppUserByName(channel.fiopOwner)?.id
      || fallback.primaryFiopUserId
    );
  const primaryFibdUserId = hasOwnAssignmentField(candidate, 'primaryFibdUserId')
    ? (candidate.primaryFibdUserId == null ? null : getAppUserById(candidate.primaryFibdUserId)?.id || null)
    : (
      getAppUserById(channel.primaryFibdUserId)?.id
      || getAppUserByName(channel.fibdOwner)?.id
      || fallback.primaryFibdUserId
    );
  const fiopCollaboratorUserIds = dedupeUserIds([
    ...(Array.isArray(candidate.fiopCollaboratorUserIds) ? candidate.fiopCollaboratorUserIds : []),
    primaryFiopUserId,
  ]).filter((userId) => getAppUserById(userId)?.role === 'FIOP');
  const fibdCollaboratorUserIds = dedupeUserIds([
    ...(Array.isArray(candidate.fibdCollaboratorUserIds) ? candidate.fibdCollaboratorUserIds : []),
    primaryFibdUserId,
  ]).filter((userId) => getAppUserById(userId)?.role === 'FIBD');

  return {
    primaryFiopUserId,
    primaryFibdUserId,
    fiopCollaboratorUserIds,
    fibdCollaboratorUserIds,
    updatedAt: String(candidate.updatedAt || fallback.updatedAt).trim() || fallback.updatedAt,
    updatedByUserId: getAppUserById(candidate.updatedByUserId)?.id || null,
  };
};

export const getChannelAssignmentUserIds = (channel: any = {}) => {
  const assignment = normalizeChannelAssignment(channel);
  return dedupeUserIds([
    assignment.primaryFiopUserId,
    assignment.primaryFibdUserId,
    ...assignment.fiopCollaboratorUserIds,
    ...assignment.fibdCollaboratorUserIds,
  ]);
};

// --- 常量定义 ---
export const GLOBAL_REGION_VALUE = 'Global';
export const DEFAULT_CORRIDOR_COLUMNS = [
  'channelName',
  'status',
  'wooshpayOnboardingStatus',
  'corridorOnboardingStatus',
  'ndaStatus',
  'contractStatus',
  'pricingProposalStatus',
  'techStatus',
  'fiopOwner',
  'fibdOwner',
  'fiopTrackingLatest',
  'cooperationModel',
  'merchantGeo',
  'supportedProducts',
  'createdAt',
  'lastModifiedAt',
];
export const DEFAULT_MATRIX_COLUMNS = ['corridorName', 'quotationName', 'paymentMethodName', 'consumerRegion', 'fee', 'floorPrice', 'capPrice', 'settlementCycle', 'settlementCurrency', 'fxCostReference', 'settlementThreshold', 'minimumTransactionAmount', 'maximumTransactionAmount', 'refundCapability', 'refundMethod', 'autoDebitCapability'];
const DASHBOARD_FILTERABLE_FIELD_KEYS = new Set([
  'supportedProducts',
  'cooperationModel',
  'fiopOwner',
  'fibdOwner',
  'status',
  'merchantGeo',
  'settlementCurrency',
  'paymentMethodName',
  'paymentMethods',
  'wooshpayOnboardingStatus',
  'corridorOnboardingStatus',
  'ndaStatus',
  'contractStatus',
  'pricingProposalStatus',
  'techStatus',
]);

export const DASHBOARD_FIELD_KEY_MIGRATION_MAP: Record<string, string> = {};

export const DEFAULT_CORRIDOR_FIELD_DEFINITIONS: DashboardFieldDefinition[] = [
  { key: 'channelName', mode: 'corridor', label: 'Corridor Name', kind: 'system', sourceKey: 'channelName', order: 0, filterable: false },
  { key: 'status', mode: 'corridor', label: 'Status', kind: 'system', sourceKey: 'status', order: 1, filterable: true },
  { key: 'wooshpayOnboardingStatus', mode: 'corridor', label: 'WooshPay onboarding', kind: 'system', sourceKey: 'wooshpayOnboardingStatus', order: 2, filterable: true },
  { key: 'corridorOnboardingStatus', mode: 'corridor', label: 'Corridor onboarding', kind: 'system', sourceKey: 'corridorOnboardingStatus', order: 3, filterable: true },
  { key: 'ndaStatus', mode: 'corridor', label: 'NDA', kind: 'system', sourceKey: 'ndaStatus', order: 4, filterable: true },
  { key: 'contractStatus', mode: 'corridor', label: 'Contract', kind: 'system', sourceKey: 'contractStatus', order: 5, filterable: true },
  { key: 'pricingProposalStatus', mode: 'corridor', label: 'Pricing', kind: 'system', sourceKey: 'pricingProposalStatus', order: 6, filterable: true },
  { key: 'techStatus', mode: 'corridor', label: 'Tech', kind: 'system', sourceKey: 'techStatus', order: 7, filterable: true },
  { key: 'fiopOwner', mode: 'corridor', label: 'FIOP', kind: 'system', sourceKey: 'fiopOwner', order: 8, filterable: true },
  { key: 'fibdOwner', mode: 'corridor', label: 'FIBD', kind: 'system', sourceKey: 'fibdOwner', order: 9, filterable: true },
  { key: 'fiopTrackingLatest', mode: 'corridor', label: 'FIOP Tracking', kind: 'system', sourceKey: 'fiopTrackingLatest', order: 10, filterable: false },
  { key: 'cooperationModel', mode: 'corridor', label: 'Cooperation Model', kind: 'system', sourceKey: 'cooperationModel', order: 11, filterable: true },
  { key: 'merchantGeo', mode: 'corridor', label: 'Supported Merchant Jurisdictions', kind: 'system', sourceKey: 'merchantGeo', order: 12, filterable: true },
  { key: 'supportedProducts', mode: 'corridor', label: 'Supported Products', kind: 'system', sourceKey: 'supportedProducts', order: 13, filterable: true },
  { key: 'createdAt', mode: 'corridor', label: 'Creation Time', kind: 'system', sourceKey: 'createdAt', order: 14, filterable: false },
  { key: 'lastModifiedAt', mode: 'corridor', label: 'Last Update Time', kind: 'system', sourceKey: 'lastModifiedAt', order: 15, filterable: false },
];

const toStartCase = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
const matrixFieldSourceKeyMap: Record<string, string> = {
  corridorName: 'channelName',
};

export const DEFAULT_MATRIX_FIELD_DEFINITIONS: DashboardFieldDefinition[] = DEFAULT_MATRIX_COLUMNS.map((key, index) => ({
  key,
  mode: 'matrix',
  label: key === 'corridorName' ? 'Corridor Name' : toStartCase(key),
  kind: 'system',
  sourceKey: matrixFieldSourceKeyMap[key] || key,
  order: index,
  filterable: DASHBOARD_FILTERABLE_FIELD_KEYS.has(key),
}));
export const PRICING_RULE_CARD_SYSTEM_IDS = {
  icpp: 'icpp',
  card: 'card',
  localCard: 'local-card',
  internationalCard: 'international-card',
} as const;
export const PRICING_RULE_CARD_SYSTEM_CATALOG = [
  { id: PRICING_RULE_CARD_SYSTEM_IDS.icpp, name: 'IC++', system: true },
  { id: PRICING_RULE_CARD_SYSTEM_IDS.card, name: 'Card', system: true },
  { id: PRICING_RULE_CARD_SYSTEM_IDS.localCard, name: 'Local Card', system: true },
  { id: PRICING_RULE_CARD_SYSTEM_IDS.internationalCard, name: 'International Card', system: true },
];
export const FX_COST_REFERENCE_OPTIONS = ['XE', 'Bloomberg', 'Parallel Rate', 'Other'] as const;
export const FX_COST_MARKUP_REFERENCE_OPTIONS = ['XE', 'Bloomberg'] as const;
export const FX_COST_DETAIL_REFERENCE_OPTIONS = ['Parallel Rate', 'Other'] as const;
export const DEFAULT_SETTLEMENT_CYCLE_DAYS = 2;
export const DEFAULT_SETTLEMENT_CURRENCY = 'USD';
const CARD_BRAND_LABEL_MAP: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  maestro: 'Maestro',
  unionpay: 'UnionPay',
  jcb: 'JCB',
  discover: 'Discover',
};

const normalizeWhitespace = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizeCardBrandLabel = (value: string) => (
  CARD_BRAND_LABEL_MAP[value.trim().toLowerCase()] || value.trim()
);
const extractCardMethodBrand = (value?: string | null) => {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return null;

  const matchers = [
    /^card\s*\(\s*(.+?)\s*\)$/i,
    /^card\s*-\s*(.+)$/i,
  ];

  for (const matcher of matchers) {
    const matched = trimmed.match(matcher);
    if (matched?.[1]) {
      return normalizeCardBrandLabel(matched[1]);
    }
  }

  return /^card$/i.test(trimmed) ? 'Card' : null;
};

export const isCardPaymentMethodName = (value?: string | null) => extractCardMethodBrand(value) !== null;
export const normalizePaymentMethodName = (value?: string | null) => {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return '';

  const brand = extractCardMethodBrand(trimmed);
  if (brand === 'Card') return 'Card';
  if (brand) return `Card (${brand})`;

  return trimmed;
};

const normalizeStringList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
  }
  const normalized = String(value ?? '').trim();
  return normalized ? [normalized] : [];
};

export const normalizeFundApprovalStatus = (value: unknown): FundApprovalStatus => {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/-/g, '_');
  if (
    !normalized
    || normalized === 'not_started'
    || normalized === 'not started'
    || normalized === 'not_submitted'
    || normalized === 'not submitted'
    || normalized === 'reopened'
    || normalized === 'reopen'
    || normalized === 'revoke'
    || normalized === 'revoked'
  ) {
    return 'not_started';
  }
  if (normalized === 'approved' || normalized === 'approve') return 'approved';
  if (
    normalized === 'changes_requested'
    || normalized === 'changes requested'
    || normalized === 'request_changes'
    || normalized === 'request changes'
    || normalized === 'returned'
  ) {
    return 'changes_requested';
  }
  if (
    normalized === 'pending'
    || normalized === 'submit'
    || normalized === 'submitted'
    || normalized === 'under_fund_review'
    || normalized === 'under fund review'
  ) {
    return 'pending';
  }
  return 'pending';
};

const normalizeFundApprovalHistory = (value: unknown) => (
  Array.isArray(value)
    ? value.reduce<FundApprovalHistoryEntry[]>((entries, item, index) => {
        if (!item || typeof item !== 'object') return entries;
        const candidate = item as Record<string, unknown>;
        const time = normalizeWhitespace(candidate.time);
        const user = normalizeWhitespace(candidate.user);
        const type = String(candidate.type ?? '').trim().toLowerCase();
        const normalizedType = type === 'submit' || type === 'revoke' || type === 'approve' || type === 'request_changes' || type === 'reopened'
          ? type as FundApprovalHistoryEntry['type']
          : normalizeFundApprovalStatus(candidate.status) === 'approved'
            ? 'approve'
            : normalizeFundApprovalStatus(candidate.status) === 'changes_requested'
              ? 'request_changes'
              : 'reopened';
        if (!time && !user) return entries;
        entries.push({
          id: normalizeWhitespace(candidate.id) || `fund-history-${time || index}`,
          type: normalizedType,
          status: normalizeFundApprovalStatus(candidate.status || normalizedType),
          user: user || 'Unknown',
          time,
          note: normalizeWhitespace(candidate.note),
          lifecycle: candidate.lifecycle ? normalizeTimelineLifecycle(candidate.lifecycle, 'normal') : undefined,
          terminalDecision: normalizeTerminalDecisionMeta(candidate.terminalDecision),
          originEventId: normalizeWhitespace(candidate.originEventId),
          previousStatus: candidate.previousStatus === undefined ? undefined : normalizeFundApprovalStatus(candidate.previousStatus),
        });
        return entries;
      }, [])
    : []
);

const normalizeFundProfile = (value: any = {}) => {
  const profile = value && typeof value === 'object' ? value : {};
  const normalizeNullableBoolean = (input: unknown): boolean | null => {
    if (input === true || input === false) return input;
    const normalized = String(input ?? '').trim().toLowerCase();
    if (['true', 'yes', 'y', 'supported'].includes(normalized)) return true;
    if (['false', 'no', 'n', 'not supported'].includes(normalized)) return false;
    return null;
  };

  return {
    balanceSupported: normalizeNullableBoolean(profile.balanceSupported),
    balancePath: normalizeWhitespace(profile.balancePath),
    rechargeSupported: normalizeNullableBoolean(profile.rechargeSupported),
    rechargeInstruction: normalizeWhitespace(profile.rechargeInstruction),
    manualRefundPath: normalizeWhitespace(profile.manualRefundPath),
    transactionStatementPath: normalizeWhitespace(profile.transactionStatementPath),
    settlementStatementPath: normalizeWhitespace(profile.settlementStatementPath),
    statementGuideLink: normalizeWhitespace(profile.statementGuideLink),
    statementIncludesFee: normalizeNullableBoolean(profile.statementIncludesFee),
    transactionStatuses: normalizeStringList(profile.transactionStatuses),
    settlementCheckChannels: normalizeStringList(profile.settlementCheckChannels),
    settlementCheckNotes: normalizeWhitespace(profile.settlementCheckNotes),
    balanceCurrencies: normalizeStringList(profile.balanceCurrencies).map((item) => item.toUpperCase()),
    withdrawalCurrencies: normalizeStringList(profile.withdrawalCurrencies).map((item) => item.toUpperCase()),
    distributionCurrencies: normalizeStringList(profile.distributionCurrencies).map((item) => item.toUpperCase()),
    chargebackNotifyPath: normalizeWhitespace(profile.chargebackNotifyPath),
    chargebackFeedbackPath: normalizeWhitespace(profile.chargebackFeedbackPath),
    payoutPlaceholder: normalizeWhitespace(profile.payoutPlaceholder),
  };
};

const normalizeFundApproval = (value: any = {}): FundApproval => {
  const approval = value && typeof value === 'object' ? value : {};
  const history = normalizeFundApprovalHistory(approval.history);
  const normalizedStatus = normalizeFundApprovalStatus(approval.status);
  const hasActiveSubmitHistory = history.some((entry) => (
    entry.type === 'submit' && entry.lifecycle?.state !== 'revoked'
  ));
  const hasActiveSubmitFields = Boolean(
    normalizeWhitespace(approval.submittedAt)
    || normalizeWhitespace(approval.submittedBy)
  );
  return {
    status: normalizedStatus === 'pending' && !hasActiveSubmitFields && !hasActiveSubmitHistory
      ? 'not_started'
      : normalizedStatus,
    note: normalizeWhitespace(approval.note),
    lastActionAt: normalizeWhitespace(approval.lastActionAt),
    lastActionBy: normalizeWhitespace(approval.lastActionBy),
    submittedAt: normalizeWhitespace(approval.submittedAt),
    submittedBy: normalizeWhitespace(approval.submittedBy),
    submitNote: normalizeWhitespace(approval.submitNote),
    history,
  };
};

export const normalizeLaunchApprovalStatus = (value: unknown): LaunchApprovalStatus => {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (normalized === 'under_fund_review' || normalized === 'fund_review' || normalized === 'pending_fund') {
    return 'under_fund_review';
  }
  if (normalized === 'fund_returned' || normalized === 'returned_by_fund' || normalized === 'fund_changes_requested') {
    return 'fund_returned';
  }
  if (
    normalized === 'under_fi_supervisor_review'
    || normalized === 'under_supervisor_review'
    || normalized === 'fi_supervisor_review'
    || normalized === 'pending_supervisor'
  ) {
    return 'under_fi_supervisor_review';
  }
  if (
    normalized === 'supervisor_returned'
    || normalized === 'returned_by_supervisor'
    || normalized === 'fi_supervisor_returned'
  ) {
    return 'supervisor_returned';
  }
  if (normalized === 'live' || normalized === 'approved' || normalized === 'go_live') return 'live';
  return 'not_submitted';
};

export const getLaunchApprovalLabel = (status: LaunchApprovalStatus | string) => {
  const normalized = normalizeLaunchApprovalStatus(status);
  if (normalized === 'under_fund_review') return 'Under Fund review';
  if (normalized === 'fund_returned') return 'Not Started';
  if (normalized === 'under_fi_supervisor_review') return 'Under FI Supervisor review';
  if (normalized === 'supervisor_returned') return 'Revision Required';
  if (normalized === 'live') return 'Completed';
  return 'Not Started';
};

export const getLaunchApprovalTheme = (status: LaunchApprovalStatus | string) => {
  const normalized = normalizeLaunchApprovalStatus(status);
  if (normalized === 'live') return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
  if (normalized === 'supervisor_returned') {
    return { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' };
  }
  if (normalized === 'under_fund_review' || normalized === 'under_fi_supervisor_review') {
    return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
  }
  return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
};

const normalizeLaunchApprovalHistoryType = (value: unknown): LaunchApprovalHistoryType => {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (normalized === 'fund_approve' || normalized === 'fund_approved') return 'fund_approve';
  if (normalized === 'fund_return' || normalized === 'fund_returned') return 'fund_return';
  if (normalized === 'supervisor_approve' || normalized === 'supervisor_approved') return 'supervisor_approve';
  if (normalized === 'supervisor_return' || normalized === 'supervisor_returned') return 'supervisor_return';
  if (normalized === 'reopened') return 'reopened';
  return 'submit';
};

const normalizeLaunchApprovalHistory = (value: unknown) => (
  Array.isArray(value)
    ? value.reduce<LaunchApprovalHistoryEntry[]>((entries, item, index) => {
        if (!item || typeof item !== 'object') return entries;
        const candidate = item as Record<string, unknown>;
        const time = normalizeWhitespace(candidate.time);
        const actor = normalizeWhitespace(candidate.actor || candidate.user);
        if (!time && !actor) return entries;
        const type = normalizeLaunchApprovalHistoryType(candidate.type);
        if (type !== 'supervisor_approve' && type !== 'supervisor_return') return entries;
        entries.push({
          id: normalizeWhitespace(candidate.id) || `launch-history-${time || index}`,
          type,
          status: normalizeLaunchApprovalStatus(candidate.status),
          actor: actor || 'Unknown',
          actorRole: normalizeWhitespace(candidate.actorRole) || 'System',
          time,
          note: normalizeWhitespace(candidate.note),
        });
        return entries;
      }, [])
    : []
);

const isLaunchKycTerminal = (status: unknown) => {
  const normalized = String(status ?? '').trim().toLowerCase();
  return normalized === 'completed' || normalized === 'no_need' || normalized === 'no need';
};

const isLaunchNdaTerminal = (status: unknown) => {
  const normalized = normalizeNdaStatusLabel(status);
  return normalized === 'Completed' || normalized === 'No Need';
};

const isLaunchLegalCompleted = (status: unknown) => (
  normalizeMsaStatusLabel(status) === 'Completed'
);

const buildLaunchLegalPrerequisiteItems = (channel: any): LaunchPrerequisiteItem[] => {
  const ndaStatus = normalizeNdaStatusLabel(channel?.ndaStatus || channel?.globalProgress?.nda);
  const msaStatus = normalizeMsaStatusLabel(channel?.contractStatus || channel?.globalProgress?.contract);
  const pricingStatus = getPricingLegalAggregateStatus(Array.isArray(channel?.pricingProposals) ? channel.pricingProposals : []);
  const otherAttachmentsStatus = normalizeMsaStatusLabel(channel?.otherAttachmentsStatus || channel?.globalProgress?.otherAttachments);

  return [
    {
      key: 'nda',
      label: 'NDA',
      status: ndaStatus,
      ready: isLaunchNdaTerminal(ndaStatus),
    },
    {
      key: 'msa',
      label: 'MSA',
      status: msaStatus,
      ready: isLaunchLegalCompleted(msaStatus),
    },
    {
      key: 'pricing',
      label: 'Pricing Schedule',
      status: pricingStatus,
      ready: pricingStatus === 'Completed',
    },
    {
      key: 'otherAttachments',
      label: 'Other Attachments',
      status: otherAttachmentsStatus,
      ready: isLaunchLegalCompleted(otherAttachmentsStatus),
    },
  ];
};

export const buildFundPrerequisiteSnapshot = (channel: any): LaunchPrerequisiteSnapshot => {
  const wooshpayWorkflow = getChannelOnboardingWorkflow(channel, 'wooshpay');
  const corridorWorkflow = getChannelOnboardingWorkflow(channel, 'corridor');
  const wooshpayKycStatus = getOnboardingStatusLabel('wooshpay', wooshpayWorkflow.status);
  const corridorKycStatus = getOnboardingStatusLabel('corridor', corridorWorkflow.status);
  const legalItems = buildLaunchLegalPrerequisiteItems(channel);
  const requiredLegalItems = legalItems.filter((item) => item.key !== 'otherAttachments');
  const legalReady = requiredLegalItems.every((item) => item.ready);
  const kycReady = isLaunchKycTerminal(wooshpayWorkflow.status) && isLaunchKycTerminal(corridorWorkflow.status);
  const missingItems = [
    ...requiredLegalItems.map((item) => (item.ready ? '' : `${item.label} must be completed${item.key === 'nda' ? ' or no need' : ''}`)),
    isLaunchKycTerminal(wooshpayWorkflow.status) ? '' : 'WooshPay onboarding must be completed or no need',
    isLaunchKycTerminal(corridorWorkflow.status) ? '' : 'Corridor onboarding must be completed or no need',
  ].filter(Boolean);

  return {
    legalItems,
    wooshpayKycStatus,
    corridorKycStatus,
    legalReady,
    kycReady,
    ready: legalReady && kycReady,
    missingItems,
  };
};

export const buildLaunchPrerequisiteSnapshot = (channel: any): LaunchPrerequisiteSnapshot => {
  const fundPrerequisites = buildFundPrerequisiteSnapshot(channel);
  const fundStatus = normalizeFundApprovalStatus(channel?.fundApproval?.status);
  const fundReady = fundStatus === 'approved';
  const missingItems = [
    fundReady ? '' : 'Fund review must be approved',
    ...fundPrerequisites.missingItems,
  ].filter(Boolean);

  return {
    ...fundPrerequisites,
    fundStatus,
    fundReady,
    ready: fundReady && fundPrerequisites.ready,
    missingItems: fundReady && fundPrerequisites.ready ? [] : missingItems,
  };
};

const normalizeLaunchPrerequisiteSnapshot = (
  value: unknown,
  fallback: LaunchPrerequisiteSnapshot,
): LaunchPrerequisiteSnapshot => {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Record<string, unknown>;
  const missingItems = Array.isArray(candidate.missingItems)
    ? candidate.missingItems.map((item) => normalizeWhitespace(item)).filter(Boolean)
    : fallback.missingItems;
  const legalReady = candidate.legalReady === undefined ? fallback.legalReady : Boolean(candidate.legalReady);
  const kycReady = candidate.kycReady === undefined ? fallback.kycReady : Boolean(candidate.kycReady);
  const fundStatus = candidate.fundStatus === undefined
    ? fallback.fundStatus
    : normalizeFundApprovalStatus(candidate.fundStatus);
  const fundReady = candidate.fundReady === undefined ? fallback.fundReady : Boolean(candidate.fundReady);
  const legalItems = Array.isArray(candidate.legalItems)
    ? candidate.legalItems.map((item, index) => {
        const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        const fallbackItem = fallback.legalItems[index] || {
          key: `legal-${index}`,
          label: 'Legal item',
          status: 'Not Started',
          ready: false,
        };
        return {
          key: normalizeWhitespace(record.key) || fallbackItem.key,
          label: normalizeWhitespace(record.label) || fallbackItem.label,
          status: normalizeWhitespace(record.status) || fallbackItem.status,
          ready: record.ready === undefined ? fallbackItem.ready : Boolean(record.ready),
        };
      })
    : fallback.legalItems;
  return {
    legalStatus: normalizeWhitespace(candidate.legalStatus) || fallback.legalStatus,
    legalItems,
    wooshpayKycStatus: normalizeWhitespace(candidate.wooshpayKycStatus) || fallback.wooshpayKycStatus,
    corridorKycStatus: normalizeWhitespace(candidate.corridorKycStatus) || fallback.corridorKycStatus,
    legalReady,
    kycReady,
    fundStatus,
    fundReady,
    ready: candidate.ready === undefined ? Boolean(fallback.ready) : Boolean(candidate.ready),
    missingItems,
  };
};

export const normalizeLaunchApproval = (
  value: any = {},
  channel: any = {},
): LaunchApproval => {
  const approval = value && typeof value === 'object' ? value : {};
  const fallbackSnapshot = buildLaunchPrerequisiteSnapshot(channel);
  const fundStatus = normalizeFundApprovalStatus(channel?.fundApproval?.status);
  const hasActiveFundSubmission = Boolean(
    normalizeWhitespace(channel?.fundApproval?.submittedAt)
    || normalizeWhitespace(channel?.fundApproval?.submittedBy),
  );
  const rawStatus = normalizeWhitespace(approval.status);
  const normalizedRawStatus = normalizeLaunchApprovalStatus(rawStatus);
  const history = normalizeLaunchApprovalHistory(approval.history);
  const hasSupervisorReturn = normalizedRawStatus === 'supervisor_returned';
  const hasSupervisorApprove = normalizedRawStatus === 'live'
    || String(channel?.status || '').trim() === 'Live';
  const status: LaunchApprovalStatus = hasSupervisorApprove
    ? 'live'
    : hasSupervisorReturn
      ? 'supervisor_returned'
      : fundStatus === 'approved'
        ? 'under_fi_supervisor_review'
        : fundStatus === 'pending' && hasActiveFundSubmission
          ? 'under_fund_review'
          : 'not_submitted';

  return {
    status,
    submittedBy: normalizeWhitespace(approval.submittedBy),
    submittedAt: normalizeWhitespace(approval.submittedAt),
    fundDecisionBy: normalizeWhitespace(approval.fundDecisionBy),
    fundDecisionAt: normalizeWhitespace(approval.fundDecisionAt),
    fundNote: normalizeWhitespace(approval.fundNote),
    supervisorDecisionBy: normalizeWhitespace(approval.supervisorDecisionBy),
    supervisorDecisionAt: normalizeWhitespace(approval.supervisorDecisionAt),
    supervisorNote: normalizeWhitespace(approval.supervisorNote),
    prerequisiteSnapshot: normalizeLaunchPrerequisiteSnapshot(approval.prerequisiteSnapshot, fallbackSnapshot),
    history,
  };
};

const createLaunchHistoryEntry = (
  type: LaunchApprovalHistoryType,
  status: LaunchApprovalStatus,
  actor: string,
  actorRole: string,
  time: string,
  note: string,
): LaunchApprovalHistoryEntry => ({
  id: `launch-${type}-${time}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  status,
  actor,
  actorRole,
  time,
  note,
});

const getLaunchHistory = (channel: any) => (
  Array.isArray(channel?.launchApproval?.history) ? channel.launchApproval.history : []
);

export const applyLaunchFundReviewSubmission = (
  channel: any,
  actor: string,
  time: string,
  note = '',
) => {
  const launchApproval = normalizeLaunchApproval(channel?.launchApproval, channel);
  const normalizedNote = normalizeWhitespace(note) || 'Fund review submitted.';
  const status: LaunchApprovalStatus = 'under_fund_review';
  const nextApproval: LaunchApproval = {
    ...launchApproval,
    status,
    submittedBy: actor,
    submittedAt: time,
    fundNote: normalizedNote,
    prerequisiteSnapshot: buildLaunchPrerequisiteSnapshot(channel),
    history: getLaunchHistory(channel),
  };

  return {
    ...channel,
    launchApproval: nextApproval,
  };
};

export const applyLaunchFundReviewRevocation = (
  channel: any,
  _actor: string,
  _time: string,
  note = '',
) => {
  const launchApproval = normalizeLaunchApproval(channel?.launchApproval, channel);
  const previousReturn = getLaunchHistory(channel).find((entry: LaunchApprovalHistoryEntry) => (
    entry?.type === 'supervisor_return'
  ));
  const status: LaunchApprovalStatus = previousReturn?.type === 'supervisor_return'
    ? 'supervisor_returned'
    : 'not_submitted';
  const normalizedNote = normalizeWhitespace(note) || 'Fund review submission revoked.';
  const nextApproval: LaunchApproval = {
    ...launchApproval,
    status,
    submittedBy: status === 'not_submitted' ? '' : launchApproval.submittedBy,
    submittedAt: status === 'not_submitted' ? '' : launchApproval.submittedAt,
    fundNote: normalizedNote,
    prerequisiteSnapshot: buildLaunchPrerequisiteSnapshot(channel),
    history: getLaunchHistory(channel),
  };

  return {
    ...channel,
    launchApproval: nextApproval,
  };
};

export const isLaunchSubmittedStatus = (status: LaunchApprovalStatus | string) => (
  normalizeLaunchApprovalStatus(status) !== 'not_submitted'
);

export const isLaunchApprovalBlocked = (channel: any) => {
  const status = normalizeLaunchApprovalStatus(channel?.launchApproval?.status);
  if (status !== 'under_fund_review' && status !== 'under_fi_supervisor_review') return false;
  return !buildLaunchPrerequisiteSnapshot(channel).ready;
};

export const canSubmitLaunchApproval = (channel: any) => {
  const status = normalizeLaunchApprovalStatus(channel?.launchApproval?.status);
  if (status === 'under_fi_supervisor_review' || status === 'live') return false;
  return normalizeFundApprovalStatus(channel?.fundApproval?.status) === 'approved'
    && String(channel?.status || '').trim() !== 'Live';
};

const getLaunchSubmissionTargetStatus = (channel: any): LaunchApprovalStatus => {
  const currentStatus = normalizeLaunchApprovalStatus(channel?.launchApproval?.status);
  if (currentStatus === 'supervisor_returned' || currentStatus === 'fund_returned' || currentStatus === 'not_submitted') {
    return 'under_fi_supervisor_review';
  }
  return 'under_fi_supervisor_review';
};

export const applyLaunchSubmission = (
  channel: any,
  actor: string,
  time: string,
  note = '',
) => {
  const launchApproval = normalizeLaunchApproval(channel?.launchApproval, channel);
  const status = getLaunchSubmissionTargetStatus(channel);
  const prerequisiteSnapshot = buildLaunchPrerequisiteSnapshot(channel);
  const normalizedNote = normalizeWhitespace(note) || 'Launch approval submitted.';
  const nextApproval: LaunchApproval = {
    ...launchApproval,
    status,
    submittedBy: actor,
    submittedAt: time,
    prerequisiteSnapshot,
    history: getLaunchHistory(channel),
  };

  return {
    ...channel,
    launchApproval: nextApproval,
    lastModifiedAt: time,
    auditLogs: [
      {
        time,
        user: actor,
        action: `${status === 'under_fi_supervisor_review' ? 'Submitted launch approval to FI Supervisor.' : 'Resubmitted launch approval.'}${normalizedNote ? ` ${normalizedNote}` : ''}`,
        color: 'blue',
      },
      ...(Array.isArray(channel?.auditLogs) ? channel.auditLogs : []),
    ],
  };
};

export const applyLaunchFundDecision = (
  channel: any,
  type: 'approve' | 'request_changes',
  actor: string,
  time: string,
  note: string,
) => {
  const launchApproval = normalizeLaunchApproval(channel?.launchApproval, channel);
  const status: LaunchApprovalStatus = type === 'approve' ? 'under_fi_supervisor_review' : 'not_submitted';
  const nextApproval: LaunchApproval = {
    ...launchApproval,
    status,
    fundDecisionBy: actor,
    fundDecisionAt: time,
    fundNote: note,
    supervisorDecisionBy: type === 'approve' ? '' : launchApproval.supervisorDecisionBy,
    supervisorDecisionAt: type === 'approve' ? '' : launchApproval.supervisorDecisionAt,
    supervisorNote: type === 'approve' ? '' : launchApproval.supervisorNote,
    prerequisiteSnapshot: buildLaunchPrerequisiteSnapshot(channel),
    history: getLaunchHistory(channel),
  };

  return {
    ...channel,
    launchApproval: nextApproval,
  };
};

export const applyLaunchFundSourceChange = (
  channel: any,
  _actor: string,
  _time: string,
) => {
  const launchApproval = normalizeLaunchApproval(channel?.launchApproval, channel);
  if (launchApproval.status !== 'under_fi_supervisor_review' && launchApproval.status !== 'supervisor_returned') {
    return {
      ...channel,
      launchApproval,
    };
  }

  const note = 'Fund source data changed after Fund confirmation; launch must be resubmitted for Fund review.';
  return {
    ...channel,
    launchApproval: {
      ...launchApproval,
      status: 'not_submitted' as LaunchApprovalStatus,
      fundNote: note,
      history: getLaunchHistory(channel),
    },
  };
};

export const applyLaunchSupervisorDecision = (
  channel: any,
  type: 'approve' | 'request_changes',
  actor: string,
  time: string,
  note: string,
) => {
  const launchApproval = normalizeLaunchApproval(channel?.launchApproval, channel);
  const status: LaunchApprovalStatus = type === 'approve' ? 'live' : 'supervisor_returned';
  const historyType: LaunchApprovalHistoryType = type === 'approve' ? 'supervisor_approve' : 'supervisor_return';
  const nextApproval: LaunchApproval = {
    ...launchApproval,
    status,
    supervisorDecisionBy: actor,
    supervisorDecisionAt: time,
    supervisorNote: note,
    history: [
      createLaunchHistoryEntry(historyType, status, actor, 'FI Supervisor', time, note),
      ...getLaunchHistory(channel),
    ],
  };
  const fundReturnNote = normalizeWhitespace(note) || 'FI Supervisor returned launch approval. FIOP must resubmit Fund review.';
  const nextFundApproval = type === 'request_changes'
    ? {
        ...(channel?.fundApproval && typeof channel.fundApproval === 'object' ? channel.fundApproval : {}),
        status: 'not_started' as FundApprovalStatus,
        note: fundReturnNote,
        submittedAt: '',
        submittedBy: '',
        submitNote: '',
        lastActionAt: time,
        lastActionBy: actor,
        history: [
          {
            id: `fund-reopened-by-supervisor-${time}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'reopened',
            status: 'not_started' as FundApprovalStatus,
            user: actor,
            time,
            note: fundReturnNote,
          },
          ...(Array.isArray(channel?.fundApproval?.history) ? channel.fundApproval.history : []),
        ],
      }
    : channel?.fundApproval;

  return {
    ...channel,
    status: type === 'approve' ? 'Live' : channel?.status,
    fundApproval: nextFundApproval || channel?.fundApproval,
    launchApproval: nextApproval,
    lastModifiedAt: time,
    auditLogs: [
      {
        time,
        user: actor,
        action: type === 'approve'
          ? `Approved final launch.${note ? ` ${note}` : ''}`
          : `Returned launch approval to FIOP.${note ? ` ${note}` : ''}`,
        color: type === 'approve' ? 'green' : 'orange',
      },
      ...(Array.isArray(channel?.auditLogs) ? channel.auditLogs : []),
    ],
  };
};

const toFiniteNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeSettlementDayType = (value?: string | null): 'calendar' | 'working' => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'working' || normalized === 'working day' ? 'working' : 'calendar';
};

export const getSettlementDayTypeLabel = (value?: string | null) => (
  normalizeSettlementDayType(value) === 'working' ? 'Working day' : 'Calendar day'
);

const extractSettlementThresholdParts = (settlement: any = {}) => {
  const rawThreshold = settlement?.settlementThreshold;
  const thresholdCurrency = String(settlement?.settlementThresholdCurrency || '').trim().toUpperCase();
  const preservedRawText = typeof settlement?.settlementThresholdRawText === 'string'
    ? settlement.settlementThresholdRawText.trim()
    : '';
  const parsedAmount = toFiniteNumberOrNull(rawThreshold);
  if (parsedAmount !== null) {
    return {
      amount: parsedAmount,
      currency: thresholdCurrency || DEFAULT_SETTLEMENT_CURRENCY,
      rawText: '',
    };
  }

  const rawText = typeof rawThreshold === 'string' ? rawThreshold.trim() : preservedRawText;
  if (!rawText) {
    return {
      amount: null,
      currency: thresholdCurrency,
      rawText: '',
    };
  }

  const amountMatch = rawText.match(/-?\d[\d,]*(?:\.\d+)?/);
  const currencyMatch = rawText.match(/[A-Za-z]{3}/);
  return {
    amount: amountMatch ? toFiniteNumberOrNull(amountMatch[0]) : null,
    currency: thresholdCurrency || currencyMatch?.[0]?.toUpperCase() || '',
    rawText,
  };
};

export const getSettlementThresholdDisplay = (settlement: any = {}) => {
  const { amount, currency, rawText } = extractSettlementThresholdParts(settlement);
  if (amount !== null) {
    return `${currency} ${amount}`;
  }
  return rawText;
};

export const getSettlementCycleDisplay = (settlement: any = {}) => {
  const cycle = toFiniteNumberOrNull(settlement?.settlementCycle ?? settlement?.cycleDays);
  if (cycle === null) return 'Not set';
  return `T+${cycle} ${getSettlementDayTypeLabel(settlement?.settlementDayType ?? settlement?.cycleDayType)}`;
};

export const normalizeSettlementConfig = (settlement: any = {}) => {
  const cycle = toFiniteNumberOrNull(settlement?.cycleDays ?? settlement?.settlementCycle);
  const rawDayType = normalizeWhitespace(settlement?.cycleDayType ?? settlement?.settlementDayType);
  const dayType = rawDayType ? normalizeSettlementDayType(rawDayType) : 'calendar';
  const { amount, currency, rawText } = extractSettlementThresholdParts(settlement);
  return {
    ...settlement,
    settlementCycle: cycle,
    cycleDays: cycle,
    settlementDayType: getSettlementDayTypeLabel(dayType),
    cycleDayType: dayType,
    settlementCurrency: normalizeStringList(settlement?.settlementCurrency),
    acquiringCurrency: normalizeStringList(settlement?.acquiringCurrency),
    settlementHolidays: normalizeStringList(settlement?.settlementHolidays),
    settlementThreshold: amount,
    settlementThresholdCurrency: currency,
    settlementThresholdRawText: amount === null ? rawText : '',
    fxCostReference: normalizeWhitespace(settlement?.fxCostReference),
    fxCostOperator: settlement?.fxCostOperator === '-' ? '-' : '+',
    fxCostValue: toFiniteNumberOrNull(settlement?.fxCostValue),
    fxCostDetails: typeof settlement?.fxCostDetails === 'string' ? settlement.fxCostDetails : '',
  };
};

export const createDefaultSettlementConfig = () => normalizeSettlementConfig({
  cycleDayType: 'calendar',
});

const createPricingRuleCardCatalogId = (name: string) => (
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `custom-card-${Date.now()}`
);
export const normalizePricingRuleCardCatalogItem = (item: any) => {
  if (typeof item === 'string') {
    const normalizedName = item.trim();
    const matchedSystemItem = PRICING_RULE_CARD_SYSTEM_CATALOG.find(
      (systemItem) => systemItem.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (matchedSystemItem) {
      return { ...matchedSystemItem };
    }
    return {
      id: createPricingRuleCardCatalogId(normalizedName),
      name: normalizedName,
      system: false,
    };
  }

  if (!item?.name) return null;

  const matchedSystemItem = item?.id
    ? PRICING_RULE_CARD_SYSTEM_CATALOG.find((systemItem) => systemItem.id === item.id)
    : PRICING_RULE_CARD_SYSTEM_CATALOG.find(
      (systemItem) => systemItem.name.toLowerCase() === String(item.name).trim().toLowerCase(),
    );

  if (matchedSystemItem) {
    return {
      ...matchedSystemItem,
      ...item,
      id: matchedSystemItem.id,
      name: matchedSystemItem.name,
      system: true,
    };
  }

  return {
    id: item.id || createPricingRuleCardCatalogId(String(item.name)),
    name: String(item.name).trim(),
    system: Boolean(item.system),
  };
};

// --- 初始视图配置 ---
export const DEFAULT_CORRIDOR_VIEW_ID = 'all-fields';
export const DEFAULT_MATRIX_VIEW_ID = 'all-columns';

export const INITIAL_CORRIDOR_VIEWS: SavedDashboardView[] = [
  {
    id: 'all-fields',
    mode: 'corridor',
    name: 'All Fields',
    description: 'Default view with every corridor field visible and no filters applied.',
    columns: [...DEFAULT_CORRIDOR_COLUMNS],
    filters: [],
    isPreset: true,
  },
  {
    id: 'fibd',
    mode: 'corridor',
    name: 'FIBD',
    description: 'Preset view focused on corridor, product, pricing, and status.',
    columns: ['channelName', 'status', 'wooshpayOnboardingStatus', 'corridorOnboardingStatus', 'cooperationModel', 'merchantGeo', 'supportedProducts', 'fiopOwner', 'fibdOwner', 'fiopTrackingLatest', 'lastModifiedAt'],
    filters: [],
    isPreset: true,
  },
  {
    id: 'manager',
    mode: 'corridor',
    name: 'FI Manager',
    description: 'Preset view focused on owners and workflow progress.',
    columns: ['channelName', 'status', 'fiopOwner', 'fibdOwner', 'fiopTrackingLatest', 'wooshpayOnboardingStatus', 'corridorOnboardingStatus', 'ndaStatus', 'contractStatus', 'pricingProposalStatus', 'techStatus', 'createdAt', 'lastModifiedAt'],
    filters: [],
    isPreset: true,
  },
];

export const INITIAL_MATRIX_VIEWS: SavedDashboardView[] = [
  {
    id: 'all-columns',
    mode: 'matrix',
    name: 'All Columns',
    description: 'Default pricing matrix view with every matrix field visible and no filters applied.',
    columns: [...DEFAULT_MATRIX_COLUMNS],
    filters: [],
    isPreset: true,
  },
];

export const cloneDashboardViewFilters = (filters: DashboardViewFilterCondition[] = []) => (
  filters.map((filter) => ({ ...filter }))
);

export const cloneDashboardFieldDefinition = (field: DashboardFieldDefinition): DashboardFieldDefinition => ({
  ...field,
});

export const cloneDashboardFieldGroup = (group: DashboardFieldGroup): DashboardFieldGroup => ({
  ...group,
});

export const cloneDashboardFieldSchema = (schema: DashboardFieldSchema): DashboardFieldSchema => ({
  fields: schema.fields.map((field) => cloneDashboardFieldDefinition(field)),
  groups: schema.groups.map((group) => cloneDashboardFieldGroup(group)),
});

export const createDefaultDashboardFieldSchema = (mode: DashboardViewMode): DashboardFieldSchema => (
  cloneDashboardFieldSchema({
    fields: (mode === 'corridor' ? DEFAULT_CORRIDOR_FIELD_DEFINITIONS : DEFAULT_MATRIX_FIELD_DEFINITIONS)
      .map((field) => cloneDashboardFieldDefinition(field)),
    groups: [],
  })
);

export const cloneSavedDashboardView = (view: SavedDashboardView): SavedDashboardView => ({
  ...view,
  columns: [...view.columns],
  filters: cloneDashboardViewFilters(view.filters),
});

export const cloneSavedDashboardViews = (views: SavedDashboardView[] = []) => (
  views.map((view) => cloneSavedDashboardView(view))
);


// --- 数据转换逻辑 (Matrix View) ---
export const buildDashboardMatrixRows = (channels: any[]) => {
  const rows: any[] = [];
  channels.forEach(channel => {
    if (channel.pricingProposals && Array.isArray(channel.pricingProposals)) {
      channel.pricingProposals.forEach((proposal: any) => {
        if (proposal.paymentMethods && Array.isArray(proposal.paymentMethods)) {
          proposal.paymentMethods.forEach((pm: any) => {
            const firstRow = pm.pricingRows?.[0] || {};
            rows.push({
              id: `${channel.id}-${proposal.id}-${pm.id}`,
              channelId: channel.id,
              channelName: channel.channelName,
              quotationName: proposal.customProposalType || 'General Quotation',
              quotationType: proposal.mode || 'N/A',
              paymentMethodName: pm.method,
              consumerRegion: pm.consumerRegion || [],
              fee: firstRow.variableRate ? `${firstRow.variableRate}%` : (firstRow.fixedFeeAmount ? `${firstRow.fixedFeeCurrency || 'USD'} ${firstRow.fixedFeeAmount}` : 'N/A'),
              floorPrice: firstRow.floorPrice ? `${firstRow.floorPriceCurrency || 'USD'} ${firstRow.floorPrice}` : 'N/A',
              capPrice: firstRow.capPrice ? `${firstRow.capPriceCurrency || 'USD'} ${firstRow.capPrice}` : 'N/A',
              settlementCycle: getSettlementCycleDisplay(pm.settlement),
              settlementCurrency: pm.settlement?.settlementCurrency || [],
              fxCostReference: pm.settlement?.fxCostReference || 'Not set',
              settlementThreshold: getSettlementThresholdDisplay(pm.settlement) || 'Not set',
              minimumTransactionAmount: pm.capabilityFlags?.minTicket ? `${pm.capabilityFlags.minTicketCurrency || 'USD'} ${pm.capabilityFlags.minTicket}` : 'Not set',
              maximumTransactionAmount: pm.capabilityFlags?.maxTicket ? `${pm.capabilityFlags.maxTicketCurrency || 'USD'} ${pm.capabilityFlags.maxTicket}` : 'Not set',
              refundCapability: pm.capabilityFlags?.refundCapability || 'Not set',
              refundMethod: pm.capabilityFlags?.refundMethod || 'Not set',
              autoDebitCapability: pm.capabilityFlags?.autoDebitCapability || 'Not set',
              logo: channel.logo
            });
          });
        }
      });
    }
  });
  return rows;
};

const createHistoryEntry = (entry?: any) => ({
  date: entry?.date || null,
  user: entry?.user || null,
  notes: entry?.notes || null,
  proposalId: entry?.proposalId || null,
  proposalName: entry?.proposalName || null,
});

const createSubmissionHistory = (entries: any = {}) => ({
  cdd: createHistoryEntry(entries.cdd || entries.kyc),
  kyc: createHistoryEntry(entries.kyc),
  nda: createHistoryEntry(entries.nda),
  msa: createHistoryEntry(entries.msa),
  otherAttachments: createHistoryEntry(entries.otherAttachments),
  pricing: createHistoryEntry(entries.pricing),
  tech: createHistoryEntry(entries.tech),
});

export const PRICING_FI_SUPERVISOR_REVIEW_STATUS = 'Under FI supervisor review';
export const PRICING_LEGAL_REVIEW_STATUS = 'Under legal review';
export const PRICING_CORRIDOR_REVIEW_STATUS = 'Under Corridor review';
export const PRICING_COMPLETED_STATUS = 'Completed';
export const PRICING_NOT_STARTED_STATUS = 'Not Started';
export const PRICING_DISPLAY_STATUS_VALUES = [
  PRICING_NOT_STARTED_STATUS,
  PRICING_FI_SUPERVISOR_REVIEW_STATUS,
  PRICING_LEGAL_REVIEW_STATUS,
  PRICING_CORRIDOR_REVIEW_STATUS,
  PRICING_COMPLETED_STATUS,
] as const;
export const PRICING_LEGAL_QUEUE_STATUS_VALUES = [
  PRICING_LEGAL_REVIEW_STATUS,
  PRICING_CORRIDOR_REVIEW_STATUS,
  PRICING_COMPLETED_STATUS,
] as const;

const pricingScheduleSupervisorReviewStates = new Set([
  'under fi supervisor review',
  'pending fi supervisor',
  'in review',
  'under review',
  'in progress',
  'pending',
]);
const pricingScheduleLegalReviewStates = new Set([
  'under legal review',
  'ready for legal',
  'under our review',
  'approved',
  'approve',
  'approved by fi supervisor',
]);
const pricingScheduleCorridorReviewStates = new Set([
  'under corridor review',
  'changes requested',
  'request changes',
  'changes_request',
  'returned by fi supervisor',
]);
const pricingScheduleCompletedStates = new Set(['completed', 'signed']);

const normalizeStatusLabel = (value: unknown) => String(value ?? '').trim();
const buildDemoDownloadUrl = (title: string, body?: string) => (
  `data:text/plain;charset=utf-8,${encodeURIComponent(
    body || `${title}\n\nThis is a demo pricing attachment prepared for the FI System prototype.`,
  )}`
);
const normalizePricingAttachmentMeta = (attachment: any, index: number) => ({
  uid: String(attachment?.uid || `pricing-attachment-${index}`),
  name: String(attachment?.name || `Attachment ${index + 1}`),
  size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : 0,
  type: String(attachment?.type || '').trim(),
  status: String(attachment?.status || 'done').trim() || 'done',
  url: String(attachment?.url || attachment?.downloadUrl || '').trim(),
  urlSessionId: String(attachment?.urlSessionId || '').trim(),
  downloadUrl: String(attachment?.downloadUrl || attachment?.url || '').trim(),
});
const normalizePricingAttachments = (attachments: any[] = []) => (
  Array.isArray(attachments) ? attachments.map(normalizePricingAttachmentMeta) : []
);

export type PricingApprovalHistoryType = 'submit' | 'approve' | 'request_changes';
export type PricingApprovalQueueTab = 'pending' | 'changes_requested' | 'approved';

export interface PricingApprovalHistoryEntry {
  type: PricingApprovalHistoryType;
  time: string;
  user: string;
  note?: string;
  title?: string;
  status?: string;
  displayStatus?: string;
  lifecycle?: TimelineLifecycle;
  terminalDecision?: TerminalDecisionMeta | null;
}

export interface PricingApprovalQueueRow {
  id: string;
  channel: any;
  proposalId: string;
  corridorName: string;
  quotationName: string;
  cooperationMode: string;
  fiOwner: string;
  submittedAt: string;
  status: string;
  queueTab: PricingApprovalQueueTab;
  latestActionAt: string;
  latestActionUser: string;
  latestActionNote: string;
  paymentMethodCount: number;
}

export interface PricingLegalHistoryEntry {
  time: string;
  user: string;
  status: string;
  displayStatus?: string;
  note?: string;
  lifecycle?: TimelineLifecycle;
  terminalDecision?: TerminalDecisionMeta | null;
}

export interface PricingUnifiedHistoryEntry {
  key: string;
  stage: 'pricing' | 'fi_supervisor' | 'legal';
  stageLabel: string;
  title: string;
  eventId?: string;
  status: string;
  displayStatus?: string;
  time: string;
  user: string;
  note?: string;
  lifecycle?: TimelineLifecycle;
  terminalDecision?: TerminalDecisionMeta | null;
}

export const isCompletedWorkflowState = (value: unknown) => (
  normalizePricingStatusToken(value) === PRICING_COMPLETED_STATUS
);

const normalizePricingStatusToken = (value: unknown, fallback = 'Not Started') => {
  const normalized = normalizeStatusLabel(value);
  if (!normalized) return fallback;

  const token = normalized.toLowerCase();
  if (token === 'no need' || token === 'no_need' || token === 'none') return fallback;
  if (pricingScheduleSupervisorReviewStates.has(token)) return PRICING_FI_SUPERVISOR_REVIEW_STATUS;
  if (pricingScheduleLegalReviewStates.has(token)) return PRICING_LEGAL_REVIEW_STATUS;
  if (pricingScheduleCorridorReviewStates.has(token)) return PRICING_CORRIDOR_REVIEW_STATUS;
  if (pricingScheduleCompletedStates.has(token)) return PRICING_COMPLETED_STATUS;
  if (token === 'not started') return 'Not Started';
  return normalized;
};

export const normalizePricingProposalApprovalStatus = (proposal: any, fallbackStatus?: string) => (
  normalizePricingStatusToken(proposal?.approvalStatus || fallbackStatus)
);

const normalizePricingLegalStatus = (value: unknown) => {
  const normalized = normalizeStatusLabel(value);
  if (!normalized) return '';

  const token = normalized.toLowerCase();
  if (token === 'not started') return 'Not Started';
  if (token === 'no need' || token === 'no_need' || token === 'none') return '';
  if (pricingScheduleCompletedStates.has(token) || token === 'approved' || token === 'approve') return PRICING_COMPLETED_STATUS;
  if (pricingScheduleLegalReviewStates.has(token)) return PRICING_LEGAL_REVIEW_STATUS;
  if (
    pricingScheduleCorridorReviewStates.has(token)
    || token === 'pending corridor signature'
    || token === 'pending channel signature'
    || token === 'under channel review'
    || token === 'corridor reviewing'
    || token === 'corridor_reviewing'
    || token === 'counterparty reviewing'
  ) {
    return PRICING_CORRIDOR_REVIEW_STATUS;
  }

  return normalizePricingStatusToken(normalized);
};

const normalizePricingLegalHistory = (proposal: any): PricingLegalHistoryEntry[] => {
  const history: any[] = Array.isArray(proposal?.legalHistory) ? proposal.legalHistory : [];
  const normalizedEntries = history.reduce<PricingLegalHistoryEntry[]>((entries, entry) => {
    const time = String(entry?.time || '').trim();
    const status = normalizePricingLegalStatus(entry?.status);
    if (!time || !status) return entries;

    entries.push({
      time,
      user: String(entry?.user || entry?.actorName || 'Legal Team').trim() || 'Legal Team',
      status,
      displayStatus: normalizePricingLegalStatus(entry?.displayStatus) || undefined,
      note: String(entry?.note || '').trim(),
      lifecycle: entry?.lifecycle ? normalizeTimelineLifecycle(entry.lifecycle, 'normal') : undefined,
      terminalDecision: normalizeTerminalDecisionMeta(entry?.terminalDecision),
    });
    return entries;
  }, []);

  if (normalizedEntries.length > 0) {
    return [...normalizedEntries].sort((left, right) => (
      resolveApprovalHistoryTimestamp(right.time) - resolveApprovalHistoryTimestamp(left.time)
    ));
  }

  return [];
};

const getPricingLegalHistoryTitle = (status: string) => {
  if (status === PRICING_FI_SUPERVISOR_REVIEW_STATUS) return 'Submitted for FI Supervisor review';
  if (status === PRICING_LEGAL_REVIEW_STATUS) return 'Entered Legal review';
  if (status === PRICING_CORRIDOR_REVIEW_STATUS) return 'Returned to FIOP';
  if (status === PRICING_COMPLETED_STATUS) return 'Legal review completed';
  return 'Legal status updated';
};

export const getPricingLegalStageStatus = (proposal: any) => {
  const legalStatus = normalizePricingLegalStatus(proposal?.legalStatus);
  if (legalStatus && legalStatus !== 'Not Started') return legalStatus;

  const latestLegalHistoryStatus = normalizePricingLegalHistory(proposal)
    .find((entry) => entry.lifecycle?.state !== 'revoked')?.status;
  if (latestLegalHistoryStatus && latestLegalHistoryStatus !== 'Not Started') {
    return latestLegalHistoryStatus;
  }

  return normalizePricingProposalApprovalStatus(proposal);
};

export const getPricingLegalQueueGroup = (proposal: any) => {
  const stageStatus = getPricingLegalStageStatus(proposal);
  if (stageStatus === PRICING_LEGAL_REVIEW_STATUS) return 'legal_pending';
  if (stageStatus === PRICING_CORRIDOR_REVIEW_STATUS) return 'external_pending';
  if (stageStatus === PRICING_COMPLETED_STATUS) return 'completed';
  return 'inactive';
};

export const getLatestPricingLegalHistoryEvent = (proposal: any) => {
  const history = normalizePricingLegalHistory(proposal);
  return history.find((entry) => entry.lifecycle?.state !== 'revoked') || null;
};

export const getPricingLegalHistory = (proposal: any) => (
  normalizePricingLegalHistory(proposal)
);

export const isPricingProposalVisibleToLegal = (proposal: any) => {
  if (!proposal) return false;

  const pendingHandoff = isPendingHandoffActive(getPricingPendingHandoff(proposal))
    ? getPricingPendingHandoff(proposal)
    : null;
  if (
    pendingHandoff?.senderRole === 'FI Supervisor'
    && pendingHandoff.receiverRole === 'FIOP'
    && normalizePricingStatusToken(pendingHandoff.targetStatus) === PRICING_CORRIDOR_REVIEW_STATUS
  ) {
    return false;
  }

  const legalStatus = normalizePricingLegalStatus(proposal?.legalStatus);
  if (
    legalStatus === PRICING_LEGAL_REVIEW_STATUS
    || legalStatus === PRICING_CORRIDOR_REVIEW_STATUS
    || legalStatus === PRICING_COMPLETED_STATUS
  ) {
    return true;
  }

  if (getLatestPricingLegalHistoryEvent(proposal)) return true;

  const stageStatus = getPricingLegalStageStatus(proposal);
  return stageStatus === PRICING_LEGAL_REVIEW_STATUS || stageStatus === PRICING_COMPLETED_STATUS;
};

export const getLegalVisiblePricingProposals = (pricingProposals: any[] = []) => (
  Array.isArray(pricingProposals) ? pricingProposals.filter(isPricingProposalVisibleToLegal) : []
);

export const buildPricingLegalStageSummary = (pricingProposals: any[] = []) => {
  if (!Array.isArray(pricingProposals) || pricingProposals.length === 0) {
    return '';
  }

  const summary = pricingProposals.reduce((accumulator, proposal) => {
    const status = getPricingLegalStageStatus(proposal);
    if (status === PRICING_COMPLETED_STATUS) {
      accumulator.completed += 1;
    } else if (status === PRICING_LEGAL_REVIEW_STATUS) {
      accumulator.inLegal += 1;
    } else if (status === PRICING_FI_SUPERVISOR_REVIEW_STATUS) {
      accumulator.pendingSupervisor += 1;
    } else if (status === PRICING_CORRIDOR_REVIEW_STATUS) {
      accumulator.underCorridor += 1;
    } else if (status === 'Not Started') {
      accumulator.notStarted += 1;
    }
    return accumulator;
  }, { completed: 0, pendingSupervisor: 0, underCorridor: 0, inLegal: 0, notStarted: 0 });

  return [
    summary.inLegal ? `${summary.inLegal} ${PRICING_LEGAL_REVIEW_STATUS}` : '',
    summary.pendingSupervisor ? `${summary.pendingSupervisor} ${PRICING_FI_SUPERVISOR_REVIEW_STATUS}` : '',
    summary.underCorridor ? `${summary.underCorridor} ${PRICING_CORRIDOR_REVIEW_STATUS}` : '',
    summary.completed ? `${summary.completed} Completed` : '',
    summary.notStarted ? `${summary.notStarted} Not Started` : '',
  ].filter(Boolean).join(' / ');
};

export const getPricingLegalAggregateStatus = (pricingProposals: any[] = []) => {
  if (!Array.isArray(pricingProposals) || pricingProposals.length === 0) {
    return 'Not Started';
  }

  const statuses = pricingProposals.map((proposal) => getPricingLegalStageStatus(proposal));
  if (statuses.some((status) => status === PRICING_COMPLETED_STATUS)) return PRICING_COMPLETED_STATUS;
  if (statuses.some((status) => status === PRICING_LEGAL_REVIEW_STATUS)) return PRICING_LEGAL_REVIEW_STATUS;
  if (statuses.some((status) => status === PRICING_CORRIDOR_REVIEW_STATUS)) return PRICING_CORRIDOR_REVIEW_STATUS;
  if (statuses.some((status) => status === PRICING_FI_SUPERVISOR_REVIEW_STATUS)) return PRICING_FI_SUPERVISOR_REVIEW_STATUS;
  return 'Not Started';
};

export const getPricingApprovalQueueTab = (value: unknown): PricingApprovalQueueTab | null => {
  const normalized = normalizePricingStatusToken(value);
  if (normalized === PRICING_FI_SUPERVISOR_REVIEW_STATUS) return 'pending';
  if (normalized === PRICING_CORRIDOR_REVIEW_STATUS) return 'changes_requested';
  if (normalized === PRICING_LEGAL_REVIEW_STATUS || normalized === PRICING_COMPLETED_STATUS) return 'approved';
  return null;
};

const normalizePricingApprovalHistoryType = (value: unknown): PricingApprovalHistoryType | null => {
  const normalized = normalizeStatusLabel(value).toLowerCase();
  if (normalized === 'submit') return 'submit';
  if (normalized === 'approve') return 'approve';
  if (normalized === 'request_changes' || normalized === 'request changes' || normalized === 'changes requested') {
    return 'request_changes';
  }
  return null;
};

const resolveApprovalHistoryTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const rawPricingProposalsFromChannel = (channel: any) => (
  Array.isArray(channel?.pricingProposals) ? channel.pricingProposals : []
);

const sortPricingProposalsByUpdatedAt = (proposals: any[] = []) => (
  [...proposals].sort((left, right) => (
    resolveApprovalHistoryTimestamp(right?.updatedAt) - resolveApprovalHistoryTimestamp(left?.updatedAt)
  ))
);

const resolveMigratedPricingHistoryTarget = (
  pricingProposals: any[] = [],
  pricingHistory: any,
) => {
  if (!pricingHistory?.date) return null;
  if (pricingHistory?.proposalId) return pricingHistory.proposalId;

  if (pricingProposals.length === 1) {
    return pricingProposals[0]?.id || null;
  }

  const proposalsWithWorkflow = pricingProposals.filter((proposal) => {
    const status = normalizePricingProposalApprovalStatus(proposal);
    return status !== 'Not Started';
  });

  return proposalsWithWorkflow.length === 1 ? proposalsWithWorkflow[0]?.id || null : null;
};

const resolveMigratedPricingApprovalHistoryType = (
  normalizedStatus: unknown,
): PricingApprovalHistoryType => {
  const queueTab = getPricingApprovalQueueTab(normalizedStatus);
  if (queueTab === 'approved') return 'approve';
  if (queueTab === 'changes_requested') return 'request_changes';
  return 'submit';
};

const normalizePricingApprovalHistory = (
  proposal: any,
  migratedProposalId: string | null,
  pricingHistory: any,
  normalizedStatus: string,
): PricingApprovalHistoryEntry[] => {
  const approvalHistory = Array.isArray(proposal?.approvalHistory)
    ? proposal.approvalHistory as any[]
    : [];
  const normalizedEntries = approvalHistory.length
    ? approvalHistory.reduce<PricingApprovalHistoryEntry[]>((entries: PricingApprovalHistoryEntry[], entry: any) => {
        const type = normalizePricingApprovalHistoryType(entry?.type);
        const time = String(entry?.time || '').trim();
        if (!type || !time) return entries;
        const title = String(entry?.title || '').trim() || undefined;
        const note = String(entry?.note || '').trim();
        if (isLegacyRevocationCopy(title, note)) return entries;

        entries.push({
          type,
          time,
          user: String(entry?.user || 'Current User').trim() || 'Current User',
          note,
          title,
          status: entry?.status ? normalizePricingStatusToken(entry.status) : undefined,
          displayStatus: entry?.displayStatus ? normalizePricingStatusToken(entry.displayStatus) : undefined,
          lifecycle: entry?.lifecycle ? normalizeTimelineLifecycle(entry.lifecycle, 'normal') : undefined,
          terminalDecision: normalizeTerminalDecisionMeta(entry?.terminalDecision),
        });
        return entries;
      }, [])
    : [];

  if (normalizedEntries.length > 0) {
    return [...normalizedEntries].sort((left, right) => (
      resolveApprovalHistoryTimestamp(left.time) - resolveApprovalHistoryTimestamp(right.time)
    ));
  }

  if (pricingHistory?.date && proposal?.id && proposal.id === migratedProposalId) {
    return [{
      type: resolveMigratedPricingApprovalHistoryType(normalizedStatus),
      time: pricingHistory.date,
      user: pricingHistory.user || 'System',
      note: pricingHistory.notes || '',
    }];
  }

  return [];
};

const normalizeAuditLogs = (value: unknown) => (
  Array.isArray(value)
    ? value.reduce<any[]>((logs, item) => {
        if (!item || typeof item !== 'object') return logs;
        const candidate = item as Record<string, unknown>;
        const action = String(candidate.action || '').trim();
        if (!action || isLegacyRevocationCopy(action)) return logs;

        logs.push({
          ...candidate,
          time: String(candidate.time || '').trim(),
          user: String(candidate.user || '').trim(),
          action,
          color: String(candidate.color || '').trim(),
        });
        return logs;
      }, [])
    : []
);

const getPricingProposalDisplayName = (proposal: any) => (
  String(proposal?.customProposalType || '').trim() || 'Pricing Schedule'
);

const buildPricingSubmitHistoryTitle = (
  proposal: any,
  title?: string | null,
) => {
  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle || normalizedTitle.toLowerCase() === 'submitted pricing schedule') {
    return `Submitted ${getPricingProposalDisplayName(proposal)}`;
  }
  return normalizedTitle;
};

const buildPricingApprovalUnifiedHistoryEntry = (
  proposal: any,
  entry: PricingApprovalHistoryEntry,
  index: number,
): PricingUnifiedHistoryEntry => {
  const lifecycle = entry.lifecycle;
  if (entry.type === 'approve') {
    return {
      key: `fi-supervisor-${entry.time}-${index}`,
      stage: 'fi_supervisor',
      stageLabel: 'FI Supervisor',
      title: entry.title || 'Approved by FI Supervisor',
      eventId: buildPricingApprovalEntryId(entry),
      status: entry.status || PRICING_LEGAL_REVIEW_STATUS,
      displayStatus: entry.displayStatus || entry.status || PRICING_LEGAL_REVIEW_STATUS,
      time: entry.time,
      user: entry.user,
      note: entry.note,
      lifecycle,
    };
  }

  if (entry.type === 'request_changes') {
    return {
      key: `fi-supervisor-${entry.time}-${index}`,
      stage: 'fi_supervisor',
      stageLabel: 'FI Supervisor',
      title: entry.title || 'Returned by FI Supervisor',
      eventId: buildPricingApprovalEntryId(entry),
      status: entry.status || PRICING_CORRIDOR_REVIEW_STATUS,
      displayStatus: entry.displayStatus || entry.status || PRICING_CORRIDOR_REVIEW_STATUS,
      time: entry.time,
      user: entry.user,
      note: entry.note,
      lifecycle,
    };
  }

  return {
    key: `pricing-${entry.time}-${index}`,
    stage: 'pricing',
    stageLabel: 'FIOP',
    title: buildPricingSubmitHistoryTitle(proposal, entry.title),
    eventId: buildPricingApprovalEntryId(entry),
    status: entry.status || PRICING_FI_SUPERVISOR_REVIEW_STATUS,
    displayStatus: entry.displayStatus || entry.status || PRICING_FI_SUPERVISOR_REVIEW_STATUS,
    time: entry.time,
    user: entry.user,
    note: entry.note,
    lifecycle,
  };
};

export const buildPricingUnifiedHistory = (
  proposal: any,
): PricingUnifiedHistoryEntry[] => {
  const normalizedStatus = normalizePricingProposalApprovalStatus(proposal);
  const approvalHistory = normalizePricingApprovalHistory(proposal, null, null, normalizedStatus);
  const legalHistory = getPricingLegalHistory(proposal);

  const approvalEntries = approvalHistory.map((entry, index) => (
    buildPricingApprovalUnifiedHistoryEntry(proposal, entry, index)
  ));
  const legalEntries = legalHistory.map((entry, index) => ({
    key: `${buildPricingLegalEntryId(entry)}-${index}`,
    stage: 'legal' as const,
    stageLabel: 'Legal',
    title: getPricingLegalHistoryTitle(entry.status),
    eventId: buildPricingLegalEntryId(entry),
    status: entry.status,
    displayStatus: entry.displayStatus || entry.status,
    time: entry.time,
    user: entry.user,
    note: entry.note,
    lifecycle: entry.lifecycle,
    terminalDecision: entry.terminalDecision,
  }));

  return [...approvalEntries, ...legalEntries]
    .filter((entry) => entry.time)
    .sort((left, right) => (
      resolveApprovalHistoryTimestamp(right.time) - resolveApprovalHistoryTimestamp(left.time)
    ));
};

export const getLatestVisiblePricingUnifiedHistoryEntry = (proposal: any) => (
  buildPricingUnifiedHistory(proposal).find((entry) => entry.lifecycle?.state !== 'revoked') || null
);

const buildPricingSubmissionHistoryEntry = (
  pricingProposals: any[] = [],
  fallbackEntry?: any,
) => {
  const hasRecordedHistory = pricingProposals.some((proposal: any) => buildPricingUnifiedHistory(proposal).length > 0);
  const latestEvent = pricingProposals
    .flatMap((proposal: any) => {
      const latestVisibleEntry = getLatestVisiblePricingUnifiedHistoryEntry(proposal);
      if (!latestVisibleEntry) return [];

      return [{
        date: latestVisibleEntry.time,
        user: latestVisibleEntry.user,
        notes: latestVisibleEntry.note || '',
        proposalId: proposal?.id || null,
        proposalName: proposal?.customProposalType || 'Pricing Schedule',
      }];
    })
    .sort((left, right) => (
      resolveApprovalHistoryTimestamp(right.date) - resolveApprovalHistoryTimestamp(left.date)
    ))[0];

  if (latestEvent) {
    return createHistoryEntry(latestEvent);
  }

  if (hasRecordedHistory) {
    return createHistoryEntry();
  }

  return createHistoryEntry(fallbackEntry);
};

export const getLatestPricingApprovalHistoryEvent = (
  proposal: any,
  type?: PricingApprovalHistoryType,
) => {
  const normalizedStatus = normalizePricingProposalApprovalStatus(proposal);
  const history = normalizePricingApprovalHistory(proposal, null, null, normalizedStatus);
  const visibleHistory = history.filter((entry) => entry.lifecycle?.state !== 'revoked');
  const filteredHistory = type ? visibleHistory.filter((entry) => entry.type === type) : visibleHistory;
  if (!filteredHistory.length) return null;

  return [...filteredHistory].sort((left, right) => (
    resolveApprovalHistoryTimestamp(right.time) - resolveApprovalHistoryTimestamp(left.time)
  ))[0];
};

const getPricingPendingHandoff = (proposal: any) => (
  normalizePendingHandoff(proposal?.pendingHandoff)
);

const buildPricingLegalEntryId = (entry: PricingLegalHistoryEntry) => (
  `legal:${entry.status}:${entry.time}:${entry.user}`
);

const isPricingLegalDecisionStatus = (status: string) => (
  status === PRICING_COMPLETED_STATUS || status === PRICING_CORRIDOR_REVIEW_STATUS
);

const resolvePricingLegalTerminalDecision = (
  entry: PricingLegalHistoryEntry | null | undefined,
) => {
  if (!entry || !isPricingLegalDecisionStatus(entry.status)) return null;

  return entry.terminalDecision || recordTerminalDecision({
    decisionEventId: buildPricingLegalEntryId(entry),
    revocableByActor: entry.user || 'Legal Team',
    previousStatus: PRICING_LEGAL_REVIEW_STATUS,
    previousQueueState: 'legal_pending',
  });
};

const updatePricingApprovalEntryByIdentity = (
  entries: PricingApprovalHistoryEntry[],
  targetId: string | undefined,
  updater: (entry: PricingApprovalHistoryEntry) => PricingApprovalHistoryEntry,
) => {
  if (!targetId) return entries;
  return entries.map((entry) => {
    const entryId = `${entry.type}:${entry.time}:${entry.user}`;
    return entryId === targetId ? updater(entry) : entry;
  });
};

const buildPricingApprovalEntryId = (entry: PricingApprovalHistoryEntry) => (
  `${entry.type}:${entry.time}:${entry.user}`
);

const createPricingApprovalHistoryEntry = (
  type: PricingApprovalHistoryType,
  time: string,
  user: string,
  note: string,
  options: {
    title?: string;
    status?: string;
    lifecycle?: TimelineLifecycle;
    terminalDecision?: TerminalDecisionMeta | null;
  } = {},
): PricingApprovalHistoryEntry => ({
  type,
  time,
  user,
  note,
  title: options.title,
  status: options.status,
  lifecycle: options.lifecycle,
  terminalDecision: options.terminalDecision || null,
});

export const getPricingRevocableAction = (
  proposal: any,
  actorRole: WorkflowRole | null | undefined,
  actorName: string,
): RevocableAction | null => {
  const latestVisibleUnifiedEntry = getLatestVisiblePricingUnifiedHistoryEntry(proposal);
  if (!latestVisibleUnifiedEntry) return null;

  if (actorRole === 'FIOP' && latestVisibleUnifiedEntry.stage !== 'pricing') return null;
  if (actorRole === 'FI Supervisor' && latestVisibleUnifiedEntry.stage !== 'fi_supervisor') return null;
  if (actorRole === 'Legal') {
    if (latestVisibleUnifiedEntry.stage !== 'legal') return null;

    const latestLegalEvent = getLatestPricingLegalHistoryEvent(proposal);
    if (!latestLegalEvent) return null;

    const eventId = buildPricingLegalEntryId(latestLegalEvent);
    if (eventId !== latestVisibleUnifiedEntry.eventId) return null;

    return getRevocableAction({
      terminalDecision: resolvePricingLegalTerminalDecision(latestLegalEvent),
      actorRole,
      actorName,
      eventId,
      isLatestEvent: true,
    });
  }

  const latestVisibleEvent = getLatestPricingApprovalHistoryEvent(proposal);
  if (!latestVisibleEvent) return null;

  const pendingHandoff = getPricingPendingHandoff(proposal);

  return getRevocableAction({
    pendingHandoff,
    terminalDecision: latestVisibleEvent.terminalDecision,
    actorRole,
    actorName,
    eventId: buildPricingApprovalEntryId(latestVisibleEvent),
    isLatestEvent: true,
  });
};

export const applyPricingSubmission = (
  channel: any,
  proposalId: string,
  actorName: string,
  timestamp: string,
  note = '',
) => {
  const nextProposals = sortPricingProposalsByUpdatedAt(
    rawPricingProposalsFromChannel(channel).map((proposal: any) => {
      if (proposal.id !== proposalId) return proposal;

      const normalizedAttachments = normalizePricingAttachments(
        Array.isArray(proposal?.attachments) && proposal.attachments.length
          ? proposal.attachments
          : proposal?.legalRequestPacket?.attachments,
      );
      const pendingHandoff = isPendingHandoffActive(getPricingPendingHandoff(proposal))
        ? getPricingPendingHandoff(proposal)
        : null;
      let approvalHistory = normalizePricingApprovalHistory(
        proposal,
        null,
        null,
        normalizePricingProposalApprovalStatus(proposal),
      );

      if (pendingHandoff && pendingHandoff.receiverRole === 'FIOP') {
        approvalHistory = updatePricingApprovalEntryByIdentity(
          approvalHistory,
          pendingHandoff.originEventId,
          (entry) => ({
            ...entry,
            lifecycle: markLifecycleConsumed(entry.lifecycle),
          }),
        );
      }

      const currentLegalStatus = normalizePricingLegalStatus(proposal?.legalStatus);
      const submitDirectlyToLegal = currentLegalStatus === PRICING_CORRIDOR_REVIEW_STATUS;
      const nextStatus = submitDirectlyToLegal
        ? PRICING_LEGAL_REVIEW_STATUS
        : PRICING_FI_SUPERVISOR_REVIEW_STATUS;
      const nextReceiverRole = submitDirectlyToLegal ? 'Legal' : 'FI Supervisor';
      const historyNote = note || proposal.remark || 'Pricing schedule submitted for review.';
      const entry = createPricingApprovalHistoryEntry(
        'submit',
        timestamp,
        actorName,
        historyNote,
        {
          title: buildPricingSubmitHistoryTitle(proposal),
          status: nextStatus,
          lifecycle: createHandoffLifecycle(),
        },
      );
      const nextPendingHandoff = createPendingHandoff({
        flowType: 'pricing',
        flowKey: proposalId,
        senderRole: 'FIOP',
        senderName: actorName,
        receiverRole: nextReceiverRole,
        createdAt: timestamp,
        sourceStatus: submitDirectlyToLegal ? currentLegalStatus : normalizePricingProposalApprovalStatus(proposal),
        targetStatus: nextStatus,
        originEventId: buildPricingApprovalEntryId(entry),
        payloadSnapshot: {
          link: proposal.link,
          remark: proposal.remark,
          attachments: normalizedAttachments,
          paymentMethods: proposal.paymentMethods,
        },
      });

      return {
        ...proposal,
        attachments: normalizedAttachments,
        approvalStatus: submitDirectlyToLegal
          ? normalizePricingProposalApprovalStatus(proposal)
          : PRICING_FI_SUPERVISOR_REVIEW_STATUS,
        legalStatus: submitDirectlyToLegal ? PRICING_LEGAL_REVIEW_STATUS : normalizePricingLegalStatus(proposal?.legalStatus),
        legalUpdatedAt: submitDirectlyToLegal ? timestamp : proposal?.legalUpdatedAt,
        legalUpdatedBy: submitDirectlyToLegal ? actorName : proposal?.legalUpdatedBy,
        updatedAt: timestamp,
        approvalHistory: [...approvalHistory, entry],
        legalRequestPacket: {
          ...(proposal?.legalRequestPacket || {}),
          documentLink: String(proposal?.link || '').trim(),
          remarks: String(proposal?.remark || '').trim(),
          attachments: normalizedAttachments,
          submittedAt: timestamp,
          submittedBy: actorName,
        },
        pendingHandoff: nextPendingHandoff,
      };
    }),
  );

  const aggregateStatus = aggregatePricingProposalStatus(nextProposals);
  const proposal = nextProposals.find((item: any) => item.id === proposalId);

  return {
    ...channel,
    lastModifiedAt: timestamp,
    pricingProposals: nextProposals,
    pricingProposalStatus: aggregateStatus,
    globalProgress: {
      ...(channel?.globalProgress || {}),
      pricing: aggregateStatus,
    },
    submissionHistory: {
      ...(channel?.submissionHistory || {}),
      pricing: {
        date: timestamp,
        user: actorName,
        notes: note || proposal?.remark || 'Pricing schedule submitted for review.',
        proposalId,
        proposalName: proposal?.customProposalType || 'Pricing Schedule',
      },
    },
  };
};

export const applyPricingApprovalDecision = (
  channel: any,
  proposalId: string,
  type: 'approve' | 'request_changes',
  actorName: string,
  timestamp: string,
  note = '',
) => {
  const nextProposals = sortPricingProposalsByUpdatedAt(
    rawPricingProposalsFromChannel(channel).map((proposal: any) => {
      if (proposal.id !== proposalId) return proposal;

      const normalizedAttachments = normalizePricingAttachments(
        Array.isArray(proposal?.attachments) && proposal.attachments.length
          ? proposal.attachments
          : proposal?.legalRequestPacket?.attachments,
      );
      const pendingHandoff = isPendingHandoffActive(getPricingPendingHandoff(proposal))
        ? getPricingPendingHandoff(proposal)
        : null;
      let approvalHistory = normalizePricingApprovalHistory(
        proposal,
        null,
        null,
        normalizePricingProposalApprovalStatus(proposal),
      );

      if (pendingHandoff && pendingHandoff.receiverRole === 'FI Supervisor') {
        approvalHistory = updatePricingApprovalEntryByIdentity(
          approvalHistory,
          pendingHandoff.originEventId,
          (entry) => ({
            ...entry,
            lifecycle: markLifecycleConsumed(entry.lifecycle),
          }),
        );
      }

      const previousStatus = normalizePricingProposalApprovalStatus(proposal);
      const nextStatus = type === 'approve' ? PRICING_LEGAL_REVIEW_STATUS : PRICING_CORRIDOR_REVIEW_STATUS;
      let entry = createPricingApprovalHistoryEntry(
        type,
        timestamp,
        actorName,
        note,
        {
          title: type === 'approve' ? 'Approved by FI Supervisor' : 'Returned by FI Supervisor',
          status: nextStatus,
          lifecycle: createHandoffLifecycle(),
        },
      );
      const terminalDecision = recordTerminalDecision({
        decisionEventId: buildPricingApprovalEntryId(entry),
        revocableByActor: actorName,
        previousStatus,
        previousQueueState: getPricingApprovalQueueTab(previousStatus),
      });
      entry = {
        ...entry,
        terminalDecision,
      };
      const nextPendingHandoff = createPendingHandoff({
        flowType: 'pricing',
        flowKey: proposalId,
        senderRole: 'FI Supervisor',
        senderName: actorName,
        receiverRole: type === 'approve' ? 'Legal' : 'FIOP',
        createdAt: timestamp,
        sourceStatus: previousStatus,
        targetStatus: nextStatus,
        originEventId: buildPricingApprovalEntryId(entry),
        payloadSnapshot: {
          link: proposal.link,
          remark: proposal.remark,
          attachments: normalizedAttachments,
          paymentMethods: proposal.paymentMethods,
        },
      });

      return {
        ...proposal,
        attachments: normalizedAttachments,
        approvalStatus: nextStatus,
        legalStatus: type === 'approve' ? PRICING_LEGAL_REVIEW_STATUS : '',
        legalUpdatedAt: type === 'approve' ? timestamp : proposal?.legalUpdatedAt,
        legalUpdatedBy: type === 'approve' ? actorName : proposal?.legalUpdatedBy,
        updatedAt: timestamp,
        approvalHistory: [...approvalHistory, entry],
        pendingHandoff: nextPendingHandoff,
      };
    }),
  );

  const aggregateStatus = aggregatePricingProposalStatus(nextProposals);
  return {
    ...channel,
    lastModifiedAt: timestamp,
    pricingProposals: nextProposals,
    pricingProposalStatus: aggregateStatus,
    globalProgress: {
      ...(channel?.globalProgress || {}),
      pricing: aggregateStatus,
    },
  };
};

export const getPricingLegalStatusOptions = () => ([
  ...PRICING_LEGAL_QUEUE_STATUS_VALUES
    .filter((status) => status === PRICING_CORRIDOR_REVIEW_STATUS || status === PRICING_COMPLETED_STATUS)
    .map((status) => ({ label: status, value: status })),
]);

export const applyPricingLegalDecision = (
  channel: any,
  proposalId: string,
  nextStatus: string,
  actorName: string,
  timestamp: string,
  note = '',
) => {
  const normalizedNextStatus = normalizePricingLegalStatus(nextStatus);
  if (![PRICING_CORRIDOR_REVIEW_STATUS, PRICING_COMPLETED_STATUS].includes(normalizedNextStatus)) {
    return channel;
  }

  const normalizedLegalNote = normalizeWhitespace(note);
  const nextProposals = sortPricingProposalsByUpdatedAt(
    rawPricingProposalsFromChannel(channel).map((proposal: any) => {
      if (proposal.id !== proposalId) return proposal;

      let approvalHistory = normalizePricingApprovalHistory(
        proposal,
        null,
        null,
        normalizePricingProposalApprovalStatus(proposal),
      );
      const pendingHandoff = isPendingHandoffActive(getPricingPendingHandoff(proposal))
        ? getPricingPendingHandoff(proposal)
        : null;

      if (pendingHandoff && pendingHandoff.receiverRole === 'Legal') {
        approvalHistory = updatePricingApprovalEntryByIdentity(
          approvalHistory,
          pendingHandoff.originEventId,
          (entry) => ({
            ...entry,
            lifecycle: markLifecycleConsumed(entry.lifecycle),
          }),
        );
      }

      const statusNote = normalizedLegalNote;
      const previousStatus = getPricingLegalStageStatus(proposal);
      let legalEntry: PricingLegalHistoryEntry = {
        time: timestamp,
        user: actorName || 'Legal Team',
        status: normalizedNextStatus,
        note: statusNote,
        lifecycle: normalizedNextStatus === PRICING_CORRIDOR_REVIEW_STATUS
          ? createHandoffLifecycle()
          : undefined,
      };
      legalEntry = {
        ...legalEntry,
        terminalDecision: recordTerminalDecision({
          decisionEventId: buildPricingLegalEntryId(legalEntry),
          revocableByActor: actorName || 'Legal Team',
          previousStatus,
          previousQueueState: getPricingLegalQueueGroup(proposal),
        }),
      };

      return {
        ...proposal,
        approvalStatus: normalizePricingProposalApprovalStatus(proposal),
        legalStatus: normalizedNextStatus,
        legalHistory: [legalEntry, ...normalizePricingLegalHistory(proposal)],
        legalUpdatedAt: timestamp,
        legalUpdatedBy: actorName || 'Legal Team',
        legalNote: statusNote,
        updatedAt: timestamp,
        approvalHistory,
        pendingHandoff: null,
      };
    }),
  );

  const aggregateStatus = aggregatePricingProposalStatus(nextProposals);
  const proposal = nextProposals.find((item: any) => item.id === proposalId);

  return {
    ...channel,
    lastModifiedAt: timestamp,
    pricingProposals: nextProposals,
    pricingProposalStatus: aggregateStatus,
    globalProgress: {
      ...(channel?.globalProgress || {}),
      pricing: aggregateStatus,
    },
    submissionHistory: {
      ...(channel?.submissionHistory || {}),
      pricing: {
        date: timestamp,
        user: actorName || 'Legal Team',
        notes: normalizedLegalNote,
        proposalId,
        proposalName: proposal?.customProposalType || 'Pricing Schedule',
      },
    },
  };
};

export const revokePricingPendingHandoff = (
  channel: any,
  proposalId: string,
  actorRole: WorkflowRole,
  _actorName: string,
  timestamp: string,
  _reason = '',
) => {
  const nextProposals = sortPricingProposalsByUpdatedAt(
    rawPricingProposalsFromChannel(channel).map((proposal: any) => {
      if (proposal.id !== proposalId) return proposal;

      const pendingHandoff = isPendingHandoffActive(getPricingPendingHandoff(proposal))
        ? getPricingPendingHandoff(proposal)
        : null;
      if (!pendingHandoff || pendingHandoff.senderRole !== actorRole) {
        return proposal;
      }

      const approvalHistory = normalizePricingApprovalHistory(
        proposal,
        null,
        null,
        normalizePricingProposalApprovalStatus(proposal),
      );
      const restoredStatus = normalizePricingStatusToken(pendingHandoff.sourceStatus || 'Not Started');
      const restoresLegalStatus = pendingHandoff.receiverRole === 'Legal';
      const nextHistory = updatePricingApprovalEntryByIdentity(
        approvalHistory,
        pendingHandoff.originEventId,
        (entry) => ({
          ...entry,
          displayStatus: restoredStatus,
          lifecycle: markLifecycleRevoked(entry.lifecycle),
        }),
      );

      return {
        ...proposal,
        approvalStatus: restoresLegalStatus
          ? normalizePricingProposalApprovalStatus(proposal)
          : restoredStatus,
        legalStatus: restoresLegalStatus
          ? normalizePricingLegalStatus(restoredStatus)
          : proposal?.legalStatus,
        updatedAt: timestamp,
        approvalHistory: nextHistory,
        pendingHandoff: null,
      };
    }),
  );

  const aggregateStatus = aggregatePricingProposalStatus(nextProposals);
  return {
    ...channel,
    lastModifiedAt: timestamp,
    pricingProposals: nextProposals,
    pricingProposalStatus: aggregateStatus,
    globalProgress: {
      ...(channel?.globalProgress || {}),
      pricing: aggregateStatus,
    },
  };
};

export const revokePricingSupervisorDecision = (
  channel: any,
  proposalId: string,
  actorName: string,
  timestamp: string,
  reason = '',
) => {
  const nextProposals = sortPricingProposalsByUpdatedAt(
    rawPricingProposalsFromChannel(channel).map((proposal: any) => {
      if (proposal.id !== proposalId) return proposal;

      const latestVisibleUnifiedEntry = getLatestVisiblePricingUnifiedHistoryEntry(proposal);
      if (latestVisibleUnifiedEntry?.stage !== 'fi_supervisor') {
        return proposal;
      }

      const approvalHistory = normalizePricingApprovalHistory(
        proposal,
        null,
        null,
        normalizePricingProposalApprovalStatus(proposal),
      );
      const latestVisibleEvent = [...approvalHistory]
        .filter((entry) => entry.lifecycle?.state !== 'revoked')
        .sort((left, right) => (
          resolveApprovalHistoryTimestamp(right.time) - resolveApprovalHistoryTimestamp(left.time)
        ))[0] || null;
      const terminalDecision = latestVisibleEvent?.terminalDecision || null;

      if (
        !latestVisibleEvent
        || !terminalDecision
        || !terminalDecision.revocable
        || terminalDecision.revocableByActor !== actorName
      ) {
        return proposal;
      }

      const restoredStatus = normalizePricingStatusToken(terminalDecision.previousStatus || 'Not Started');
      const revokedDecision = revokeTerminalDecision(
        terminalDecision,
        actorName,
        reason || `Restored ${restoredStatus} after pricing supervisor status revoke.`,
        timestamp,
      );
      const nextHistory = updatePricingApprovalEntryByIdentity(
        approvalHistory,
        buildPricingApprovalEntryId(latestVisibleEvent),
        (entry) => ({
          ...entry,
          displayStatus: restoredStatus,
          lifecycle: markLifecycleRevoked(entry.lifecycle),
          terminalDecision: revokedDecision,
        }),
      );

      return {
        ...proposal,
        approvalStatus: restoredStatus,
        legalStatus: latestVisibleEvent.type === 'approve' ? '' : proposal?.legalStatus,
        legalUpdatedAt: latestVisibleEvent.type === 'approve' ? '' : proposal?.legalUpdatedAt,
        legalUpdatedBy: latestVisibleEvent.type === 'approve' ? '' : proposal?.legalUpdatedBy,
        updatedAt: timestamp,
        approvalHistory: nextHistory,
        pendingHandoff: null,
      };
    }),
  );

  const aggregateStatus = aggregatePricingProposalStatus(nextProposals);
  return {
    ...channel,
    lastModifiedAt: timestamp,
    pricingProposals: nextProposals,
    pricingProposalStatus: aggregateStatus,
    globalProgress: {
      ...(channel?.globalProgress || {}),
      pricing: aggregateStatus,
    },
  };
};

export const revokePricingLegalDecision = (
  channel: any,
  proposalId: string,
  actorName: string,
  timestamp: string,
  reason = '',
) => {
  const normalizedActorName = String(actorName || '').trim();
  const nextProposals = sortPricingProposalsByUpdatedAt(
    rawPricingProposalsFromChannel(channel).map((proposal: any) => {
      if (proposal.id !== proposalId) return proposal;

      const latestVisibleUnifiedEntry = getLatestVisiblePricingUnifiedHistoryEntry(proposal);
      if (latestVisibleUnifiedEntry?.stage !== 'legal') {
        return proposal;
      }

      const legalHistory = normalizePricingLegalHistory(proposal);
      const latestVisibleLegalEvent = legalHistory.find((entry) => entry.lifecycle?.state !== 'revoked') || null;
      if (!latestVisibleLegalEvent) {
        return proposal;
      }

      const latestLegalEventId = buildPricingLegalEntryId(latestVisibleLegalEvent);
      if (latestLegalEventId !== latestVisibleUnifiedEntry.eventId) {
        return proposal;
      }

      const terminalDecision = resolvePricingLegalTerminalDecision(latestVisibleLegalEvent);
      if (
        !terminalDecision
        || !terminalDecision.revocable
        || terminalDecision.revocableByActor !== normalizedActorName
      ) {
        return proposal;
      }

      const restoredStatus = normalizePricingLegalStatus(terminalDecision.previousStatus)
        || normalizePricingStatusToken(terminalDecision.previousStatus || PRICING_LEGAL_REVIEW_STATUS);
      const revokedDecision = revokeTerminalDecision(
        terminalDecision,
        normalizedActorName,
        reason || `Restored ${restoredStatus} after pricing legal status revoke.`,
        timestamp,
      );
      const nextLegalHistory = legalHistory.map((entry) => (
        buildPricingLegalEntryId(entry) === latestLegalEventId
          ? {
              ...entry,
              displayStatus: restoredStatus,
              lifecycle: markLifecycleRevoked(entry.lifecycle),
              terminalDecision: revokedDecision,
            }
          : entry
      ));

      return {
        ...proposal,
        legalStatus: restoredStatus === 'Not Started' ? '' : restoredStatus,
        legalHistory: nextLegalHistory,
        legalUpdatedAt: timestamp,
        legalUpdatedBy: normalizedActorName || 'Legal Team',
        legalNote: reason || `Restored ${restoredStatus} after pricing legal status revoke.`,
        updatedAt: timestamp,
        pendingHandoff: null,
      };
    }),
  );

  const aggregateStatus = aggregatePricingProposalStatus(nextProposals);
  return {
    ...channel,
    lastModifiedAt: timestamp,
    pricingProposals: nextProposals,
    pricingProposalStatus: aggregateStatus,
    globalProgress: {
      ...(channel?.globalProgress || {}),
      pricing: aggregateStatus,
    },
  };
};

export const buildPricingScheduleSummary = (pricingProposals: any[] = []) => {
  if (!Array.isArray(pricingProposals) || pricingProposals.length === 0) {
    return '';
  }

  const summary = pricingProposals.reduce((accumulator, proposal) => {
    const status = getPricingLegalStageStatus(proposal);
    if (status === PRICING_COMPLETED_STATUS) {
      accumulator.completed += 1;
    } else if (status === PRICING_LEGAL_REVIEW_STATUS) {
      accumulator.legalReview += 1;
    } else if (status === PRICING_FI_SUPERVISOR_REVIEW_STATUS) {
      accumulator.supervisorReview += 1;
    } else if (status === PRICING_CORRIDOR_REVIEW_STATUS) {
      accumulator.corridorReview += 1;
    } else {
      accumulator.notStarted += 1;
    }
    return accumulator;
  }, { completed: 0, legalReview: 0, supervisorReview: 0, corridorReview: 0, notStarted: 0 });

  return [
    summary.legalReview ? `${summary.legalReview} ${PRICING_LEGAL_REVIEW_STATUS}` : '',
    summary.supervisorReview ? `${summary.supervisorReview} ${PRICING_FI_SUPERVISOR_REVIEW_STATUS}` : '',
    summary.corridorReview ? `${summary.corridorReview} ${PRICING_CORRIDOR_REVIEW_STATUS}` : '',
    summary.completed ? `${summary.completed} ${PRICING_COMPLETED_STATUS}` : '',
    summary.notStarted ? `${summary.notStarted} Not Started` : '',
  ].filter(Boolean).join(' / ');
};

const aggregatePricingProposalStatus = (pricingProposals: any[] = []) => {
  if (!Array.isArray(pricingProposals) || pricingProposals.length === 0) {
    return 'Not Started';
  }

  const normalizedStatuses = pricingProposals.map((proposal) => getPricingLegalStageStatus(proposal));

  if (normalizedStatuses.some((status) => status === PRICING_COMPLETED_STATUS)) return PRICING_COMPLETED_STATUS;

  if (normalizedStatuses.some((status) => status === PRICING_LEGAL_REVIEW_STATUS)) return PRICING_LEGAL_REVIEW_STATUS;

  if (normalizedStatuses.some((status) => status === PRICING_CORRIDOR_REVIEW_STATUS)) return PRICING_CORRIDOR_REVIEW_STATUS;

  if (normalizedStatuses.some((status) => status === PRICING_FI_SUPERVISOR_REVIEW_STATUS)) return PRICING_FI_SUPERVISOR_REVIEW_STATUS;

  return 'Not Started';
};

const resolvePricingProposalStatus = (channel: any, pricingProposals: any[] = []) => {
  if (pricingProposals.length > 0) {
    return aggregatePricingProposalStatus(pricingProposals);
  }

  return normalizeWorkflowStatusLabel(
    channel?.pricingProposalStatus || channel?.globalProgress?.pricing,
  );
};

const normalizeFiopTrackingEntries = (entries: any[] = []) => {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry, index) => ({
      id: entry?.id || `fiop-track-${index}`,
      time: entry?.time || '',
      remark: entry?.remark || '',
    }))
    .filter((entry) => entry.remark)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
};

const normalizeProposalPaymentMethods = (paymentMethods: any[] = []) => (
  Array.isArray(paymentMethods)
    ? paymentMethods.map((paymentMethod: any) => ({
        ...paymentMethod,
        method: normalizePaymentMethodName(paymentMethod?.method),
        settlement: normalizeSettlementConfig(paymentMethod?.settlement),
      }))
    : []
);

const normalizeBackendAccountText = (value: unknown) => String(value || '').trim();

const resolveBackendAccountEnvironmentType = (value: unknown) => {
  const normalized = normalizeBackendAccountText(value);
  const lower = normalized.toLowerCase();

  if (!normalized) return '';
  if (
    ['production', 'prod', 'live'].includes(lower)
    || normalized.includes('\u751f\u4ea7')
    || normalized.includes('\u6b63\u5f0f')
  ) {
    return 'Production';
  }
  if (
    ['test', 'testing', 'uat', 'sandbox'].includes(lower)
    || normalized.includes('\u6d4b\u8bd5')
  ) {
    return 'Test';
  }

  return '';
};

const extractBackendAccountEnvironmentFromLegacy = (value: unknown) => {
  const legacyValue = normalizeBackendAccountText(value);

  if (!legacyValue) {
    return {
      environmentType: '',
      environmentDetail: '',
    };
  }

  const rules = [
    {
      type: 'Production',
      exact: /^(production|prod|live)$/i,
      remove: /(production|prod|live|\u751f\u4ea7|\u6b63\u5f0f)/gi,
    },
    {
      type: 'Test',
      exact: /^(test|testing|uat|sandbox)$/i,
      remove: /(test|testing|uat|sandbox|\u6d4b\u8bd5)/gi,
    },
  ] as const;

  const matchedRule = rules.find((rule) => {
    if (rule.exact.test(legacyValue)) return true;
    return resolveBackendAccountEnvironmentType(legacyValue) === rule.type;
  });

  if (!matchedRule) {
    return {
      environmentType: '',
      environmentDetail: legacyValue,
    };
  }

  if (matchedRule.exact.test(legacyValue)) {
    return {
      environmentType: matchedRule.type,
      environmentDetail: '',
    };
  }

  const environmentDetail = legacyValue
    .replace(matchedRule.remove, ' ')
    .replace(/^[\s:\/|,_-]+/, '')
    .replace(/[\s:\/|,_-]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    environmentType: matchedRule.type,
    environmentDetail,
  };
};

const normalizeBackendAccounts = (backendAccounts: any[] = []) => (
  Array.isArray(backendAccounts)
    ? backendAccounts.map((row: any) => {
        const environmentType = resolveBackendAccountEnvironmentType(row?.environmentType);
        const environmentDetail = normalizeBackendAccountText(row?.environmentDetail);
        const legacyEnvironment = extractBackendAccountEnvironmentFromLegacy(row?.environment);

        return {
          environmentType: environmentType || legacyEnvironment.environmentType,
          environmentDetail: environmentDetail || legacyEnvironment.environmentDetail,
          legalName: normalizeBackendAccountText(row?.legalName),
          tradingName: normalizeBackendAccountText(row?.tradingName),
          address: normalizeBackendAccountText(row?.address),
          account: normalizeBackendAccountText(row?.account),
          password: normalizeBackendAccountText(row?.password),
          remark: normalizeBackendAccountText(row?.remark),
          loginMethod: normalizeBackendAccountText(row?.loginMethod),
          accountPurpose: normalizeBackendAccountText(row?.accountPurpose),
          permissionScope: normalizeBackendAccountText(row?.permissionScope),
          reviewStep: normalizeBackendAccountText(row?.reviewStep),
        };
      })
    : []
);

export const withChannelDefaults = (channel: any) => {
  const assignment = normalizeChannelAssignment(channel);
  const fiopCollaboratorNames = assignment.fiopCollaboratorUserIds.map((userId) => getAppUserDisplayName(userId)).filter(Boolean);
  const fibdCollaboratorNames = assignment.fibdCollaboratorUserIds.map((userId) => getAppUserDisplayName(userId)).filter(Boolean);
  const fiopTrackingEntries = normalizeFiopTrackingEntries(channel.fiopTrackingEntries);
  const latestTracking = fiopTrackingEntries[0];
  const wooshpayOnboarding = getChannelOnboardingWorkflow(channel, 'wooshpay');
  const corridorOnboarding = getChannelOnboardingWorkflow(channel, 'corridor');
  const wooshpayOnboardingStatus = getOnboardingStatusLabel('wooshpay', wooshpayOnboarding.status);
  const corridorOnboardingStatus = getOnboardingStatusLabel('corridor', corridorOnboarding.status);
  const complianceStatusKey = getAggregatedOnboardingStatusKey([
    wooshpayOnboarding.status,
    corridorOnboarding.status,
  ]);
  const kycOverview = getKycOverviewAggregate(channel);
  const complianceStatus = kycOverview.displayStatus;
  const rawPricingProposals = Array.isArray(channel.pricingProposals) ? channel.pricingProposals : [];
  const sharedPricingHistory = createHistoryEntry((channel.submissionHistory || {}).pricing);
  const migratedPricingProposalId = resolveMigratedPricingHistoryTarget(rawPricingProposals, sharedPricingHistory);
  const pricingProposals = rawPricingProposals.map((proposal: any) => {
    const normalizedApprovalStatus = normalizePricingProposalApprovalStatus(proposal, channel.pricingProposalStatus);
    const latestApproveEvent = getLatestPricingApprovalHistoryEvent(proposal, 'approve');
    const pendingHandoff = normalizePendingHandoff(proposal?.pendingHandoff);
    const normalizedAttachments = normalizePricingAttachments(
      Array.isArray(proposal?.legalRequestPacket?.attachments) && proposal.legalRequestPacket.attachments.length
        ? proposal.legalRequestPacket.attachments
        : proposal?.attachments,
    );
    return {
      ...proposal,
      approvalStatus: normalizedApprovalStatus,
      attachments: normalizedAttachments,
      paymentMethods: normalizeProposalPaymentMethods(proposal.paymentMethods),
      approvalHistory: normalizePricingApprovalHistory(
        proposal,
        migratedPricingProposalId,
        sharedPricingHistory,
        normalizedApprovalStatus,
      ),
      legalStatus: normalizePricingLegalStatus(proposal.legalStatus),
      legalHistory: normalizePricingLegalHistory(proposal),
      legalRequestPacket: {
        documentLink: String(proposal?.legalRequestPacket?.documentLink || proposal?.link || '').trim(),
        remarks: String(proposal?.legalRequestPacket?.remarks || proposal?.remark || '').trim(),
        attachments: normalizedAttachments,
        submittedAt: String(proposal?.legalRequestPacket?.submittedAt || latestApproveEvent?.time || '').trim(),
        submittedBy: String(proposal?.legalRequestPacket?.submittedBy || latestApproveEvent?.user || '').trim(),
      },
      legalUpdatedAt: String(proposal?.legalUpdatedAt || '').trim(),
      legalUpdatedBy: String(proposal?.legalUpdatedBy || '').trim(),
      pendingHandoff: isPendingHandoffActive(pendingHandoff) ? pendingHandoff : null,
    };
  });
  const ndaLegalRequestData = getLegalRequestPacket(channel, 'NDA');
  const msaLegalRequestData = getLegalRequestPacket(channel, 'MSA');
  const otherAttachmentsLegalRequestData = getLegalRequestPacket(channel, 'OTHER_ATTACHMENTS');
  const ndaLegalStatusHistory = getLegalStatusHistory(channel, 'NDA');
  const msaLegalStatusHistory = getLegalStatusHistory(channel, 'MSA');
  const otherAttachmentsLegalStatusHistory = getLegalStatusHistory(channel, 'OTHER_ATTACHMENTS');
  const ndaStatus = normalizeNdaStatusLabel(channel.ndaStatus || channel.globalProgress?.nda);
  const contractStatus = normalizeMsaStatusLabel(channel.contractStatus || channel.globalProgress?.contract);
  const otherAttachmentsStatus = normalizeMsaStatusLabel(channel.otherAttachmentsStatus || channel.globalProgress?.otherAttachments);
  const pricingProposalStatus = resolvePricingProposalStatus(channel, pricingProposals);
  const techStatus = normalizeWorkflowStatusLabel(channel.techStatus || channel.globalProgress?.tech);
  const normalizedProgress = {
    ...(channel.globalProgress || {}),
    kyc: complianceStatus,
    nda: ndaStatus,
    contract: contractStatus,
    otherAttachments: otherAttachmentsStatus,
    pricing: pricingProposalStatus,
    tech: techStatus,
  };
  const launchApproval = normalizeLaunchApproval(channel.launchApproval, {
    ...channel,
    wooshpayOnboarding,
    corridorOnboarding,
    ndaStatus,
    contractStatus,
    otherAttachmentsStatus,
    pricingProposals,
    pricingProposalStatus,
    techStatus,
    globalProgress: normalizedProgress,
  });

  return {
    ...channel,
    assignment,
    auditLogs: normalizeAuditLogs(channel.auditLogs),
    merchantGeoAllowed: channel.merchantGeoAllowed || channel.merchantGeo || [],
    merchantPolicyLink: channel.merchantPolicyLink || '',
    merchantPolicyRemark: channel.merchantPolicyRemark || '',
    merchantMidDetails: channel.merchantMidDetails || '',
    backendAccounts: normalizeBackendAccounts(channel.backendAccounts),
    fundProfile: normalizeFundProfile(channel.fundProfile),
    fundApproval: normalizeFundApproval(channel.fundApproval),
    launchApproval,
    paymentMethods: Array.isArray(channel.paymentMethods)
      ? channel.paymentMethods.map((paymentMethod: string) => normalizePaymentMethodName(paymentMethod))
      : [],
    wooshpayOnboarding,
    corridorOnboarding,
    wooshpayOnboardingStatus,
    corridorOnboardingStatus,
    complianceStatus,
    complianceStatusKey,
    submissionHistory: createSubmissionHistory({
      ...(channel.submissionHistory || {}),
      cdd: buildOnboardingHistoryEntry('corridor', corridorOnboarding),
      kyc: buildOnboardingHistoryEntry('wooshpay', wooshpayOnboarding),
      nda: buildLegalSubmissionHistoryEntry(channel, 'NDA', ndaLegalStatusHistory),
      msa: buildLegalSubmissionHistoryEntry(channel, 'MSA', msaLegalStatusHistory),
      otherAttachments: buildLegalSubmissionHistoryEntry(channel, 'OTHER_ATTACHMENTS', otherAttachmentsLegalStatusHistory),
      pricing: buildPricingSubmissionHistoryEntry(pricingProposals, sharedPricingHistory),
    }),
    legalRequestData: {
      ...(channel.legalRequestData || {}),
      nda: ndaLegalRequestData,
      msa: msaLegalRequestData,
      otherAttachments: otherAttachmentsLegalRequestData,
    },
    legalStatusHistory: {
      ...(channel.legalStatusHistory || {}),
      nda: ndaLegalStatusHistory,
      msa: msaLegalStatusHistory,
      otherAttachments: otherAttachmentsLegalStatusHistory,
    },
    ndaStatus,
    contractStatus,
    otherAttachmentsStatus,
    pricingProposals,
    pricingProposalStatus,
    techStatus,
    globalProgress: normalizedProgress,
    fiopOwner: getAppUserDisplayName(assignment.primaryFiopUserId, channel.fiopOwner || 'Unassigned'),
    fibdOwner: getAppUserDisplayName(assignment.primaryFibdUserId),
    fiopCollaboratorNames,
    fibdCollaboratorNames,
    fiopTrackingEntries,
    fiopTrackingLatestTime: latestTracking?.time || '',
    fiopTrackingLatest: latestTracking ? `${latestTracking.time} ${latestTracking.remark}` : '',
  };
};

export const buildPricingApprovalQueueRows = (channels: any[] = []): PricingApprovalQueueRow[] => (
  channels.reduce<PricingApprovalQueueRow[]>((rows, channel) => {
    const proposals = Array.isArray(channel?.pricingProposals) ? channel.pricingProposals : [];
    proposals.forEach((proposal: any) => {
      if (!proposal || typeof proposal !== 'object') return;

      const normalizeQueueText = (value: unknown, fallback = '') => {
        if (typeof value === 'string') {
          const normalized = value.trim();
          return normalized || fallback;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
          return String(value);
        }
        return fallback;
      };

      const stageStatus = getPricingLegalStageStatus(proposal);
      const queueTab = getPricingApprovalQueueTab(stageStatus);
      if (!queueTab) return;

      const latestSubmitEvent = getLatestPricingApprovalHistoryEvent(proposal, 'submit');
      const latestVisibleEvent = getLatestVisiblePricingUnifiedHistoryEntry(proposal);
      const latestReviewEvent = queueTab === 'approved'
        ? getLatestPricingApprovalHistoryEvent(proposal, 'approve')
        : queueTab === 'changes_requested'
          ? getLatestPricingApprovalHistoryEvent(proposal, 'request_changes')
          : latestSubmitEvent;
      const fallbackEvent = latestVisibleEvent
        || latestReviewEvent
        || latestSubmitEvent
        || {
          time: normalizeQueueText(proposal?.updatedAt || channel?.lastModifiedAt, ''),
          user: queueTab === 'pending'
            ? normalizeQueueText(channel?.fiopOwner, 'Current User')
            : 'System',
          note: '',
        };
      const submittedAt = normalizeQueueText(
        latestSubmitEvent?.time || proposal?.updatedAt || channel?.lastModifiedAt,
        '',
      );
      const latestActionAt = queueTab === 'pending'
        ? submittedAt
        : normalizeQueueText(latestVisibleEvent?.time || latestReviewEvent?.time || fallbackEvent.time || submittedAt, submittedAt);
      if (!latestActionAt) return;

      const proposalId = normalizeQueueText(proposal.id, '');
      const fiOwner = normalizeQueueText(channel?.fiopOwner, 'Unassigned');
      const fallbackChannelId = normalizeQueueText(channel?.channelId, 'channel');

      rows.push({
        id: `${normalizeQueueText(channel?.id, fallbackChannelId)}-${proposalId || 'proposal'}`,
        channel,
        proposalId,
        corridorName: normalizeQueueText(channel?.channelName, 'Unnamed Corridor'),
        quotationName: normalizeQueueText(proposal.customProposalType, 'Pricing Schedule'),
        cooperationMode: normalizeQueueText(proposal.mode, 'N/A'),
        fiOwner,
        submittedAt,
        status: stageStatus,
        queueTab,
        latestActionAt,
        latestActionUser: queueTab === 'pending'
          ? normalizeQueueText(latestSubmitEvent?.user || fallbackEvent.user || fiOwner, 'Current User')
          : normalizeQueueText(latestVisibleEvent?.user || latestReviewEvent?.user || fallbackEvent.user, 'System'),
        latestActionNote: queueTab === 'pending'
          ? normalizeQueueText(latestSubmitEvent?.note, '')
          : normalizeQueueText(latestVisibleEvent?.note || latestReviewEvent?.note || fallbackEvent.note, ''),
        paymentMethodCount: Array.isArray(proposal.paymentMethods) ? proposal.paymentMethods.length : 0,
      });
    });

    return rows;
  }, []).sort((left, right) => (
    resolveApprovalHistoryTimestamp(right.latestActionAt) - resolveApprovalHistoryTimestamp(left.latestActionAt)
  ))
);

export const getLaunchApprovalQueueTab = (status: LaunchApprovalStatus | string): LaunchApprovalQueueTab | null => {
  const normalized = normalizeLaunchApprovalStatus(status);
  if (normalized === 'under_fi_supervisor_review') return 'pending';
  if (normalized === 'supervisor_returned') return 'returned';
  if (normalized === 'live') return 'live';
  return null;
};

export const buildLaunchApprovalQueueRows = (channels: any[] = []): LaunchApprovalQueueRow[] => (
  channels.reduce<LaunchApprovalQueueRow[]>((rows, channel) => {
    const approval = normalizeLaunchApproval(channel?.launchApproval, channel);
    const queueTab = getLaunchApprovalQueueTab(approval.status);
    if (!queueTab) return rows;

    const latestHistory = approval.history[0] || null;
    const latestActionAt = latestHistory?.time
      || approval.supervisorDecisionAt
      || approval.fundDecisionAt
      || approval.submittedAt
      || normalizeWhitespace(channel?.lastModifiedAt);
    if (!latestActionAt) return rows;

    rows.push({
      id: `launch-${normalizeWhitespace(channel?.id || channel?.channelId || channel?.channelName)}`,
      channel,
      corridorName: normalizeWhitespace(channel?.channelName) || 'Unnamed Corridor',
      cooperationMode: Array.isArray(channel?.cooperationModel)
        ? channel.cooperationModel.map((item: unknown) => normalizeWhitespace(item)).filter(Boolean).join(', ') || 'N/A'
        : normalizeWhitespace(channel?.cooperationModel) || 'N/A',
      fiOwner: normalizeWhitespace(channel?.fiopOwner) || 'Unassigned',
      submittedAt: approval.submittedAt,
      status: approval.status,
      queueTab,
      latestActionAt,
      latestActionUser: latestHistory?.actor || approval.supervisorDecisionBy || approval.fundDecisionBy || approval.submittedBy || 'System',
      latestActionNote: latestHistory?.note || approval.supervisorNote || approval.fundNote || '',
      fundDecisionAt: approval.fundDecisionAt,
      fundDecisionBy: approval.fundDecisionBy,
      prerequisiteSnapshot: buildLaunchPrerequisiteSnapshot(channel),
      blocked: isLaunchApprovalBlocked(channel),
    });

    return rows;
  }, []).sort((left, right) => (
    resolveApprovalHistoryTimestamp(right.latestActionAt) - resolveApprovalHistoryTimestamp(left.latestActionAt)
  ))
);

export const createTechStepsData = (variant = 'notStarted') => {
  const steps = [
    { title: 'Test Environment Setup', status: 'process', isFIOPTask: true, data: {}, tasks: [] as any[] },
    { title: 'Development and User Acceptance Testing', status: 'wait', isFIOPTask: false, data: {}, tasks: [{ label: 'Integration Development Completed', checked: false }, { label: 'Phase 1 Testing Passed', checked: false }] },
    { title: 'Production Environment Setup', status: 'wait', isFIOPTask: true, data: {}, tasks: [] as any[] },
    { title: 'Production Deployment and Verification', status: 'wait', isFIOPTask: false, data: {}, tasks: [{ label: 'Production Environment Deployed', checked: false }, { label: 'Live Penny Test Passed', checked: false }] },
  ];
  if (variant === 'completed') {
    steps[0].status = 'finish'; steps[1].status = 'finish'; steps[1].tasks.forEach(t => t.checked = true);
    steps[2].status = 'finish'; steps[3].status = 'finish'; steps[3].tasks.forEach(t => t.checked = true);
  } else if (variant === 'integration') {
    steps[0].status = 'finish';
    steps[1].status = 'finish';
    steps[1].tasks.forEach(t => t.checked = true);
    steps[2].status = 'finish';
    steps[3].status = 'process';
    steps[3].tasks[0].checked = true;
  }
  return steps;
};

// --- 初始渠道数据 (1:1 完整同步 React 项目测试数据) ---
const rawInitialChannels = [
  {
    id: 1,
    channelName: 'Stripe Global',
    channelId: 'COR-2026-001',
    companyName: 'Stripe Payments UK Ltd',
    registrationGeo: 'UK',
    merchantGeo: [['Europe', 'UK'], ['Europe', 'Germany'], ['Americas', 'USA']],
    cooperationModel: ['PayFac'],
    status: 'Live',
    fiopOwner: 'Alice',
    paymentMethods: ['Card (Visa)', 'Card (Mastercard)', 'Card (Amex)'],
    supportedProducts: ['Payin'],
    supportedCurrencies: ['USD', 'GBP', 'EUR'],
    createdAt: '2026-02-14 10:30:00',
    lastModifiedAt: '2026-03-18 16:20:00',
    complianceStatus: 'Completed',
    ndaStatus: 'Signed',
    contractStatus: 'Signed',
    pricingProposalStatus: 'Approved',
    techStatus: 'Completed',
    globalProgress: { kyc: 'Completed', nda: 'Completed', pricing: 'Completed', contract: 'Completed', tech: 'Completed' },
    auditLogs: [
      { time: '2026-03-18 16:20:00', user: 'Alice', action: 'Updated Pricing Schedule', color: 'blue' },
      { time: '2026-03-15 14:10:00', user: 'Bob', action: 'Approved Legal Contract', color: 'green' },
{ time: '2026-03-10 09:45:00', user: 'Charlie', action: 'Updated Service Coverage Details', color: 'orange' },
    ],
    submissionHistory: createSubmissionHistory({
      kyc: { date: '2026-02-17', user: 'Alice', notes: 'Standard KYB package approved.' },
      nda: { date: '2026-02-18', user: 'Bob', notes: 'Signed by both parties.' },
      msa: { date: '2026-02-24', user: 'Legal Team', notes: 'Commercial clauses finalized.' },
      pricing: { date: '2026-03-01', user: 'System', notes: 'Pricing sheet approved and synced.' },
      tech: { date: '2026-03-06', user: 'Charlie', notes: 'Production verification completed.' },
    }),
    techStepsData: createTechStepsData('completed'),
    settlementCycle: 2,
    merchantSop: 'https://stripe.com/docs/sop',
    settlementCurrency: [['Fiat', 'USD'], ['Fiat', 'GBP']],
    taxReporter: 'Corridor',
    backendAccounts: [
      {
        environmentType: 'Production',
        environmentDetail: 'Primary merchant portal',
        legalName: 'Stripe Payments UK Ltd',
        tradingName: 'Stripe Global',
        address: 'dashboard.stripe.com',
        account: 'finance.ops@wooshpay.com',
        password: 'Stripe#Temp2026',
        remark: 'Primary account used by Fund for balance, statements, and refund verification.',
        loginMethod: 'Email + Password + OTP',
        accountPurpose: 'Balance / statements / refund operations',
        permissionScope: 'View balance, download statements, issue refunds',
        reviewStep: 'Single login in V1',
      },
      {
        environmentType: 'Production',
        environmentDetail: 'Risk & dispute console',
        legalName: 'Stripe Payments UK Ltd',
        tradingName: 'Stripe Global',
        address: 'dashboard.stripe.com/risk',
        account: 'risk.ops@wooshpay.com',
        password: 'Risk#Temp2026',
        remark: 'Dedicated risk console for dispute review.',
        loginMethod: 'SSO + OTP',
        accountPurpose: 'Chargeback monitoring',
        permissionScope: 'View disputes and export evidence packs',
        reviewStep: 'Separate risk login',
      },
    ],
    reconMethods: ['API', 'Portal', 'Email'],
    reconMethodDetail: 'API is primary for daily pulls. Portal is the fallback for statement exports. Email is only used for monthly exception handling.',
    corridorPayoutAccount: 'Beneficiary: WooshPay HK Limited\nBank: HSBC Hong Kong\nAccount No: 012-889922-001\nCurrency: USD / GBP',
    chargebackHandling: 'API',
    chargebackRemarks: 'Chargeback alerts arrive by webhook and portal inbox. Fund validates exposure in the same day and syncs outcome back to FI via Feishu.',
    fundProfile: {
      balanceSupported: true,
      balancePath: 'Portal > Balances > Available funds',
      rechargeSupported: false,
      rechargeInstruction: 'Pay-in only in V1. No corridor recharge flow is required.',
      manualRefundPath: 'Portal > Payments > Refund',
      transactionStatementPath: 'Portal > Reports > Balance transactions',
      settlementStatementPath: 'Portal > Reports > Payout reconciliation',
      statementGuideLink: 'https://docs.stripe.com/reports',
      statementIncludesFee: true,
      transactionStatuses: ['Succeeded', 'Pending', 'Failed', 'Refunded', 'Chargeback'],
      settlementCheckChannels: ['API', 'Portal', 'Email'],
      settlementCheckNotes: 'API is the source of truth. Email is used only for reserve or exception confirmation.',
      balanceCurrencies: ['USD', 'EUR', 'GBP'],
      withdrawalCurrencies: ['USD', 'GBP'],
      distributionCurrencies: [],
      chargebackNotifyPath: 'Webhook + portal notification center',
      chargebackFeedbackPath: 'Fund confirms handling path in Feishu and uploads internal memo.',
      payoutPlaceholder: 'V1 only covers pay-in. Pay-out recharge and maker-checker steps are reserved.',
    },
    fundApproval: {
      status: 'approved',
      note: 'Portal access, statements, settlement account, FX reference, and chargeback routing verified for go-live.',
      lastActionAt: '2026-03-18 18:10:00',
      lastActionBy: 'Olivia',
      history: [
        {
          id: 'fund-stripe-approved',
          type: 'approve',
          status: 'approved',
          user: 'Olivia',
          time: '2026-03-18 18:10:00',
          note: 'Portal access, statements, settlement account, FX reference, and chargeback routing verified for go-live.',
        },
      ],
    },
    pricingProposals: [
      {
        id: 'proposal-stripe-emea-cards',
        mode: 'PayFac',
        customProposalType: 'EMEA Cards',
        updatedAt: '2026-03-18 16:20:00',
        legalStatus: 'Completed',
        legalUpdatedAt: '2026-03-18 16:20:00',
        legalUpdatedBy: 'Pricing Legal',
        link: 'https://drive.example.com/stripe/emea-cards-pricing',
        remark: 'EMEA acquiring scope with standard card pricing, settlement and FX assumptions.',
        attachments: [
          {
            uid: 'proposal-stripe-emea-cards-pack',
            name: 'stripe-emea-cards-pricing-pack.txt',
            size: 24812,
            type: 'text/plain',
            status: 'done',
            downloadUrl: buildDemoDownloadUrl(
              'Stripe EMEA Cards Pricing Pack',
              'Stripe EMEA Cards Pricing Pack\n\nIncludes settlement assumptions, FX reference, and card pricing snapshot for treasury review.',
            ),
          },
        ],
        paymentMethods: [
          {
            id: 'pm-stripe-visa',
            method: 'Card (Visa)',
            consumerRegion: [['Europe', 'UK'], ['Europe', 'Germany']],
            pricingRows: [{ tierName: 'EEA Standard', variableRate: 1.45, fixedFeeCurrency: 'USD', floorPrice: 0.3, capPrice: 12 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'API', autoDebitCapability: 'Supported', minTicket: 1, minTicketCurrency: 'USD', maxTicket: 50000, maxTicketCurrency: 'USD' },
            settlement: { cycleDays: 2, settlementCurrency: ['USD', 'EUR'], fxCostReference: 'XE', fxCostOperator: '+', fxCostValue: 0.35, settlementThreshold: 'USD 100' }
          },
          {
            id: 'pm-stripe-mastercard',
            method: 'Card (Mastercard)',
            consumerRegion: [['Europe', 'UK'], ['Americas', 'USA']],
            pricingRows: [{ tierName: 'Core Card', fixedFeeAmount: 0.23, fixedFeeCurrency: 'USD', floorPrice: 0.3, capPrice: 12 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'API', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 2, settlementCurrency: ['USD', 'GBP'], fxCostReference: 'Bloomberg', fxCostOperator: '+', fxCostValue: 0.25 }
          },
          {
            id: 'pm-stripe-amex',
            method: 'Card (Amex)',
            consumerRegion: [['Europe', 'Germany'], ['Americas', 'USA']],
            pricingRows: [{ tierName: 'Premium Cards', variableRate: 2.35, fixedFeeAmount: 0.28, fixedFeeCurrency: 'USD', floorPrice: 0.35, capPrice: 18 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'API', autoDebitCapability: 'In Conditions' },
            settlement: { cycleDays: 3, settlementCurrency: ['USD'], fxCostReference: 'XE', fxCostOperator: '+', fxCostValue: 0.4 }
          }
        ]
      }
    ]
  },
  {
    id: 2,
    channelName: 'Adyen APAC',
    channelId: 'COR-2026-014',
    companyName: 'Adyen Singapore Pte Ltd',
    registrationGeo: 'Singapore',
    merchantGeo: [['Asia', 'Singapore'], ['Asia', 'Hong Kong'], ['Asia', 'Japan']],
    cooperationModel: ['Referral'],
    status: 'Ongoing',
    fiopOwner: 'Bob',
    paymentMethods: ['WeChat Pay', 'Alipay', 'UnionPay'],
    supportedProducts: ['Payout'],
    supportedCurrencies: ['USD', 'HKD'],
    createdAt: '2026-03-02 09:10:00',
    lastModifiedAt: '2026-03-19 11:05:00',
    complianceStatus: 'Completed',
    ndaStatus: 'Signed',
    contractStatus: 'Signed',
    pricingProposalStatus: 'In Review',
    techStatus: 'Not Started',
    globalProgress: { kyc: 'Completed', nda: 'Completed', pricing: 'In Review', contract: 'Completed', tech: 'Not Started' },
    auditLogs: [
      { time: '2026-03-19 11:05:00', user: 'Bob', action: 'Submitted Pricing for Review', color: 'blue' },
      { time: '2026-03-11 15:20:00', user: 'Legal Team', action: 'Signed Master Services Agreement', color: 'green' },
    ],
    submissionHistory: createSubmissionHistory({
      kyc: { date: '2026-03-05', user: 'Bob', notes: 'APAC compliance pack cleared.' },
      nda: { date: '2026-03-06', user: 'Legal Team', notes: 'Mutual NDA signed.' },
      msa: { date: '2026-03-11', user: 'Legal Team', notes: 'Commercial contract signed.' },
      pricing: { date: '2026-03-18', user: 'System', notes: 'Waiting for corridor pricing confirmation.' },
    }),
    corridorOnboarding: {
      status: 'no_need',
      submission: {
        documentLink: 'https://drive.example.com/adyen/corridor-risk-memo',
        notes: 'Existing APAC diligence pack reused from the regional approval baseline.',
        attachments: [
          { uid: 'adyen-corridor-1', name: 'regional-risk-waiver.pdf', size: 182300, type: 'application/pdf', status: 'done' },
        ],
        submittedAt: '2026-03-05 10:00:00',
        submittedBy: 'Bob',
      },
      activityHistory: [
        {
          id: 'adyen-corridor-note-1',
          eventType: 'note',
          remark: 'Regional compliance confirmed the existing approval can be reused; no additional corridor package required.',
          status: 'no_need',
          time: '2026-03-06 16:10:00',
          actorName: 'Compliance User',
          actorRole: 'reviewer',
          attachments: [],
        },
        {
          id: 'adyen-corridor-submission-1',
          eventType: 'submission',
          remark: 'Existing APAC diligence pack reused from the regional approval baseline.',
          status: 'wooshpay_reviewing',
          time: '2026-03-05 10:00:00',
          actorName: 'Bob',
          actorRole: 'submitter',
          attachments: [
            { uid: 'adyen-corridor-1', name: 'regional-risk-waiver.pdf', size: 182300, type: 'application/pdf', status: 'done' },
          ],
        },
      ],
      lastUpdatedAt: '2026-03-06 16:10:00',
      lastUpdatedBy: 'Compliance User',
    },
    techStepsData: createTechStepsData('notStarted'),
    merchantSop: 'https://adyen.com/docs/sop',
    settlementCurrency: [['Fiat', 'USD'], ['Fiat', 'HKD']],
    settlementCycle: 1,
    backendAccounts: [
      {
        environmentType: 'Production',
        environmentDetail: 'Acquiring portal',
        legalName: 'Adyen Singapore Pte Ltd',
        tradingName: 'Adyen APAC',
        address: 'ca-live.adyen.com',
        account: 'settlement.ops@wooshpay.com',
        password: 'Adyen#Temp2026',
        remark: 'Payout and settlement related steps still require manual follow-up.',
        loginMethod: 'Email + OTP',
        accountPurpose: 'Portal lookup / settlement verification',
        permissionScope: 'Portal viewing and statement export',
        reviewStep: 'Payout maker-checker to be confirmed',
      },
    ],
    reconMethods: ['Portal', 'Email'],
    reconMethodDetail: 'Portal is used for daily statement export. Email is used for settlement exception confirmation while automation is pending.',
    corridorPayoutAccount: 'Beneficiary: WooshPay HK Limited\nBank: DBS Hong Kong\nAccount No: 889900122\nCurrency: USD / HKD',
    chargebackHandling: 'Portal',
    chargebackRemarks: 'Wallet products rarely see chargebacks; payout operations still require manual confirmation.',
    fundProfile: {
      balanceSupported: true,
      balancePath: 'Portal > Finance > Account balance',
      rechargeSupported: null,
      rechargeInstruction: '',
      manualRefundPath: 'Portal > Transactions > Manual refund',
      transactionStatementPath: 'Portal > Reports > Payment accounting',
      settlementStatementPath: 'Portal > Reports > Settlement details',
      statementGuideLink: 'https://docs.adyen.com/reporting',
      statementIncludesFee: true,
      transactionStatuses: ['Authorised', 'SentForSettle', 'Settled', 'Refunded'],
      settlementCheckChannels: ['Portal', 'Email'],
      settlementCheckNotes: 'Automation is not confirmed yet; manual email confirmation remains in use.',
      balanceCurrencies: ['USD', 'HKD'],
      withdrawalCurrencies: ['USD'],
      distributionCurrencies: [],
      chargebackNotifyPath: '',
      chargebackFeedbackPath: '',
      payoutPlaceholder: 'Payout recharge and maker-checker flow are reserved in V1 and do not block approval.',
    },
    fundApproval: {
      status: 'pending',
      note: '',
      lastActionAt: '2026-03-19 11:05:00',
      lastActionBy: '',
      history: [],
    },
    pricingProposals: [
      {
        id: 'proposal-adyen-apac-travel',
        mode: 'Referral',
        customProposalType: 'APAC Travel',
        updatedAt: '2026-03-19 11:05:00',
        paymentMethods: [
          {
            id: 'pm-adyen-wechat',
            method: 'WeChat Pay',
            consumerRegion: [['Asia', 'Singapore'], ['Asia', 'Hong Kong']],
            pricingRows: [{ tierName: 'Standard Wallet', variableRate: 1.2, fixedFeeAmount: 0.12, fixedFeeCurrency: 'HKD', floorPrice: 0.2, capPrice: 20 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'Portal', autoDebitCapability: 'Not Supported', minTicket: 10, minTicketCurrency: 'HKD' },
            settlement: { cycleDays: 1, settlementCurrency: ['USD', 'HKD'], fxCostReference: 'XE', fxCostOperator: '+', fxCostValue: 0.5, settlementThreshold: 'HKD 500' }
          },
          {
            id: 'pm-adyen-alipay',
            method: 'Alipay',
            consumerRegion: [['Asia', 'Singapore'], ['Asia', 'Japan']],
            pricingRows: [{ tierName: 'Cross-border Wallet', variableRate: 1.18, fixedFeeCurrency: 'HKD', floorPrice: 0.2, capPrice: 18 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'Portal', autoDebitCapability: 'Not Supported' },
            settlement: { cycleDays: 1, settlementCurrency: ['USD', 'HKD'], fxCostReference: 'Bloomberg', fxCostOperator: '+', fxCostValue: 0.45, settlementThreshold: 'HKD 500' }
          }
        ]
      }
    ]
  },
  {
    id: 3,
    channelName: 'Braintree US',
    channelId: 'COR-2026-021',
    companyName: 'PayPal Inc.',
    registrationGeo: 'USA',
    merchantGeo: [['Americas', 'USA']],
    cooperationModel: ['MoR'],
    status: 'Offline',
    fiopOwner: 'Charlie',
    paymentMethods: ['PayPal', 'Venmo'],
    supportedProducts: ['Payin'],
    supportedCurrencies: ['USD'],
    createdAt: '2026-02-26 14:40:00',
    lastModifiedAt: '2026-03-08 18:00:00',
    complianceStatus: 'Not Started',
    ndaStatus: 'Not Started',
    contractStatus: 'Not Started',
    pricingProposalStatus: 'Not Started',
    techStatus: 'No need',
    globalProgress: { kyc: 'Not Started', nda: 'Not Started', pricing: 'Not Started', contract: 'Not Started', tech: 'Not Started' },
    auditLogs: [],
    submissionHistory: createSubmissionHistory(),
    techStepsData: createTechStepsData('notStarted'),
    merchantSop: 'https://braintree.com/docs/sop',
    pricingProposals: []
  },
  {
    id: 4,
    channelName: 'Checkout.com',
    channelId: 'COR-2026-009',
    companyName: 'Checkout Ltd',
    registrationGeo: 'Germany',
    merchantGeo: [['Europe', 'Germany'], ['Europe', 'France']],
    cooperationModel: ['PayFac'],
    status: 'Lost connection',
    fiopOwner: 'Alice',
    paymentMethods: ['Card (Visa)', 'Card (Mastercard)'],
    supportedProducts: ['Issuing Cards'],
    supportedCurrencies: ['EUR', 'GBP'],
    createdAt: '2026-01-19 12:15:00',
    lastModifiedAt: '2026-03-09 10:10:00',
    complianceStatus: 'Completed',
    ndaStatus: 'Signed',
    contractStatus: 'Signed',
    pricingProposalStatus: 'Approved',
    techStatus: 'Completed',
    globalProgress: { kyc: 'Completed', nda: 'Completed', pricing: 'Completed', contract: 'Completed', tech: 'Completed' },
    auditLogs: [
      { time: '2026-03-18 16:20:00', user: 'Alice', action: 'Updated Pricing Schedule', color: 'blue' },
      { time: '2026-03-15 14:10:00', user: 'Bob', action: 'Approved Legal Contract', color: 'green' },
{ time: '2026-03-10 09:45:00', user: 'Charlie', action: 'Updated Service Coverage Details', color: 'orange' },
    ],
    submissionHistory: createSubmissionHistory({
      kyc: { date: '2026-01-25', user: 'Alice', notes: 'KYB approved before commercial pause.' },
      nda: { date: '2026-01-27', user: 'Legal Team', notes: 'Signed.' },
      msa: { date: '2026-02-03', user: 'Legal Team', notes: 'Master agreement executed.' },
      pricing: { date: '2026-02-14', user: 'System', notes: 'Commercial approval completed.' },
      tech: { date: '2026-02-21', user: 'Charlie', notes: 'Tech setup completed.' },
    }),
    techStepsData: createTechStepsData('completed'),
    merchantSop: 'https://checkout.com/docs/sop',
    settlementCurrency: [['Fiat', 'EUR']],
    fundApproval: {
      status: 'pending',
      note: 'Returned by FI Supervisor after final review.',
      submittedAt: '2026-03-09 11:30:00',
      submittedBy: 'Alice',
      submitNote: 'Fund approval submitted before final launch review.',
      lastActionAt: '2026-03-10 15:45:00',
      lastActionBy: 'Ivy',
      history: [
        {
          id: 'fund-checkout-approved',
          type: 'approve',
          status: 'approved',
          user: 'Olivia',
          time: '2026-03-09 14:20:00',
          note: 'Fund confirmed portal access and settlement account setup.',
        },
        {
          id: 'fund-checkout-reopened',
          type: 'supervisor_return',
          status: 'pending',
          user: 'Ivy',
          time: '2026-03-10 15:45:00',
          note: 'FI Supervisor returned final launch. FIOP must confirm commercial pause resolution before resubmitting Fund review.',
        },
      ],
    },
    launchApproval: {
      status: 'supervisor_returned',
      submittedBy: 'Alice',
      submittedAt: '2026-03-09 11:30:00',
      fundDecisionBy: 'Olivia',
      fundDecisionAt: '2026-03-09 14:20:00',
      fundNote: 'Fund confirmed portal access and settlement account setup.',
      supervisorDecisionBy: 'Ivy',
      supervisorDecisionAt: '2026-03-10 15:45:00',
      supervisorNote: 'Commercial pause is still open. Please confirm reconnect plan, then resubmit Fund review before launch.',
      history: [
        {
          id: 'launch-checkout-supervisor-returned',
          type: 'supervisor_return',
          status: 'supervisor_returned',
          actor: 'Ivy',
          time: '2026-03-10 15:45:00',
          note: 'Commercial pause is still open. Please confirm reconnect plan, then resubmit Fund review before launch.',
        },
        {
          id: 'launch-checkout-fund-approved',
          type: 'fund_approve',
          status: 'under_fi_supervisor_review',
          actor: 'Olivia',
          time: '2026-03-09 14:20:00',
          note: 'Fund confirmed portal access and settlement account setup.',
        },
      ],
    },
    pricingProposals: [
      {
        id: 'proposal-checkout-eu-cards',
        mode: 'PayFac',
        customProposalType: 'EU Cards',
        updatedAt: '2026-03-09 10:10:00',
        paymentMethods: [
          {
            id: 'pm-checkout-visa',
            method: 'Card (Visa)',
            consumerRegion: [['Europe', 'Germany'], ['Europe', 'France']],
            pricingRows: [{ tierName: 'Domestic Cards', variableRate: 0.95, fixedFeeAmount: 0.18, fixedFeeCurrency: 'EUR', floorPrice: 0.18, capPrice: 10 }],
            capabilityFlags: { refundCapability: 'Partial Refund', refundMethod: 'API', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 2, settlementCurrency: ['EUR', 'GBP'], fxCostReference: 'XE' }
          },
          {
            id: 'pm-checkout-mastercard',
            method: 'Card (Mastercard)',
            consumerRegion: [['Europe', 'Germany'], ['Europe', 'France']],
            pricingRows: [{ tierName: 'Domestic Cards', variableRate: 0.99, fixedFeeAmount: 0.18, fixedFeeCurrency: 'EUR', floorPrice: 0.18, capPrice: 10 }],
            capabilityFlags: { refundCapability: 'Partial Refund', refundMethod: 'API', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 2, settlementCurrency: ['EUR', 'GBP'], fxCostReference: 'XE' }
          }
        ]
      }
    ]
  },
  {
    id: 5,
    channelName: 'dLocal',
    channelId: 'COR-2026-017',
    companyName: 'dLocal Group',
    registrationGeo: 'Uruguay',
    merchantGeo: [['Americas', 'Brazil'], ['Americas', 'Canada']],
    cooperationModel: ['Referral'],
    status: 'Offline',
    fiopOwner: 'Bob',
    paymentMethods: ['Boleto', 'OXXO'],
    supportedProducts: ['Payout'],
    supportedCurrencies: ['USDT', 'BTC'],
    createdAt: '2026-03-01 15:30:00',
    lastModifiedAt: '2026-03-17 17:25:00',
    complianceStatus: 'In Review',
    ndaStatus: 'In Review',
    contractStatus: 'Not Started',
    pricingProposalStatus: 'Not Started',
    techStatus: 'Not Started',
    globalProgress: { kyc: 'In Review', nda: 'In Review', pricing: 'Not Started', contract: 'Not Started', tech: 'Not Started' },
    submissionHistory: createSubmissionHistory({
      kyc: { date: '2026-03-10', user: 'Bob', notes: 'Waiting for corridor supplemental documents.' },
      nda: { date: '2026-03-12', user: 'Legal Team', notes: 'Redline returned; signature paused.' },
    }),
    wooshpayOnboarding: {
      status: 'wooshpay_preparation',
      submission: {
        entities: ['Steelhenge Pte Ltd (Singapore)'],
        documentLink: 'https://drive.example.com/dlocal/wooshpay-v1',
        notes: 'Initial WooshPay package submitted for LatAm onboarding.',
        attachments: [
          { uid: 'dlocal-wooshpay-1', name: 'wooshpay-entity-pack.zip', size: 520100, type: 'application/zip', status: 'done' },
        ],
        submittedAt: '2026-03-10 09:30:00',
        submittedBy: 'Bob',
      },
      activityHistory: [
        {
          id: 'dlocal-wooshpay-submission-1',
          eventType: 'submission',
          remark: 'Initial WooshPay package submitted for LatAm onboarding.',
          status: 'wooshpay_preparation',
          time: '2026-03-10 09:30:00',
          actorName: 'Bob',
          actorRole: 'submitter',
          attachments: [
            { uid: 'dlocal-wooshpay-1', name: 'wooshpay-entity-pack.zip', size: 520100, type: 'application/zip', status: 'done' },
          ],
        },
      ],
      lastUpdatedAt: '2026-03-10 09:30:00',
      lastUpdatedBy: 'Bob',
    },
    corridorOnboarding: {
      status: 'corridor_preparation',
      submission: {
        contactName: 'Maria Silva',
        contactMethod: 'Email',
        contactValue: 'maria.silva@dlocal.com',
        handoffNote: 'Primary corridor ops contact for settlement controls follow-up and fallback payout routing.',
        notes: 'Primary corridor ops contact for settlement controls follow-up and fallback payout routing.',
        submittedAt: '2026-03-11 14:10:00',
        submittedBy: 'Bob',
      },
      activityHistory: [
        {
          id: 'dlocal-corridor-request-1',
          eventType: 'request_changes',
          remark: 'Please confirm the latest fallback payout contact and escalation path.',
          status: 'corridor_preparation',
          time: '2026-03-17 17:25:00',
          actorName: 'Compliance User',
          actorRole: 'reviewer',
          attachments: [],
        },
        {
          id: 'dlocal-corridor-submission-1',
          eventType: 'submission',
          remark: 'Primary corridor ops contact for settlement controls follow-up and fallback payout routing.',
          status: 'wooshpay_reviewing',
          time: '2026-03-11 14:10:00',
          actorName: 'Bob',
          actorRole: 'submitter',
          attachments: [],
        },
      ],
      lastUpdatedAt: '2026-03-17 17:25:00',
      lastUpdatedBy: 'Compliance User',
    },
    techStepsData: createTechStepsData('notStarted'),
    merchantSop: 'https://dlocal.com/docs/sop',
    pricingProposals: []
  },
  {
    id: 6,
    channelName: 'Worldpay EMEA',
    channelId: 'COR-2026-019',
    companyName: 'Worldpay (UK) Limited',
    registrationGeo: 'UK',
    merchantGeo: [['Europe', 'UK'], ['Europe', 'Ireland']],
    cooperationModel: ['PayFac'],
    status: 'Ongoing',
    fiopOwner: 'Charlie',
    paymentMethods: ['Card (Visa)', 'Card (Mastercard)', 'Card (Maestro)'],
    supportedProducts: ['Payin'],
    supportedCurrencies: ['EUR', 'GBP'],
    createdAt: '2026-03-04 11:45:00',
    lastModifiedAt: '2026-03-19 09:40:00',
    complianceStatus: 'Completed',
    ndaStatus: 'Signed',
    contractStatus: 'In Review',
    pricingProposalStatus: 'Not Started',
    techStatus: 'Not Started',
    globalProgress: { kyc: 'Completed', nda: 'Completed', pricing: 'Not Started', contract: 'In Review', tech: 'Not Started' },
    submissionHistory: createSubmissionHistory({
      kyc: { date: '2026-03-07', user: 'Charlie', notes: 'Compliance pack approved.' },
      nda: { date: '2026-03-08', user: 'Legal Team', notes: 'NDA executed.' },
      msa: { date: '2026-03-18', user: 'Legal Team', notes: 'Reviewing liability and settlement clauses.' },
    }),
    techStepsData: createTechStepsData('notStarted'),
    merchantSop: 'https://worldpay.com/docs/sop',
    backendAccounts: [
      {
        environmentType: 'Production',
        environmentDetail: 'Merchant management portal',
        legalName: 'Worldpay (UK) Limited',
        tradingName: 'Worldpay EMEA',
        address: 'myportal.worldpay.com',
        account: 'fund.review@wooshpay.com',
        password: 'Worldpay#Temp2026',
        remark: 'Portal access exists, but role split between maker and checker is still unclear.',
        loginMethod: 'Email + Password',
        accountPurpose: 'Settlement review and refund operations',
        permissionScope: '',
        reviewStep: '',
      },
    ],
    reconMethods: ['Portal'],
    reconMethodDetail: 'Portal export is available, but exception handling and reserve confirmation are not documented.',
    corridorPayoutAccount: 'Beneficiary: WooshPay UK Ltd\nBank: Barclays\nAccount No: 66001288\nCurrency: EUR / GBP',
    chargebackHandling: 'Portal',
    chargebackRemarks: 'Worldpay portal exposes disputes, but internal notification and escalation path are not fully documented.',
    fundProfile: {
      balanceSupported: true,
      balancePath: 'Portal > Finance > Merchant balances',
      rechargeSupported: false,
      rechargeInstruction: 'No recharge needed for pay-in.',
      manualRefundPath: '',
      transactionStatementPath: 'Portal > Reports > Transaction search export',
      settlementStatementPath: '',
      statementGuideLink: '',
      statementIncludesFee: null,
      transactionStatuses: ['Authorised', 'Settled', 'Refunded'],
      settlementCheckChannels: ['Portal'],
      settlementCheckNotes: '',
      balanceCurrencies: ['EUR', 'GBP'],
      withdrawalCurrencies: ['EUR'],
      distributionCurrencies: [],
      chargebackNotifyPath: '',
      chargebackFeedbackPath: '',
      payoutPlaceholder: 'Payout-specific controls are not in V1 scope.',
    },
    fundApproval: {
      status: 'approved',
      note: 'Fund approved as an intentional blocked-state demo; Legal/Pricing prerequisites are still incomplete.',
      submittedAt: '2026-03-19 09:40:00',
      submittedBy: 'Charlie',
      submitNote: 'Submitted to demonstrate how FI Supervisor sees a launch task after prerequisites drift.',
      lastActionAt: '2026-03-19 13:25:00',
      lastActionBy: 'Olivia',
      history: [
        {
          id: 'fund-worldpay-approved-demo',
          type: 'approve',
          status: 'approved',
          user: 'Olivia',
          time: '2026-03-19 13:25:00',
          note: 'Fund approved as an intentional blocked-state demo; Legal/Pricing prerequisites are still incomplete.',
        },
      ],
    },
    launchApproval: {
      status: 'under_fi_supervisor_review',
      submittedBy: 'Charlie',
      submittedAt: '2026-03-19 09:40:00',
      fundDecisionBy: 'Olivia',
      fundDecisionAt: '2026-03-19 13:25:00',
      fundNote: 'Fund approved, but Legal/Pricing prerequisites changed after submission.',
      supervisorDecisionBy: '',
      supervisorDecisionAt: '',
      supervisorNote: '',
      history: [
        {
          id: 'launch-worldpay-blocked-fund-approved',
          type: 'fund_approve',
          status: 'under_fi_supervisor_review',
          actor: 'Olivia',
          time: '2026-03-19 13:25:00',
          note: 'Fund approved, but Legal/Pricing prerequisites changed after submission.',
        },
      ],
    },
    pricingProposals: [
      {
        id: 'proposal-worldpay-core-cards',
        mode: 'PayFac',
        customProposalType: 'Core Cards',
        updatedAt: '2026-03-19 09:40:00',
        link: 'https://drive.example.com/worldpay/core-cards-pricing',
        remark: 'Worldpay core cards pricing schedule for UK and Ireland acquiring coverage.',
        attachments: [
          {
            uid: 'proposal-worldpay-core-cards-pack',
            name: 'worldpay-core-cards-pricing-pack.txt',
            size: 21456,
            type: 'text/plain',
            status: 'done',
            downloadUrl: buildDemoDownloadUrl(
              'Worldpay Core Cards Pricing Pack',
              'Worldpay Core Cards Pricing Pack\n\nContains settlement notes, pricing assumptions, and review references for treasury.',
            ),
          },
        ],
        paymentMethods: [
          {
            id: 'pm-worldpay-visa',
            method: 'Card (Visa)',
            consumerRegion: [['Europe', 'UK'], ['Europe', 'Ireland']],
            pricingRows: [{ tierName: 'Domestic', variableRate: 2.75, fixedFeeAmount: 0.2, fixedFeeCurrency: 'EUR', floorPrice: 0.25, capPrice: 16 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'Portal', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 3, settlementCurrency: ['EUR', 'GBP'], fxCostReference: 'Bloomberg', settlementThreshold: 'EUR 300' }
          },
          {
            id: 'pm-worldpay-maestro',
            method: 'Card (Maestro)',
            consumerRegion: [['Europe', 'UK']],
            pricingRows: [{ tierName: 'Debit', variableRate: 1.95, fixedFeeAmount: 0.18, fixedFeeCurrency: 'EUR', floorPrice: 0.2, capPrice: 12 }],
            capabilityFlags: { refundCapability: 'Partial Refund', refundMethod: 'Portal', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 3, settlementCurrency: ['EUR'], fxCostReference: 'XE', settlementThreshold: 'EUR 300' }
          }
        ]
      }
    ]
  },
  {
    id: 7,
    channelName: 'PayU LatAm',
    channelId: 'COR-2026-005',
    companyName: 'PayU Latam',
    registrationGeo: 'Colombia',
    merchantGeo: [['Americas', 'Brazil'], ['Americas', 'Canada']],
    cooperationModel: ['MoR'],
    status: 'Live',
    fiopOwner: 'Diana',
    paymentMethods: ['PSE', 'Baloto'],
    supportedProducts: ['Payin'],
    supportedCurrencies: ['USD', 'USDC'],
    createdAt: '2026-01-11 08:20:00',
    lastModifiedAt: '2026-03-16 14:35:00',
    complianceStatus: 'Completed',
    ndaStatus: 'Signed',
    contractStatus: 'Signed',
    pricingProposalStatus: 'Approved',
    techStatus: 'Completed',
    globalProgress: { kyc: 'Completed', nda: 'Completed', pricing: 'Completed', contract: 'Completed', tech: 'Completed' },
    auditLogs: [
      { time: '2026-03-18 16:20:00', user: 'Alice', action: 'Updated Pricing Schedule', color: 'blue' },
      { time: '2026-03-15 14:10:00', user: 'Bob', action: 'Approved Legal Contract', color: 'green' },
{ time: '2026-03-10 09:45:00', user: 'Charlie', action: 'Updated Service Coverage Details', color: 'orange' },
    ],
    submissionHistory: createSubmissionHistory({
      kyc: { date: '2026-01-16', user: 'Diana', notes: 'Completed with enhanced checks.' },
      nda: { date: '2026-01-17', user: 'Legal Team', notes: 'Signed.' },
      msa: { date: '2026-01-28', user: 'Legal Team', notes: 'Agreement fully executed.' },
      pricing: { date: '2026-02-05', user: 'System', notes: 'Proposal approved and activated.' },
      tech: { date: '2026-02-12', user: 'Charlie', notes: 'Production release signed off.' },
    }),
    techStepsData: createTechStepsData('completed'),
    merchantSop: 'https://payu.com/docs/sop',
    backendAccounts: [
      {
        environmentType: 'Production',
        environmentDetail: 'PayU merchant portal',
        legalName: 'PayU Latam',
        tradingName: 'PayU LatAm',
        address: 'merchants.payulatam.com',
        account: 'fund.latam@wooshpay.com',
        password: 'PayU#Temp2026',
        remark: 'Fund can view settlement batches and export refund references. Permission split still needs confirmation.',
        loginMethod: 'Email + Password + OTP',
        accountPurpose: 'Settlement review and refund operation',
        permissionScope: 'View settlements, export transaction reports, initiate refund checks',
        reviewStep: 'Treasury confirms maker/checker split before approval',
      },
    ],
    reconMethods: ['Portal', 'API'],
    reconMethodDetail: 'Portal exports are reviewed daily. API reconciliation is available for exception checks and settlement matching.',
    corridorPayoutAccount: 'Beneficiary: WooshPay LatAm Ltd\nBank: Bancolombia\nAccount No: 778899001\nCurrency: USD / USDC',
    chargebackHandling: 'Portal',
    chargebackRemarks: 'Dispute alerts are reviewed in the PayU portal and escalated to FI operations by email for same-day confirmation.',
    fundProfile: {
      balanceSupported: true,
      balancePath: 'Portal > Finance > Balances',
      rechargeSupported: false,
      rechargeInstruction: 'Pay-in only in V1. No recharge flow is required.',
      manualRefundPath: 'Portal > Transactions > Refund',
      transactionStatementPath: 'Portal > Reports > Transactions',
      settlementStatementPath: 'Portal > Reports > Settlements',
      statementGuideLink: 'https://developers.payulatam.com/docs/reports',
      statementIncludesFee: true,
      transactionStatuses: ['Approved', 'Pending', 'Declined', 'Refunded', 'Dispute'],
      settlementCheckChannels: ['Portal', 'API'],
      settlementCheckNotes: 'Portal is the daily source. API is used for exception checks.',
      balanceCurrencies: ['USD', 'USDC'],
      withdrawalCurrencies: ['USD'],
      distributionCurrencies: [],
      chargebackNotifyPath: 'Portal dispute inbox',
      chargebackFeedbackPath: 'Fund records dispute outcome in Feishu after portal review.',
      payoutPlaceholder: 'Payout-specific controls are not in V1 scope.',
    },
    fundApproval: {
      status: 'changes_requested',
      note: 'Please confirm the manual refund path and split portal permissions between settlement review and dispute handling.',
      submittedAt: '2026-03-16 14:50:00',
      submittedBy: 'Diana',
      submitNote: 'Fund review submitted after legal, KYC, and pricing completion.',
      lastActionAt: '2026-03-16 17:20:00',
      lastActionBy: 'Olivia',
      history: [
        {
          id: 'fund-payu-returned',
          type: 'request_changes',
          status: 'changes_requested',
          user: 'Olivia',
          time: '2026-03-16 17:20:00',
          note: 'Please confirm the manual refund path and split portal permissions between settlement review and dispute handling.',
        },
      ],
    },
    pricingProposals: [
      {
        id: 'proposal-payu-latam-apms',
        mode: 'MoR',
        customProposalType: 'LatAm APMs',
        updatedAt: '2026-03-16 14:35:00',
        legalStatus: 'Completed',
        legalUpdatedAt: '2026-03-16 14:35:00',
        legalUpdatedBy: 'Pricing Legal',
        link: 'https://drive.example.com/payu/latam-apms-pricing',
        remark: 'LatAm APM pricing schedule shared with treasury for payin review.',
        attachments: [
          {
            uid: 'proposal-payu-latam-apms-pack',
            name: 'payu-latam-apms-pricing-pack.txt',
            size: 19684,
            type: 'text/plain',
            status: 'done',
            downloadUrl: buildDemoDownloadUrl(
              'PayU LatAm APMs Pricing Pack',
              'PayU LatAm APMs Pricing Pack\n\nIncludes proposal notes, FX reference details, and settlement summary for treasury.',
            ),
          },
        ],
        paymentMethods: [
          {
            id: 'pm-payu-pse',
            method: 'PSE',
            consumerRegion: [['Americas', 'Brazil'], ['Americas', 'Canada']],
            pricingRows: [{ tierName: 'Domestic APM', variableRate: 3.99, fixedFeeAmount: 0.2, fixedFeeCurrency: 'USD', floorPrice: 0.25, capPrice: 20 }],
            capabilityFlags: { refundCapability: 'Partial Refund', refundMethod: 'Portal', autoDebitCapability: 'Not Supported' },
            settlement: { cycleDays: 2, settlementCurrency: ['USD', 'USDC'], fxCostReference: 'Parallel Rate' }
          },
          {
            id: 'pm-payu-baloto',
            method: 'Baloto',
            consumerRegion: [['Americas', 'Brazil']],
            pricingRows: [{ tierName: 'Cash Voucher', variableRate: 3.65, fixedFeeAmount: 0.22, fixedFeeCurrency: 'USD', floorPrice: 0.25, capPrice: 18 }],
            capabilityFlags: { refundCapability: 'Not Supported', refundMethod: 'Not Supported', autoDebitCapability: 'Not Supported' },
            settlement: { cycleDays: 4, settlementCurrency: ['USD'], fxCostReference: 'Other' }
          }
        ]
      }
    ]
  },
  {
    id: 9,
    channelName: 'Nuvei Canada',
    channelId: 'COR-2026-031',
    companyName: 'Nuvei Corporation',
    registrationGeo: 'Canada',
    merchantGeo: [['Americas', 'Canada'], ['Americas', 'USA']],
    cooperationModel: ['PayFac'],
    status: 'Ongoing',
    fiopOwner: 'Alice',
    paymentMethods: ['Card (Visa)', 'Interac'],
    supportedProducts: ['Payin'],
    supportedCurrencies: ['CAD', 'USD'],
    createdAt: '2026-03-12 10:20:00',
    lastModifiedAt: '2026-03-22 10:15:00',
    complianceStatus: 'Completed',
    ndaStatus: 'Signed',
    contractStatus: 'Signed',
    pricingProposalStatus: 'Approved',
    techStatus: 'Completed',
    globalProgress: { kyc: 'Completed', nda: 'Completed', pricing: 'Completed', contract: 'Completed', tech: 'Completed' },
    auditLogs: [
      { time: '2026-03-22 10:15:00', user: 'Alice', action: 'Submitted Fund Review', color: 'blue' },
      { time: '2026-03-21 16:40:00', user: 'Pricing Legal', action: 'Approved Pricing Schedule', color: 'green' },
      { time: '2026-03-18 11:25:00', user: 'Legal Team', action: 'Completed MSA', color: 'green' },
    ],
    submissionHistory: createSubmissionHistory({
      kyc: { date: '2026-03-14', user: 'Alice', notes: 'WooshPay and corridor onboarding completed.' },
      nda: { date: '2026-03-15', user: 'Legal Team', notes: 'NDA signed.' },
      msa: { date: '2026-03-18', user: 'Legal Team', notes: 'MSA fully executed.' },
      pricing: { date: '2026-03-21', user: 'Pricing Legal', notes: 'Pricing schedule legally approved.' },
      tech: { date: '2026-03-21', user: 'Charlie', notes: 'Production setup confirmed.' },
    }),
    techStepsData: createTechStepsData('completed'),
    merchantSop: 'https://nuvei.com/docs/sop',
    backendAccounts: [
      {
        environmentType: 'Production',
        environmentDetail: 'Nuvei control panel',
        legalName: 'Nuvei Corporation',
        tradingName: 'Nuvei Canada',
        address: 'cpanel.nuvei.com',
        account: 'fund.canada@wooshpay.com',
        password: 'Nuvei#Temp2026',
        remark: 'Primary fund account for balance review, settlement reports, and refund lookup.',
        loginMethod: 'Email + Password + MFA',
        accountPurpose: 'Balance, statements, and refund verification',
        permissionScope: 'View balance, export reports, view disputes, refund lookup',
        reviewStep: 'Fund confirms access and report paths',
      },
    ],
    reconMethods: ['API', 'SFTP'],
    reconMethodDetail: 'Daily settlement files are received through SFTP. API is used for balance and transaction status checks.',
    corridorPayoutAccount: 'Beneficiary: WooshPay Canada Ltd\nBank: RBC Royal Bank\nAccount No: 334455667\nCurrency: CAD / USD',
    chargebackHandling: 'Email',
    chargebackRemarks: 'Chargeback notices are sent to the finance disputes mailbox. Fund records the case and updates FI operations after evidence submission.',
    fundProfile: {
      balanceSupported: true,
      balancePath: 'Control Panel > Finance > Account balance',
      rechargeSupported: false,
      rechargeInstruction: 'Pay-in only in V1. No recharge flow is required.',
      manualRefundPath: 'Control Panel > Transactions > Refund payment',
      transactionStatementPath: 'Control Panel > Reports > Transactions',
      settlementStatementPath: 'SFTP /settlements/daily',
      statementGuideLink: 'https://docs.nuvei.com/reports',
      statementIncludesFee: true,
      transactionStatuses: ['Approved', 'Pending', 'Declined', 'Refunded', 'Chargeback'],
      settlementCheckChannels: ['API', 'SFTP'],
      settlementCheckNotes: 'SFTP settlement file is checked every business day. API confirms final transaction status.',
      balanceCurrencies: ['CAD', 'USD'],
      withdrawalCurrencies: ['CAD', 'USD'],
      distributionCurrencies: [],
      chargebackNotifyPath: 'Finance disputes mailbox',
      chargebackFeedbackPath: 'Fund updates FI operations after evidence submission.',
      payoutPlaceholder: 'Payout-specific controls are not in V1 scope.',
    },
    fundApproval: {
      status: 'approved',
      note: 'Fund confirmed Canadian acquiring controls, settlement reports, and refund lookup paths.',
      submittedAt: '2026-03-22 10:15:00',
      submittedBy: 'Alice',
      submitNote: 'All legal, KYC, and pricing prerequisites are complete.',
      lastActionAt: '2026-03-22 15:30:00',
      lastActionBy: 'Olivia',
      history: [
        {
          id: 'fund-nuvei-approved',
          type: 'approve',
          status: 'approved',
          user: 'Olivia',
          time: '2026-03-22 15:30:00',
          note: 'Fund confirmed Canadian acquiring controls, settlement reports, and refund lookup paths.',
        },
      ],
    },
    launchApproval: {
      status: 'under_fi_supervisor_review',
      submittedBy: 'Alice',
      submittedAt: '2026-03-22 10:15:00',
      fundDecisionBy: 'Olivia',
      fundDecisionAt: '2026-03-22 15:30:00',
      fundNote: 'Fund confirmed Canadian acquiring controls, settlement reports, and refund lookup paths.',
      supervisorDecisionBy: '',
      supervisorDecisionAt: '',
      supervisorNote: '',
      history: [
        {
          id: 'launch-nuvei-fund-approved',
          type: 'fund_approve',
          status: 'under_fi_supervisor_review',
          actor: 'Olivia',
          time: '2026-03-22 15:30:00',
          note: 'Fund confirmed Canadian acquiring controls, settlement reports, and refund lookup paths.',
        },
        {
          id: 'launch-nuvei-submitted',
          type: 'submit',
          status: 'under_fund_review',
          actor: 'Alice',
          time: '2026-03-22 10:15:00',
          note: 'All legal, KYC, and pricing prerequisites are complete.',
        },
      ],
    },
    pricingProposals: [
      {
        id: 'proposal-nuvei-canada-cards',
        mode: 'PayFac',
        customProposalType: 'Canada Cards and Interac',
        updatedAt: '2026-03-21 16:40:00',
        legalStatus: 'Completed',
        legalUpdatedAt: '2026-03-21 16:40:00',
        legalUpdatedBy: 'Pricing Legal',
        link: 'https://drive.example.com/nuvei/canada-cards-pricing',
        remark: 'Canada acquiring scope with card and Interac settlement assumptions for fund review.',
        attachments: [
          {
            uid: 'proposal-nuvei-canada-cards-pack',
            name: 'nuvei-canada-cards-pricing-pack.txt',
            size: 22640,
            type: 'text/plain',
            status: 'done',
            downloadUrl: buildDemoDownloadUrl(
              'Nuvei Canada Pricing Pack',
              'Nuvei Canada Pricing Pack\n\nIncludes card and Interac settlement assumptions, FX reference, and fund review notes.',
            ),
          },
        ],
        paymentMethods: [
          {
            id: 'pm-nuvei-visa',
            method: 'Card (Visa)',
            consumerRegion: [['Americas', 'Canada'], ['Americas', 'USA']],
            pricingRows: [{ tierName: 'Canada Domestic', variableRate: 1.85, fixedFeeAmount: 0.18, fixedFeeCurrency: 'CAD', floorPrice: 0.25, capPrice: 14 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'API', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 2, settlementCurrency: ['CAD', 'USD'], fxCostReference: 'Bloomberg', fxCostOperator: '+', fxCostValue: 0.28, settlementThreshold: 'CAD 250' }
          },
          {
            id: 'pm-nuvei-interac',
            method: 'Interac',
            consumerRegion: [['Americas', 'Canada']],
            pricingRows: [{ tierName: 'Interac Standard', variableRate: 1.1, fixedFeeAmount: 0.12, fixedFeeCurrency: 'CAD', floorPrice: 0.15, capPrice: 8 }],
            capabilityFlags: { refundCapability: 'Partial Refund', refundMethod: 'Portal', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 1, settlementCurrency: ['CAD'], fxCostReference: 'XE', settlementThreshold: 'CAD 200' }
          }
        ]
      }
    ]
  },
  {
    id: 8,
    channelName: '2C2P South Asia',
    channelId: 'COR-2026-023',
    companyName: '2C2P Pte. Ltd.',
    registrationGeo: 'Singapore',
    merchantGeo: [['Asia', 'Singapore'], ['Asia', 'Japan']],
    cooperationModel: ['PayFac'],
    status: 'Ongoing',
    fiopOwner: 'Alice',
    paymentMethods: ['GoPay', 'OVO'],
    supportedProducts: ['Payout'],
    supportedCurrencies: ['USDT'],
    createdAt: '2026-03-06 13:05:00',
    lastModifiedAt: '2026-03-19 15:15:00',
    complianceStatus: 'Completed',
    ndaStatus: 'Signed',
    contractStatus: 'Signed',
    pricingProposalStatus: 'Approved',
    techStatus: 'In Progress',
    globalProgress: { kyc: 'Completed', nda: 'Completed', pricing: 'Completed', contract: 'Completed', tech: 'In process' },
    submissionHistory: createSubmissionHistory({
      kyc: { date: '2026-03-08', user: 'Alice', notes: 'KYB cleared.' },
      nda: { date: '2026-03-09', user: 'Legal Team', notes: 'NDA signed.' },
      msa: { date: '2026-03-12', user: 'Legal Team', notes: 'Commercial contract executed.' },
      pricing: { date: '2026-03-14', user: 'System', notes: 'Commercial approval synced.' },
      tech: { date: '2026-03-18', user: 'Charlie', notes: 'Production deployment in verification.' },
    }),
    techStepsData: createTechStepsData('integration'),
    merchantSop: 'https://2c2p.com/docs/sop',
    pricingProposals: [
      {
        id: 'proposal-2c2p-sea-wallets',
        mode: 'PayFac',
        customProposalType: 'SEA Wallets',
        updatedAt: '2026-03-19 15:15:00',
        paymentMethods: [
          {
            id: 'pm-2c2p-gopay',
            method: 'GoPay',
            consumerRegion: [['Asia', 'Singapore'], ['Asia', 'Japan']],
            pricingRows: [{ tierName: 'Wallet Standard', variableRate: 2.2, fixedFeeAmount: 0.08, fixedFeeCurrency: 'USD', floorPrice: 0.1, capPrice: 12 }],
            capabilityFlags: { refundCapability: 'Partial Refund', refundMethod: 'API', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 1, settlementCurrency: ['USDT'], fxCostReference: 'XE' }
          },
          {
            id: 'pm-2c2p-ovo',
            method: 'OVO',
            consumerRegion: [['Asia', 'Singapore']],
            pricingRows: [{ tierName: 'Wallet Standard', fixedFeeAmount: 0.08, fixedFeeCurrency: 'USD', floorPrice: 0.1, capPrice: 10 }],
            capabilityFlags: { refundCapability: 'Partial Refund', refundMethod: 'API', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 1, settlementCurrency: ['USDT'], fxCostReference: 'Bloomberg' }
          }
        ]
      }
    ]
  }
];

export const initialChannels = rawInitialChannels.map(withChannelDefaults);

export const createDefaultDashboardViewState = () => ({
  filters: [],
  searchText: '',
  viewMode: 'corridor',
  activeCorridorViewId: DEFAULT_CORRIDOR_VIEW_ID,
  activeMatrixViewId: DEFAULT_MATRIX_VIEW_ID,
  pagination: { current: 1, pageSize: 12 },
  filterPanelVisible: false,
});

export const buildGlobalPaymentMethodCatalog = (channels: any[]) => {
  const seeds = ['Card (Visa)', 'Card (Mastercard)', 'WeChat Pay', 'Alipay'];
  const fromChannels = channels.flatMap((channel) => (
    Array.isArray(channel?.paymentMethods)
      ? channel.paymentMethods.map((paymentMethod: string) => normalizePaymentMethodName(paymentMethod))
      : []
  ));
  return [...new Set([...seeds, ...fromChannels])];
};

export const buildGlobalPricingRuleCardCatalog = (_channels: any[], existingCatalog: any[] = []) => {
  const catalogMap = new Map<string, any>();

  PRICING_RULE_CARD_SYSTEM_CATALOG.forEach((item) => {
    catalogMap.set(item.id, { ...item });
  });

  existingCatalog.forEach((item) => {
    const normalizedItem = normalizePricingRuleCardCatalogItem(item);
    if (!normalizedItem?.id || !normalizedItem?.name) return;
    catalogMap.set(normalizedItem.id, {
      ...catalogMap.get(normalizedItem.id),
      ...normalizedItem,
    });
  });

  return Array.from(catalogMap.values());
};
