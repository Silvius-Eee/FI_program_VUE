import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { 
  DASHBOARD_VIEW_STATE_STORAGE_KEY,
  DASHBOARD_FIELD_KEY_MIGRATION_MAP,
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
  type DashboardFieldDefinition,
  type DashboardFieldGroup,
  type DashboardFieldSchema,
  type DashboardViewFilterCondition,
  type DashboardViewMode,
  type SavedDashboardView,
  normalizePricingRuleCardCatalogItem,
  withChannelDefaults,
} from '../constants/initialData';
import type { OnboardingTrack } from '../constants/onboarding';

type PersistedDashboardViewsState = {
  corridorViews?: unknown;
  activeCorridorViewId?: unknown;
  matrixViews?: unknown;
  activeMatrixViewId?: unknown;
  corridorFieldSchema?: unknown;
  matrixFieldSchema?: unknown;
};

type PersistedChannelDataState = {
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
};

type KycQueueTab = 'in_progress' | 'need_fi_input' | 'done';

type KycQueueFilters = {
  keyword: string;
  track: 'all' | OnboardingTrack;
  owner: string;
};

const CHANNEL_DATA_STORAGE_KEY = 'fi-dashboard-channel-data';
const buildKycHubDraftKey = (channelId: unknown, track: OnboardingTrack) => `${String(channelId ?? '')}:${track}`;

const canUseLocalStorage = () => (
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
);

const cloneChannelList = (channels: any[]) => (
  Array.isArray(channels) ? channels.map((channel) => withChannelDefaults(channel)) : []
);

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
    if (!normalized || !validColumns.includes(normalized) || columns.includes(normalized)) {
      return columns;
    }

    columns.push(normalized);
    return columns;
  }, []);
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

      const label = String(rawField.label ?? fallbackField?.label ?? '').trim();
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
    const columns = sanitizeStoredColumns(candidate.columns, validColumns);
    const rawColumns = Array.isArray(candidate.columns)
      ? candidate.columns.map((column) => String(column ?? '').trim())
      : [];
    const hadLegacyComplianceColumn = rawColumns.includes('complianceStatus');
    if (
      mode === 'corridor'
      && hadLegacyComplianceColumn
      && columns.includes('wooshpayOnboardingStatus')
      && !columns.includes('corridorOnboardingStatus')
    ) {
      const wooshpayIndex = columns.indexOf('wooshpayOnboardingStatus');
      columns.splice(wooshpayIndex + 1, 0, 'corridorOnboardingStatus');
    }
    if (!name || !columns.length) return views;

    const rawId = String(candidate.id ?? '').trim() || buildFallbackViewId(mode, index);
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
  const fallbackChannelList = cloneChannelList(initialChannels);
  const fallbackGlobalPricingRuleCardCatalog = buildGlobalPricingRuleCardCatalog(fallbackChannelList);
  const fallbackKycHubDraftMap = {};
  const fallbackKycHubTrack: OnboardingTrack = 'wooshpay';
  const fallbackKycHubPerspective = 'submit';
  const fallbackKycHubReturnView = 'detail';
  const fallbackKycQueueTab: KycQueueTab = 'in_progress';
  const fallbackKycQueueFilters: KycQueueFilters = {
    keyword: '',
    track: 'all',
    owner: 'all',
  };
  const fallbackKycQueueScrollTop = 0;

  if (!canUseLocalStorage()) {
    return {
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
    };
  }

  try {
    const rawState = window.localStorage.getItem(CHANNEL_DATA_STORAGE_KEY);
    if (!rawState) {
      return {
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
      };
    }

    const parsedState = JSON.parse(rawState) as PersistedChannelDataState;
    const storedChannelList = Array.isArray(parsedState?.channelList)
      ? parsedState.channelList.reduce<any[]>((channels, item) => {
          if (!item || typeof item !== 'object') return channels;
          channels.push(withChannelDefaults(item));
          return channels;
        }, [])
      : fallbackChannelList;
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

    return {
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
      kycQueueTab: parsedState?.kycQueueTab === 'done'
        ? 'done'
        : parsedState?.kycQueueTab === 'need_fi_input' || parsedState?.kycQueueTab === 'waiting'
          ? 'need_fi_input'
          : 'in_progress',
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
    };
  } catch {
    return {
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
    };
  }
};

