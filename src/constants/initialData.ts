
import {
  buildOnboardingHistoryEntry,
  getAggregatedOnboardingStatusKey,
  getAggregatedOnboardingStatusLabel,
  getChannelOnboardingWorkflow,
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

// --- 常量定义 ---
export const GLOBAL_REGION_VALUE = 'Global';
export const DEFAULT_CORRIDOR_COLUMNS = [
  'channelName',
  'status',
  'complianceStatus',
  'ndaStatus',
  'contractStatus',
  'pricingProposalStatus',
  'techStatus',
  'fiopOwner',
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
  'status',
  'merchantGeo',
  'settlementCurrency',
  'paymentMethodName',
  'paymentMethods',
  'complianceStatus',
  'ndaStatus',
  'contractStatus',
  'pricingProposalStatus',
  'techStatus',
]);

export const DASHBOARD_FIELD_KEY_MIGRATION_MAP: Record<string, string> = {
  wooshpayOnboardingStatus: 'complianceStatus',
  corridorOnboardingStatus: 'complianceStatus',
};

export const DEFAULT_CORRIDOR_FIELD_DEFINITIONS: DashboardFieldDefinition[] = [
  { key: 'channelName', mode: 'corridor', label: 'Corridor Name', kind: 'system', sourceKey: 'channelName', order: 0, filterable: false },
  { key: 'status', mode: 'corridor', label: 'Status', kind: 'system', sourceKey: 'status', order: 1, filterable: true },
  { key: 'complianceStatus', mode: 'corridor', label: 'Compliance', kind: 'system', sourceKey: 'complianceStatus', order: 2, filterable: true },
  { key: 'ndaStatus', mode: 'corridor', label: 'NDA', kind: 'system', sourceKey: 'ndaStatus', order: 3, filterable: true },
  { key: 'contractStatus', mode: 'corridor', label: 'Contract', kind: 'system', sourceKey: 'contractStatus', order: 4, filterable: true },
  { key: 'pricingProposalStatus', mode: 'corridor', label: 'Pricing', kind: 'system', sourceKey: 'pricingProposalStatus', order: 5, filterable: true },
  { key: 'techStatus', mode: 'corridor', label: 'Tech', kind: 'system', sourceKey: 'techStatus', order: 6, filterable: true },
  { key: 'fiopOwner', mode: 'corridor', label: 'FI Owner', kind: 'system', sourceKey: 'fiopOwner', order: 7, filterable: true },
  { key: 'fiopTrackingLatest', mode: 'corridor', label: 'FIOP Tracking', kind: 'system', sourceKey: 'fiopTrackingLatest', order: 8, filterable: false },
  { key: 'cooperationModel', mode: 'corridor', label: 'Cooperation', kind: 'system', sourceKey: 'cooperationModel', order: 9, filterable: true },
  { key: 'merchantGeo', mode: 'corridor', label: 'Merchant Geo Allowed', kind: 'system', sourceKey: 'merchantGeo', order: 10, filterable: true },
  { key: 'supportedProducts', mode: 'corridor', label: 'Supported Products', kind: 'system', sourceKey: 'supportedProducts', order: 11, filterable: true },
  { key: 'createdAt', mode: 'corridor', label: 'Creation Time', kind: 'system', sourceKey: 'createdAt', order: 12, filterable: false },
  { key: 'lastModifiedAt', mode: 'corridor', label: 'Last Update Time', kind: 'system', sourceKey: 'lastModifiedAt', order: 13, filterable: false },
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
    columns: ['channelName', 'cooperationModel', 'merchantGeo', 'supportedProducts', 'status', 'fiopOwner', 'fiopTrackingLatest', 'lastModifiedAt'],
    filters: [],
    isPreset: true,
  },
  {
    id: 'manager',
    mode: 'corridor',
    name: 'FI Manager',
    description: 'Preset view focused on owners and workflow progress.',
    columns: ['channelName', 'status', 'fiopOwner', 'fiopTrackingLatest', 'complianceStatus', 'ndaStatus', 'contractStatus', 'pricingProposalStatus', 'techStatus', 'createdAt', 'lastModifiedAt'],
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
  pricing: createHistoryEntry(entries.pricing),
  tech: createHistoryEntry(entries.tech),
});

