<script setup lang="ts">
import { ref, computed, h, reactive, watch } from 'vue';
import { useAppStore } from '../stores/app';
import { 
  INITIAL_CORRIDOR_VIEWS, 
  INITIAL_MATRIX_VIEWS,
  cloneDashboardFieldSchema,
  cloneSavedDashboardView,
  type DashboardFieldDefinition,
  type DashboardFieldSchema,
  type DashboardViewFilterCondition as PersistedDashboardFilterCondition,
  type DashboardViewMode,
  type SavedDashboardView,
  DEFAULT_MATRIX_COLUMNS,
  buildDashboardMatrixRows,
  normalizePaymentMethodName,
} from '../constants/initialData';
import { getOnboardingStatusTheme } from '../constants/onboarding';
import { supportedProductOptions } from '../constants/channelOptions';
import {
  AppstoreOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  DownloadOutlined,
  EditOutlined,
  FilterOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  MoreOutlined,
  SettingOutlined,
  TableOutlined,
  LeftOutlined
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';

const dashboardFilterOperatorValues = ['equals', 'notEquals', 'contains', 'notContains', 'isEmpty', 'isNotEmpty'] as const;
type DashboardFilterOperator = typeof dashboardFilterOperatorValues[number];

const dashboardFilterFieldKeys = [
  'supportedProducts',
  'cooperationMode',
  'fiopOwner',
  'status',
  'merchantGeo',
  'settlementCurrency',
  'paymentMethod',
  'wooshpayOnboardingStatus',
  'corridorOnboardingStatus',
  'ndaStatus',
  'contractStatus',
  'pricingProposalStatus',
  'techStatus',
] as const;
type DashboardFilterFieldKey = typeof dashboardFilterFieldKeys[number];
type DashboardFilterControlType = 'select' | 'text';

interface DashboardFilterOption {
  label: string;
  value: string;
}

interface DashboardFilterCondition extends PersistedDashboardFilterCondition {
  fieldKey?: DashboardFilterFieldKey;
  operator: DashboardFilterOperator;
}

interface DashboardFilterFieldConfig {
  key: DashboardFilterFieldKey;
  label: string;
  controlType: DashboardFilterControlType;
  options?: DashboardFilterOption[];
  valuePlaceholder?: string;
  getValue: (item: any) => string[];
  isEmpty?: (values: string[]) => boolean;
}

const store = useAppStore();
const dashboardFilterOperatorSet = new Set<string>(dashboardFilterOperatorValues);
const dashboardFilterFieldKeySet = new Set<string>(dashboardFilterFieldKeys);

const dashboardFilterOperatorOptions: Array<{ label: string; value: DashboardFilterOperator }> = [
  { label: 'Equals', value: 'equals' },
  { label: 'Not equals', value: 'notEquals' },
  { label: 'Contains', value: 'contains' },
  { label: 'Does not contain', value: 'notContains' },
  { label: 'Is empty', value: 'isEmpty' },
  { label: 'Is not empty', value: 'isNotEmpty' },
];

const dashboardOperatorsWithoutValue = new Set<DashboardFilterOperator>(['isEmpty', 'isNotEmpty']);
const defaultFilterIsEmpty = (values: string[] = []) => values.every((value) => !String(value || '').trim());
const normalizeFilterToken = (value: unknown) => String(value ?? '').trim().toLowerCase();
const normalizePaymentMethodLabel = (value: string = '') => normalizePaymentMethodName(value);
const buildUniqueOptions = (values: Array<string | null | undefined>) => (
  [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ label: value, value }))
);
const dedupeFilterOptions = (options: DashboardFilterOption[] = []) => {
  const optionMap = new Map<string, DashboardFilterOption>();
  options.forEach((option) => {
    const value = String(option?.value ?? '').trim();
    if (!value || optionMap.has(value)) return;
    optionMap.set(value, {
      value,
      label: String(option?.label ?? value).trim() || value,
    });
  });
  return Array.from(optionMap.values()).sort((a, b) => a.label.localeCompare(b.label));
};
const flattenLeafOptions = (options: any[] = []): DashboardFilterOption[] => {
  const leafOptions: DashboardFilterOption[] = [];
  const walk = (nodes: any[] = []) => {
    nodes.forEach((node) => {
      if (Array.isArray(node?.children) && node.children.length) {
        walk(node.children);
        return;
      }
      if (!node?.value) return;
      leafOptions.push({
        value: String(node.value),
        label: String(node.label ?? node.value),
      });
    });
  };
  walk(options);
  return dedupeFilterOptions(leafOptions);
};
const buildConditionSignature = (condition: DashboardFilterCondition) => (
  `${condition.fieldKey || ''}:${condition.operator}:${condition.value || ''}`
);
const createFilterCondition = (): DashboardFilterCondition => ({
  id: `filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  operator: 'equals',
});

// --- 閻樿埖鈧礁鐣鹃敓?---
const viewMode = ref<DashboardViewMode>('corridor');
const filterPopoverOpen = ref(false);
const fieldConfigPopoverOpen = ref(false);
const viewPopoverOpen = ref(false);
const viewPopoverMode = ref<'overview' | 'editor'>('overview');
const draftViewName = ref('');
const editingViewId = ref<string | null>(null);
const editorViewMode = ref<DashboardViewMode>('corridor');
const fieldEditorModalOpen = ref(false);
const fieldEditorMode = ref<'create' | 'edit'>('create');
const fieldEditorState = reactive({
  key: '',
  label: '',
  groupId: undefined as string | undefined,
});
const groupCreationModalOpen = ref(false);
const groupCreationState = reactive({
  name: '',
  fieldKeys: [] as string[],
});

// --- 鐎电厧鍤柅鏄忕帆 (鐎靛綊缍堥崢鐔笺€嶉敓? ---
const exportModalOpen = ref(false);
const exportScope = ref('page');
const selectedRowKeys = ref<any[]>([]);

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
});

const filterConditions = ref<DashboardFilterCondition[]>([]);

const merchantGeoOptions = [
  {
    value: 'Asia',
    label: 'Asia',
    children: [
      {
        value: 'East Asia',
        label: 'East Asia',
        children: [
          { value: 'CN', label: 'China (East Asia)' },
          { value: 'JP', label: 'Japan (East Asia)' },
          { value: 'HK', label: 'Hong Kong (East Asia)' },
        ],
      },
      {
        value: 'Southeast Asia',
        label: 'Southeast Asia',
        children: [
          { value: 'SG', label: 'Singapore (Southeast Asia)' },
          { value: 'ID', label: 'Indonesia (Southeast Asia)' },
        ],
      },
    ],
  },
  {
    value: 'EMEA',
    label: 'EMEA',
    children: [
      {
        value: 'Middle East',
        label: 'Middle East',
        children: [
          { value: 'AE', label: 'UAE (Middle East)' },
          { value: 'SA', label: 'Saudi Arabia (Middle East)' },
        ],
      },
      {
        value: 'Europe',
        label: 'Europe',
        children: [
          { value: 'UK', label: 'United Kingdom (Europe)' },
          { value: 'DE', label: 'Germany (Europe)' },
        ],
      },
    ],
  },
  {
    value: 'Americas',
    label: 'Americas',
    children: [
      {
        value: 'North America',
        label: 'North America',
        children: [
          { value: 'US', label: 'United States (North America)' },
          { value: 'CA', label: 'Canada (North America)' },
        ],
      },
      {
        value: 'LATAM',
        label: 'LATAM',
        children: [
          { value: 'UY', label: 'Uruguay (LATAM)' },
          { value: 'CO', label: 'Colombia (LATAM)' },
          { value: 'BR', label: 'Brazil (LATAM)' },
        ],
      },
    ],
  },
];

const settlementCurrencyCascaderOptions = [
  {
    value: 'Fiat',
    label: 'Fiat Currency',
    children: [
      { label: 'USD', value: 'USD' },
      { label: 'EUR', value: 'EUR' },
      { label: 'GBP', value: 'GBP' },
      { label: 'HKD', value: 'HKD' },
    ],
  },
  {
    value: 'Crypto',
    label: 'Crypto Currency',
    children: [
      { label: 'USDT', value: 'USDT' },
      { label: 'USDC', value: 'USDC' },
      { label: 'BTC', value: 'BTC' },
    ],
  },
];

const statusColors: any = {
  Live: { bg: '#DCFCE7', text: '#166534' },
  Ongoing: { bg: '#DBEAFE', text: '#1E40AF' },
  Offline: { bg: '#FEF3C7', text: '#92400E' },
  'Lost connection': { bg: '#F1F5F9', text: '#475569' },
};

const workflowStatusColors: Record<string, { bg: string; text: string }> = {
  Completed: { bg: '#DCFCE7', text: '#166534' },
  Signed: { bg: '#DCFCE7', text: '#166534' },
  Approved: { bg: '#DBEAFE', text: '#1D4ED8' },
  'In Review': { bg: '#E0E7FF', text: '#4338CA' },
  'Under Review': { bg: '#E0E7FF', text: '#4338CA' },
  'In Progress': { bg: '#FEF3C7', text: '#B45309' },
  'In process': { bg: '#FEF3C7', text: '#B45309' },
  'Not Started': { bg: '#F1F5F9', text: '#475569' },
  'No need': { bg: '#F8FAFC', text: '#64748B' },
  'WooshPay Preparation': { bg: '#dbeafe', text: '#1d4ed8' },
  'Corridor Preparation': { bg: '#dbeafe', text: '#1d4ed8' },
  'Corridor Reviewing': { bg: '#fee2e2', text: '#dc2626' },
  'WooshPay Reviewing': { bg: '#fee2e2', text: '#dc2626' },
};

const merchantGeoFilterOptions = flattenLeafOptions(merchantGeoOptions);
const settlementCurrencyFilterOptions = flattenLeafOptions(settlementCurrencyCascaderOptions);
const cooperationModeFilterOptions = buildUniqueOptions(['Referral', 'PayFac', 'MoR']);

const corridorBaseColumnDefs = [
  { key: 'channelName', fixed: 'left', width: 220, sorter: (a: any, b: any) => a.channelName.localeCompare(b.channelName) },
  { key: 'status', width: 120 },
  { key: 'wooshpayOnboardingStatus', width: 170 },
  { key: 'corridorOnboardingStatus', width: 170 },
  { key: 'ndaStatus', width: 120 },
  { key: 'contractStatus', width: 120 },
  { key: 'pricingProposalStatus', width: 120 },
  { key: 'techStatus', width: 120 },
  { key: 'fiopOwner', width: 120 },
  { key: 'fiopTrackingLatest', width: 320, sorter: (a: any, b: any) => dayjs(a.fiopTrackingLatestTime || 0).unix() - dayjs(b.fiopTrackingLatestTime || 0).unix() },
  { key: 'cooperationModel', width: 180 },
  { key: 'merchantGeo', width: 200 },
  { key: 'supportedProducts', width: 180 },
  { key: 'createdAt', width: 180, sorter: (a: any, b: any) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix() },
  { key: 'lastModifiedAt', width: 180, sorter: (a: any, b: any) => dayjs(a.lastModifiedAt).unix() - dayjs(b.lastModifiedAt).unix() },
];

const matrixBaseColumnDefs = DEFAULT_MATRIX_COLUMNS.map((key) => ({
  key,
  width: key === 'corridorName' ? 220 : key === 'quotationName' ? 220 : key === 'paymentMethodName' ? 220 : 170,
  fixed: key === 'corridorName' ? 'left' : undefined,
}));

const corridorColumnConfigMap = Object.fromEntries(corridorBaseColumnDefs.map((column) => [column.key, column]));
const matrixColumnConfigMap = Object.fromEntries(matrixBaseColumnDefs.map((column) => [column.key, column]));
const fieldFilterKeyMap: Partial<Record<string, DashboardFilterFieldKey[]>> = {
  supportedProducts: ['supportedProducts'],
  cooperationModel: ['cooperationMode'],
  fiopOwner: ['fiopOwner'],
  status: ['status'],
  merchantGeo: ['merchantGeo'],
  settlementCurrency: ['settlementCurrency'],
  paymentMethodName: ['paymentMethod'],
  paymentMethods: ['paymentMethod'],
  wooshpayOnboardingStatus: ['wooshpayOnboardingStatus'],
  corridorOnboardingStatus: ['corridorOnboardingStatus'],
  ndaStatus: ['ndaStatus'],
  contractStatus: ['contractStatus'],
  pricingProposalStatus: ['pricingProposalStatus'],
  techStatus: ['techStatus'],
};
const sortByOrder = <T extends { order: number }>(items: T[]) => [...items].sort((a, b) => a.order - b.order);
const cloneFieldSchema = (schema: DashboardFieldSchema) => cloneDashboardFieldSchema(schema);
const getViewsByMode = (mode: DashboardViewMode) => (
  mode === 'corridor' ? store.corridorViews : store.matrixViews
);
const setViewsByMode = (mode: DashboardViewMode, views: SavedDashboardView[]) => {
  if (mode === 'corridor') {
    store.corridorViews = views;
    return;
  }
  store.matrixViews = views;
};
const getFieldSchemaByMode = (mode: DashboardViewMode) => (
  mode === 'corridor' ? store.corridorFieldSchema : store.matrixFieldSchema
);
const setFieldSchemaByMode = (mode: DashboardViewMode, schema: DashboardFieldSchema) => {
  if (mode === 'corridor') {
    store.corridorFieldSchema = schema;
    return;
  }
  store.matrixFieldSchema = schema;
};
const normalizeFieldSchema = (schema: DashboardFieldSchema): DashboardFieldSchema => {
  const fields = sortByOrder(schema.fields).map((field, index) => ({
    ...field,
    order: index,
  }));
  const usedGroupIds = new Set(fields.map((field) => field.groupId).filter(Boolean) as string[]);
  const groups = sortByOrder(schema.groups)
    .filter((group) => usedGroupIds.has(group.id))
    .map((group, index) => ({
      ...group,
      order: index,
    }));
  const validGroupIds = new Set(groups.map((group) => group.id));
  return {
    fields: fields.map((field) => ({
      ...field,
      groupId: field.groupId && validGroupIds.has(field.groupId) ? field.groupId : undefined,
    })),
    groups,
  };
};
const updateFieldSchemaByMode = (
  mode: DashboardViewMode,
  updater: (schema: DashboardFieldSchema) => DashboardFieldSchema,
) => {
  const nextSchema = normalizeFieldSchema(updater(cloneFieldSchema(getFieldSchemaByMode(mode))));
  setFieldSchemaByMode(mode, nextSchema);
  return nextSchema;
};
const getOrderedFieldDefinitionsByMode = (mode: DashboardViewMode) => sortByOrder(getFieldSchemaByMode(mode).fields);
const getFieldDefinitionByMode = (mode: DashboardViewMode, fieldKey: string) => (
  getOrderedFieldDefinitionsByMode(mode).find((field) => field.key === fieldKey)
);
const getValidColumnsForMode = (mode: DashboardViewMode, columns: string[] = []) => {
  const visibleSet = new Set(
    columns
      .map((key) => String(key || '').trim())
      .filter(Boolean),
  );
  return getOrderedFieldDefinitionsByMode(mode)
    .filter((field) => visibleSet.has(field.key))
    .map((field) => field.key);
};
const updateViewsByMode = (
  mode: DashboardViewMode,
  updater: (view: SavedDashboardView, index: number) => SavedDashboardView,
) => {
  const nextViews = getViewsByMode(mode).map((view, index) => updater(cloneSavedDashboardView(view), index));
  setViewsByMode(mode, nextViews);
};
const getBaseColumnConfig = (mode: DashboardViewMode, key: string) => (
  mode === 'corridor' ? corridorColumnConfigMap[key] : matrixColumnConfigMap[key]
);
const buildTableColumn = (field: DashboardFieldDefinition) => {
  const baseConfig = getBaseColumnConfig(field.mode, field.key) || {};
  const sourceKey = field.sourceKey || field.key;
  return {
    ...baseConfig,
    title: field.label,
    dataIndex: sourceKey,
    key: field.key,
    fieldSourceKey: sourceKey,
    width: baseConfig.width || 180,
  };
};
const getActiveViewByMode = (mode: DashboardViewMode) => (
  mode === 'corridor'
    ? (store.corridorViews.find((view) => view.id === store.activeCorridorViewId) || INITIAL_CORRIDOR_VIEWS[0])
    : (store.matrixViews.find((view) => view.id === store.activeMatrixViewId) || INITIAL_MATRIX_VIEWS[0])
);
const activeCorridorView = computed<SavedDashboardView>(() => (
  store.corridorViews.find((view) => view.id === store.activeCorridorViewId) || INITIAL_CORRIDOR_VIEWS[0]
));
const activeMatrixView = computed<SavedDashboardView>(() => (
  store.matrixViews.find((view) => view.id === store.activeMatrixViewId) || INITIAL_MATRIX_VIEWS[0]
));
const activeSavedView = computed(() => (
  viewMode.value === 'corridor' ? activeCorridorView.value : activeMatrixView.value
));
const currentFieldSchema = computed(() => getFieldSchemaByMode(viewMode.value));
const currentFieldDefinitions = computed(() => sortByOrder(currentFieldSchema.value.fields));
const currentFieldGroupList = computed(() => sortByOrder(currentFieldSchema.value.groups));
const activeVisibleFieldKeys = computed(() => getValidColumnsForMode(viewMode.value, activeSavedView.value.columns));
const currentVisibleFields = computed(() => {
  const visibleFieldKeySet = new Set(activeVisibleFieldKeys.value);
  return currentFieldDefinitions.value.filter((field) => visibleFieldKeySet.has(field.key));
});
const currentFieldSections = computed(() => {
  const groupedSections = currentFieldGroupList.value.map((group) => ({
    id: group.id,
    label: group.name,
    fields: currentFieldDefinitions.value.filter((field) => field.groupId === group.id),
  })).filter((section) => section.fields.length > 0);

  return [
    {
      id: 'ungrouped',
      label: 'Ungrouped',
      fields: currentFieldDefinitions.value.filter((field) => !field.groupId),
    },
    ...groupedSections,
  ].filter((section) => section.id === 'ungrouped' || section.fields.length > 0);
});
const currentSavedViews = computed(() => (
  viewMode.value === 'corridor' ? store.corridorViews : store.matrixViews
));
const availableFieldGroupOptions = computed(() => currentFieldGroupList.value.map((group) => ({
  label: group.name,
  value: group.id,
})));
const activeSavedViewFilterCount = computed(() => activeSavedView.value.filters.length);
const activeSavedViewColumnCount = computed(() => activeVisibleFieldKeys.value.length);
const getModeLabel = (mode: DashboardViewMode) => (
  mode === 'corridor' ? 'Corridor' : 'Pricing Matrix'
);
const currentModeLabel = computed(() => (
  getModeLabel(viewMode.value)
));
const editorModeLabel = computed(() => getModeLabel(editorViewMode.value));
const currentViewIcon = computed(() => (
  viewMode.value === 'corridor' ? AppstoreOutlined : TableOutlined
));
const resolveFilterSchemaKey = (mode: DashboardViewMode, filterKey: DashboardFilterFieldKey) => {
  if (filterKey === 'cooperationMode') return mode === 'corridor' ? 'cooperationModel' : undefined;
  if (filterKey === 'paymentMethod') return mode === 'matrix' ? 'paymentMethodName' : 'paymentMethods';
  return filterKey;
};
const getFilterFieldLabel = (
  filterKey: DashboardFilterFieldKey,
  fallbackLabel: string,
  mode: DashboardViewMode = viewMode.value,
) => {
  const schemaKey = resolveFilterSchemaKey(mode, filterKey);
  if (!schemaKey) return fallbackLabel;
  return getFieldDefinitionByMode(mode, schemaKey)?.label || fallbackLabel;
};
const dashboardFilterFieldConfigs = computed<DashboardFilterFieldConfig[]>(() => [
  {
    key: 'supportedProducts',
    label: getFilterFieldLabel('supportedProducts', 'Supported Products'),
    controlType: 'select',
    options: supportedProductOptions.map((option) => ({ label: option.label, value: option.value })),
    valuePlaceholder: 'Select product',
    getValue: (item) => Array.isArray(item.supportedProducts) ? item.supportedProducts.map(String) : [],
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'cooperationMode',
    label: getFilterFieldLabel('cooperationMode', 'Cooperation Mode'),
    controlType: 'select',
    options: cooperationModeFilterOptions,
    valuePlaceholder: 'Select mode',
    getValue: (item) => Array.isArray(item.cooperationModel) ? item.cooperationModel.map(String) : [],
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'fiopOwner',
    label: getFilterFieldLabel('fiopOwner', 'FI Owner'),
    controlType: 'select',
    options: buildUniqueOptions(store.channelList.map((item) => item.fiopOwner)),
    valuePlaceholder: 'Select owner',
    getValue: (item) => item.fiopOwner ? [String(item.fiopOwner)] : [],
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'status',
    label: getFilterFieldLabel('status', 'Status'),
    controlType: 'select',
    options: buildUniqueOptions(store.channelList.map((item) => item.status || '').filter(Boolean)),
    valuePlaceholder: 'Select status',
    getValue: (item) => item.status ? [String(item.status)] : [],
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'merchantGeo',
    label: getFilterFieldLabel('merchantGeo', 'Merchant Geo Allowed'),
    controlType: 'select',
    options: merchantGeoFilterOptions,
    valuePlaceholder: 'Select region',
    getValue: (item) => (
      Array.isArray(item.merchantGeo)
        ? item.merchantGeo
          .map((geoPath: any) => Array.isArray(geoPath) ? geoPath[geoPath.length - 1] : geoPath)
          .filter(Boolean)
          .map(String)
        : []
    ),
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'settlementCurrency',
    label: getFilterFieldLabel('settlementCurrency', 'Settlement Currency'),
    controlType: 'select',
    options: settlementCurrencyFilterOptions,
    valuePlaceholder: 'Select currency',
    getValue: (item) => Array.isArray(item.supportedCurrencies) ? item.supportedCurrencies.map(String) : [],
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'paymentMethod',
    label: getFilterFieldLabel('paymentMethod', 'Payment Methods'),
    controlType: 'select',
    options: buildUniqueOptions(
      store.channelList.flatMap((item) => (
        Array.isArray(item.paymentMethods)
          ? item.paymentMethods.map((method: string) => normalizePaymentMethodLabel(String(method)))
          : []
      )),
    ),
    valuePlaceholder: 'Select payment method',
    getValue: (item) => (
      Array.isArray(item.paymentMethods)
        ? item.paymentMethods.map((method: string) => normalizePaymentMethodLabel(String(method)))
        : []
    ),
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'wooshpayOnboardingStatus',
    label: getFilterFieldLabel('wooshpayOnboardingStatus', 'WooshPay onboarding'),
    controlType: 'select',
    options: buildUniqueOptions(store.channelList.map((item) => item.wooshpayOnboardingStatus)),
    valuePlaceholder: 'Select status',
    getValue: (item) => item.wooshpayOnboardingStatus ? [String(item.wooshpayOnboardingStatus)] : [],
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'corridorOnboardingStatus',
    label: getFilterFieldLabel('corridorOnboardingStatus', 'Corridor onboarding'),
    controlType: 'select',
    options: buildUniqueOptions(store.channelList.map((item) => item.corridorOnboardingStatus)),
    valuePlaceholder: 'Select status',
    getValue: (item) => item.corridorOnboardingStatus ? [String(item.corridorOnboardingStatus)] : [],
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'ndaStatus',
    label: getFilterFieldLabel('ndaStatus', 'NDA Status'),
    controlType: 'select',
    options: buildUniqueOptions(store.channelList.map((item) => item.ndaStatus)),
    valuePlaceholder: 'Select status',
    getValue: (item) => item.ndaStatus ? [String(item.ndaStatus)] : [],
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'contractStatus',
    label: getFilterFieldLabel('contractStatus', 'Contract Status'),
    controlType: 'select',
    options: buildUniqueOptions(store.channelList.map((item) => item.contractStatus)),
    valuePlaceholder: 'Select status',
    getValue: (item) => item.contractStatus ? [String(item.contractStatus)] : [],
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'pricingProposalStatus',
    label: getFilterFieldLabel('pricingProposalStatus', 'Pricing Proposal'),
    controlType: 'select',
    options: buildUniqueOptions(store.channelList.map((item) => item.pricingProposalStatus)),
    valuePlaceholder: 'Select status',
    getValue: (item) => item.pricingProposalStatus ? [String(item.pricingProposalStatus)] : [],
    isEmpty: defaultFilterIsEmpty,
  },
  {
    key: 'techStatus',
    label: getFilterFieldLabel('techStatus', 'Tech Integration'),
    controlType: 'select',
    options: buildUniqueOptions(store.channelList.map((item) => item.techStatus)),
    valuePlaceholder: 'Select status',
    getValue: (item) => item.techStatus ? [String(item.techStatus)] : [],
    isEmpty: defaultFilterIsEmpty,
  },
]);
const dashboardFilterFieldOptions = computed(() => (
  dashboardFilterFieldConfigs.value.map((config) => ({
    value: config.key,
    label: config.label,
  }))
));
const dashboardFilterFieldConfigMap = computed<Record<DashboardFilterFieldKey, DashboardFilterFieldConfig>>(() => (
  dashboardFilterFieldConfigs.value.reduce((configMap, config) => {
    configMap[config.key] = config;
    return configMap;
  }, {} as Record<DashboardFilterFieldKey, DashboardFilterFieldConfig>)
));
const conditionNeedsValue = (condition: DashboardFilterCondition) => !dashboardOperatorsWithoutValue.has(condition.operator);
const getFilterConditionFieldConfig = (condition: DashboardFilterCondition) => (
  condition.fieldKey ? dashboardFilterFieldConfigMap.value[condition.fieldKey] : null
);
const getConditionValueOptions = (condition: DashboardFilterCondition) => (
  getFilterConditionFieldConfig(condition)?.options || []
);
const shouldUseSelectValueControl = (condition: DashboardFilterCondition) => (
  conditionNeedsValue(condition)
  && !['contains', 'notContains'].includes(condition.operator)
  && getConditionValueOptions(condition).length > 0
);
const isFilterConditionComplete = (condition: DashboardFilterCondition) => {
  if (!condition.fieldKey) return false;
  if (!conditionNeedsValue(condition)) return true;
  return Boolean(normalizeFilterToken(condition.value));
};
const activeFilterConditions = computed(() => filterConditions.value.filter(isFilterConditionComplete));
const isFilterButtonActive = computed(() => filterPopoverOpen.value || activeFilterConditions.value.length > 0);
const normalizeSavedViewFilters = (filters: PersistedDashboardFilterCondition[] = []): DashboardFilterCondition[] => (
  filters.reduce<DashboardFilterCondition[]>((conditions, filter, index) => {
    const operator = String(filter?.operator ?? '').trim();
    if (!dashboardFilterOperatorSet.has(operator)) return conditions;

    const fieldKey = String(filter?.fieldKey ?? '').trim();
    const normalizedCondition: DashboardFilterCondition = {
      id: String(filter?.id ?? '').trim() || `filter-${Date.now()}-${index}`,
      operator: operator as DashboardFilterOperator,
      value: filter?.value,
    };

    if (fieldKey) {
      if (!dashboardFilterFieldKeySet.has(fieldKey)) return conditions;
      normalizedCondition.fieldKey = fieldKey as DashboardFilterFieldKey;
    }

    conditions.push(normalizedCondition);
    return conditions;
  }, [])
);
const cloneActiveFilterConditions = () => (
  activeFilterConditions.value.map((condition) => ({
    id: condition.id,
    fieldKey: condition.fieldKey,
    operator: condition.operator,
    value: condition.value,
  }))
);
const applySavedViewFilters = (view: SavedDashboardView) => {
  filterConditions.value = normalizeSavedViewFilters(view.filters);
};
const setActiveViewId = (mode: DashboardViewMode, id: string) => {
  if (mode === 'corridor') {
    store.activeCorridorViewId = id;
    return;
  }

  store.activeMatrixViewId = id;
};

const handleExport = () => {
  exportModalOpen.value = true;
};

const handleConfirmExport = () => {
  const hide = message.loading('Generating export...', 0);
  setTimeout(() => {
    hide();
    let dataToExport = activeSourceData.value;
    
    if (exportScope.value === 'selected') {
      dataToExport = activeSourceData.value.filter(item => selectedRowKeys.value.includes(item.id || item.key));
    } else if (exportScope.value === 'page') {
      const start = (pagination.current - 1) * pagination.pageSize;
      dataToExport = activeSourceData.value.slice(start, start + pagination.pageSize);
    }

    const columns = currentColumns.value;
    const headers = columns.map(col => escapeCsvCell(col.title));
    const lines = [headers.join(',')];

    dataToExport.forEach(record => {
      const row = columns.map(col => {
        const fieldKey = col.dataIndex || col.key;
        return escapeCsvCell(formatExportValue(record[fieldKey as string]));
      });
      lines.push(row.join(','));
    });

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${viewMode.value === 'corridor' ? 'corridor' : 'pricing_matrix'}_export_${exportScope.value}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
    link.click();
    exportModalOpen.value = false;
    message.success(`Successfully exported ${dataToExport.length} rows`);
  }, 1000);
};

// --- 鐠侊紕鐣荤仦鐑囨嫹? 瑜版挸澧犻柅澶夎厬閻ㄥ嫬鍨?---
const currentColumns = computed(() => currentVisibleFields.value.map((field) => buildTableColumn(field)));


// --- 鐠侊紕鐣荤仦鐑囨嫹? 鏉╁洦鎶ら崥搴ｆ畱閺佺増宓?---
const doesConditionMatchRecord = (item: any, condition: DashboardFilterCondition) => {
  const fieldConfig = getFilterConditionFieldConfig(condition);
  if (!fieldConfig) return true;

  const fieldValues = fieldConfig.getValue(item).map((value) => String(value ?? ''));
  const normalizedFieldValues = fieldValues
    .map((value) => normalizeFilterToken(value))
    .filter(Boolean);
  const isEmpty = (fieldConfig.isEmpty || defaultFilterIsEmpty)(fieldValues);

  if (condition.operator === 'isEmpty') return isEmpty;
  if (condition.operator === 'isNotEmpty') return !isEmpty;

  const targetValue = normalizeFilterToken(condition.value);
  if (!targetValue) return true;

  if (condition.operator === 'equals') {
    return normalizedFieldValues.some((value) => value === targetValue);
  }
  if (condition.operator === 'notEquals') {
    return normalizedFieldValues.every((value) => value !== targetValue);
  }
  if (condition.operator === 'contains') {
    return normalizedFieldValues.some((value) => value.includes(targetValue));
  }
  return normalizedFieldValues.every((value) => !value.includes(targetValue));
};

const filteredCorridors = computed(() => {
  return store.channelList.filter((item) => (
    activeFilterConditions.value.every((condition) => doesConditionMatchRecord(item, condition))
  ));
});

const activeSourceData = computed(() => {
  if (viewMode.value === 'corridor') {
    return filteredCorridors.value;
  }
  return buildDashboardMatrixRows(filteredCorridors.value);
});

watch(
  () => [viewMode.value, store.activeCorridorViewId, store.activeMatrixViewId],
  ([nextMode, nextCorridorViewId, nextMatrixViewId], previousValue) => {
    const resolvedMode = nextMode as DashboardViewMode;
    const [prevMode, prevCorridorViewId, prevMatrixViewId] = previousValue || [];
    const modeChanged = resolvedMode !== prevMode;
    const activeViewChanged = resolvedMode === 'corridor'
      ? nextCorridorViewId !== prevCorridorViewId
      : nextMatrixViewId !== prevMatrixViewId;

    if (!modeChanged && !activeViewChanged) return;

    applySavedViewFilters(getActiveViewByMode(resolvedMode));
    if (viewPopoverMode.value !== 'editor') {
      viewPopoverMode.value = 'overview';
    }
  },
  { immediate: true },
);

watch(
  () => [viewMode.value, activeFilterConditions.value.map(buildConditionSignature).join('|')],
  () => {
    pagination.current = 1;
  },
);

watch(
  () => [activeSourceData.value.length, pagination.pageSize],
  () => {
    pagination.total = activeSourceData.value.length;
    const maxPage = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
    if (pagination.current > maxPage) {
      pagination.current = maxPage;
    }
  },
  { immediate: true },
);

// --- 娴溿倓绨伴弬瑙勭《 ---
const handleAddNew = () => {
  store.setSelectedChannel(null);
  store.setView('form');
};

const handleViewDetails = (record: any) => {
  const targetId = record.channelId || record.id;
  const channel = store.channelList.find(c => c.id === targetId || c.channelId === targetId);
  if (channel) {
    store.setSelectedChannel(channel);
    store.setView('detail');
  }
};

// --- CSV 鐎电厧鍤粻妤佺《 (1:1 鐎靛綊缍?React 妞ゅ湱娲? ---
const escapeCsvCell = (value: any) => `"${String(value || '').replace(/"/g, '""')}"`;