export const useAppStore = defineStore('app', () => {
  const hydratedSavedViewsState = hydrateDashboardSavedViewsState();
  const hydratedChannelDataState = hydrateChannelDataState();
  const role = ref('FI');
  const view = ref('dashboard');
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
  const kycHubDraftMap = ref<Record<string, any>>(hydratedChannelDataState.kycHubDraftMap);
  const kycQueueTab = ref<KycQueueTab>(hydratedChannelDataState.kycQueueTab as KycQueueTab);
  const kycQueueFilters = ref<KycQueueFilters>(hydratedChannelDataState.kycQueueFilters as KycQueueFilters);
  const kycQueueScrollTop = ref(Number(hydratedChannelDataState.kycQueueScrollTop || 0));
  const normalizeGlobalPricingRuleCardCatalog = () => {
    globalPricingRuleCardCatalog.value = buildGlobalPricingRuleCardCatalog(
      channelList.value,
      globalPricingRuleCardCatalog.value.map((item: any) => normalizePricingRuleCardCatalogItem(item)).filter(Boolean),
    );
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

      window.localStorage.setItem(DASHBOARD_VIEW_STATE_STORAGE_KEY, JSON.stringify(payload));
    },
    { deep: true },
  );

  watch(
    [
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
    ],
    () => {
      if (!canUseLocalStorage()) return;

      const payload = {
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
      };

      window.localStorage.setItem(CHANNEL_DATA_STORAGE_KEY, JSON.stringify(payload));
    },
    { deep: true },
  );

  // Actions
  const setRole = (newRole: string) => {
    role.value = newRole;
  };

  const setView = (newView: string) => {
    view.value = newView;
  };

  const setSelectedChannel = (channel: any) => {
    const matchedChannel = channel
      ? channelList.value.find((item) => item.id === channel.id) || channel
      : null;
    const nextChannel = matchedChannel ? withChannelDefaults(matchedChannel) : null;
    selectedChannel.value = nextChannel;
    if (nextChannel) {
      techStepsData.value = nextChannel.techStepsData || createTechStepsData('notStarted');
    } else {
      techStepsData.value = createTechStepsData('notStarted');
    }
  };

  const setChannelList = (list: any[]) => {
    channelList.value = cloneChannelList(list);
    if (selectedChannel.value?.id) {
      const matchedChannel = channelList.value.find((channel) => channel.id === selectedChannel.value.id) || null;
      setSelectedChannel(matchedChannel);
    }
    globalPaymentMethodCatalog.value = buildGlobalPaymentMethodCatalog(channelList.value);
    normalizeGlobalPricingRuleCardCatalog();
  };

  const createChannel = (channel: any) => {
    const normalizedChannel = withChannelDefaults(channel);
    channelList.value = [normalizedChannel, ...channelList.value];
    globalPaymentMethodCatalog.value = buildGlobalPaymentMethodCatalog(channelList.value);
    normalizeGlobalPricingRuleCardCatalog();
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
    view.value = 'dashboard';
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
    view.value = 'kycSubmit';
  };

  const closeKycSubmit = () => {
    if (kycHubReturnView.value === 'detail' || kycHubReturnView.value === 'pricing') {
      view.value = 'detail';
      return;
    }

    view.value = 'dashboard';
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
    view.value = 'kycReviewDetail';
  };

  const closeKycReviewDetail = () => {
    view.value = 'dashboard';
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

  return {
    role,
    view,
    selectedChannel,
    channelList,
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
    kycHubDraftMap,
    kycQueueTab,
    kycQueueFilters,
    kycQueueScrollTop,
    setRole,
    setView,
    setSelectedChannel,
    setChannelList,
    createChannel,
    updateChannel,
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
    openKycSubmit,
    closeKycSubmit,
    openKycReviewDetail,
    closeKycReviewDetail,
    openKycHub,
    closeKycHub,
    getKycHubDraft,
    setKycHubDraft,
    clearKycHubDraft,
  };
});