const pricingScheduleSuccessStates = new Set(['completed', 'approved', 'signed']);
const pricingScheduleInReviewStates = new Set(['in review', 'under review', 'in progress', 'pending']);
const pricingScheduleChangesRequestedStates = new Set(['changes requested', 'request changes', 'changes_request']);

const normalizeStatusLabel = (value: unknown) => String(value ?? '').trim();

export type PricingApprovalHistoryType = 'submit' | 'approve' | 'request_changes';
export type PricingApprovalQueueTab = 'pending' | 'changes_requested' | 'approved';

export interface PricingApprovalHistoryEntry {
  type: PricingApprovalHistoryType;
  time: string;
  user: string;
  note?: string;
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

export const isCompletedWorkflowState = (value: unknown) => (
  pricingScheduleSuccessStates.has(normalizeStatusLabel(value).toLowerCase())
);

export const normalizePricingProposalApprovalStatus = (proposal: any, fallbackStatus?: string) => (
  normalizeStatusLabel(proposal?.approvalStatus || fallbackStatus) || 'Not Started'
);

export const getPricingApprovalQueueTab = (value: unknown): PricingApprovalQueueTab | null => {
  const normalized = normalizeStatusLabel(value).toLowerCase();
  if (pricingScheduleInReviewStates.has(normalized)) return 'pending';
  if (pricingScheduleChangesRequestedStates.has(normalized)) return 'changes_requested';
  if (pricingScheduleSuccessStates.has(normalized)) return 'approved';
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
    const status = normalizePricingProposalApprovalStatus(proposal).toLowerCase();
    return pricingScheduleInReviewStates.has(status)
      || pricingScheduleSuccessStates.has(status)
      || pricingScheduleChangesRequestedStates.has(status);
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

        entries.push({
          type,
          time,
          user: String(entry?.user || 'Current User').trim() || 'Current User',
          note: String(entry?.note || '').trim(),
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

export const getLatestPricingApprovalHistoryEvent = (
  proposal: any,
  type?: PricingApprovalHistoryType,
) => {
  const history = Array.isArray(proposal?.approvalHistory) ? proposal.approvalHistory : [];
  const filteredHistory = type ? history.filter((entry: PricingApprovalHistoryEntry) => entry.type === type) : history;
  if (!filteredHistory.length) return null;

  return [...filteredHistory].sort((left, right) => (
    resolveApprovalHistoryTimestamp(right.time) - resolveApprovalHistoryTimestamp(left.time)
  ))[0];
};

export const buildPricingScheduleSummary = (pricingProposals: any[] = []) => {
  if (!Array.isArray(pricingProposals) || pricingProposals.length === 0) {
    return '';
  }

  const summary = pricingProposals.reduce((accumulator, proposal) => {
    const status = normalizePricingProposalApprovalStatus(proposal).toLowerCase();
    if (pricingScheduleSuccessStates.has(status)) {
      accumulator.approved += 1;
    } else if (pricingScheduleInReviewStates.has(status)) {
      accumulator.inReview += 1;
    } else if (pricingScheduleChangesRequestedStates.has(status)) {
      accumulator.changesRequested += 1;
    } else {
      accumulator.notStarted += 1;
    }
    return accumulator;
  }, { approved: 0, inReview: 0, changesRequested: 0, notStarted: 0 });

  return [
    summary.approved ? `${summary.approved} Approved` : '',
    summary.inReview ? `${summary.inReview} In Review` : '',
    summary.changesRequested ? `${summary.changesRequested} Changes Requested` : '',
    summary.notStarted ? `${summary.notStarted} Not Started` : '',
  ].filter(Boolean).join(' / ');
};

const aggregatePricingProposalStatus = (pricingProposals: any[] = []) => {
  if (!Array.isArray(pricingProposals) || pricingProposals.length === 0) {
    return 'Not Started';
  }

  const normalizedStatuses = pricingProposals.map((proposal) => (
    normalizePricingProposalApprovalStatus(proposal).toLowerCase()
  ));

  if (normalizedStatuses.some((status) => pricingScheduleInReviewStates.has(status))) {
    return 'In Review';
  }

  if (normalizedStatuses.every((status) => pricingScheduleSuccessStates.has(status))) {
    return 'Approved';
  }

  if (normalizedStatuses.some((status) => pricingScheduleChangesRequestedStates.has(status))) {
    return 'Changes Requested';
  }

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

export const withChannelDefaults = (channel: any) => {
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
  const complianceStatus = getAggregatedOnboardingStatusLabel([
    wooshpayOnboarding.status,
    corridorOnboarding.status,
  ]);
  const rawPricingProposals = Array.isArray(channel.pricingProposals) ? channel.pricingProposals : [];
  const sharedPricingHistory = createHistoryEntry((channel.submissionHistory || {}).pricing);
  const migratedPricingProposalId = resolveMigratedPricingHistoryTarget(rawPricingProposals, sharedPricingHistory);
  const pricingProposals = rawPricingProposals.map((proposal: any) => {
    const normalizedApprovalStatus = normalizePricingProposalApprovalStatus(proposal, channel.pricingProposalStatus);
    return {
      ...proposal,
      approvalStatus: normalizedApprovalStatus,
      paymentMethods: normalizeProposalPaymentMethods(proposal.paymentMethods),
      approvalHistory: normalizePricingApprovalHistory(
        proposal,
        migratedPricingProposalId,
        sharedPricingHistory,
        normalizedApprovalStatus,
      ),
    };
  });
  const ndaLegalRequestData = getLegalRequestPacket(channel, 'NDA');
  const msaLegalRequestData = getLegalRequestPacket(channel, 'MSA');
  const ndaLegalStatusHistory = getLegalStatusHistory(channel, 'NDA');
  const msaLegalStatusHistory = getLegalStatusHistory(channel, 'MSA');
  const ndaStatus = normalizeNdaStatusLabel(channel.ndaStatus || channel.globalProgress?.nda);
  const contractStatus = normalizeMsaStatusLabel(channel.contractStatus || channel.globalProgress?.contract);
  const pricingProposalStatus = resolvePricingProposalStatus(channel, pricingProposals);
  const techStatus = normalizeWorkflowStatusLabel(channel.techStatus || channel.globalProgress?.tech);

  return {
    ...channel,
    merchantGeoAllowed: channel.merchantGeoAllowed || channel.merchantGeo || [],
    merchantPolicyLink: channel.merchantPolicyLink || '',
    merchantPolicyRemark: channel.merchantPolicyRemark || '',
    merchantMidDetails: channel.merchantMidDetails || '',
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
    }),
    legalRequestData: {
      ...(channel.legalRequestData || {}),
      nda: ndaLegalRequestData,
      msa: msaLegalRequestData,
    },
    legalStatusHistory: {
      ...(channel.legalStatusHistory || {}),
      nda: ndaLegalStatusHistory,
      msa: msaLegalStatusHistory,
    },
    ndaStatus,
    contractStatus,
    pricingProposals,
    pricingProposalStatus,
    techStatus,
    globalProgress: {
      ...(channel.globalProgress || {}),
      kyc: wooshpayOnboardingStatus,
      nda: ndaStatus,
      contract: contractStatus,
      pricing: pricingProposalStatus,
      tech: techStatus,
    },
    fiopTrackingEntries,
    fiopTrackingLatestTime: latestTracking?.time || '',
    fiopTrackingLatest: latestTracking ? `${latestTracking.time} ${latestTracking.remark}` : '',
  };
};

export const buildPricingApprovalQueueRows = (channels: any[] = []): PricingApprovalQueueRow[] => (
  channels.reduce<PricingApprovalQueueRow[]>((rows, channel) => {
    const proposals = Array.isArray(channel?.pricingProposals) ? channel.pricingProposals : [];
    proposals.forEach((proposal: any) => {
      const normalizedStatus = normalizePricingProposalApprovalStatus(proposal, channel?.pricingProposalStatus);
      const queueTab = getPricingApprovalQueueTab(normalizedStatus);
      if (!queueTab) return;

      const latestSubmitEvent = getLatestPricingApprovalHistoryEvent(proposal, 'submit');
      const latestReviewEvent = queueTab === 'approved'
        ? getLatestPricingApprovalHistoryEvent(proposal, 'approve')
        : queueTab === 'changes_requested'
          ? getLatestPricingApprovalHistoryEvent(proposal, 'request_changes')
          : latestSubmitEvent;
      const fallbackEvent = latestReviewEvent
        || latestSubmitEvent
        || {
          time: proposal?.updatedAt || channel?.lastModifiedAt || '',
          user: queueTab === 'pending' ? (channel?.fiopOwner || 'Current User') : 'System',
          note: '',
        };
      const submittedAt = latestSubmitEvent?.time || proposal?.updatedAt || channel?.lastModifiedAt || '';
      const latestActionAt = queueTab === 'pending'
        ? submittedAt
        : (latestReviewEvent?.time || fallbackEvent.time || submittedAt);
      if (!latestActionAt) return;

      rows.push({
        id: `${channel.id}-${proposal.id}`,
        channel,
        proposalId: proposal.id,
        corridorName: channel.channelName || 'Unnamed Corridor',
        quotationName: proposal.customProposalType || 'Pricing Schedule',
        cooperationMode: proposal.mode || 'N/A',
        fiOwner: channel.fiopOwner || 'Unassigned',
        submittedAt,
        status: normalizedStatus,
        queueTab,
        latestActionAt,
        latestActionUser: queueTab === 'pending'
          ? (latestSubmitEvent?.user || fallbackEvent.user || channel?.fiopOwner || 'Current User')
          : (latestReviewEvent?.user || fallbackEvent.user || 'System'),
        latestActionNote: queueTab === 'pending'
          ? (latestSubmitEvent?.note || '')
          : (latestReviewEvent?.note || fallbackEvent.note || ''),
        paymentMethodCount: Array.isArray(proposal.paymentMethods) ? proposal.paymentMethods.length : 0,
      });
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
      { time: '2026-03-10 09:45:00', user: 'Charlie', action: 'Updated Capability Details', color: 'orange' },
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
    pricingProposals: [
      {
        id: 'proposal-stripe-emea-cards',
        mode: 'PayFac',
        customProposalType: 'EMEA Cards',
        updatedAt: '2026-03-18 16:20:00',
        paymentMethods: [
          {
            id: 'pm-stripe-visa',
            method: 'Card (Visa)',
            consumerRegion: [['Europe', 'UK'], ['Europe', 'Germany']],
            pricingRows: [{ tierName: 'EEA Standard', variableRate: 1.45, fixedFeeCurrency: 'USD', floorPrice: 0.3, capPrice: 12 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'API', autoDebitCapability: 'Supported', minTicket: 1, minTicketCurrency: 'USD', maxTicket: 50000, maxTicketCurrency: 'USD' },
            settlement: { cycleDays: 2, settlementCurrency: ['USD', 'EUR'], fxCostReference: 'XE', settlementThreshold: 'USD 100' }
          },
          {
            id: 'pm-stripe-mastercard',
            method: 'Card (Mastercard)',
            consumerRegion: [['Europe', 'UK'], ['Americas', 'USA']],
            pricingRows: [{ tierName: 'Core Card', fixedFeeAmount: 0.23, fixedFeeCurrency: 'USD', floorPrice: 0.3, capPrice: 12 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'API', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 2, settlementCurrency: ['USD', 'GBP'], fxCostReference: 'Bloomberg' }
          },
          {
            id: 'pm-stripe-amex',
            method: 'Card (Amex)',
            consumerRegion: [['Europe', 'Germany'], ['Americas', 'USA']],
            pricingRows: [{ tierName: 'Premium Cards', variableRate: 2.35, fixedFeeAmount: 0.28, fixedFeeCurrency: 'USD', floorPrice: 0.35, capPrice: 18 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'API', autoDebitCapability: 'In Conditions' },
            settlement: { cycleDays: 3, settlementCurrency: ['USD'], fxCostReference: 'XE' }
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
          title: 'Corridor onboarding marked as no need',
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
          title: 'Corridor onboarding package submitted',
          remark: 'Existing APAC diligence pack reused from the regional approval baseline.',
          status: 'self_preparation',
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
            settlement: { cycleDays: 1, settlementCurrency: ['USD', 'HKD'], fxCostReference: 'XE' }
          },
          {
            id: 'pm-adyen-alipay',
            method: 'Alipay',
            consumerRegion: [['Asia', 'Singapore'], ['Asia', 'Japan']],
            pricingRows: [{ tierName: 'Cross-border Wallet', variableRate: 1.18, fixedFeeCurrency: 'HKD', floorPrice: 0.2, capPrice: 18 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'Portal', autoDebitCapability: 'Not Supported' },
            settlement: { cycleDays: 1, settlementCurrency: ['USD', 'HKD'], fxCostReference: 'Bloomberg' }
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
      { time: '2026-03-10 09:45:00', user: 'Charlie', action: 'Updated Capability Details', color: 'orange' },
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
      status: 'self_preparation',
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
          title: 'WooshPay onboarding package submitted',
          remark: 'Initial WooshPay package submitted for LatAm onboarding.',
          status: 'self_preparation',
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
      status: 'self_preparation',
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
          title: 'Status updated to Corridor preparation',
          remark: 'Please confirm the latest fallback payout contact and escalation path.',
          status: 'self_preparation',
          time: '2026-03-17 17:25:00',
          actorName: 'Compliance User',
          actorRole: 'reviewer',
          attachments: [],
        },
        {
          id: 'dlocal-corridor-submission-1',
          eventType: 'submission',
          title: 'Corridor onboarding package submitted',
          remark: 'Primary corridor ops contact for settlement controls follow-up and fallback payout routing.',
          status: 'self_preparation',
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
    pricingProposals: [
      {
        id: 'proposal-worldpay-core-cards',
        mode: 'PayFac',
        customProposalType: 'Core Cards',
        updatedAt: '2026-03-19 09:40:00',
        paymentMethods: [
          {
            id: 'pm-worldpay-visa',
            method: 'Card (Visa)',
            consumerRegion: [['Europe', 'UK'], ['Europe', 'Ireland']],
            pricingRows: [{ tierName: 'Domestic', variableRate: 2.75, fixedFeeAmount: 0.2, fixedFeeCurrency: 'EUR', floorPrice: 0.25, capPrice: 16 }],
            capabilityFlags: { refundCapability: 'Full Refund', refundMethod: 'Portal', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 3, settlementCurrency: ['EUR', 'GBP'], fxCostReference: 'Bloomberg' }
          },
          {
            id: 'pm-worldpay-maestro',
            method: 'Card (Maestro)',
            consumerRegion: [['Europe', 'UK']],
            pricingRows: [{ tierName: 'Debit', variableRate: 1.95, fixedFeeAmount: 0.18, fixedFeeCurrency: 'EUR', floorPrice: 0.2, capPrice: 12 }],
            capabilityFlags: { refundCapability: 'Partial Refund', refundMethod: 'Portal', autoDebitCapability: 'Supported' },
            settlement: { cycleDays: 3, settlementCurrency: ['EUR'], fxCostReference: 'XE' }
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
      { time: '2026-03-10 09:45:00', user: 'Charlie', action: 'Updated Capability Details', color: 'orange' },
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
    pricingProposals: [
      {
        id: 'proposal-payu-latam-apms',
        mode: 'MoR',
        customProposalType: 'LatAm APMs',
        updatedAt: '2026-03-16 14:35:00',
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