const formatExportValue = (value: any) => {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map(item => Array.isArray(item) ? item.join(' > ') : String(item)).join(' | ');
  }
  return String(value);
};

const updateFilterCondition = (
  conditionId: string,
  updater: (condition: DashboardFilterCondition) => DashboardFilterCondition,
) => {
  filterConditions.value = filterConditions.value.map((condition) => (
    condition.id === conditionId ? updater(condition) : condition
  ));
};

const handleAddFilterCondition = () => {
  filterConditions.value = [...filterConditions.value, createFilterCondition()];
};

const handleFilterFieldChange = (conditionId: string, fieldKey?: DashboardFilterFieldKey) => {
  updateFilterCondition(conditionId, (condition) => ({
    ...condition,
    fieldKey,
    operator: 'equals',
    value: undefined,
  }));
};

const handleFilterOperatorChange = (conditionId: string, operator: DashboardFilterOperator) => {
  updateFilterCondition(conditionId, (condition) => ({
    ...condition,
    operator,
    value: conditionNeedsValue({ ...condition, operator }) ? condition.value : undefined,
  }));
};

const handleFilterValueChange = (conditionId: string, value?: string) => {
  updateFilterCondition(conditionId, (condition) => ({
    ...condition,
    value,
  }));
};

const handleRemoveFilterCondition = (conditionId: string) => {
  filterConditions.value = filterConditions.value.filter((condition) => condition.id !== conditionId);
};

