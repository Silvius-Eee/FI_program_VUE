import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  APP_USERS,
  DASHBOARD_VIEW_STATE_STORAGE_KEY,
  DASHBOARD_FIELD_KEY_MIGRATION_MAP,
  DEFAULT_CURRENT_USER_ID,
  initialChannels, 
  INITIAL_CORRIDOR_VIEWS, 
  INITIAL_MATRIX_VIEWS,
  DEFAULT_CORRIDOR_VIEW_ID,
  DEFAULT_MATRIX_VIEW_ID,
  createDefaultDashboardViewState,
  createDefaultDashboardFieldSchema,
  buildGlobalPaymentMethodCatalog,
  buildGlobalPricingRuleCardCatalog,
  cloneSavedDashboardViews,
  cloneDashboardFieldSchema,
  createTechStepsData,
  getChannelAssignmentUserIds,
  normalizeChannelAssignment,
  type DashboardFieldDefinition,
  type DashboardFieldGroup,
  type DashboardFieldSchema,
  type DashboardViewFilterCondition,
  type DashboardViewMode,
  type SavedDashboardView,
  type AppUser,
  type AppUserRole,
  normalizePricingRuleCardCatalogItem,
  withChannelDefaults,
} from '../constants/initialData';
import type { OnboardingTrack } from '../constants/onboarding';
import type { WorkflowRole } from '../utils/workflowLifecycle';

type PersistedDashboardViewsState = {
  corridorViews?: unknown;
  activeCorridorViewId?: unknown;
  matrixViews?: unknown;
  activeMatrixViewId?: unknown;
  corridorFieldSchema?: unknown;
  matrixFieldSchema?: unknown;
};

type PersistedChannelDataState = {
  storageVersion?: unknown;
  currentUserId?: unknown;
  channelList?: unknown;
  selectedChannelId?: unknown;
  globalPricingRuleCardCatalog?: unknown;
  kycHubDraftMap?: unknown;
  kycHubTrack?: unknown;
  kycHubPerspective?: unknown;
  kycHubReturnView?: unknown;
  kycQueueTab?: unknown;
  kycQueueFilters?: unknown;
  kycQueueScrollTop?: unknown;
  legalQueuePreferredDocType?: unknown;
};

type KycQueueTab = 'reviewing' | 'preparation' | 'completed' | 'no_need';
type LegalDetailTab = 'nda' | 'msa' | 'pricing' | 'otherAttachments';
type LegalQueueDocType = 'NDA' | 'MSA' | 'PRICING' | 'OTHER_ATTACHMENTS';
type PricingEntryMode = 'default' | 'proposalScoped' | 'approvalReviewScoped' | 'fundProposalScoped' | 'fundMethodScoped';
type DetailEntryMode = 'default' | 'launchApprovalReadonly';

type KycQueueFilters = {
  keyword: string;
  track: 'all' | OnboardingTrack;
  owner: string;
};

const CHANNEL_DATA_STORAGE_KEY = 'fi-dashboard-channel-data';
const CHANNEL_DATA_STORAGE_VERSION = 6;
const buildKycHubDraftKey = (channelId: unknown, track: OnboardingTrack) => `${String(channelId ?? '')}:${track}`;

const canUseLocalStorage = () => (
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
);

const sanitizeStorageValue = (key: string, value: unknown) => {
  if (
    (key === 'url' || key === 'downloadUrl')
    && typeof value === 'string'
    && /^(data:|blob:)/i.test(value)
  ) {
    return '';
  }

  return value;
};

const setLocalStorageState = (key: string, payload: unknown) => {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(payload, sanitizeStorageValue));
  } catch (error) {
    console.warn(`Failed to persist ${key}.`, error);
  }
};

const cloneChannelList = (channels: any[]) => (
  Array.isArray(channels) ? channels.map((channel) => withChannelDefaults(channel)) : []
);

const buildChannelIdentityKeys = (channel: any = {}) => (
  (['id', 'channelId', 'channelName'] as const).reduce<string[]>((keys, field) => {
    const value = String(channel?.[field] ?? '').trim().toLowerCase();
    if (value) {
      keys.push(`${field}:${value}`);
    }
    return keys;
  }, [])
);

const initialChannelIdentityKeys = new Set(
  initialChannels.flatMap((channel) => buildChannelIdentityKeys(channel)),
);

const isInitialChannel = (channel: any = {}) => (
  buildChannelIdentityKeys(channel).some((key) => initialChannelIdentityKeys.has(key))
);

const sanitizeStoredChannelList = (channels: unknown, fallbackChannelList: any[] = []) => (
  Array.isArray(channels)
    ? channels.reduce<any[]>((result, item) => {
        if (!item || typeof item !== 'object') return result;
        result.push(withChannelDefaults(item));
        return result;
      }, [])
    : fallbackChannelList
);

const buildMigratedChannelList = (storedChannels: unknown, fallbackChannelList: any[]) => {
  const userCreatedChannels = sanitizeStoredChannelList(storedChannels)
    .filter((channel) => !isInitialChannel(channel));

  return [...userCreatedChannels, ...fallbackChannelList];
};

const resolvePersistedCurrentUserId = (value: unknown, fallback = DEFAULT_CURRENT_USER_ID) => {
  const userId = String(value || '').trim();
  return APP_USERS.some((user) => user.id === userId) ? userId : fallback;
};

const hasFundSubmissionTrace = (approval: any = {}) => (
  Boolean(String(approval?.submittedAt || '').trim())
  || Boolean(String(approval?.submittedBy || '').trim())
  || Boolean(String(approval?.lastActionAt || '').trim())
  || Boolean(String(approval?.lastActionBy || '').trim())
  || ['approved', 'changes_requested'].includes(String(approval?.status || '').trim().toLowerCase())
  || (Array.isArray(approval?.history) && approval.history.length > 0)
);

const hasStaleFundMockData = (channels: unknown) => {
  if (!Array.isArray(channels)) return false;
  const channelByName = new Map(channels.map((channel: any) => [String(channel?.channelName || '').trim(), channel]));
  const stripe = channelByName.get('Stripe Global');
  const worldpay = channelByName.get('Worldpay EMEA');
  const nuvei = channelByName.get('Nuvei Canada');
  const stripePricing = Array.isArray(stripe?.pricingProposals)
    ? stripe.pricingProposals.find((proposal: any) => proposal?.id === 'proposal-stripe-emea-cards')
    : null;
  const worldpayLaunchStatus = String(worldpay?.launchApproval?.status || '').trim();
  const hasLegacyWorldpayFundTrace = (
    Boolean(worldpay)
    && hasFundSubmissionTrace(worldpay?.fundApproval)
    && (!worldpayLaunchStatus || worldpayLaunchStatus === 'not_submitted')
  );

  return (
    !nuvei
    || Boolean(stripe && !stripePricing)
    || hasLegacyWorldpayFundTrace
  );
};

const buildFallbackViewId = (mode: DashboardViewMode, index: number) => (
  `${mode}-view-${Date.now()}-${index}`
);

const sanitizeStoredFilterConditions = (value: unknown): DashboardViewFilterCondition[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<DashboardViewFilterCondition[]>((filters, item, index) => {
    if (!item || typeof item !== 'object') return filters;

    const candidate = item as Record<string, unknown>;
    const operator = String(candidate.operator ?? '').trim();
    if (!operator) return filters;

    const id = String(candidate.id ?? '').trim() || `filter-${Date.now()}-${index}`;
    const fieldKey = DASHBOARD_FIELD_KEY_MIGRATION_MAP[String(candidate.fieldKey ?? '').trim()]
      || String(candidate.fieldKey ?? '').trim();
    if (fieldKey === 'complianceStatus') return filters;
    const rawValue = candidate.value;

    filters.push({
      id,
      fieldKey: fieldKey || undefined,
      operator,
      value: rawValue === undefined || rawValue === null ? undefined : String(rawValue),
    });

    return filters;
  }, []);
};