const handleClearFilterConditions = () => {
  filterConditions.value = [];
};

const handleTableChange = (p: any) => {
  pagination.current = p.current;
  pagination.pageSize = p.pageSize;
};

const getSavedViewVisibleFieldCount = (view: SavedDashboardView) => getValidColumnsForMode(view.mode, view.columns).length;
const getFieldGroupName = (groupId?: string) => (
  currentFieldGroupList.value.find((group) => group.id === groupId)?.name || 'Ungrouped'
);
const resetFieldEditorState = () => {
  fieldEditorState.key = '';
  fieldEditorState.label = '';
  fieldEditorState.groupId = undefined;
};
const resetGroupCreationState = () => {
  groupCreationState.name = '';
  groupCreationState.fieldKeys = [];
};
const createCustomFieldKey = (mode: DashboardViewMode, label: string) => {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'field';
  let nextKey = `${mode}-custom-${slug}`;
  let suffix = 1;
  while (getFieldDefinitionByMode(mode, nextKey)) {
    nextKey = `${mode}-custom-${slug}-${suffix}`;
    suffix += 1;
  }
  return nextKey;
};
const createFieldGroupId = (mode: DashboardViewMode, name: string) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'group';
  let nextId = `${mode}-group-${slug}`;
  let suffix = 1;
  while (currentFieldGroupList.value.some((group) => group.id === nextId)) {
    nextId = `${mode}-group-${slug}-${suffix}`;
    suffix += 1;
  }
  return nextId;
};
const getFieldRelatedFilterKeys = (field: DashboardFieldDefinition): DashboardFilterFieldKey[] => {
  const relatedFilterKeys = new Set<DashboardFilterFieldKey>();
  [field.key, field.sourceKey].forEach((value) => {
    const normalized = String(value || '').trim();
    if (dashboardFilterFieldKeySet.has(normalized)) {
      relatedFilterKeys.add(normalized as DashboardFilterFieldKey);
    }
    (fieldFilterKeyMap[normalized] || []).forEach((filterKey) => relatedFilterKeys.add(filterKey));
  });
  return [...relatedFilterKeys];
};
const stripFieldFilters = (
  conditions: DashboardFilterCondition[],
  field: DashboardFieldDefinition,
) => {
  const relatedFilterKeys = getFieldRelatedFilterKeys(field);
  if (!relatedFilterKeys.length) return conditions;
  return conditions.filter((condition) => !condition.fieldKey || !relatedFilterKeys.includes(condition.fieldKey));
};
const resolveColumnSourceKey = (column: any) => String(column?.fieldSourceKey || column?.dataIndex || column?.key || '');
const resolveColumnKey = (column: any) => String(column?.key || resolveColumnSourceKey(column));
const openCreateFieldModal = () => {
  resetFieldEditorState();
  fieldEditorMode.value = 'create';
  fieldEditorState.groupId = availableFieldGroupOptions.value[0]?.value;
  fieldEditorModalOpen.value = true;
};
const openEditFieldModal = (field: DashboardFieldDefinition) => {
  fieldEditorMode.value = 'edit';
  fieldEditorState.key = field.key;
  fieldEditorState.label = field.label;
  fieldEditorState.groupId = field.groupId;
  fieldEditorModalOpen.value = true;
};
const handleSubmitFieldEditor = () => {
  const trimmedLabel = fieldEditorState.label.trim();
  if (!trimmedLabel) {
    return message.warning('Field name is required.');
  }

  if (fieldEditorMode.value === 'create') {
    const targetMode = viewMode.value;
    const nextFieldKey = createCustomFieldKey(targetMode, trimmedLabel);
    updateFieldSchemaByMode(targetMode, (schema) => ({
      ...schema,
      fields: [
        ...schema.fields,
        {
          key: nextFieldKey,
          mode: targetMode,
          label: trimmedLabel,
          kind: 'custom',
          sourceKey: nextFieldKey,
          groupId: fieldEditorState.groupId,
          order: schema.fields.length,
          filterable: false,
        },
      ],
    }));
    updateViewsByMode(targetMode, (view) => ({
      ...view,
      columns: [...new Set([...view.columns, nextFieldKey])],
    }));
    message.success('Field created.');
  } else {
    updateFieldSchemaByMode(viewMode.value, (schema) => ({
      ...schema,
      fields: schema.fields.map((field) => (
        field.key === fieldEditorState.key
          ? {
            ...field,
            label: trimmedLabel,
            groupId: fieldEditorState.groupId,
          }
          : field
      )),
    }));
    message.success('Field updated.');
  }

  fieldEditorModalOpen.value = false;
  resetFieldEditorState();
};
const openCreateGroupModal = (field: DashboardFieldDefinition) => {
  resetGroupCreationState();
  groupCreationState.fieldKeys = [field.key];
  groupCreationModalOpen.value = true;
};
const handleCreateFieldGroup = () => {
  const trimmedName = groupCreationState.name.trim();
  if (!trimmedName) {
    return message.warning('Group name is required.');
  }
  if (!groupCreationState.fieldKeys.length) {
    return message.warning('Select at least one field.');
  }

  const nextGroupId = createFieldGroupId(viewMode.value, trimmedName);
  updateFieldSchemaByMode(viewMode.value, (schema) => ({
    groups: [
      ...schema.groups,
      {
        id: nextGroupId,
        mode: viewMode.value,
        name: trimmedName,
        order: schema.groups.length,
      },
    ],
    fields: schema.fields.map((field) => (
      groupCreationState.fieldKeys.includes(field.key)
        ? { ...field, groupId: nextGroupId }
        : field
    )),
  }));
  groupCreationModalOpen.value = false;
  resetGroupCreationState();
  message.success('Field group created.');
};
const toggleFieldVisibility = (field: DashboardFieldDefinition) => {
  const targetMode = viewMode.value;
  const activeView = getActiveViewByMode(targetMode);
  const visibleFieldKeys = getValidColumnsForMode(targetMode, activeView.columns);
  const isVisible = visibleFieldKeys.includes(field.key);

  if (isVisible && visibleFieldKeys.length <= 1) {
    return message.warning('Keep at least one visible field in the current view.');
  }

  const nextVisibleFieldKeys = isVisible
    ? visibleFieldKeys.filter((fieldKey) => fieldKey !== field.key)
    : getValidColumnsForMode(targetMode, [...visibleFieldKeys, field.key]);

  updateViewsByMode(targetMode, (view) => (
    view.id === activeView.id
      ? { ...view, columns: nextVisibleFieldKeys }
      : view
  ));
};
const handleDeleteField = (field: DashboardFieldDefinition) => {
  if (currentFieldDefinitions.value.length <= 1) {
    return message.warning('At least one field must remain.');
  }

  Modal.confirm({
    title: `Delete "${field.label}"?`,
    content: 'This removes the field from the schema, all saved views, and any related saved filters.',
    okText: 'Delete',
    okType: 'danger',
    onOk: () => {
      const targetMode = viewMode.value;
      const remainingFields = getOrderedFieldDefinitionsByMode(targetMode).filter((item) => item.key !== field.key);
      const fallbackFieldKey = remainingFields[0]?.key;

      updateFieldSchemaByMode(targetMode, (schema) => ({
        ...schema,
        fields: schema.fields.filter((item) => item.key !== field.key),
      }));

      updateViewsByMode(targetMode, (view) => {
        const nextColumns = getValidColumnsForMode(
          targetMode,
          view.columns.filter((columnKey) => columnKey !== field.key),
        );
        return {
          ...view,
          columns: nextColumns.length ? nextColumns : (fallbackFieldKey ? [fallbackFieldKey] : []),
          filters: stripFieldFilters(view.filters as DashboardFilterCondition[], field),
        };
      });

      filterConditions.value = stripFieldFilters(filterConditions.value, field);
      fieldConfigPopoverOpen.value = false;
      message.success('Field deleted.');
    },
  });
};

// --- 鐟欏棗娴樼粻锛勬倞閺傝纭?---
const activateSavedView = (view: SavedDashboardView) => {
  setActiveViewId(view.mode, view.id);
  viewPopoverOpen.value = false;
};

const openViewEditor = (view: SavedDashboardView | null = null) => {
  const targetMode = view?.mode || viewMode.value;
  const baseView = view || getActiveViewByMode(targetMode);

  if (view && baseView.id !== getActiveViewByMode(targetMode).id) {
    setActiveViewId(targetMode, baseView.id);
  }

  editorViewMode.value = targetMode;
  editingViewId.value = view?.id || null;
  draftViewName.value = view?.name || '';
  viewPopoverMode.value = 'editor';
};

const handleSaveView = () => {
  const targetMode = editorViewMode.value;
  const sanitizedColumns = getValidColumnsForMode(targetMode, getActiveViewByMode(targetMode).columns);
  const nextFilters = cloneActiveFilterConditions();

  if (!draftViewName.value.trim()) {
    return message.warning('Please enter a view name.');
  }
  if (sanitizedColumns.length === 0) {
    return message.warning('Select at least one column.');
  }

  if (editingViewId.value) {
    const nextViews = getViewsByMode(targetMode).map((view) => (
      view.id === editingViewId.value ? {
        ...view,
        name: draftViewName.value.trim(),
        columns: [...sanitizedColumns],
        filters: nextFilters,
      } : view
    ));

    setViewsByMode(targetMode, nextViews);
    message.success('View updated.');
  } else {
    const newId = `${targetMode}-view-${Date.now()}`;
    const nextView: SavedDashboardView = {
      id: newId,
      mode: targetMode,
      name: draftViewName.value.trim(),
      columns: [...sanitizedColumns],
      filters: nextFilters,
      description: targetMode === 'corridor'
        ? 'Custom corridor view created from dashboard.'
        : 'Custom pricing matrix view created from dashboard.',
      isPreset: false,
    };

    setViewsByMode(targetMode, [...getViewsByMode(targetMode), nextView]);

    setActiveViewId(targetMode, newId);
    message.success('View saved.');
  }

  viewPopoverOpen.value = false;
  viewPopoverMode.value = 'overview';
};