const sanitizeStoredColumns = (value: unknown, validColumns: string[]) => {
  if (!Array.isArray(value)) return [];

  return value.reduce<string[]>((columns, item) => {
    const normalized = DASHBOARD_FIELD_KEY_MIGRATION_MAP[String(item ?? '').trim()]
      || String(item ?? '').trim();
    if (normalized === 'complianceStatus') {
      ['wooshpayOnboardingStatus', 'corridorOnboardingStatus'].forEach((columnKey) => {
        if (validColumns.includes(columnKey) && !columns.includes(columnKey)) {
          columns.push(columnKey);
        }
      });
      return columns;
    }

    if (!normalized || !validColumns.includes(normalized) || columns.includes(normalized)) {
      return columns;
    }

    columns.push(normalized);
    return columns;
  }, []);
};

const CORRIDOR_PRESET_VIEW_IDS_REQUIRING_STATUS = new Set(['all-fields', 'fibd', 'manager']);

const ensureCorridorPresetStatusColumn = (
  mode: DashboardViewMode,
  viewId: string,
  columns: string[],
  validColumns: string[],
) => {
  if (
    mode !== 'corridor'
    || !CORRIDOR_PRESET_VIEW_IDS_REQUIRING_STATUS.has(viewId)
    || !validColumns.includes('status')
    || columns.includes('status')
  ) {
    return columns;
  }

  const nextColumns = [...columns];
  const channelNameIndex = nextColumns.indexOf('channelName');
  nextColumns.splice(channelNameIndex >= 0 ? channelNameIndex + 1 : 0, 0, 'status');
  return nextColumns;
};

const normalizeOrderedItems = <T extends { order: number }>(items: T[]) => (
  [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }))
);

const sanitizeStoredFieldGroups = (
  value: unknown,
  mode: DashboardViewMode,
): DashboardFieldGroup[] => {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const groups = value.reduce<DashboardFieldGroup[]>((result, item, index) => {
    if (!item || typeof item !== 'object') return result;

    const candidate = item as Record<string, unknown>;
    const id = String(candidate.id ?? '').trim();
    const name = String(candidate.name ?? '').trim();
    if (!id || !name || seenIds.has(id)) return result;

    seenIds.add(id);
    result.push({
      id,
      mode,
      name,
      order: Number.isFinite(Number(candidate.order)) ? Number(candidate.order) : index,
    });
    return result;
  }, []);

  return normalizeOrderedItems(groups);
};

const sanitizeStoredFieldSchema = (
  value: unknown,
  mode: DashboardViewMode,
  fallbackSchema: DashboardFieldSchema,
): DashboardFieldSchema => {
  const fallback = cloneDashboardFieldSchema(fallbackSchema);
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as Record<string, unknown>;
  const groups = sanitizeStoredFieldGroups(candidate.groups, mode);
  const validGroupIds = new Set(groups.map((group) => group.id));
  const fallbackSystemFields = fallback.fields.filter((field) => field.kind === 'system');
  const fallbackSystemFieldMap = new Map(fallbackSystemFields.map((field) => [field.key, field]));
  const seenKeys = new Set<string>();
  const sanitizedFields: DashboardFieldDefinition[] = [];

  if (Array.isArray(candidate.fields)) {
    candidate.fields.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;

      const rawField = item as Record<string, unknown>;
      const key = DASHBOARD_FIELD_KEY_MIGRATION_MAP[String(rawField.key ?? '').trim()]
        || String(rawField.key ?? '').trim();
      if (!key || seenKeys.has(key)) return;

      const kind = rawField.kind === 'custom' ? 'custom' : 'system';
      const fallbackField = fallbackSystemFieldMap.get(key);
      if (kind === 'system' && !fallbackField) return;

      const label = kind === 'system'
        ? String(fallbackField?.label ?? '').trim()
        : String(rawField.label ?? fallbackField?.label ?? '').trim();
      if (!label) return;

      const sourceKey = DASHBOARD_FIELD_KEY_MIGRATION_MAP[String(rawField.sourceKey ?? fallbackField?.sourceKey ?? key).trim()]
        || String(rawField.sourceKey ?? fallbackField?.sourceKey ?? key).trim()
        || key;
      const groupId = String(rawField.groupId ?? '').trim();

      seenKeys.add(key);
      sanitizedFields.push({
        key,
        mode,
        label,
        kind,
        sourceKey,
        groupId: groupId && validGroupIds.has(groupId) ? groupId : undefined,
        order: Number.isFinite(Number(rawField.order)) ? Number(rawField.order) : (fallbackField?.order ?? index),
        filterable: rawField.filterable === undefined ? Boolean(fallbackField?.filterable) : Boolean(rawField.filterable),
      });
    });
  }

  fallbackSystemFields.forEach((field) => {
    if (seenKeys.has(field.key)) return;
    sanitizedFields.push(cloneDashboardFieldSchema({ fields: [field], groups: [] }).fields[0]);
  });

  return {
    fields: normalizeOrderedItems(sanitizedFields).map((field) => ({
      ...field,
      groupId: field.groupId && validGroupIds.has(field.groupId) ? field.groupId : undefined,
    })),
    groups,
  };
};

const sanitizeStoredViews = (
  value: unknown,
  mode: DashboardViewMode,
  validColumns: string[],
  fallbackViews: SavedDashboardView[],
) => {
  if (!Array.isArray(value)) return cloneSavedDashboardViews(fallbackViews);

  const seenIds = new Set<string>();
  const sanitizedViews = value.reduce<SavedDashboardView[]>((views, item, index) => {
    if (!item || typeof item !== 'object') return views;

    const candidate = item as Record<string, unknown>;
    const name = String(candidate.name ?? '').trim();
    const rawId = String(candidate.id ?? '').trim() || buildFallbackViewId(mode, index);
    const columns = ensureCorridorPresetStatusColumn(
      mode,
      rawId,
      sanitizeStoredColumns(candidate.columns, validColumns),
      validColumns,
    );
    if (!name || !columns.length) return views;

    if (seenIds.has(rawId)) return views;
    seenIds.add(rawId);

    views.push({
      id: rawId,
      mode,
      name,
      description: String(candidate.description ?? '').trim(),
      columns,
      filters: sanitizeStoredFilterConditions(candidate.filters),
      isPreset: Boolean(candidate.isPreset),
    });

    return views;
  }, []);

  return sanitizedViews.length ? sanitizedViews : cloneSavedDashboardViews(fallbackViews);
};

const resolveActiveViewId = (
  activeViewId: unknown,
  views: SavedDashboardView[],
  fallbackId: string,
) => {
  const normalized = String(activeViewId ?? '').trim();
  if (normalized && views.some((view) => view.id === normalized)) {
    return normalized;
  }

  return views[0]?.id || fallbackId;
};