const handleDeleteView = (id: string) => {
  const targetMode = viewMode.value;
  const currentViews = targetMode === 'corridor' ? store.corridorViews : store.matrixViews;
  if (currentViews.length <= 1) return;

  const nextViews = currentViews.filter((view) => view.id !== id);
  if (targetMode === 'corridor') {
    store.corridorViews = nextViews;
  } else {
    store.matrixViews = nextViews;
  }

  const activeViewId = targetMode === 'corridor' ? store.activeCorridorViewId : store.activeMatrixViewId;
  if (activeViewId === id && nextViews.length) {
    setActiveViewId(targetMode, nextViews[0].id);
  }

  message.success('View deleted.');
};

</script>

<template>
  <div class="p-6">
    <a-space direction="vertical" size="large" class="w-full">
      <!-- 妞ゅ爼鍎撮幙宥勭稊閿?-->
      <div class="flex items-center gap-3 flex-wrap mb-1">
        <a-button type="primary" @click="handleAddNew" class="bg-[#0284c7] border-none hover:bg-sky-600 h-[40px] px-5 rounded-lg font-bold flex items-center gap-2 shadow-sm">
          <template #icon><plus-outlined /></template>
          New Corridor
        </a-button>
        
        <a-popover
          v-model:open="filterPopoverOpen"
          trigger="click"
          placement="bottomLeft"
          overlay-class-name="fitrem-filter-popover"
        >
          <template #content>
            <div class="w-[520px] max-w-[calc(100vw-48px)] p-5">
              <div class="flex items-center justify-between gap-4 mb-4">
                <div class="flex items-center gap-2 text-[14px] font-bold text-slate-700">
                  <span>Set filters</span>
                  <a-tooltip title="Add multiple conditions. All conditions are matched with AND in real time.">
                    <question-circle-outlined class="text-slate-400 text-[14px]" />
                  </a-tooltip>
                </div>
                <a-button
                  v-if="filterConditions.length"
                  type="text"
                  size="small"
                  class="px-0 text-[12px] font-medium text-slate-400 hover:text-sky-600"
                  @click="handleClearFilterConditions"
                >
                  Clear
                </a-button>
              </div>

              <div v-if="filterConditions.length" class="space-y-3 mb-3">
                <div
                  v-for="condition in filterConditions"
                  :key="condition.id"
                  class="flex items-start gap-3"
                >
                  <a-select
                    :value="condition.fieldKey"
                    :options="dashboardFilterFieldOptions"
                    placeholder="Select field"
                    class="w-[168px] fitrem-filter-select"
                    @update:value="(value: DashboardFilterFieldKey | undefined) => handleFilterFieldChange(condition.id, value)"
                  />
                  <a-select
                    :value="condition.operator"
                    :options="dashboardFilterOperatorOptions"
                    class="w-[120px] fitrem-filter-select"
                    :disabled="!condition.fieldKey"
                    @update:value="(value: DashboardFilterOperator) => handleFilterOperatorChange(condition.id, value)"
                  />
                  <div class="flex-1 min-w-0">
                    <a-select
                      v-if="shouldUseSelectValueControl(condition)"
                      :value="condition.value"
                      :options="getConditionValueOptions(condition)"
                      :placeholder="getFilterConditionFieldConfig(condition)?.valuePlaceholder || 'Select'"
                      allow-clear
                      class="w-full fitrem-filter-select"
                      :disabled="!condition.fieldKey || !conditionNeedsValue(condition)"
                      @update:value="(value: string | undefined) => handleFilterValueChange(condition.id, value)"
                    />
                    <a-input
                      v-else-if="conditionNeedsValue(condition)"
                      :value="condition.value"
                      :placeholder="getFilterConditionFieldConfig(condition)?.valuePlaceholder || 'Enter value'"
                      :disabled="!condition.fieldKey"
                      class="w-full fitrem-filter-value-input"
                      @update:value="(value: string | undefined) => handleFilterValueChange(condition.id, value)"
                    />
                  </div>
                  <a-button
                    type="text"
                    size="small"
                    class="mt-1 flex h-[32px] w-[32px] items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                    @click="handleRemoveFilterCondition(condition.id)"
                  >
                    <template #icon><close-outlined /></template>
                  </a-button>
                </div>
              </div>

              <a-button
                type="text"
                class="px-0 h-auto text-[14px] font-medium text-slate-700 hover:text-sky-600"
                @click="handleAddFilterCondition"
              >
                <template #icon><plus-outlined /></template>
                Add condition
              </a-button>
            </div>
          </template>
          <a-button
            class="h-[40px] px-4 rounded-lg font-bold flex items-center gap-2 transition-all bg-white border-slate-200 text-slate-600 shadow-sm"
            :class="{ 'text-[#0284c7] border-[#0284c7] bg-[#f0f7ff]': isFilterButtonActive }"
          >
            <template #icon><filter-outlined /></template>
            Filter
          </a-button>
        </a-popover>

        <a-popover
          v-model:open="fieldConfigPopoverOpen"
          trigger="click"
          placement="bottomLeft"
          overlay-class-name="fitrem-field-config-popover"
        >
          <template #content>
            <div class="w-[330px] p-1">
              <div class="mb-4 flex items-start justify-between gap-3 px-1">
                <div>
                  <div class="text-[15px] font-black uppercase tracking-widest text-[#0f172a] opacity-50">Field Config</div>
                  <div class="mt-1 text-[12px] font-medium text-slate-400">
                    {{ currentFieldDefinitions.length }} fields in this {{ currentModeLabel.toLowerCase() }} table
                  </div>
                </div>
                <div class="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-sky-600">
                  {{ activeSavedViewColumnCount }} visible
                </div>
              </div>

              <div class="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                <div v-for="section in currentFieldSections" :key="section.id" class="space-y-2">
                  <div class="px-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {{ section.label }}
                  </div>
                  <div class="space-y-1">
                    <div
                      v-for="field in section.fields"
                      :key="field.key"
                      class="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm"
                    >
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-[13px] font-bold text-slate-700">{{ field.label }}</div>
                        <div class="text-[11px] font-medium text-slate-400">
                          {{ field.kind === 'custom' ? 'Custom field' : 'System field' }}
                        </div>
                      </div>
                      <div class="flex items-center gap-1">
                        <a-button
                          type="text"
                          size="small"
                          class="h-[30px] w-[30px] rounded-full text-slate-400 hover:bg-slate-100 hover:text-sky-600"
                          @click.stop="toggleFieldVisibility(field)"
                        >
                          <component :is="activeVisibleFieldKeys.includes(field.key) ? EyeOutlined : EyeInvisibleOutlined" class="text-[15px]" />
                        </a-button>
                        <a-dropdown placement="bottomRight" trigger="click">
                          <a-button
                            type="text"
                            size="small"
                            class="h-[30px] w-[30px] rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            @click.stop
                          >
                            <more-outlined class="text-[15px]" />
                          </a-button>
                          <template #overlay>
                            <a-menu>
                              <a-menu-item key="edit" @click="openEditFieldModal(field)">Edit field</a-menu-item>
                              <a-menu-item key="group" @click="openCreateGroupModal(field)">Create group</a-menu-item>
                              <a-menu-item key="delete" danger @click="handleDeleteField(field)">Delete</a-menu-item>
                            </a-menu>
                          </template>
                        </a-dropdown>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-4 border-t border-slate-100 pt-4">
                <a-button
                  block
                  class="h-[44px] rounded-2xl border-slate-200 font-black text-slate-600 hover:border-sky-500 hover:text-sky-600"
                  @click="openCreateFieldModal"
                >
                  <template #icon><plus-outlined /></template>
                  Add field
                </a-button>
              </div>
            </div>
          </template>
          <a-button
            class="h-[40px] px-4 rounded-lg font-bold flex items-center gap-2 transition-all bg-white border-slate-200 text-slate-600 shadow-sm"
            :class="{ 'text-[#0284c7] border-[#0284c7] bg-[#f0f7ff]': fieldConfigPopoverOpen }"
          >
            <template #icon><setting-outlined /></template>
            Field Config
          </a-button>
        </a-popover>

        <a-segmented
          v-model:value="viewMode"
          class="fitrem-view-segmented"
          :options="[
            { value: 'corridor', label: 'Corridor View', payload: { icon: h(AppstoreOutlined) } },
            { value: 'matrix', label: 'Pricing Matrix', payload: { icon: h(TableOutlined) } }
          ]"
        >
          <template #label="{ label, payload }">
            <div class="flex items-center gap-2 px-1">
              <component :is="payload.icon" />
              <span class="font-bold">{{ label }}</span>
            </div>
          </template>
        </a-segmented>

        <!-- 鐟欏棗娴橀柅澶嬪閹稿鎸?-->
        <a-popover
          v-model:open="viewPopoverOpen"
          trigger="click"
          placement="bottomLeft"
          overlay-class-name="fitrem-view-popover"
        >
          <template #content>
            <div v-if="viewPopoverMode === 'overview'" class="w-[360px] p-1">
              <div class="font-black text-[#0f172a] text-[15px] mb-5 px-1 uppercase tracking-widest opacity-40">Saved Views</div>
              
              <div class="space-y-4 mb-8">
                <div v-for="v in currentSavedViews" :key="v.id" 
                  class="group relative p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden"
                  :class="activeSavedView.id === v.id 
                    ? 'border-sky-500 bg-white shadow-[0_12px_24px_-8px_rgba(14,165,233,0.15)]' 
                    : 'border-slate-50 bg-slate-50/30 hover:border-slate-200 hover:bg-white hover:shadow-md'"
                  @click="activateSavedView(v)"
                >
                  <div class="flex justify-between items-start mb-2">
                    <div class="font-black text-[#0f172a] text-[16px] leading-tight">{{ v.name }}</div>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a-button type="text" size="small" @click.stop="openViewEditor(v)" class="text-slate-400 hover:text-sky-600 p-1 flex items-center justify-center">
                        <edit-outlined class="text-[14px]" />
                      </a-button>
                      <a-button type="text" size="small" danger :disabled="currentSavedViews.length <= 1" @click.stop="handleDeleteView(v.id)" class="text-slate-300 hover:text-red-500 p-1 flex items-center justify-center">
                        <delete-outlined class="text-[14px]" />
                      </a-button>
                    </div>
                  </div>
                  
                  <div class="text-[12px] text-slate-400 font-medium leading-relaxed mb-4 pr-4">{{ v.description }}</div>
                  
                  <div class="flex items-center gap-2 flex-wrap">
                    <div class="bg-white px-3 py-1 rounded-full border border-slate-100 text-[11px] font-bold text-slate-600 shadow-sm">
                      {{ getSavedViewVisibleFieldCount(v) }} fields
                    </div>
                    <div class="bg-white px-3 py-1 rounded-full border border-slate-100 text-[11px] font-bold text-slate-600 shadow-sm">
                      {{ v.filters.length }} filters
                    </div>
                    <div v-if="v.isPreset" class="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider">
                      Preset
                    </div>
                    <div v-if="activeSavedView.id === v.id" class="bg-sky-50 text-sky-600 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider">
                      Current
                    </div>
                  </div>

                  <!-- Active indicator corner -->
                  <div v-if="activeSavedView.id === v.id" class="absolute top-0 right-0 w-12 h-12 bg-sky-500/5 rounded-bl-[40px] pointer-events-none"></div>
                </div>
              </div>

              <div class="mb-8 px-1">
                <div class="font-black text-[#0f172a] text-[13px] mb-2 uppercase tracking-widest opacity-40">Current View</div>
                <div class="text-[13px] text-slate-500 font-bold mb-1">
                  Restores {{ activeSavedViewColumnCount }} visible fields and {{ activeSavedViewFilterCount }} filters
                </div>
                <div class="text-[12px] text-slate-400 font-medium leading-relaxed">
                  Switching saved views resets the toolbar filters and field visibility to the stored snapshot for this {{ currentModeLabel.toLowerCase() }} view.
                </div>
              </div>

              <div class="px-1 border-t border-slate-100 pt-6">
                <div class="font-black text-[#0f172a] text-[13px] mb-4 uppercase tracking-widest opacity-40">Actions</div>
                <a-button 
                  block 
                  class="h-[48px] rounded-2xl border-slate-200 text-slate-600 font-black text-[14px] hover:border-sky-500 hover:text-sky-600 transition-all shadow-sm"
                  @click="openViewEditor()"
                >
                  Create {{ currentModeLabel }} View
                </a-button>
              </div>
            </div>

            <div v-else class="w-[340px]">
              <a-button type="text" @click="viewPopoverMode = 'overview'" class="mb-4 text-slate-400 p-0 hover:text-sky-600">
                <template #icon><left-outlined /></template> Back to Views
              </a-button>
              <div class="font-bold text-lg mb-4 text-slate-800">{{ editingViewId ? 'Edit ' + editorModeLabel + ' View' : 'Create ' + editorModeLabel + ' View' }}</div>
              <div class="mb-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 mb-1">Snapshot</div>
                <div class="text-[13px] font-semibold text-slate-600">
                  This view will save {{ activeSavedViewColumnCount }} visible fields and {{ activeFilterConditions.length }} active filters from the current toolbar state.
                </div>
              </div>
              <a-form layout="vertical">
                <a-form-item label="View Name">
                  <a-input v-model:value="draftViewName" :placeholder="editorViewMode === 'corridor' ? 'e.g. My Corridor View' : 'e.g. APAC Matrix Focus'" />
                </a-form-item>
                <div class="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2">Current Snapshot</div>
                  <div class="text-[13px] font-semibold text-slate-700">
                    {{ activeSavedViewColumnCount }} visible fields | {{ activeFilterConditions.length }} active filters
                  </div>
                  <div class="mt-1 text-[12px] font-medium text-slate-400">
                    Use Field Config and Filter before saving if you need to adjust this view snapshot.
                  </div>
                </div>
                <div class="flex justify-end mt-6 pt-4 border-t border-slate-100">
                  <a-button type="primary" @click="handleSaveView" class="bg-sky-600 border-none">{{ editingViewId ? 'Update' : 'Save' }}</a-button>
                </div>
              </a-form>
            </div>
          </template>
          <a-button class="h-[40px] px-4 rounded-lg font-bold flex items-center gap-2 transition-all bg-white border-slate-200 text-slate-600 shadow-sm">
            <template #icon><component :is="currentViewIcon" /></template>
            {{ activeSavedView.name }} ({{ activeSavedViewColumnCount }})
            <down-outlined class="text-[10px] ml-1 text-slate-400" />
          </a-button>
        </a-popover>

        <!-- 閻晠妯€鐟欏棗娴樼拋鍓х枂閹稿鎸?-->

        <a-button class="h-[40px] px-4 rounded-lg font-bold flex items-center gap-2 transition-all bg-white border-slate-200 text-slate-600 shadow-sm" @click="handleExport">
          <template #icon><download-outlined /></template>
          Export CSV
        </a-button>
      </div>

      <!-- 鐎电厧鍤涵顔款吇瀵湱鐛?(鐎靛綊缍?React 妞ゅ湱娲? -->
      <a-modal
        v-model:open="exportModalOpen"
        :title="viewMode === 'corridor' ? 'Export Corridor Data' : 'Export Pricing Matrix Data'"
        @ok="handleConfirmExport"
        okText="Confirm Export"
      >
        <div class="py-4">
          <div class="mb-6">
            <div class="font-bold text-slate-800 mb-1">Select Export Scope</div>
            <div class="text-xs text-slate-500">Choose the data range you want to include in the CSV file.</div>
          </div>
          <a-radio-group v-model:value="exportScope" class="w-full flex flex-col gap-4">
            <a-card size="small" class="cursor-pointer hover:border-sky-300" :class="exportScope === 'page' ? 'border-sky-500 bg-sky-50' : 'border-slate-200'" @click="exportScope = 'page'">
              <a-radio value="page">
                <span class="font-bold">This Page Only</span>
                <div class="text-xs text-slate-400 mt-1">Export current visible rows in the table.</div>
              </a-radio>
            </a-card>
            <a-card size="small" class="cursor-pointer hover:border-sky-300" :class="exportScope === 'all' ? 'border-sky-500 bg-sky-50' : 'border-slate-200'" @click="exportScope = 'all'">
              <a-radio value="all">
                <span class="font-bold">All Results</span>
                <div class="text-xs text-slate-400 mt-1">Export all data matching the current filters.</div>
              </a-radio>
            </a-card>
            <a-card size="small" class="cursor-pointer hover:border-sky-300" :class="exportScope === 'selected' ? 'border-sky-500 bg-sky-50' : 'border-slate-200'" @click="exportScope = 'selected'">
              <a-radio value="selected">
                <span class="font-bold">Selected Items</span>
                <div class="text-xs text-slate-400 mt-1">Export only rows you have manually checked.</div>
              </a-radio>
            </a-card>
          </a-radio-group>
        </div>
      </a-modal>

      <!-- 娑撹缍嬮崘鍛啇鐢啫鐪?-->
      <a-modal
        v-model:open="fieldEditorModalOpen"
        :title="fieldEditorMode === 'create' ? `Add ${currentModeLabel} Field` : 'Edit Field'"
        :ok-text="fieldEditorMode === 'create' ? 'Create Field' : 'Save Changes'"
        @ok="handleSubmitFieldEditor"
        @cancel="resetFieldEditorState"
      >
        <a-form layout="vertical" class="pt-4">
          <a-form-item label="Field Name">
            <a-input
              v-model:value="fieldEditorState.label"
              :placeholder="fieldEditorMode === 'create' ? 'e.g. Internal Note' : 'Enter field name'"
            />
          </a-form-item>
          <a-form-item label="Group">
            <a-select
              v-model:value="fieldEditorState.groupId"
              :options="availableFieldGroupOptions"
              allow-clear
              placeholder="Place in group later"
            />
          </a-form-item>
        </a-form>
      </a-modal>

      <a-modal
        v-model:open="groupCreationModalOpen"
        title="Create Field Group"
        ok-text="Create Group"
        @ok="handleCreateFieldGroup"
        @cancel="resetGroupCreationState"
      >
        <a-form layout="vertical" class="pt-4">
          <a-form-item label="Group Name">
            <a-input v-model:value="groupCreationState.name" placeholder="e.g. Workflow Fields" />
          </a-form-item>
          <a-form-item label="Fields in This Group">
            <a-checkbox-group v-model:value="groupCreationState.fieldKeys" class="flex flex-col gap-3">
              <a-checkbox v-for="field in currentFieldDefinitions" :key="field.key" :value="field.key">
                <span class="font-medium text-slate-700">{{ field.label }}</span>
                <span class="ml-2 text-[11px] text-slate-400">({{ getFieldGroupName(field.groupId) }})</span>
              </a-checkbox>
            </a-checkbox-group>
          </a-form-item>
        </a-form>
      </a-modal>

      <div class="flex items-start gap-5 w-full">
        <!-- 鐞涖劍鐗搁崠鍝勭厵 -->
        <div class="flex-1 min-w-0">
          <a-table
            :columns="currentColumns"
            :data-source="activeSourceData"
            :pagination="pagination"
            @change="handleTableChange"
            :row-key="(record: any) => record.id"
            :scroll="{ x: 'max-content' }"
            class="fitrem-table"
            :customRow="(record: any) => ({
              onClick: () => handleViewDetails(record),
              class: 'cursor-pointer'
            })"
          >
            <template #bodyCell="{ column, record, text }">
              <!-- Corridor Name 鐎规艾鍩?-->
              <template v-if="['channelName', 'corridorName'].includes(resolveColumnKey(column)) || resolveColumnSourceKey(column) === 'channelName'">
                <div class="flex items-center gap-2">
                  <div v-if="record.logo" class="w-6 h-6 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                    <img :src="record.logo" class="w-full h-full object-cover" />
                  </div>
                  <span class="font-bold text-slate-900">{{ text }}</span>
                </div>
              </template>

              <!-- Matrix Mode: Quotation 鐎规艾鍩?-->
              <template v-else-if="resolveColumnKey(column) === 'quotationName'">
                <div>
                  <div class="font-bold text-slate-800">{{ text }}</div>
                  <a-tag class="mt-1 bg-slate-50 text-slate-500 border-none text-[10px]">{{ record.quotationType }}</a-tag>
                </div>
              </template>

              <!-- Matrix Mode: Fee 鐎规艾鍩?-->
              <template v-else-if="resolveColumnKey(column) === 'fee'">
                <span class="font-mono font-bold text-sky-600">{{ text }}</span>
              </template>

              <!-- Matrix Mode: Settlement Currency 鐎规艾鍩?-->
              <template v-else-if="resolveColumnSourceKey(column) === 'settlementCurrency'">
                <a-space wrap :size="[0, 4]">
                  <a-tag v-for="curr in record.settlementCurrency" :key="curr" class="bg-slate-100 text-slate-600 border-none text-[11px]">{{ curr }}</a-tag>
                </a-space>
              </template>

              <!-- Cooperation Model 鐎规艾鍩?-->
              <template v-else-if="resolveColumnSourceKey(column) === 'cooperationModel'">
                <a-space wrap :size="[0, 4]">
                  <a-tag v-for="model in record.cooperationModel" :key="model" 
                    class="bg-indigo-50 text-indigo-700 border-none rounded-md px-2 py-0">
                    {{ model }}
                  </a-tag>
                </a-space>
              </template>

              <!-- Status 鐎规艾鍩?-->
              <template v-else-if="resolveColumnSourceKey(column) === 'status'">
                <a-tag :style="{
                  backgroundColor: statusColors[text]?.bg || '#F1F5F9',
                  color: statusColors[text]?.text || '#475569',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '999px',
                  padding: '2px 12px'
                }">
                  {{ text }}
                </a-tag>
              </template>

              <!-- 瀹搞儰缍斿ù浣哄Ц閹礁鐣鹃敓?(KYC, NDA, Contract, Pricing, Tech) -->
              <template v-else-if="['wooshpayOnboardingStatus', 'corridorOnboardingStatus', 'ndaStatus', 'contractStatus', 'pricingProposalStatus', 'techStatus'].includes(resolveColumnSourceKey(column))">
                <a-tag v-if="text" :style="{
                  backgroundColor: ['wooshpayOnboardingStatus', 'corridorOnboardingStatus'].includes(resolveColumnSourceKey(column))
                    ? getOnboardingStatusTheme(text).bg
                    : (workflowStatusColors[text]?.bg || '#F8FAFC'),
                  color: ['wooshpayOnboardingStatus', 'corridorOnboardingStatus'].includes(resolveColumnSourceKey(column))
                    ? getOnboardingStatusTheme(text).text
                    : (workflowStatusColors[text]?.text || '#475569'),
                  border: 'none',
                  borderRadius: '999px',
                  fontWeight: 600,
                  fontSize: '11px',
                  padding: '2px 10px'
                }">
                  {{ text }}
                </a-tag>
                <span v-else class="text-slate-300">-</span>
              </template>

              <!-- Merchant Coverage 鐎规艾鍩?-->
              <template v-else-if="resolveColumnSourceKey(column) === 'merchantGeo'">
                <a-space wrap :size="[0, 4]">
                  <a-tag v-for="geo in (record.merchantGeo?.slice(0, 2) || [])" :key="geo.join('-')" class="bg-sky-50 text-sky-700 border-none text-[11px] font-medium rounded-md px-2">
                    {{ geo.length > 1 ? `${geo[geo.length - 1]} (${geo[0]})` : geo[0] }}
                  </a-tag>
                  <a-tag v-if="record.merchantGeo?.length > 2" class="bg-slate-100 text-slate-500 border-none text-[11px] font-medium rounded-md px-2">
                    +{{ record.merchantGeo.length - 2 }}
                  </a-tag>
                </a-space>
              </template>

              <!-- Supported Products 鐎规艾鍩?-->
              <template v-else-if="resolveColumnSourceKey(column) === 'supportedProducts'">
                <a-space wrap :size="[0, 4]">
                  <a-tag v-for="prod in (record.supportedProducts || [])" :key="prod" class="bg-sky-50 text-sky-600 border-none text-[11px] font-bold rounded-md px-2">
                    {{ prod }}
                  </a-tag>
                </a-space>
              </template>

              <!-- Payment Methods 鐎规艾鍩?-->
              <template v-else-if="['paymentMethods', 'paymentMethodName'].includes(resolveColumnKey(column)) || resolveColumnSourceKey(column) === 'paymentMethods'">
                <a-space wrap :size="[0, 4]">
                  <a-tag v-for="pm in (record.paymentMethods?.slice(0, 2) || [])" :key="pm" class="bg-slate-100 text-slate-600 border-none text-[11px]">
                    {{ normalizePaymentMethodLabel(pm) }}
                  </a-tag>
                  <a-tag v-if="record.paymentMethods?.length > 2" class="bg-slate-50 text-slate-400 border-none text-[11px]">
                    +{{ record.paymentMethods.length - 2 }}
                  </a-tag>
                </a-space>
              </template>

              <!-- FI Owner 鐎规艾鍩?-->
              <template v-else-if="resolveColumnSourceKey(column) === 'fiopOwner'">
                <a-tag color="blue" class="rounded-full px-3">{{ text }}</a-tag>
              </template>
            </template>
          </a-table>
        </div>

      </div>
    </a-space>
  </div>