const hydrateDashboardSavedViewsState = () => {
  const fallbackCorridorViews = cloneSavedDashboardViews(INITIAL_CORRIDOR_VIEWS);
  const fallbackMatrixViews = cloneSavedDashboardViews(INITIAL_MATRIX_VIEWS);
  const fallbackCorridorFieldSchema = createDefaultDashboardFieldSchema('corridor');
  const fallbackMatrixFieldSchema = createDefaultDashboardFieldSchema('matrix');

  if (!canUseLocalStorage()) {
    return {
      corridorViews: fallbackCorridorViews,
      activeCorridorViewId: resolveActiveViewId(DEFAULT_CORRIDOR_VIEW_ID, fallbackCorridorViews, DEFAULT_CORRIDOR_VIEW_ID),
      matrixViews: fallbackMatrixViews,
      activeMatrixViewId: resolveActiveViewId(DEFAULT_MATRIX_VIEW_ID, fallbackMatrixViews, DEFAULT_MATRIX_VIEW_ID),
      corridorFieldSchema: fallbackCorridorFieldSchema,
      matrixFieldSchema: fallbackMatrixFieldSchema,
    };
  }

  try {
    const rawState = window.localStorage.getItem(DASHBOARD_VIEW_STATE_STORAGE_KEY);
    if (!rawState) {
      return {
        corridorViews: fallbackCorridorViews,
        activeCorridorViewId: resolveActiveViewId(DEFAULT_CORRIDOR_VIEW_ID, fallbackCorridorViews, DEFAULT_CORRIDOR_VIEW_ID),
        matrixViews: fallbackMatrixViews,
        activeMatrixViewId: resolveActiveViewId(DEFAULT_MATRIX_VIEW_ID, fallbackMatrixViews, DEFAULT_MATRIX_VIEW_ID),
        corridorFieldSchema: fallbackCorridorFieldSchema,
        matrixFieldSchema: fallbackMatrixFieldSchema,
      };
    }

    const parsedState = JSON.parse(rawState) as PersistedDashboardViewsState;
    const corridorFieldSchema = sanitizeStoredFieldSchema(parsedState?.corridorFieldSchema, 'corridor', fallbackCorridorFieldSchema);
    const matrixFieldSchema = sanitizeStoredFieldSchema(parsedState?.matrixFieldSchema, 'matrix', fallbackMatrixFieldSchema);
    const corridorViews = sanitizeStoredViews(
      parsedState?.corridorViews,
      'corridor',
      corridorFieldSchema.fields.map((field) => field.key),
      fallbackCorridorViews,
    );
    const matrixViews = sanitizeStoredViews(
      parsedState?.matrixViews,
      'matrix',
      matrixFieldSchema.fields.map((field) => field.key),
      fallbackMatrixViews,
    );

    return {
      corridorViews,
      activeCorridorViewId: resolveActiveViewId(parsedState?.activeCorridorViewId, corridorViews, DEFAULT_CORRIDOR_VIEW_ID),
      matrixViews,
      activeMatrixViewId: resolveActiveViewId(parsedState?.activeMatrixViewId, matrixViews, DEFAULT_MATRIX_VIEW_ID),
      corridorFieldSchema,
      matrixFieldSchema,
    };
  } catch {
    return {
      corridorViews: fallbackCorridorViews,
      activeCorridorViewId: resolveActiveViewId(DEFAULT_CORRIDOR_VIEW_ID, fallbackCorridorViews, DEFAULT_CORRIDOR_VIEW_ID),
      matrixViews: fallbackMatrixViews,
      activeMatrixViewId: resolveActiveViewId(DEFAULT_MATRIX_VIEW_ID, fallbackMatrixViews, DEFAULT_MATRIX_VIEW_ID),
      corridorFieldSchema: fallbackCorridorFieldSchema,
      matrixFieldSchema: fallbackMatrixFieldSchema,
    };
  }
};

const hydrateChannelDataState = () => {
  const fallbackCurrentUserId = DEFAULT_CURRENT_USER_ID;
  const fallbackChannelList = cloneChannelList(initialChannels);
  const fallbackGlobalPricingRuleCardCatalog = buildGlobalPricingRuleCardCatalog(fallbackChannelList);
  const fallbackKycHubDraftMap = {};
  const fallbackKycHubTrack: OnboardingTrack = 'wooshpay';
  const fallbackKycHubPerspective = 'submit';
  const fallbackKycHubReturnView = 'detail';
  const fallbackKycQueueTab: KycQueueTab = 'reviewing';
  const fallbackKycQueueFilters: KycQueueFilters = {
    keyword: '',
    track: 'all',
    owner: 'all',
  };
  const fallbackKycQueueScrollTop = 0;
  const fallbackLegalQueuePreferredDocType: LegalQueueDocType = 'NDA';

  if (!canUseLocalStorage()) {
    return {
      currentUserId: fallbackCurrentUserId,
      channelList: fallbackChannelList,
      selectedChannel: null,
      globalPricingRuleCardCatalog: fallbackGlobalPricingRuleCardCatalog,
      kycHubDraftMap: fallbackKycHubDraftMap,
      kycHubTrack: fallbackKycHubTrack,
      kycHubPerspective: fallbackKycHubPerspective,
      kycHubReturnView: fallbackKycHubReturnView,
      kycQueueTab: fallbackKycQueueTab,
      kycQueueFilters: fallbackKycQueueFilters,
      kycQueueScrollTop: fallbackKycQueueScrollTop,
      legalQueuePreferredDocType: fallbackLegalQueuePreferredDocType,
    };
  }

  try {
    const rawState = window.localStorage.getItem(CHANNEL_DATA_STORAGE_KEY);
    if (!rawState) {
      return {
        currentUserId: fallbackCurrentUserId,
        channelList: fallbackChannelList,
        selectedChannel: null,
        globalPricingRuleCardCatalog: fallbackGlobalPricingRuleCardCatalog,
        kycHubDraftMap: fallbackKycHubDraftMap,
        kycHubTrack: fallbackKycHubTrack,
        kycHubPerspective: fallbackKycHubPerspective,
        kycHubReturnView: fallbackKycHubReturnView,
        kycQueueTab: fallbackKycQueueTab,
        kycQueueFilters: fallbackKycQueueFilters,
        kycQueueScrollTop: fallbackKycQueueScrollTop,
        legalQueuePreferredDocType: fallbackLegalQueuePreferredDocType,
      };
    }

    const parsedState = JSON.parse(rawState) as PersistedChannelDataState;
    if (
      Number(parsedState?.storageVersion) !== CHANNEL_DATA_STORAGE_VERSION
      || hasStaleFundMockData(parsedState?.channelList)
    ) {
      const currentUserId = resolvePersistedCurrentUserId(parsedState?.currentUserId, fallbackCurrentUserId);
      const migratedChannelList = buildMigratedChannelList(parsedState?.channelList, fallbackChannelList);
      const storedSelectedChannelId = parsedState?.selectedChannelId;
      const selectedChannel = migratedChannelList.find((channel) => (
        storedSelectedChannelId !== undefined
        && storedSelectedChannelId !== null
        && String(channel.id) === String(storedSelectedChannelId)
      )) || null;
      const globalPricingRuleCardCatalog = buildGlobalPricingRuleCardCatalog(
        migratedChannelList,
        Array.isArray(parsedState?.globalPricingRuleCardCatalog) ? parsedState.globalPricingRuleCardCatalog : [],
      );

      return {
        currentUserId,
        channelList: migratedChannelList,
        selectedChannel,
        globalPricingRuleCardCatalog,
        kycHubDraftMap: fallbackKycHubDraftMap,
        kycHubTrack: fallbackKycHubTrack,
        kycHubPerspective: fallbackKycHubPerspective,
        kycHubReturnView: fallbackKycHubReturnView,
        kycQueueTab: fallbackKycQueueTab,
        kycQueueFilters: fallbackKycQueueFilters,
        kycQueueScrollTop: fallbackKycQueueScrollTop,
        legalQueuePreferredDocType: fallbackLegalQueuePreferredDocType,
      };
    }
    const storedChannelList = sanitizeStoredChannelList(parsedState?.channelList, fallbackChannelList);
    const storedSelectedChannelId = parsedState?.selectedChannelId;
    const selectedChannel = storedChannelList.find((channel) => (
      storedSelectedChannelId !== undefined
      && storedSelectedChannelId !== null
      && String(channel.id) === String(storedSelectedChannelId)
    )) || null;
    const globalPricingRuleCardCatalog = buildGlobalPricingRuleCardCatalog(
      storedChannelList,
      Array.isArray(parsedState?.globalPricingRuleCardCatalog) ? parsedState.globalPricingRuleCardCatalog : [],
    );
    const currentUserId = resolvePersistedCurrentUserId(parsedState?.currentUserId, fallbackCurrentUserId);

    return {
      currentUserId,
      channelList: storedChannelList,
      selectedChannel,
      globalPricingRuleCardCatalog,
      kycHubDraftMap: parsedState?.kycHubDraftMap && typeof parsedState.kycHubDraftMap === 'object'
        ? parsedState.kycHubDraftMap as Record<string, any>
        : fallbackKycHubDraftMap,
      kycHubTrack: parsedState?.kycHubTrack === 'corridor' ? 'corridor' : fallbackKycHubTrack,
      kycHubPerspective: parsedState?.kycHubPerspective === 'review' ? 'review' : fallbackKycHubPerspective,
      kycHubReturnView: typeof parsedState?.kycHubReturnView === 'string' && parsedState.kycHubReturnView.trim()
        ? parsedState.kycHubReturnView
        : fallbackKycHubReturnView,
      kycQueueTab: parsedState?.kycQueueTab === 'no_need'
        ? 'no_need'
        : parsedState?.kycQueueTab === 'completed' || parsedState?.kycQueueTab === 'done'
          ? 'completed'
          : parsedState?.kycQueueTab === 'preparation' || parsedState?.kycQueueTab === 'need_fi_input' || parsedState?.kycQueueTab === 'waiting'
            ? 'preparation'
            : 'reviewing',
      kycQueueFilters: parsedState?.kycQueueFilters && typeof parsedState.kycQueueFilters === 'object'
        ? {
            keyword: String((parsedState.kycQueueFilters as Record<string, unknown>).keyword || ''),
            track: (parsedState.kycQueueFilters as Record<string, unknown>).track === 'corridor'
              ? 'corridor'
              : (parsedState.kycQueueFilters as Record<string, unknown>).track === 'wooshpay'
                ? 'wooshpay'
                : 'all',
            owner: String((parsedState.kycQueueFilters as Record<string, unknown>).owner || 'all') || 'all',
          }
        : fallbackKycQueueFilters,
      kycQueueScrollTop: Number.isFinite(Number(parsedState?.kycQueueScrollTop))
        ? Number(parsedState?.kycQueueScrollTop)
        : fallbackKycQueueScrollTop,
      legalQueuePreferredDocType: parsedState?.legalQueuePreferredDocType === 'MSA'
        ? 'MSA'
        : parsedState?.legalQueuePreferredDocType === 'PRICING'
          ? 'PRICING'
          : parsedState?.legalQueuePreferredDocType === 'OTHER_ATTACHMENTS'
            ? 'OTHER_ATTACHMENTS'
            : fallbackLegalQueuePreferredDocType,
    };
  } catch {
    return {
      currentUserId: fallbackCurrentUserId,
      channelList: fallbackChannelList,
      selectedChannel: null,
      globalPricingRuleCardCatalog: fallbackGlobalPricingRuleCardCatalog,
      kycHubDraftMap: fallbackKycHubDraftMap,
      kycHubTrack: fallbackKycHubTrack,
      kycHubPerspective: fallbackKycHubPerspective,
      kycHubReturnView: fallbackKycHubReturnView,
      kycQueueTab: fallbackKycQueueTab,
      kycQueueFilters: fallbackKycQueueFilters,
      kycQueueScrollTop: fallbackKycQueueScrollTop,
      legalQueuePreferredDocType: fallbackLegalQueuePreferredDocType,
    };
  }
};