</template>

<style scoped>
:deep(.fitrem-table .ant-table-thead > tr > th) {
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
  font-size: 13px;
  padding: 16px 24px;
}

:deep(.fitrem-table .ant-table-tbody > tr > td) {
  padding: 16px 24px;
}

:deep(.fitrem-table .ant-table-tbody > tr:hover > td) {
  background: #f8fbff !important;
}

:deep(.fitrem-view-segmented.ant-segmented) {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 3px;
  border-radius: 8px;
  height: 40px;
  display: flex;
  align-items: center;
}

:deep(.fitrem-view-segmented .ant-segmented-item) {
  border-radius: 6px;
  transition: all 0.2s;
  color: #64748b;
}

:deep(.fitrem-view-segmented .ant-segmented-item-selected) {
  background: #f0f7ff !important;
  color: #0284c7 !important;
  box-shadow: none !important;
}

:deep(.fitrem-view-segmented .ant-segmented-item:hover:not(.ant-segmented-item-selected)) {
  background: #f8fafc;
  color: #475569;
}

:deep(.fitrem-view-popover .ant-popover-inner) {
  padding: 12px;
  border-radius: 24px;
  box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.15);
}

:deep(.fitrem-view-popover .ant-popover-inner-content) {
  padding: 0;
}

:deep(.fitrem-field-config-popover .ant-popover-inner) {
  padding: 12px;
  border-radius: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 24px 60px -18px rgba(15, 23, 42, 0.18);
}

:deep(.fitrem-field-config-popover .ant-popover-inner-content) {
  padding: 0;
}

:deep(.fitrem-filter-popover .ant-popover-inner) {
  padding: 0;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 24px 60px -18px rgba(15, 23, 42, 0.18);
}

:deep(.fitrem-filter-popover .ant-popover-inner-content) {
  padding: 0;
}

:deep(.fitrem-filter-select .ant-select-selector) {
  min-height: 40px !important;
  border-radius: 10px !important;
  border-color: #dbe2ea !important;
  box-shadow: none !important;
  padding-inline: 11px !important;
  display: flex;
  align-items: center;
}

:deep(.fitrem-filter-select.ant-select-disabled .ant-select-selector) {
  background: #f8fafc !important;
  color: #94a3b8 !important;
}

:deep(.fitrem-filter-select .ant-select-selection-placeholder) {
  color: #94a3b8 !important;
}

:deep(.fitrem-filter-select.ant-select-focused .ant-select-selector),
:deep(.fitrem-filter-select.ant-select-open .ant-select-selector) {
  border-color: #60a5fa !important;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14) !important;
}

:deep(.fitrem-filter-value-input.ant-input) {
  min-height: 40px;
  border-radius: 10px;
  border-color: #dbe2ea;
  box-shadow: none;
}

:deep(.fitrem-filter-value-input.ant-input:focus),
:deep(.fitrem-filter-value-input.ant-input-focused) {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14);
}
</style>