export const useAppStore = defineStore('app', () => {
  const hydratedSavedViewsState = hydrateDashboardSavedViewsState();
  const hydratedChannelDataState = hydrateChannelDataState();
  const users = ref<AppUser[]>(APP_USERS.map((user) => ({ ...user })));
  const currentUserId = ref(String(hydratedChannelDataState.currentUserId || DEFAULT_CURRENT_USER_ID));
  const currentUser = computed(() => (
    users.value.find((user) => user.id === currentUserId.value) || users.value[0] || null
  ));
  const currentUserRole = computed<AppUserRole>(() => currentUser.value?.role || 'FIOP');
  const role = computed(() => {
    if (currentUserRole.value === 'FI_SUPERVISOR') return 'FI Supervisor';
    if (currentUserRole.value === 'FIOP' || currentUserRole.value === 'FIBD') return 'FI';
    if (currentUserRole.value === 'COMPLIANCE') return 'Compliance';
    if (currentUserRole.value === 'LEGAL') return 'Legal';
    if (currentUserRole.value === 'TECH') return 'Tech';
    return 'Fund';
  });
  const currentUserName = computed(() => currentUser.value?.name || 'Current User');
  const view = ref('dashboard');
  const fundViews = ['fundWorkspace', 'fundDetail'];
  const selectedChannel = ref<any>(hydratedChannelDataState.selectedChannel);
  const channelList = ref<any[]>(hydratedChannelDataState.channelList);
  const globalPaymentMethodCatalog = ref<string[]>(buildGlobalPaymentMethodCatalog(hydratedChannelDataState.channelList));
  const globalPricingRuleCardCatalog = ref<any[]>(hydratedChannelDataState.globalPricingRuleCardCatalog);
  const corridorViews = ref<SavedDashboardView[]>(hydratedSavedViewsState.corridorViews);
  const activeCorridorViewId = ref(hydratedSavedViewsState.activeCorridorViewId);
  const matrixViews = ref<SavedDashboardView[]>(hydratedSavedViewsState.matrixViews);
  const activeMatrixViewId = ref(hydratedSavedViewsState.activeMatrixViewId);
  const corridorFieldSchema = ref<DashboardFieldSchema>(hydratedSavedViewsState.corridorFieldSchema);
  const matrixFieldSchema = ref<DashboardFieldSchema>(hydratedSavedViewsState.matrixFieldSchema);
  const dashboardViewState = ref<any>(createDefaultDashboardViewState());
  const dashboardRestoreNoticeToken = ref(0);
  const techStepsData = ref<any[]>(
    hydratedChannelDataState.selectedChannel?.techStepsData || createTechStepsData('notStarted'),
  );
  const kycHubTrack = ref<OnboardingTrack>(hydratedChannelDataState.kycHubTrack as OnboardingTrack);
  const kycHubPerspective = ref<'submit' | 'review'>(hydratedChannelDataState.kycHubPerspective as 'submit' | 'review');
  const kycHubReturnView = ref(String(hydratedChannelDataState.kycHubReturnView || 'detail'));
  const legalDetailReturnView = ref('detail');
  const fundSubmitReturnView = ref('detail');
  const pricingReturnView = ref('detail');
  const pricingApprovalReturnView = ref('pricingApprovalWorkspace');
  const pricingEntryMode = ref<PricingEntryMode>('default');
  const detailEntryMode = ref<DetailEntryMode>('default');
  const detailReturnView = ref('dashboard');
  const legalDetailActiveTab = ref<LegalDetailTab>('nda');
  const legalQueuePreferredDocType = ref<LegalQueueDocType>(
    hydratedChannelDataState.legalQueuePreferredDocType as LegalQueueDocType || 'NDA',
  );
  const selectedPricingProposalId = ref<string | null>(null);
  const selectedPricingMethodId = ref<string | null>(null);
  const kycHubDraftMap = ref<Record<string, any>>(hydratedChannelDataState.kycHubDraftMap);
  const kycQueueTab = ref<KycQueueTab>(hydratedChannelDataState.kycQueueTab as KycQueueTab);
  const kycQueueFilters = ref<KycQueueFilters>(hydratedChannelDataState.kycQueueFilters as KycQueueFilters);
  const kycQueueScrollTop = ref(Number(hydratedChannelDataState.kycQueueScrollTop || 0));
  const visibleChannels = computed(() => {
    if (!currentUser.value) return [];
    if (currentUserRole.value === 'FI_SUPERVISOR') return channelList.value;
    if (currentUserRole.value === 'FIOP' || currentUserRole.value === 'FIBD') {
      return channelList.value.filter((channel) => getChannelAssignmentUserIds(channel).includes(currentUserId.value));
    }
    return channelList.value;
  });
  const normalizeGlobalPricingRuleCardCatalog = () => {
    globalPricingRuleCardCatalog.value = buildGlobalPricingRuleCardCatalog(
      channelList.value,
      globalPricingRuleCardCatalog.value.map((item: any) => normalizePricingRuleCardCatalogItem(item)).filter(Boolean),
    );
  };
  const buildChannelDataStoragePayload = () => ({
    storageVersion: CHANNEL_DATA_STORAGE_VERSION,
    currentUserId: currentUserId.value,
    channelList: cloneChannelList(channelList.value),
    selectedChannelId: selectedChannel.value?.id ?? null,
    globalPricingRuleCardCatalog: globalPricingRuleCardCatalog.value
      .map((item: any) => normalizePricingRuleCardCatalogItem(item))
      .filter(Boolean),
    kycHubDraftMap: { ...kycHubDraftMap.value },
    kycHubTrack: kycHubTrack.value,
    kycHubPerspective: kycHubPerspective.value,
    kycHubReturnView: kycHubReturnView.value,
    kycQueueTab: kycQueueTab.value,
    kycQueueFilters: { ...kycQueueFilters.value },
    kycQueueScrollTop: kycQueueScrollTop.value,
    legalQueuePreferredDocType: legalQueuePreferredDocType.value,
  });
  const persistChannelDataState = () => {
    setLocalStorageState(CHANNEL_DATA_STORAGE_KEY, buildChannelDataStoragePayload());
  };
  const resolveWorkflowActorRole = (user: AppUser | null = currentUser.value): WorkflowRole | null => {
    if (!user) return null;
    if (user.role === 'FIOP' || user.role === 'FIBD') return 'FIOP';
    if (user.role === 'COMPLIANCE') return 'Compliance';
    if (user.role === 'LEGAL') return 'Legal';
    if (user.role === 'FI_SUPERVISOR') return 'FI Supervisor';
    return null;
  };
  const canCreateChannel = () => (
    currentUserRole.value === 'FI_SUPERVISOR'
    || currentUserRole.value === 'FIOP'
    || currentUserRole.value === 'FIBD'
  );
  const canManageAssignments = (_channel?: any) => currentUserRole.value === 'FI_SUPERVISOR';
  const canAccessChannel = (channel: any) => {
    if (!channel || !currentUser.value) return false;
    if (currentUserRole.value === 'FI_SUPERVISOR') return true;
    if (currentUserRole.value === 'FIOP' || currentUserRole.value === 'FIBD') {
      return getChannelAssignmentUserIds(channel).includes(currentUserId.value);
    }
    return true;
  };
  const canOperateFiWork = (channel: any) => {
    if (!channel || !currentUser.value) return false;
    return (
      currentUserRole.value === 'FI_SUPERVISOR'
      || ((currentUserRole.value === 'FIOP' || currentUserRole.value === 'FIBD') && canAccessChannel(channel))
    );
  };
  const openLegalApprovalWorkspace = (preferredDocType?: LegalQueueDocType | null) => {
    legalQueuePreferredDocType.value = preferredDocType || legalQueuePreferredDocType.value || 'NDA';
    selectedPricingProposalId.value = null;
    selectedPricingMethodId.value = null;
    view.value = 'legalApprovalWorkspace';
  };
  const resetPageContext = () => {
    selectedChannel.value = null;
    selectedPricingProposalId.value = null;
    selectedPricingMethodId.value = null;
    techStepsData.value = createTechStepsData('notStarted');
    legalDetailReturnView.value = 'detail';
    fundSubmitReturnView.value = 'detail';
    pricingReturnView.value = 'detail';
    pricingApprovalReturnView.value = 'pricingApprovalWorkspace';
    pricingEntryMode.value = 'default';
    detailEntryMode.value = 'default';
    detailReturnView.value = 'dashboard';
    legalDetailActiveTab.value = 'nda';
    kycHubReturnView.value = 'detail';
    kycHubPerspective.value = 'submit';
  };
  const resetToRoleHome = (targetRole: AppUserRole) => {
    resetPageContext();

    if (targetRole === 'LEGAL') {
      view.value = 'legalApprovalWorkspace';
      return;
    }

    if (targetRole === 'FUND') {
      view.value = 'fundWorkspace';
      return;
    }

    view.value = 'dashboard';
  };
  const syncViewAccess = () => {
    if (selectedChannel.value && !canAccessChannel(selectedChannel.value)) {
      selectedChannel.value = null;
      selectedPricingProposalId.value = null;
      selectedPricingMethodId.value = null;
      legalDetailActiveTab.value = 'nda';
      techStepsData.value = createTechStepsData('notStarted');
    }

    if (currentUserRole.value === 'FUND') {
      const isFundPricingScoped = (
        view.value === 'pricing'
        && (pricingEntryMode.value === 'fundProposalScoped' || pricingEntryMode.value === 'fundMethodScoped')
        && Boolean(selectedChannel.value)
        && Boolean(selectedPricingProposalId.value)
        && (
          pricingEntryMode.value !== 'fundMethodScoped'
          || Boolean(selectedPricingMethodId.value)
        )
      );

      if (isFundPricingScoped) {
        return;
      }

      selectedPricingProposalId.value = null;
      selectedPricingMethodId.value = null;
      if (view.value === 'fundDetail' && !selectedChannel.value) {
        view.value = 'fundWorkspace';
        return;
      }
      if (!fundViews.includes(view.value)) {
        view.value = 'fundWorkspace';
      }
      return;
    }

    if (fundViews.includes(view.value)) {
      selectedPricingProposalId.value = null;
      selectedPricingMethodId.value = null;
      view.value = 'dashboard';
      return;
    }

    if (view.value === 'pricingApprovalDetail' && currentUserRole.value !== 'FI_SUPERVISOR') {
      selectedPricingProposalId.value = null;
      selectedPricingMethodId.value = null;
      view.value = selectedChannel.value ? 'detail' : 'dashboard';
      return;
    }

    if (view.value === 'pricingApprovalWorkspace' && currentUserRole.value !== 'FI_SUPERVISOR') {
      selectedPricingProposalId.value = null;
      selectedPricingMethodId.value = null;
      view.value = selectedChannel.value ? 'detail' : 'dashboard';
      return;
    }

    if (view.value === 'launchApprovalWorkspace' && currentUserRole.value !== 'FI_SUPERVISOR') {
      selectedPricingProposalId.value = null;
      selectedPricingMethodId.value = null;
      view.value = selectedChannel.value ? 'detail' : 'dashboard';
      return;
    }

    if (view.value === 'kycReviewDetail' && currentUserRole.value !== 'COMPLIANCE') {
      view.value = 'dashboard';
      return;
    }

    if (currentUserRole.value !== 'LEGAL' && view.value === 'legalDetail' && legalDetailActiveTab.value !== 'pricing') {
      if (!selectedChannel.value) {
        view.value = 'dashboard';
      }
    }

    if (
      ['detail', 'pricing', 'kycSubmit', 'legalDetail', 'ndaDetail', 'msaDetail', 'fundDetail', 'fundSubmit'].includes(view.value)
      && !selectedChannel.value
    ) {
      selectedPricingProposalId.value = null;
      selectedPricingMethodId.value = null;
      view.value = 'dashboard';
      return;
    }

    if (currentUserRole.value === 'COMPLIANCE') {
      if (
        view.value === 'kycSubmit'
        || view.value === 'fundSubmit'
        || view.value === 'detail'
        || view.value === 'pricing'
        || view.value === 'pricingApprovalWorkspace'
        || view.value === 'pricingApprovalDetail'
        || view.value === 'launchApprovalWorkspace'
        || view.value === 'form'
        || view.value === 'legalDetail'
        || view.value === 'ndaDetail'
        || view.value === 'msaDetail'
      ) {
        selectedPricingProposalId.value = null;
        selectedPricingMethodId.value = null;
        view.value = 'dashboard';
      }
      return;
    }

    if (
      currentUserRole.value === 'LEGAL'
      && (
        view.value === 'kycSubmit'
        || view.value === 'fundSubmit'
        || view.value === 'kycReviewDetail'
        || view.value === 'pricingApprovalWorkspace'
        || view.value === 'pricingApprovalDetail'
        || view.value === 'launchApprovalWorkspace'
        || view.value === 'ndaDetail'
        || view.value === 'msaDetail'
      )
    ) {
      openLegalApprovalWorkspace();
      return;
    }

    if (view.value === 'form' && !canCreateChannel()) {
      view.value = selectedChannel.value ? 'detail' : 'dashboard';
      return;
    }

    if (currentUserRole.value === 'TECH' && ['detail', 'pricing', 'form', 'kycSubmit', 'fundSubmit', 'kycReviewDetail', 'legalDetail', 'pricingApprovalWorkspace', 'pricingApprovalDetail', 'launchApprovalWorkspace'].includes(view.value)) {
      selectedPricingProposalId.value = null;
      selectedPricingMethodId.value = null;
      view.value = 'dashboard';
      return;
    }
  };
  normalizeGlobalPricingRuleCardCatalog();

  watch(corridorViews, (views) => {
    if (!views.length) {
      corridorViews.value = cloneSavedDashboardViews(INITIAL_CORRIDOR_VIEWS);
      return;
    }

    if (!views.some((savedView) => savedView.id === activeCorridorViewId.value)) {
      activeCorridorViewId.value = views[0].id;
    }
  }, { deep: true });

  watch(matrixViews, (views) => {
    if (!views.length) {
      matrixViews.value = cloneSavedDashboardViews(INITIAL_MATRIX_VIEWS);
      return;
    }

    if (!views.some((savedView) => savedView.id === activeMatrixViewId.value)) {
      activeMatrixViewId.value = views[0].id;
    }
  }, { deep: true });

  watch(
    [corridorViews, activeCorridorViewId, matrixViews, activeMatrixViewId, corridorFieldSchema, matrixFieldSchema],
    () => {
      if (!canUseLocalStorage()) return;

      const payload = {
        corridorViews: cloneSavedDashboardViews(corridorViews.value),
        activeCorridorViewId: activeCorridorViewId.value,
        matrixViews: cloneSavedDashboardViews(matrixViews.value),
        activeMatrixViewId: activeMatrixViewId.value,
        corridorFieldSchema: cloneDashboardFieldSchema(corridorFieldSchema.value),
        matrixFieldSchema: cloneDashboardFieldSchema(matrixFieldSchema.value),
      };

      setLocalStorageState(DASHBOARD_VIEW_STATE_STORAGE_KEY, payload);
    },
    { deep: true },
  );

  watch(
    [
      currentUserId,
      channelList,
      selectedChannel,
      globalPricingRuleCardCatalog,
      kycHubDraftMap,
      kycHubTrack,
      kycHubPerspective,
      kycHubReturnView,
      kycQueueTab,
      kycQueueFilters,
      kycQueueScrollTop,
      legalQueuePreferredDocType,
    ],
    () => {
      persistChannelDataState();
    },
    { deep: true },
  );

  // Actions
  const setRole = (newRole: string) => {
    const matchedUser = users.value.find((user) => {
      if (!user.active) return false;
      if (newRole === 'FI') return user.role === 'FIOP' || user.role === 'FIBD';
      if (newRole === 'FI Supervisor') return user.role === 'FI_SUPERVISOR';
      if (newRole === 'Compliance') return user.role === 'COMPLIANCE';
      if (newRole === 'Legal') return user.role === 'LEGAL';
      if (newRole === 'Tech') return user.role === 'TECH';
      if (newRole === 'Fund') return user.role === 'FUND';
      return false;
    });
    if (matchedUser) {
      const isSameUser = currentUserId.value === matchedUser.id;
      currentUserId.value = matchedUser.id;
      if (!isSameUser) {
        resetToRoleHome(matchedUser.role);
        return;
      }
      syncViewAccess();
    }
  };

  const setCurrentUser = (userId: string) => {
    const matchedUser = users.value.find((user) => user.id === userId && user.active);
    if (!matchedUser) return;
    const isSameUser = currentUserId.value === matchedUser.id;
    currentUserId.value = matchedUser.id;
    if (!isSameUser) {
      resetToRoleHome(matchedUser.role);
      return;
    }
    syncViewAccess();
  };

  const setView = (newView: string) => {
    if (newView !== 'detail' && newView !== 'pricing') {
      detailEntryMode.value = 'default';
      detailReturnView.value = 'dashboard';
    }
    view.value = newView;
    syncViewAccess();
  };

  const setSelectedChannel = (channel: any) => {
    detailEntryMode.value = 'default';
    detailReturnView.value = 'dashboard';
    const matchedChannel = channel
      ? channelList.value.find((item) => item.id === channel.id) || channel
      : null;
    const nextChannel = matchedChannel ? withChannelDefaults(matchedChannel) : null;
    if (nextChannel && !canAccessChannel(nextChannel)) {
      selectedChannel.value = null;
      selectedPricingProposalId.value = null;
      selectedPricingMethodId.value = null;
      legalDetailActiveTab.value = 'nda';
      techStepsData.value = createTechStepsData('notStarted');
      if (['detail', 'pricing', 'form', 'kycSubmit', 'legalDetail', 'ndaDetail', 'msaDetail', 'fundDetail', 'fundSubmit'].includes(view.value)) {
        view.value = currentUserRole.value === 'FUND' ? 'fundWorkspace' : 'dashboard';
      }
      return;
    }
    selectedChannel.value = nextChannel;
    if (!nextChannel) {
      selectedPricingProposalId.value = null;
      selectedPricingMethodId.value = null;
      legalDetailActiveTab.value = 'nda';
    }
    if (nextChannel) {
      techStepsData.value = nextChannel.techStepsData || createTechStepsData('notStarted');
    } else {
      techStepsData.value = createTechStepsData('notStarted');
    }
    syncViewAccess();
  };

  const setChannelList = (list: any[]) => {
    channelList.value = cloneChannelList(list);
    if (selectedChannel.value?.id) {
      const matchedChannel = channelList.value.find((channel) => channel.id === selectedChannel.value.id) || null;
      setSelectedChannel(matchedChannel);
    }
    globalPaymentMethodCatalog.value = buildGlobalPaymentMethodCatalog(channelList.value);
    normalizeGlobalPricingRuleCardCatalog();
    syncViewAccess();
  };

  const createChannel = (channel: any) => {
    const normalizedChannel = withChannelDefaults(channel);
    channelList.value = [normalizedChannel, ...channelList.value];
    globalPaymentMethodCatalog.value = buildGlobalPaymentMethodCatalog(channelList.value);
    normalizeGlobalPricingRuleCardCatalog();
    syncViewAccess();
    persistChannelDataState();
    return normalizedChannel;
  };

  const updateChannel = (updatedChannel: any) => {
    const normalizedChannel = withChannelDefaults(updatedChannel);
    const index = channelList.value.findIndex(c => c.id === updatedChannel.id);
    if (index !== -1) {
      channelList.value[index] = { ...normalizedChannel };
    }
    if (selectedChannel.value?.id === updatedChannel.id) {
      selectedChannel.value = { ...normalizedChannel };
    }
    
    // Update catalogs if necessary
    globalPaymentMethodCatalog.value = buildGlobalPaymentMethodCatalog(channelList.value);
    normalizeGlobalPricingRuleCardCatalog();
    syncViewAccess();
  };

  const updateChannelAssignment = (
    channelId: string | number,
    payload: Partial<ReturnType<typeof normalizeChannelAssignment>>,
  ) => {
    const channel = channelList.value.find((item) => String(item.id) === String(channelId));
    if (!channel) return null;

    const nextAssignment = normalizeChannelAssignment({
      ...channel,
      assignment: {
        ...channel.assignment,
        ...payload,
      },
    });
    const timestamp = nextAssignment.updatedAt || channel.lastModifiedAt || '';
    const actorName = currentUserName.value;
    const updatedChannel = withChannelDefaults({
      ...channel,
      assignment: nextAssignment,
      lastModifiedAt: timestamp || channel.lastModifiedAt,
      auditLogs: [
        {
          time: timestamp || channel.lastModifiedAt || '',
          user: actorName,
          action: 'Updated channel assignments',
          color: 'purple',
        },
        ...(channel.auditLogs || []),
      ],
    });

    updateChannel(updatedChannel);
    return updatedChannel;
  };

  const createPricingRuleCardId = () => `custom-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const upsertGlobalPricingRuleCard = (name: string) => {
    const normalizedName = name?.trim();
    if (!normalizedName) return null;

    const matchedItem = globalPricingRuleCardCatalog.value.find(
      (item) => item.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (matchedItem) {
      return matchedItem;
    }

    const nextItem = {
      id: createPricingRuleCardId(),
      name: normalizedName,
      system: false,
    };
    globalPricingRuleCardCatalog.value = [...globalPricingRuleCardCatalog.value, nextItem];
    return nextItem;
  };

  const renameGlobalPricingRuleCard = (id: string, name: string) => {
    const normalizedName = name?.trim();
    if (!id || !normalizedName) return null;

    const matchedItem = globalPricingRuleCardCatalog.value.find(
      (item) => item.id !== id && item.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (matchedItem) {
      return { duplicate: true, item: matchedItem };
    }

    const index = globalPricingRuleCardCatalog.value.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const nextCatalog = [...globalPricingRuleCardCatalog.value];
    nextCatalog[index] = { ...nextCatalog[index], name: normalizedName };
    globalPricingRuleCardCatalog.value = nextCatalog;
    return nextCatalog[index];
  };

  const removeGlobalPricingRuleCard = (id: string) => {
    globalPricingRuleCardCatalog.value = globalPricingRuleCardCatalog.value.filter((item) => item.id !== id);
  };

  const returnToDashboard = () => {
    setView(currentUserRole.value === 'FUND' ? 'fundWorkspace' : 'dashboard');
  };

  const setKycHubTrack = (track: OnboardingTrack) => {
    kycHubTrack.value = track;
  };

  const setKycHubPerspective = (perspective: 'submit' | 'review') => {
    kycHubPerspective.value = perspective;
  };

  const setKycQueueTab = (tab: KycQueueTab) => {
    kycQueueTab.value = tab;
  };

  const setKycQueueFilters = (filters: Partial<KycQueueFilters>) => {
    kycQueueFilters.value = {
      ...kycQueueFilters.value,
      ...filters,
    };
  };

  const resetKycQueueFilters = () => {
    kycQueueFilters.value = {
      keyword: '',
      track: 'all',
      owner: 'all',
    };
  };

  const setKycQueueScrollTop = (value: number) => {
    kycQueueScrollTop.value = Number.isFinite(Number(value)) ? Number(value) : 0;
  };

  const openKycSubmit = (
    channel: any,
    options: {
      track?: OnboardingTrack;
      returnView?: string;
    } = {},
  ) => {
    if (channel) {
      setSelectedChannel(channel);
    }

    kycHubTrack.value = options.track || 'wooshpay';
    kycHubPerspective.value = 'submit';
    kycHubReturnView.value = options.returnView || view.value || 'detail';
    setView('kycSubmit');
  };

  const closeKycSubmit = () => {
    if (kycHubReturnView.value === 'detail' || kycHubReturnView.value === 'pricing') {
      setView('detail');
      return;
    }

    setView('dashboard');
  };

  const openLegalDetail = (
    docType: 'NDA' | 'MSA' | 'PRICING' | 'OTHER_ATTACHMENTS' = 'NDA',
    returnView = 'detail',
    options: {
      proposalId?: string | null;
    } = {},
  ) => {
    legalDetailReturnView.value = returnView || view.value || 'detail';
    legalDetailActiveTab.value = docType === 'MSA'
      ? 'msa'
      : docType === 'PRICING'
        ? 'pricing'
        : docType === 'OTHER_ATTACHMENTS'
          ? 'otherAttachments'
          : 'nda';
    selectedPricingProposalId.value = legalDetailActiveTab.value === 'pricing'
      ? Object.prototype.hasOwnProperty.call(options, 'proposalId')
        ? options.proposalId || null
        : selectedPricingProposalId.value
      : null;
    selectedPricingMethodId.value = null;
    setView('legalDetail');
  };

  const closeLegalDetail = () => {
    if (legalDetailReturnView.value === 'detail' || legalDetailReturnView.value === 'pricing') {
      setView(legalDetailReturnView.value);
      return;
    }

    setView('dashboard');
  };

  const openKycReviewDetail = (
    channel: any,
    options: {
      track?: OnboardingTrack;
    } = {},
  ) => {
    if (channel) {
      setSelectedChannel(channel);
    }

    kycHubTrack.value = options.track || 'wooshpay';
    setView('kycReviewDetail');
  };

  const closeKycReviewDetail = () => {
    setView('dashboard');
  };

  const openPricingApprovalWorkspace = () => {
    pricingApprovalReturnView.value = 'pricingApprovalWorkspace';
    pricingEntryMode.value = 'default';
    selectedPricingProposalId.value = null;
    selectedPricingMethodId.value = null;
    setView('pricingApprovalWorkspace');
  };

  const openLaunchApprovalWorkspace = () => {
    pricingEntryMode.value = 'default';
    selectedPricingProposalId.value = null;
    selectedPricingMethodId.value = null;
    setView('launchApprovalWorkspace');
  };

  const openLaunchApprovalReadonlyDetail = (channel: any) => {
    if (channel) {
      setSelectedChannel(channel);
    }
    selectedPricingProposalId.value = null;
    selectedPricingMethodId.value = null;
    pricingEntryMode.value = 'default';
    detailEntryMode.value = 'launchApprovalReadonly';
    detailReturnView.value = 'launchApprovalWorkspace';
    setView('detail');
  };

  const closeChannelDetail = () => {
    const nextReturnView = detailReturnView.value || 'dashboard';
    detailEntryMode.value = 'default';
    detailReturnView.value = 'dashboard';
    setView(nextReturnView);
  };

  const openPricingApprovalDetail = (
    channel: any,
    proposalId: string,
    options: {
      returnView?: string;
    } = {},
  ) => {
    if (channel) {
      setSelectedChannel(channel);
    }
    pricingEntryMode.value = 'default';
    selectedPricingProposalId.value = proposalId || null;
    selectedPricingMethodId.value = null;
    pricingApprovalReturnView.value = options.returnView || view.value || 'pricingApprovalWorkspace';
    setView('pricingApprovalDetail');
  };

  const closePricingApprovalDetail = () => {
    pricingEntryMode.value = 'default';
    selectedPricingProposalId.value = null;
    selectedPricingMethodId.value = null;
    setView(pricingApprovalReturnView.value || 'dashboard');
  };

  const openFundDetail = (channel: any) => {
    if (channel) {
      setSelectedChannel(channel);
    }
    selectedPricingProposalId.value = null;
    selectedPricingMethodId.value = null;
    pricingEntryMode.value = 'default';
    setView('fundDetail');
  };

  const closeFundDetail = () => {
    selectedPricingProposalId.value = null;
    selectedPricingMethodId.value = null;
    pricingEntryMode.value = 'default';
    setView('fundWorkspace');
  };

  const openFundSubmit = (
    channel: any,
    options: {
      returnView?: string;
    } = {},
  ) => {
    if (channel) {
      setSelectedChannel(channel);
    }
    selectedPricingProposalId.value = null;
    selectedPricingMethodId.value = null;
    pricingEntryMode.value = 'default';
    fundSubmitReturnView.value = options.returnView || view.value || 'detail';
    setView('fundSubmit');
  };

  const closeFundSubmit = () => {
    selectedPricingProposalId.value = null;
    selectedPricingMethodId.value = null;
    pricingEntryMode.value = 'default';
    setView(fundSubmitReturnView.value || 'detail');
  };

  const openFundPricingMethod = (
    channel: any,
    proposalId: string,
    methodId: string,
  ) => {
    openFundPricingProposal(channel, proposalId, methodId);
  };

  const openFundPricingProposal = (
    channel: any,
    proposalId: string,
    methodId?: string | null,
    returnView = 'fundDetail',
  ) => {
    if (channel) {
      setSelectedChannel(channel);
    }
    selectedPricingProposalId.value = proposalId || null;
    selectedPricingMethodId.value = methodId || null;
    pricingReturnView.value = returnView;
    pricingEntryMode.value = 'fundProposalScoped';
    setView('pricing');
  };

  const openPricingProposal = (
    proposalId?: string | null,
    options: {
      returnView?: string;
      entryMode?: PricingEntryMode;
    } = {},
  ) => {
    selectedPricingProposalId.value = proposalId || null;
    selectedPricingMethodId.value = null;
    pricingReturnView.value = options.returnView || view.value || 'detail';
    pricingEntryMode.value = options.entryMode || 'default';
    setView('pricing');
  };

  const closePricingProposal = () => {
    const nextReturnView = pricingReturnView.value || 'detail';
    pricingEntryMode.value = 'default';
    selectedPricingMethodId.value = null;

    if (
      nextReturnView !== 'pricingApprovalDetail'
      && nextReturnView !== 'legalDetail'
      && nextReturnView !== 'fundDetail'
    ) {
      selectedPricingProposalId.value = null;
    }

    if (
      nextReturnView === 'detail'
      || nextReturnView === 'legalDetail'
      || nextReturnView === 'fundDetail'
      || nextReturnView === 'fundSubmit'
      || nextReturnView === 'pricingApprovalDetail'
      || nextReturnView === 'dashboard'
    ) {
      setView(nextReturnView);
      return;
    }

    setView('dashboard');
  };

  const openKycHub = (
    channel: any,
    options: {
      track?: OnboardingTrack;
      perspective?: 'submit' | 'review';
      returnView?: string;
    } = {},
  ) => {
    if (options.perspective === 'review') {
      openKycReviewDetail(channel, { track: options.track });
      return;
    }

    openKycSubmit(channel, {
      track: options.track,
      returnView: options.returnView,
    });
  };

  const closeKycHub = () => {
    if (view.value === 'kycReviewDetail') {
      closeKycReviewDetail();
      return;
    }

    closeKycSubmit();
  };

  const getKycHubDraft = (channelId: unknown, track: OnboardingTrack) => (
    kycHubDraftMap.value[buildKycHubDraftKey(channelId, track)] || null
  );

  const setKycHubDraft = (channelId: unknown, track: OnboardingTrack, draft: Record<string, any>) => {
    const nextDraftMap = { ...kycHubDraftMap.value };
    nextDraftMap[buildKycHubDraftKey(channelId, track)] = draft;
    kycHubDraftMap.value = nextDraftMap;
  };

  const clearKycHubDraft = (channelId: unknown, track: OnboardingTrack) => {
    const nextDraftMap = { ...kycHubDraftMap.value };
    delete nextDraftMap[buildKycHubDraftKey(channelId, track)];
    kycHubDraftMap.value = nextDraftMap;
  };

  // Re-apply channel normalization once after store init so migrated statuses
  // are written back to local storage instead of only being cleaned in memory.
  setChannelList(channelList.value);
  if (selectedChannel.value) {
    setSelectedChannel(selectedChannel.value);
  }
  syncViewAccess();

  return {
    users,
    currentUserId,
    currentUser,
    currentUserRole,
    currentUserName,
    role,
    view,
    selectedChannel,
    channelList,
    visibleChannels,
    globalPaymentMethodCatalog,
    globalPricingRuleCardCatalog,
    corridorViews,
    activeCorridorViewId,
    matrixViews,
    activeMatrixViewId,
    corridorFieldSchema,
    matrixFieldSchema,
    dashboardViewState,
    dashboardRestoreNoticeToken,
    techStepsData,
    kycHubTrack,
      kycHubPerspective,
      kycHubReturnView,
      legalDetailReturnView,
      pricingReturnView,
      pricingApprovalReturnView,
      pricingEntryMode,
      detailEntryMode,
      detailReturnView,
      legalDetailActiveTab,
      legalQueuePreferredDocType,
      selectedPricingProposalId,
      selectedPricingMethodId,
    kycHubDraftMap,
    kycQueueTab,
    kycQueueFilters,
    kycQueueScrollTop,
    setRole,
    setCurrentUser,
    setView,
    setSelectedChannel,
    setChannelList,
    createChannel,
    updateChannel,
    updateChannelAssignment,
    canAccessChannel,
    canOperateFiWork,
    canCreateChannel,
    canManageAssignments,
    resolveWorkflowActorRole,
    upsertGlobalPricingRuleCard,
    renameGlobalPricingRuleCard,
    removeGlobalPricingRuleCard,
    returnToDashboard,
    setKycHubTrack,
    setKycHubPerspective,
    setKycQueueTab,
    setKycQueueFilters,
    resetKycQueueFilters,
    setKycQueueScrollTop,
    resetToRoleHome,
    openLegalApprovalWorkspace,
      openKycSubmit,
      closeKycSubmit,
      openLegalDetail,
    closeLegalDetail,
    openKycReviewDetail,
    closeKycReviewDetail,
    openPricingApprovalWorkspace,
    openLaunchApprovalWorkspace,
    openLaunchApprovalReadonlyDetail,
    closeChannelDetail,
    openPricingApprovalDetail,
    closePricingApprovalDetail,
    openFundDetail,
    openFundSubmit,
    openFundPricingProposal,
    openFundPricingMethod,
    closeFundDetail,
    closeFundSubmit,
    openPricingProposal,
    closePricingProposal,
    openKycHub,
    closeKycHub,
    getKycHubDraft,
    setKycHubDraft,
    clearKycHubDraft,
  };
});
