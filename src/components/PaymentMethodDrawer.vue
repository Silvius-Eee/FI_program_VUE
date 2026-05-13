<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { 
  PlusOutlined, 
  InfoCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  DownOutlined,
  CloseCircleFilled,
  SearchOutlined,
  CloseOutlined,
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { merchantGeoOptions } from '../constants/channelOptions';
import { useAppStore } from '../stores/app';
import {
  createDefaultSettlementConfig,
  FX_COST_DETAIL_REFERENCE_OPTIONS,
  FX_COST_MARKUP_REFERENCE_OPTIONS,
  FX_COST_REFERENCE_OPTIONS,
  getSettlementCycleDisplay,
  getSettlementThresholdDisplay,
  isCardPaymentMethodName,
  normalizePaymentMethodName,
  normalizeSettlementConfig,
  normalizePricingRuleCardCatalogItem,
  PRICING_RULE_CARD_SYSTEM_CATALOG,
  PRICING_RULE_CARD_SYSTEM_IDS,
} from '../constants/initialData';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';

const props = defineProps<{
  open: boolean;
  initialData?: any;
  methodFormType?: 'card' | 'nonCard';
  hideHeader?: boolean;
  proposalMode?: string;
  forceReadOnly?: boolean;
  breadcrumbRootLabel?: string;
  breadcrumbSectionLabel?: string;
  breadcrumbProposalLabel?: string;
  readOnlyDescription?: string;
}>();

const emit = defineEmits(['update:open', 'save']);
const store = useAppStore();

const currencyOptions = ['USD', 'EUR', 'GBP', 'HKD', 'SGD', 'JPY', 'AUD', 'CAD'];
const globalRegionSelection = [['Global']];
const floorPriceTooltip = 'Minimum fee applied after fixed and variable pricing are calculated.';
const capPriceTooltip = 'Maximum fee applied after fixed and variable pricing are calculated.';
const cardPricingEditorDescription = 'Configure the dedicated pricing, floor/cap, and tiered rule logic for this card option.';
const cardPricingEditorHint = 'Set a clear pricing band, then define fixed, percentage, floor, and cap values.';
const normalizeOptionalCurrency = (value?: string | null) => String(value ?? '').trim().toUpperCase();

const createPricingRow = (tierName = '') => ({
  tierName,
  isTiered: Boolean(tierName),
  variableRate: null,
  fixedFeeAmount: null,
  fixedFeeCurrency: '',
  floorPrice: null,
  capPrice: null,
});
const normalizePricingRow = (row: any = {}, fallbackTierName = '') => {
  const rawTierName = normalizeTextValue(row?.tierName || fallbackTierName);
  const tierName = /base rule$/i.test(rawTierName) ? '' : rawTierName;
  return {
    ...createPricingRow(tierName),
    ...row,
    fixedFeeCurrency: normalizeOptionalCurrency(row?.fixedFeeCurrency),
    tierName,
    isTiered: Boolean(row?.isTiered ?? tierName),
  };
};
const normalizePricingRows = (rows: any[] = [], baseLabel = '') => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [normalizePricingRow(createPricingRow(baseLabel), baseLabel)];
  }
  const hasMultipleRules = rows.length > 1;
  return rows.map((row, index) => normalizePricingRow({
    ...row,
    isTiered: index === 0
      ? Boolean((row?.isTiered ?? normalizeTextValue(row?.tierName)) || hasMultipleRules)
      : true,
  }, index === 0 ? baseLabel : ''));
};

const createCardAdditionalFees = () => ({
  preAuthorizationFee: { amount: null, currency: '' },
  authorizationFee: { amount: null, currency: '' },
  captureFee: { amount: null, currency: '' },
  refundFee: { amount: null, currency: '' },
  chargebackFee: { amount: null, currency: '' },
  representmentFee: { amount: null, currency: '' },
  retrievalFee: { amount: null, currency: '' },
  threeDSecureFee: { amount: null, currency: '' },
  tokenizationFee: { amount: null, currency: '' },
  accountUpdaterFee: { amount: null, currency: '' },
});

const cardAdditionalFeeFields = [
  { label: 'Pre Authorization Fee', prop: 'preAuthorizationFee' },
  { label: 'Authorization Fee', prop: 'authorizationFee' },
  { label: 'Capture Fee', prop: 'captureFee' },
  { label: 'Refund Fee', prop: 'refundFee' },
  { label: 'Chargeback Fee', prop: 'chargebackFee' },
  { label: 'Representment Fee', prop: 'representmentFee' },
  { label: 'Retrieval Fee', prop: 'retrievalFee' },
  { label: '3D Secure Fee', prop: 'threeDSecureFee' },
  { label: 'Tokenization Fee', prop: 'tokenizationFee' },
  { label: 'Account Updater Fee', prop: 'accountUpdaterFee' },
] as const;

const nonCardAdditionalFeeFields = [
  { label: 'Refund Fee', prop: 'refundFee' },
  { label: 'Chargeback Fee', prop: 'chargebackFee' },
] as const;

const normalizeTextValue = (value?: string | null) => value?.trim() || '';
const isCardPaymentType = (value?: string | null) => normalizeTextValue(value).toLowerCase() === 'card';
const inferPaymentType = (
  paymentType?: string | null,
  method?: string | null,
  legacyMethodForm?: string | null,
) => {
  const normalizedPaymentType = normalizeTextValue(paymentType);
  if (normalizedPaymentType) {
    return isCardPaymentType(normalizedPaymentType) ? 'Card' : normalizedPaymentType;
  }
  if (legacyMethodForm === 'card' || isCardPaymentMethodName(method)) {
    return 'Card';
  }
  return '';
};
const resolveMethodForm = (paymentType?: string | null, legacyMethodForm?: string | null): 'card' | 'nonCard' => (
  isCardPaymentType(paymentType) || legacyMethodForm === 'card' ? 'card' : 'nonCard'
);
const normalizeSelectionList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeTextValue(typeof item === 'string' ? item : String(item)))
      .filter(Boolean);
  }
  const normalized = normalizeTextValue(typeof value === 'string' ? value : value ? String(value) : '');
  return normalized ? [normalized] : [];
};
const normalizeCapabilityFlags = (flags: any = {}) => ({
  ...flags,
  refundCapability: normalizeSelectionList(flags.refundCapability),
  refundMethod: normalizeSelectionList(flags.refundMethod),
  autoDebitCapability: normalizeSelectionList(flags.autoDebitCapability).slice(0, 1),
  minTicketCurrency: normalizeOptionalCurrency(flags.minTicketCurrency),
  maxTicketCurrency: normalizeOptionalCurrency(flags.maxTicketCurrency),
});
const normalizeCardAdditionalFees = (fees: any = {}) => {
  const defaults = createCardAdditionalFees();
  return Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [key, {
      ...value,
      ...(fees?.[key] || {}),
      currency: normalizeOptionalCurrency(fees?.[key]?.currency),
    }]),
  );
};
const fxMarkupReferenceSet = new Set<string>(FX_COST_MARKUP_REFERENCE_OPTIONS);
const fxDetailReferenceSet = new Set<string>(FX_COST_DETAIL_REFERENCE_OPTIONS);
const isFxMarkupReference = (value?: string | null) => fxMarkupReferenceSet.has(normalizeTextValue(value));
const isFxDetailReference = (value?: string | null) => fxDetailReferenceSet.has(normalizeTextValue(value));
const getSystemPricingCardItem = (id: string) => PRICING_RULE_CARD_SYSTEM_CATALOG.find((item) => item.id === id);
const createPricingRuleBucket = (_cardName = 'Card') => normalizePricingRows([createPricingRow()], '');
const normalizeCardPricingRules = (rules: any = {}) => {
  const nextRules: Record<string, any[]> = {};
  Object.entries(rules || {}).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    if (key === 'local') {
      nextRules[PRICING_RULE_CARD_SYSTEM_IDS.localCard] = normalizePricingRows(value, 'Local Card Base Rule');
      return;
    }
    if (key === 'international') {
      nextRules[PRICING_RULE_CARD_SYSTEM_IDS.internationalCard] = normalizePricingRows(value, 'International Card Base Rule');
      return;
    }
    nextRules[key] = normalizePricingRows(value);
  });
  return nextRules;
};
const normalizeSelectedPricingCardIds = (state: any) => {
  const ids: string[] = [];
  const appendId = (cardId?: string | null) => {
    if (cardId && !ids.includes(cardId)) {
      ids.push(cardId);
    }
  };

  if (Array.isArray(state?.selectedPricingCardIds)) {
    state.selectedPricingCardIds.forEach((item: string) => appendId(item));
  }
  if (hasRuleValue(state?.icpp)) {
    appendId(PRICING_RULE_CARD_SYSTEM_IDS.icpp);
  }

  const normalizedRules = normalizeCardPricingRules(state?.cardPricingRules);
  if (state?.cardPricingRules?.local?.length) {
    appendId(PRICING_RULE_CARD_SYSTEM_IDS.localCard);
  }
  if (state?.cardPricingRules?.international?.length) {
    appendId(PRICING_RULE_CARD_SYSTEM_IDS.internationalCard);
  }
  Object.keys(normalizedRules).forEach((cardId) => appendId(cardId));

  return ids;
};

const createCatalogMethodId = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const createCatalogItem = (name: string, used = false) => ({
  id: createCatalogMethodId(name) || `catalog-${Date.now()}`,
  name,
  used,
});

const cloneState = (value: any) => JSON.parse(JSON.stringify(value));
type CatalogField = 'paymentType' | 'method' | 'pricingCard';
const openCatalogField = ref<CatalogField | null>(null);
const paymentTypeFieldRef = ref<HTMLElement | null>(null);
const paymentMethodFieldRef = ref<HTMLElement | null>(null);
const pricingCardFieldRef = ref<HTMLElement | null>(null);
const paymentTypePanelRef = ref<HTMLElement | null>(null);
const paymentMethodPanelRef = ref<HTMLElement | null>(null);
const pricingCardPanelRef = ref<HTMLElement | null>(null);
const catalogPanelStyles = reactive<Record<CatalogField, Record<string, string>>>({
  paymentType: {},
  method: {},
  pricingCard: {},
});

const formState = reactive<any>({
  id: '',
  method: '',
  paymentType: '',
  methodForm: 'nonCard',
  consumerRegion: [],
  pricingRegion: [],
  icpp: null,
  selectedPricingCardIds: [],
  pricingRows: normalizePricingRows([createPricingRow()], ''),
  cardPricingRules: {},
  cardAdditionalFees: createCardAdditionalFees(),
  capabilityFlags: {
    refundCapability: [],
    refundMethod: [],
    autoDebitCapability: [],
    minTicket: null,
    minTicketCurrency: '',
    maxTicket: null,
    maxTicketCurrency: '',
  },
  reserve: {
    type: '',
    fixedReserveValue: null,
    fixedReserveCurrency: '',
    rollingReserveRate: null,
    holdingPeriodDays: null,
    holdingPeriodDayType: 'calendar',
    notes: '',
  },
  settlement: createDefaultSettlementConfig(),
});

const usesCardPricing = computed(() => isCardPaymentType(formState.paymentType));
const usesFxMarkupFields = computed(() => isFxMarkupReference(formState.settlement?.fxCostReference));
const usesFxDetailField = computed(() => isFxDetailReference(formState.settlement?.fxCostReference));
const isEditing = ref(true);
const lastSavedSnapshot = ref<any>(null);
const isForceReadOnly = computed(() => Boolean(props.forceReadOnly));
const isReadOnly = computed(() => isForceReadOnly.value || (!props.hideHeader && !isEditing.value));
const loadedMethodId = ref<string | null>(null);
const breadcrumbRootLabel = computed(() => props.breadcrumbRootLabel || 'Corridor Detail');
const breadcrumbSectionLabel = computed(() => props.breadcrumbSectionLabel || 'Pricing');
const breadcrumbProposalLabel = computed(() => props.breadcrumbProposalLabel || 'Other Pricing Schedule');
const headerDescription = computed(() => (
  isForceReadOnly.value
    ? (props.readOnlyDescription || 'View the payment method snapshot in read-only mode.')
    : 'Edit one payment method at a time with grouped sections for pricing, capability, reserve, and settlement.'
));

const paymentMethodCatalog = ref([
  { id: 'card-visa', name: 'Card (Visa)', used: true },
  { id: 'card-mastercard', name: 'Card (Mastercard)', used: true },
  { id: 'wechat-pay', name: 'WeChat Pay', used: false },
  { id: 'alipay', name: 'Alipay', used: false },
  { id: 'card-amex', name: 'Card (Amex)', used: true },
  { id: 'card-unionpay', name: 'Card (UnionPay)', used: false },
]);
const paymentTypeCatalog = ref([
  { id: 'card', name: 'Card', used: true },
  { id: 'e-wallet', name: 'E-Wallet', used: false },
]);
const newCatalogMethodName = ref('');
const newCatalogPaymentTypeName = ref('');
const pricingCardSearch = ref('');
const newPricingCardName = ref('');
const editingCatalogMethodId = ref<string | null>(null);
const editingCatalogMethodName = ref('');
const editingCatalogPaymentTypeId = ref<string | null>(null);
const editingCatalogPaymentTypeName = ref('');
const editingPricingCardId = ref<string | null>(null);
const editingPricingCardName = ref('');
const filteredPaymentMethodCatalog = computed(() => paymentMethodCatalog.value);
const filteredPaymentTypeCatalog = computed(() => paymentTypeCatalog.value);
const pricingRuleCardCatalog = computed(() => (
  (store.globalPricingRuleCardCatalog || [])
    .map((item: any) => normalizePricingRuleCardCatalogItem(item))
    .filter(Boolean)
));
const getPricingCardCatalogItem = (cardId?: string | null) => {
  if (!cardId) return null;
  return pricingRuleCardCatalog.value.find((item) => item.id === cardId) || getSystemPricingCardItem(cardId) || {
    id: cardId,
    name: cardId,
    system: false,
  };
};
const filteredPricingCardCatalog = computed(() => {
  const keyword = normalizeTextValue(pricingCardSearch.value).toLowerCase();
  if (!keyword) return pricingRuleCardCatalog.value;
  return pricingRuleCardCatalog.value.filter((item) => item.name.toLowerCase().includes(keyword));
});
const selectedPricingCardItems = computed(() => (
  (Array.isArray(formState.selectedPricingCardIds) ? formState.selectedPricingCardIds : [])
    .map((cardId: string) => getPricingCardCatalogItem(cardId))
    .filter(Boolean)
));
const selectedPricingEditorCards = computed(() => selectedPricingCardItems.value.filter((item: any) => item.id !== PRICING_RULE_CARD_SYSTEM_IDS.icpp));
const pricingCardSelectionSummary = computed(() => {
  const count = selectedPricingCardItems.value.length;
  return count === 0 ? 'No cards selected' : `${count} selected`;
});
const pricingCardUsageIds = computed(() => {
  const usedIds = new Set<string>();
  store.channelList.forEach((channel: any) => {
    (channel.pricingProposals || []).forEach((proposal: any) => {
      (proposal.paymentMethods || []).forEach((method: any) => {
        (method.selectedPricingCardIds || []).forEach((cardId: string) => usedIds.add(cardId));
      });
    });
  });
  (formState.selectedPricingCardIds || []).forEach((cardId: string) => usedIds.add(cardId));
  return usedIds;
});
const upsertCatalogItem = (catalog: typeof paymentMethodCatalog | typeof paymentTypeCatalog, name?: string | null, used = false) => {
  const normalizedName = catalog === paymentMethodCatalog
    ? normalizePaymentMethodName(name)
    : normalizeTextValue(name);
  if (!normalizedName) return null;
  const matchedItem = catalog.value.find((item) => item.name.toLowerCase() === normalizedName.toLowerCase());
  if (matchedItem) {
    if (used) {
      matchedItem.used = true;
    }
    return matchedItem;
  }
  const nextItem = createCatalogItem(normalizedName, used);
  catalog.value.push(nextItem);
  return nextItem;
};
const syncCatalogsWithFormState = () => {
  upsertCatalogItem(paymentMethodCatalog, formState.method, true);
  upsertCatalogItem(paymentTypeCatalog, formState.paymentType, true);
};
const resetCatalogMethodEditor = () => {
  editingCatalogMethodId.value = null;
  editingCatalogMethodName.value = '';
  newCatalogMethodName.value = '';
};
const resetCatalogPaymentTypeEditor = () => {
  editingCatalogPaymentTypeId.value = null;
  editingCatalogPaymentTypeName.value = '';
  newCatalogPaymentTypeName.value = '';
};
const resetPricingCardEditor = () => {
  editingPricingCardId.value = null;
  editingPricingCardName.value = '';
  newPricingCardName.value = '';
};

const handleAddCatalogMethod = () => {
  const name = normalizePaymentMethodName(newCatalogMethodName.value);
  if (!name) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Payment Method', value: newCatalogMethodName.value, max: INPUT_LIMITS.name },
  ])) return;

  if (paymentMethodCatalog.value.some(m => m.name.toLowerCase() === name.toLowerCase())) {
    return message.warning('This payment method already exists in catalog');
  }
  paymentMethodCatalog.value.push(createCatalogItem(name));
  formState.method = name;
  newCatalogMethodName.value = '';
  message.success(`Added ${name} to catalog`);
};

const handleEditCatalogMethod = (id: string) => {
  const item = paymentMethodCatalog.value.find((entry) => entry.id === id);
  if (!item) return;
  editingCatalogMethodId.value = id;
  editingCatalogMethodName.value = item.name;
  newCatalogMethodName.value = '';
};

const handleUpdateCatalogMethod = () => {
  const id = editingCatalogMethodId.value;
  const nextName = normalizePaymentMethodName(editingCatalogMethodName.value);
  if (!id || !nextName) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Payment Method', value: editingCatalogMethodName.value, max: INPUT_LIMITS.name },
  ])) return;

  const currentItem = paymentMethodCatalog.value.find((entry) => entry.id === id);
  if (!currentItem) return;
  if (paymentMethodCatalog.value.some((entry) => entry.id !== id && entry.name.toLowerCase() === nextName.toLowerCase())) {
    return message.warning('This payment method already exists in catalog');
  }
  const previousName = currentItem.name;
  currentItem.name = nextName;
  if (formState.method === previousName) {
    formState.method = nextName;
  }
  resetCatalogMethodEditor();
  message.success('Payment method updated');
};

const handleDeleteCatalogMethod = (id: string) => {
  const item = paymentMethodCatalog.value.find((entry) => entry.id === id);
  paymentMethodCatalog.value = paymentMethodCatalog.value.filter(m => m.id !== id);
  if (item && formState.method === item.name) {
    formState.method = '';
  }
  resetCatalogMethodEditor();
  message.success('Removed from catalog');
};

const handleAddCatalogPaymentType = () => {
  const name = normalizeTextValue(newCatalogPaymentTypeName.value);
  if (!name) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Payment Type', value: newCatalogPaymentTypeName.value, max: INPUT_LIMITS.name },
  ])) return;

  if (paymentTypeCatalog.value.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    return message.warning('This payment type already exists in catalog');
  }
  const normalizedName = isCardPaymentType(name) ? 'Card' : name;
  paymentTypeCatalog.value.push(createCatalogItem(normalizedName));
  formState.paymentType = normalizedName;
  newCatalogPaymentTypeName.value = '';
  message.success(`Added ${normalizedName} to catalog`);
};

const handleEditCatalogPaymentType = (id: string) => {
  const item = paymentTypeCatalog.value.find((entry) => entry.id === id);
  if (!item) return;
  editingCatalogPaymentTypeId.value = id;
  editingCatalogPaymentTypeName.value = item.name;
  newCatalogPaymentTypeName.value = '';
};

const handleUpdateCatalogPaymentType = () => {
  const id = editingCatalogPaymentTypeId.value;
  const nextName = normalizeTextValue(editingCatalogPaymentTypeName.value);
  if (!id || !nextName) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Payment Type', value: editingCatalogPaymentTypeName.value, max: INPUT_LIMITS.name },
  ])) return;

  const currentItem = paymentTypeCatalog.value.find((entry) => entry.id === id);
  if (!currentItem) return;
  if (paymentTypeCatalog.value.some((entry) => entry.id !== id && entry.name.toLowerCase() === nextName.toLowerCase())) {
    return message.warning('This payment type already exists in catalog');
  }
  const normalizedName = isCardPaymentType(nextName) ? 'Card' : nextName;
  const previousName = currentItem.name;
  currentItem.name = normalizedName;
  if (formState.paymentType === previousName) {
    formState.paymentType = normalizedName;
  }
  resetCatalogPaymentTypeEditor();
  message.success('Payment type updated');
};

const handleDeleteCatalogPaymentType = (id: string) => {
  const item = paymentTypeCatalog.value.find((entry) => entry.id === id);
  paymentTypeCatalog.value = paymentTypeCatalog.value.filter((entry) => entry.id !== id);
  if (item && formState.paymentType === item.name) {
    formState.paymentType = '';
  }
  resetCatalogPaymentTypeEditor();
  message.success('Removed from catalog');
};
const ensurePricingCardBucket = (cardId: string) => {
  if (cardId === PRICING_RULE_CARD_SYSTEM_IDS.icpp) return;
  const item = getPricingCardCatalogItem(cardId);
  if (!Array.isArray(formState.cardPricingRules?.[cardId]) || formState.cardPricingRules[cardId].length === 0) {
    formState.cardPricingRules = {
      ...formState.cardPricingRules,
      [cardId]: createPricingRuleBucket(item?.name || 'Card'),
    };
  }
};
const addPricingCardSelection = (cardId: string) => {
  const nextIds = Array.isArray(formState.selectedPricingCardIds) ? [...formState.selectedPricingCardIds] : [];
  if (!nextIds.includes(cardId)) {
    nextIds.push(cardId);
    formState.selectedPricingCardIds = nextIds;
  }
  ensurePricingCardBucket(cardId);
};
const removePricingCardSelection = (cardId: string) => {
  formState.selectedPricingCardIds = (formState.selectedPricingCardIds || []).filter((id: string) => id !== cardId);
  if (cardId === PRICING_RULE_CARD_SYSTEM_IDS.icpp) {
    formState.icpp = null;
    return;
  }
  if (formState.cardPricingRules?.[cardId]) {
    const nextRules = { ...formState.cardPricingRules };
    delete nextRules[cardId];
    formState.cardPricingRules = nextRules;
  }
};
const confirmRemovePricingCardSelection = (cardId: string) => {
  if (isReadOnly.value) return;
  const item = getPricingCardCatalogItem(cardId);
  Modal.confirm({
    title: `Remove ${item?.name || 'this card'}?`,
    content: 'Removing this card will also clear its pricing rule values from the current payment method.',
    okText: 'Remove',
    okType: 'danger',
    onOk: () => removePricingCardSelection(cardId),
  });
};
const handleTogglePricingCardSelection = (cardId: string) => {
  if (isReadOnly.value) return;
  const isSelected = (formState.selectedPricingCardIds || []).includes(cardId);
  if (isSelected) {
    confirmRemovePricingCardSelection(cardId);
    return;
  }
  addPricingCardSelection(cardId);
};
const handleAddPricingCardCatalog = () => {
  const name = normalizeTextValue(newPricingCardName.value);
  if (!name) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Card Name', value: newPricingCardName.value, max: INPUT_LIMITS.name },
  ])) return;

  if (pricingRuleCardCatalog.value.some((item: any) => item.name.toLowerCase() === name.toLowerCase())) {
    return message.warning('This card already exists in catalog');
  }
  const createdItem = store.upsertGlobalPricingRuleCard(name);
  if (!createdItem) return;
  addPricingCardSelection(createdItem.id);
  pricingCardSearch.value = '';
  newPricingCardName.value = '';
  message.success(`Added ${createdItem.name} to Cards`);
};
const handleEditPricingCardCatalog = (id: string) => {
  const item = pricingRuleCardCatalog.value.find((entry: any) => entry.id === id);
  if (!item || item.system) return;
  editingPricingCardId.value = id;
  editingPricingCardName.value = item.name;
  newPricingCardName.value = '';
};
const handleUpdatePricingCardCatalog = () => {
  const id = editingPricingCardId.value;
  const nextName = normalizeTextValue(editingPricingCardName.value);
  if (!id || !nextName) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Card Name', value: editingPricingCardName.value, max: INPUT_LIMITS.name },
  ])) return;

  const result = store.renameGlobalPricingRuleCard(id, nextName);
  if ((result as any)?.duplicate) {
    return message.warning('This card already exists in catalog');
  }
  if (!result) return;
  resetPricingCardEditor();
  message.success('Card updated');
};
const handleDeletePricingCardCatalog = (id: string) => {
  const item = pricingRuleCardCatalog.value.find((entry: any) => entry.id === id);
  if (!item || item.system) return;
  if (pricingCardUsageIds.value.has(id)) {
    return message.warning('This card is already used in pricing rules and cannot be deleted');
  }
  Modal.confirm({
    title: `Delete ${item.name}?`,
    content: 'This removes the custom card from the Cards catalog for the current workspace.',
    okText: 'Delete',
    okType: 'danger',
    onOk: () => {
      store.removeGlobalPricingRuleCard(id);
      resetPricingCardEditor();
      message.success('Card removed from catalog');
    },
  });
};
const toggleCatalogField = (field: CatalogField) => {
  if (isReadOnly.value) return;
  openCatalogField.value = openCatalogField.value === field ? null : field;
};
const closeCatalogField = () => {
  openCatalogField.value = null;
  pricingCardSearch.value = '';
};
const getCatalogFieldElement = (field: CatalogField) => (
  field === 'paymentType'
    ? paymentTypeFieldRef.value
    : field === 'method'
      ? paymentMethodFieldRef.value
      : pricingCardFieldRef.value
);
const updateCatalogPanelPosition = (field?: CatalogField | null) => {
  const activeField = field || openCatalogField.value;
  if (!activeField) return;
  const trigger = getCatalogFieldElement(activeField);
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const viewportPadding = 16;
  const panelWidth = rect.width;
  const preferredTop = rect.bottom + 10;
  const spaceBelow = window.innerHeight - preferredTop - viewportPadding;
  const top = spaceBelow >= 220
    ? preferredTop
    : Math.max(viewportPadding, rect.top - Math.min(440, window.innerHeight - viewportPadding * 2) - 10);
  const availableHeight = Math.max(window.innerHeight - top - viewportPadding, 220);
  const left = Math.min(
    Math.max(rect.left, viewportPadding),
    Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding),
  );
  catalogPanelStyles[activeField] = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${panelWidth}px`,
    maxHeight: `${Math.min(availableHeight, 440)}px`,
  };
};
const selectCatalogValue = (field: CatalogField, value: string) => {
  if (field === 'paymentType') {
    formState.paymentType = value;
  } else if (field === 'method') {
    formState.method = value;
  } else {
    handleTogglePricingCardSelection(value);
    return;
  }
  closeCatalogField();
};
const clearCatalogValue = (field: CatalogField) => {
  if (field === 'paymentType') {
    formState.paymentType = '';
  } else if (field === 'method') {
    formState.method = '';
  } else {
    formState.selectedPricingCardIds = [];
  }
};
const handleDocumentMouseDown = (event: MouseEvent) => {
  const target = event.target as Node;
  if (
    paymentTypeFieldRef.value?.contains(target)
    || paymentMethodFieldRef.value?.contains(target)
    || pricingCardFieldRef.value?.contains(target)
    || paymentTypePanelRef.value?.contains(target)
    || paymentMethodPanelRef.value?.contains(target)
    || pricingCardPanelRef.value?.contains(target)
  ) return;
  closeCatalogField();
};
const handleViewportChange = () => {
  updateCatalogPanelPosition();
};

const capabilityOptionGroups = {
  refundCapability: ['Full Refund', 'Partial Refund', 'Multiple Partial Refund', 'Not Supported'],
  refundMethod: ['API', 'Portal', 'Not Supported'],
  autoDebitCapability: ['In Conditions', 'Supported', 'Not Supported'],
};

const toggleCapabilityOption = (group: 'refundCapability' | 'refundMethod', value: string) => {
  const currentSelection = normalizeSelectionList(formState.capabilityFlags[group]);
  formState.capabilityFlags[group] = currentSelection.includes(value)
    ? currentSelection.filter((item) => item !== value)
    : [...currentSelection, value];
};

const selectExclusiveCapabilityOption = (group: 'autoDebitCapability', value: string) => {
  formState.capabilityFlags[group] = [value];
};

const capabilitySummary = computed(() => {
  const { refundCapability, refundMethod, autoDebitCapability, minTicket, minTicketCurrency, maxTicket, maxTicketCurrency } = formState.capabilityFlags || {};
  const parts = [];
  
  if (minTicket) parts.push(`Min Ticket ${minTicketCurrency || 'USD'} ${minTicket}`);
  if (maxTicket) parts.push(`Max Ticket ${maxTicketCurrency || 'USD'} ${maxTicket}`);
  
  if (Array.isArray(refundCapability) && refundCapability.length > 0) {
    parts.push(...refundCapability);
  }
  if (Array.isArray(refundMethod) && refundMethod.length > 0) {
    parts.push(...refundMethod);
  }
  if (Array.isArray(autoDebitCapability) && autoDebitCapability.length > 0) {
    parts.push(...autoDebitCapability);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No capability flags set.';
});

const reserveSummary = computed(() => {
  const { type, fixedReserveValue, fixedReserveCurrency, rollingReserveRate, holdingPeriodDays } = formState.reserve || {};
  if (!type) return 'No reserve type selected.';
  if (type === 'None') return 'No reserve is configured for this payment method.';
  if (type === 'Fixed Reserve' && fixedReserveValue) return `Fixed reserve of ${fixedReserveCurrency || 'USD'} ${fixedReserveValue} is applied.`;
  if (type === 'Rolling Reserve' && rollingReserveRate) return `Rolling reserve of ${rollingReserveRate}% for ${holdingPeriodDays || 0} days is applied.`;
  if (type === 'Case by Case') return 'Reserve is handled on a case-by-case basis.';
  return 'Reserve configuration is incomplete.';
});

const settlementSummary = computed(() => {
  const {
    acquiringCurrency,
    settlementHolidays,
    settlementCurrency,
    fxCostReference,
  } = formState.settlement || {};
  const parts = [];
  const cycleLabel = getSettlementCycleDisplay(formState.settlement);
  const thresholdLabel = getSettlementThresholdDisplay(formState.settlement);
  if (cycleLabel !== 'Not set') parts.push(cycleLabel);
  if (Array.isArray(acquiringCurrency) && acquiringCurrency.length > 0) parts.push(...acquiringCurrency);
  if (Array.isArray(settlementHolidays) && settlementHolidays.length > 0) parts.push(...settlementHolidays);
  if (thresholdLabel) parts.push(thresholdLabel);
  if (Array.isArray(settlementCurrency) && settlementCurrency.length > 0) parts.push(...settlementCurrency);
  if (fxCostReference) parts.push(fxCostReference);
  return parts.length > 0 ? parts.join(', ') : 'Settlement configuration is incomplete.';
});

const hasRuleValue = (value: unknown) => value !== null && value !== undefined && value !== '';
const pricingSummary = computed(() => {
  if (usesCardPricing.value) {
    const summaries = selectedPricingEditorCards.value.map((item: any) => {
      const rules = getPricingRules(item.id);
      let feeStr = 'pricing not set';
      if (rules && rules.length > 0) {
        const primaryFee = rules[0];
        if (hasRuleValue(primaryFee.variableRate)) {
          feeStr = `${primaryFee.variableRate}%`;
        } else if (hasRuleValue(primaryFee.fixedFeeAmount)) {
          feeStr = `${primaryFee.fixedFeeCurrency || 'USD'} ${primaryFee.fixedFeeAmount}`;
        }
      }
      return `${item.name}: the primary fee is ${feeStr}`;
    });
    if ((formState.selectedPricingCardIds || []).includes(PRICING_RULE_CARD_SYSTEM_IDS.icpp)) {
      summaries.unshift(`IC++: ${hasRuleValue(formState.icpp) ? `${formState.icpp}%` : 'pricing not set'}`);
    }
    if (summaries.length === 0) return 'No cards selected.';
    return summaries.join('. ');
  }
  return 'General pricing rules applied';
});

const getPricingRules = (key: string) => {
  if (key === 'general') return formState.pricingRows || [];
  return formState.cardPricingRules?.[key] || [];
};

const ensureCardDefaults = () => {
  if (!Array.isArray(formState.consumerRegion) || formState.consumerRegion.length === 0) {
    formState.consumerRegion = JSON.parse(JSON.stringify(globalRegionSelection));
  }
  formState.cardPricingRules = normalizeCardPricingRules(formState.cardPricingRules);
  formState.selectedPricingCardIds = normalizeSelectedPricingCardIds(formState);
  (formState.selectedPricingCardIds || []).forEach((cardId: string) => ensurePricingCardBucket(cardId));
};

const restoreFormState = (value: any) => {
  const cloned = cloneState(value);
  Object.assign(formState, cloned);
};

watch(() => props.initialData, (newData) => {
  resetCatalogMethodEditor();
  resetCatalogPaymentTypeEditor();
  resetPricingCardEditor();
  if (newData) {
    const incomingId = newData?.id || null;
    const switchedRecord = incomingId !== loadedMethodId.value;
    loadedMethodId.value = incomingId;
    restoreFormState(newData);
    formState.method = normalizePaymentMethodName(formState.method);
    formState.paymentType = inferPaymentType(formState.paymentType, formState.method, formState.methodForm);
    formState.methodForm = resolveMethodForm(formState.paymentType, formState.methodForm);
    formState.capabilityFlags = normalizeCapabilityFlags(formState.capabilityFlags);
    formState.cardAdditionalFees = normalizeCardAdditionalFees(formState.cardAdditionalFees);
    formState.settlement = normalizeSettlementConfig(formState.settlement);
    if (!Array.isArray(formState.pricingRegion)) {
      formState.pricingRegion = [];
    }
    if (!Array.isArray(formState.pricingRows) || formState.pricingRows.length === 0) {
      formState.pricingRows = normalizePricingRows([createPricingRow()], '');
    } else {
      formState.pricingRows = normalizePricingRows(formState.pricingRows, '');
    }
    formState.cardPricingRules = normalizeCardPricingRules(formState.cardPricingRules);
    formState.selectedPricingCardIds = normalizeSelectedPricingCardIds(formState);
    if (usesCardPricing.value) {
      ensureCardDefaults();
    }
    syncCatalogsWithFormState();
    lastSavedSnapshot.value = cloneState(formState);
    if (isForceReadOnly.value) {
      isEditing.value = false;
    } else if (props.hideHeader || switchedRecord) {
      isEditing.value = true;
    }
  } else {
    // Reset to initial state when initialData is null/undefined
    formState.id = '';
    formState.method = '';
    formState.paymentType = props.methodFormType === 'card' ? 'Card' : '';
    formState.methodForm = props.methodFormType || 'nonCard';
    formState.consumerRegion = [];
    formState.pricingRegion = [];
    formState.icpp = null;
    formState.selectedPricingCardIds = [];
    formState.pricingRows = normalizePricingRows([createPricingRow()], '');
    formState.cardPricingRules = {};
    formState.cardAdditionalFees = createCardAdditionalFees();
    formState.capabilityFlags = {
      refundCapability: [],
      refundMethod: [],
      autoDebitCapability: [],
      minTicket: null,
      minTicketCurrency: '',
      maxTicket: null,
      maxTicketCurrency: '',
    };
    formState.reserve = {
      type: '',
      fixedReserveValue: null,
      fixedReserveCurrency: '',
      rollingReserveRate: null,
      holdingPeriodDays: null,
      holdingPeriodDayType: 'calendar',
      notes: '',
    };
    formState.settlement = createDefaultSettlementConfig();
    if (usesCardPricing.value) {
      ensureCardDefaults();
    }
    syncCatalogsWithFormState();
    loadedMethodId.value = null;
    lastSavedSnapshot.value = cloneState(formState);
    isEditing.value = !isForceReadOnly.value;
  }
}, { immediate: true });

watch(() => formState.paymentType, (nextType, previousType) => {
  if (nextType === previousType) return;
  const normalizedType = normalizeTextValue(nextType);
  if (normalizedType !== nextType) {
    formState.paymentType = normalizedType;
    return;
  }
  formState.methodForm = resolveMethodForm(normalizedType);
  if (isCardPaymentType(normalizedType)) {
    ensureCardDefaults();
  } else {
    formState.pricingRegion = [];
  }
});

watch(openCatalogField, async (nextField) => {
  if (!nextField) return;
  await nextTick();
  updateCatalogPanelPosition(nextField);
});

const handleCancel = () => {
  emit('update:open', false);
};

const handleDiscardChanges = () => {
  if (isForceReadOnly.value) return;
  if (props.hideHeader) {
    handleCancel();
    return;
  }
  if (lastSavedSnapshot.value) {
    restoreFormState(lastSavedSnapshot.value);
    syncCatalogsWithFormState();
  }
  resetCatalogMethodEditor();
  resetCatalogPaymentTypeEditor();
  resetPricingCardEditor();
  isEditing.value = false;
};

const handleEnterEditMode = () => {
  if (isForceReadOnly.value) return;
  isEditing.value = true;
};

const handleSave = () => {
  if (isForceReadOnly.value) return;
  formState.method = normalizePaymentMethodName(formState.method);
  if (!formState.method) return message.warning('Method name is required');
  formState.paymentType = inferPaymentType(formState.paymentType, formState.method, formState.methodForm);
  formState.methodForm = resolveMethodForm(formState.paymentType);
  formState.capabilityFlags = normalizeCapabilityFlags(formState.capabilityFlags);
  formState.settlement = normalizeSettlementConfig(formState.settlement);
  formState.cardPricingRules = normalizeCardPricingRules(formState.cardPricingRules);
  formState.selectedPricingCardIds = normalizeSelectedPricingCardIds(formState);
  syncCatalogsWithFormState();
  if (showTextLimitWarning(message.warning, [
    { label: 'Payment Method', value: formState.method, max: INPUT_LIMITS.name },
    { label: 'Settlement FX Cost Details', value: formState.settlement.fxCostDetails, max: INPUT_LIMITS.shortText },
    { label: 'Reserve Notes', value: formState.reserve.notes, max: INPUT_LIMITS.note },
    ...formState.pricingRows.map((row: any, index: number) => ({
      label: `Pricing Rule ${index + 1} Tier Name`,
      value: row.tierName,
      max: INPUT_LIMITS.name,
    })),
    ...Object.values(formState.cardPricingRules || {}).flatMap((rows: any) => (
      Array.isArray(rows)
        ? rows.map((row: any, index: number) => ({
          label: `Card Pricing Rule ${index + 1} Tier Name`,
          value: row.tierName,
          max: INPUT_LIMITS.name,
        }))
        : []
    )),
  ])) return;

  if (usesCardPricing.value) {
    ensureCardDefaults();
  }
  const payload = cloneState(formState);
  if (usesCardPricing.value) {
    const firstSelectedCard = selectedPricingEditorCards.value[0];
    payload.pricingRows = firstSelectedCard
      ? cloneState(payload.cardPricingRules?.[firstSelectedCard.id] || [createPricingRow('Base Rule')])
      : [createPricingRow('Base Rule')];
    formState.pricingRows = cloneState(payload.pricingRows);
  }
  lastSavedSnapshot.value = cloneState(payload);
  if (!props.hideHeader) {
    isEditing.value = false;
  }
  emit('save', payload);
};

defineExpose({
  handleSave
});

const handleDelete = () => {
  if (isForceReadOnly.value) return;
  message.info('Delete functionality to be implemented');
};

const shouldShowTierRule = (row: any = {}, _index = 0, type = 'general') => {
  const rules = getPricingRules(type);
  return Boolean(row?.isTiered) || rules.length > 1;
};
const getTierRuleActionLabel = (row: any = {}, index = 0, type = 'general') => {
  const rules = getPricingRules(type);
  if (!shouldShowTierRule(row, index, type)) return '';
  return rules.length > 1 ? 'Remove Rule' : 'Hide Tiered Rule';
};
const removePricingRow = (type: string, index: number) => {
  if (type === 'general') {
    if (formState.pricingRows.length === 1 && index === 0) {
      formState.pricingRows[0] = normalizePricingRow({ ...formState.pricingRows[0], tierName: '', isTiered: false });
      return;
    }
    const nextRows = formState.pricingRows.filter((_: any, rowIndex: number) => rowIndex !== index);
    if (nextRows.length === 1) {
      nextRows[0] = normalizePricingRow({ ...nextRows[0], isTiered: true });
    }
    formState.pricingRows = nextRows;
    return;
  }

  const rules = [...(formState.cardPricingRules?.[type] || [])];
  if (rules.length === 1 && index === 0) {
    rules[0] = normalizePricingRow({ ...rules[0], tierName: '', isTiered: false });
  } else {
    rules.splice(index, 1);
    if (rules.length === 1) {
      rules[0] = normalizePricingRow({ ...rules[0], isTiered: true });
    }
  }
  formState.cardPricingRules = {
    ...formState.cardPricingRules,
    [type]: rules,
  };
};
const addPricingRow = (type: string = 'general') => {
  if (type === 'general') {
    if (formState.pricingRows.length === 1 && !formState.pricingRows[0]?.isTiered) {
      formState.pricingRows[0] = normalizePricingRow({ ...formState.pricingRows[0], isTiered: true });
      return;
    }
    formState.pricingRows.push(normalizePricingRow({ ...createPricingRow(''), isTiered: true }));
    return;
  }
  ensurePricingCardBucket(type);
  const rules = formState.cardPricingRules[type];
  if (rules.length === 1 && !rules[0]?.isTiered) {
    rules[0] = normalizePricingRow({ ...rules[0], isTiered: true });
    formState.cardPricingRules = {
      ...formState.cardPricingRules,
      [type]: rules,
    };
    return;
  }
  rules.push(normalizePricingRow({ ...createPricingRow(''), isTiered: true }));
};

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentMouseDown);
  window.addEventListener('scroll', handleViewportChange, true);
  window.addEventListener('resize', handleViewportChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown);
  window.removeEventListener('scroll', handleViewportChange, true);
  window.removeEventListener('resize', handleViewportChange);
});

</script>

<template>
  <div class="payment-method-editor" :class="{ 'modal-mode': hideHeader }">
    <!-- Main Detail Header Card (Image 1 top part) -->
    <a-card
      v-if="!hideHeader"
      class="mb-6 onboarding-card border-none shadow-sm"
      :body-style="{ padding: '32px 40px' }"
      style="border-radius: 24px; background: #fff"
    >
      <div class="mb-4">
        <a-breadcrumb separator="/">
          <a-breadcrumb-item @click="emit('update:open', false)" class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium">
            {{ breadcrumbRootLabel }}
          </a-breadcrumb-item>
          <a-breadcrumb-item @click="emit('update:open', false)" class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium">
            {{ breadcrumbSectionLabel }}
          </a-breadcrumb-item>
          <a-breadcrumb-item class="text-slate-400 font-medium text-[13px]">{{ breadcrumbProposalLabel }}</a-breadcrumb-item>
          <a-breadcrumb-item class="text-slate-900 font-bold text-[13px]">{{ formState.method }}</a-breadcrumb-item>
        </a-breadcrumb>
      </div>

      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h2 class="text-[28px] font-black text-[#0f172a] m-0 leading-tight mb-2 tracking-tight">{{ formState.method || 'New Payment Method' }}</h2>
          <p class="text-slate-500 text-[14px] m-0 max-w-2xl font-medium leading-relaxed">
            {{ headerDescription }}
          </p>
        </div>
        <div v-if="!isForceReadOnly" class="flex items-center gap-3">
          <template v-if="isEditing">
            <a-button @click="handleDiscardChanges" class="h-[40px] px-6 rounded-xl font-bold text-slate-400 bg-slate-50 border-none hover:bg-slate-100 transition-all">
              Discard
            </a-button>
            <a-button type="primary" @click="handleSave" class="h-[40px] px-8 rounded-xl font-black bg-[#0284c7] border-none shadow-md hover:bg-sky-600 transition-all">
              Save
            </a-button>
          </template>
          <a-button v-else type="text" @click="handleEnterEditMode" class="h-[40px] px-4 rounded-xl font-bold text-sky-600 hover:bg-sky-50 transition-all">
            <template #icon><edit-outlined /></template>Edit
          </a-button>
          <a-button @click="handleDelete" class="h-[40px] px-6 rounded-xl font-bold text-red-500 border border-red-200 bg-white hover:bg-red-50 transition-all">
            Delete
          </a-button>
        </div>
      </div>
    </a-card>

    <a-form
      layout="vertical"
      :model="formState"
      :disabled="isReadOnly"
      :class="[
        'payment-method-form',
        hideHeader ? 'space-y-3' : 'space-y-6',
        isForceReadOnly ? 'payment-method-form--readonly-visual' : '',
      ]"
    >
      <!-- Payment Method Overview Section -->
      <a-card class="section-card onboarding-card border-none shadow-sm" style="border-radius: 24px; background: #fff">
        <template #title>
          <div class="flex justify-between items-center w-full pr-4">
            <h3 class="text-[16px] font-black text-slate-900 m-0">Payment Method Overview</h3>
            <div v-if="!isForceReadOnly" class="flex gap-2">
              <template v-if="hideHeader || isEditing">
                <a-button size="small" @click="hideHeader ? handleCancel() : handleDiscardChanges()" class="rounded-lg font-bold text-slate-600 border-slate-200 px-4 h-[28px] text-[11px] bg-white">Discard</a-button>
                <a-button type="primary" size="small" @click="handleSave" class="rounded-lg font-bold bg-[#0284c7] border-none px-4 h-[28px] text-[11px] shadow-sm">Save</a-button>
              </template>
              <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="handleEnterEditMode">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </div>
          </div>
        </template>
        <div class="section-body overview-body p-6 pt-0">
          <div class="overview-grid grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <div class="overview-field-card rounded-[20px] border border-slate-100 bg-slate-50/40 p-5 self-start">
              <a-form-item class="mb-0">
                <template #label>
                  <span class="text-[13px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1">
                    Consumer Region
                    <a-tooltip title="Regions where this payment method is allowed. Card pricing still defaults to Global when no region is selected."><info-circle-outlined class="text-slate-300" /></a-tooltip>
                  </span>
                </template>
                <a-cascader
                  v-model:value="formState.consumerRegion"
                  multiple
                  expand-trigger="hover"
                  :options="merchantGeoOptions"
                  placeholder="Select region"
                  class="w-full custom-cascader-height"
                />
              </a-form-item>
            </div>

            <div class="overview-field-card rounded-[20px] border border-slate-100 bg-slate-50/40 p-5 self-start">
              <a-form-item class="mb-0">
                <template #label>
                  <span class="text-[13px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1">
                    Payment Type
                    <a-tooltip title="If you cannot determine the payment type yet, you can leave this field empty.">
                      <info-circle-outlined class="text-slate-300" />
                    </a-tooltip>
                  </span>
                </template>
                <div ref="paymentTypeFieldRef" class="catalog-picker">
                  <button
                    type="button"
                    class="catalog-picker-trigger"
                    :class="{ 'is-open': openCatalogField === 'paymentType' }"
                    :disabled="isReadOnly"
                    @click.stop="toggleCatalogField('paymentType')"
                  >
                    <span class="catalog-picker-text" :class="{ 'is-placeholder': !formState.paymentType }">
                      {{ formState.paymentType || 'Select payment type' }}
                    </span>
                    <span class="catalog-picker-icons">
                      <close-circle-filled
                        v-if="formState.paymentType"
                        class="catalog-picker-clear"
                        @click.stop="clearCatalogValue('paymentType')"
                      />
                      <down-outlined class="catalog-picker-chevron" :class="{ 'is-open': openCatalogField === 'paymentType' }" />
                    </span>
                  </button>
                </div>
                <Teleport to="body">
                  <div
                    v-if="openCatalogField === 'paymentType'"
                    ref="paymentTypePanelRef"
                    class="catalog-picker-panel catalog-picker-panel--teleport"
                    :style="catalogPanelStyles.paymentType"
                    @mousedown.stop
                    @click.stop
                  >
                    <div class="catalog-picker-options">
                      <button
                        v-for="item in filteredPaymentTypeCatalog"
                        :key="item.id"
                        type="button"
                        class="catalog-picker-option"
                        :class="{ 'is-selected': formState.paymentType === item.name }"
                        @click="selectCatalogValue('paymentType', item.name)"
                      >
                        <span class="catalog-picker-option-label">{{ item.name }}</span>
                        <span class="catalog-picker-option-actions">
                          <edit-outlined class="catalog-picker-action" @click.stop="handleEditCatalogPaymentType(item.id)" />
                          <delete-outlined class="catalog-picker-action" @click.stop="handleDeleteCatalogPaymentType(item.id)" />
                        </span>
                      </button>
                    </div>
                    <div class="catalog-picker-footer">
                      <div class="text-[12px] font-black text-slate-700 uppercase tracking-widest mb-1.5">Manage Payment Type Catalog</div>
                      <p class="text-[11px] text-slate-400 font-medium mb-4 leading-relaxed">
                        Keep the payment type catalog aligned with your naming standard. You can leave the field empty if there is no clear mapping yet.
                      </p>
                      <div class="catalog-picker-footer-actions">
                        <a-input
                          v-if="editingCatalogPaymentTypeId"
                          v-model:value="editingCatalogPaymentTypeName"
                          :maxlength="INPUT_LIMITS.name"
                          placeholder="Edit payment type"
                          class="catalog-picker-footer-input rounded-lg h-[38px] border-slate-200 text-[13px]"
                          @keydown.enter.prevent="handleUpdateCatalogPaymentType"
                        />
                        <a-input
                          v-else
                          v-model:value="newCatalogPaymentTypeName"
                          :maxlength="INPUT_LIMITS.name"
                          placeholder="Add new payment type"
                          class="catalog-picker-footer-input rounded-lg h-[38px] border-slate-200 text-[13px]"
                          @keydown.enter.prevent="handleAddCatalogPaymentType"
                        />
                        <a-button
                          v-if="editingCatalogPaymentTypeId"
                          type="primary"
                          @click.stop="handleUpdateCatalogPaymentType"
                          class="font-bold h-[38px] rounded-lg border-none px-4 text-[13px] bg-[#0284c7]"
                        >
                          Save
                        </a-button>
                        <a-button
                          v-if="editingCatalogPaymentTypeId"
                          @click.stop="resetCatalogPaymentTypeEditor"
                          class="font-bold h-[38px] rounded-lg border-slate-200 px-4 text-[13px]"
                        >
                          Cancel
                        </a-button>
                        <a-button
                          v-else
                          type="default"
                          @click.stop="handleAddCatalogPaymentType"
                          class="flex items-center gap-1 font-bold h-[38px] rounded-lg border-slate-200 bg-white px-4 text-slate-700 text-[13px]"
                        >
                          <template #icon><plus-outlined /></template> Add
                        </a-button>
                      </div>
                    </div>
                  </div>
                </Teleport>
              </a-form-item>
            </div>

            <div class="overview-field-card rounded-[20px] border border-slate-100 bg-slate-50/40 p-5 self-start">
              <a-form-item required class="mb-0">
                <template #label>
                  <span class="text-[13px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1">
                    Payment Method
                    <a-tooltip title="Select the payment method identifier and manage the catalog directly from the dropdown.">
                      <info-circle-outlined class="text-slate-300" />
                    </a-tooltip>
                  </span>
                </template>
                <div ref="paymentMethodFieldRef" class="catalog-picker">
                  <button
                    type="button"
                    class="catalog-picker-trigger"
                    :class="{ 'is-open': openCatalogField === 'method' }"
                    :disabled="isReadOnly"
                    @click.stop="toggleCatalogField('method')"
                  >
                    <span class="catalog-picker-text" :class="{ 'is-placeholder': !formState.method }">
                      {{ formState.method || 'Select payment method' }}
                    </span>
                    <span class="catalog-picker-icons">
                      <close-circle-filled
                        v-if="formState.method"
                        class="catalog-picker-clear"
                        @click.stop="clearCatalogValue('method')"
                      />
                      <down-outlined class="catalog-picker-chevron" :class="{ 'is-open': openCatalogField === 'method' }" />
                    </span>
                  </button>
                </div>
                <Teleport to="body">
                  <div
                    v-if="openCatalogField === 'method'"
                    ref="paymentMethodPanelRef"
                    class="catalog-picker-panel catalog-picker-panel--teleport"
                    :style="catalogPanelStyles.method"
                    @mousedown.stop
                    @click.stop
                  >
                    <div class="catalog-picker-options">
                      <button
                        v-for="item in filteredPaymentMethodCatalog"
                        :key="item.id"
                        type="button"
                        class="catalog-picker-option"
                        :class="{ 'is-selected': formState.method === item.name }"
                        @click="selectCatalogValue('method', item.name)"
                      >
                        <span class="catalog-picker-option-copy">
                          <span class="catalog-picker-option-label">{{ item.name }}</span>
                          <span v-if="item.used" class="catalog-picker-option-meta">Used in pricing schedules</span>
                        </span>
                        <span class="catalog-picker-option-actions">
                          <edit-outlined class="catalog-picker-action" @click.stop="handleEditCatalogMethod(item.id)" />
                          <delete-outlined class="catalog-picker-action" @click.stop="handleDeleteCatalogMethod(item.id)" />
                        </span>
                      </button>
                    </div>
                    <div class="catalog-picker-footer">
                      <div class="text-[12px] font-black text-slate-700 uppercase tracking-widest mb-1.5">Manage Payment Method Catalog</div>
                      <p class="text-[11px] text-slate-400 font-medium mb-4 leading-relaxed">
                        Add, edit, or remove payment methods here without affecting the pricing rule layout.
                      </p>
                      <div class="catalog-picker-footer-actions">
                        <a-input
                          v-if="editingCatalogMethodId"
                          v-model:value="editingCatalogMethodName"
                          :maxlength="INPUT_LIMITS.name"
                          placeholder="Edit payment method"
                          class="catalog-picker-footer-input rounded-lg h-[38px] border-slate-200 text-[13px]"
                          @keydown.enter.prevent="handleUpdateCatalogMethod"
                        />
                        <a-input
                          v-else
                          v-model:value="newCatalogMethodName"
                          :maxlength="INPUT_LIMITS.name"
                          placeholder="Add new payment method"
                          class="catalog-picker-footer-input rounded-lg h-[38px] border-slate-200 text-[13px]"
                          @keydown.enter.prevent="handleAddCatalogMethod"
                        />
                        <a-button
                          v-if="editingCatalogMethodId"
                          type="primary"
                          @click.stop="handleUpdateCatalogMethod"
                          class="font-bold h-[38px] rounded-lg border-none px-4 text-[13px] bg-[#0284c7]"
                        >
                          Save
                        </a-button>
                        <a-button
                          v-if="editingCatalogMethodId"
                          @click.stop="resetCatalogMethodEditor"
                          class="font-bold h-[38px] rounded-lg border-slate-200 px-4 text-[13px]"
                        >
                          Cancel
                        </a-button>
                        <a-button
                          v-else
                          type="default"
                          @click.stop="handleAddCatalogMethod"
                          class="flex items-center gap-1 font-bold h-[38px] rounded-lg border-slate-200 bg-white px-4 text-slate-700 text-[13px]"
                        >
                          <template #icon><plus-outlined /></template> Add
                        </a-button>
                      </div>
                    </div>
                  </div>
                </Teleport>
              </a-form-item>
            </div>
          </div>
        </div>
      </a-card>

      <!-- Pricing Rules Section -->
      <a-card class="section-card onboarding-card border-none shadow-sm" style="border-radius: 24px; background: #fff">
        <template #title>
          <div class="flex justify-between items-center w-full pr-4">
            <div>
              <h3 class="text-[16px] font-black text-slate-900 m-0">Pricing Rules</h3>
              <p class="text-slate-400 text-[12px] font-medium m-0 mt-1">Summary: {{ pricingSummary }}</p>
            </div>
            <div v-if="!hideHeader && !isForceReadOnly" class="flex gap-2">
              <template v-if="isEditing">
                <a-button size="small" @click="handleDiscardChanges" class="rounded-lg font-bold text-slate-600 border-slate-200 px-4 h-[28px] text-[11px] bg-white">Discard</a-button>
                <a-button type="primary" size="small" @click="handleSave" class="rounded-lg font-bold bg-[#0284c7] border-none px-4 h-[28px] text-[11px] shadow-sm">Save</a-button>
              </template>
              <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="handleEnterEditMode">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </div>
          </div>
        </template>

        <div class="section-body pricing-body p-6 pt-0 space-y-6">
          <template v-if="usesCardPricing">
            <div class="pricing-card-selector p-6 border border-slate-200 rounded-[28px] bg-[#fcfdff] shadow-[0_16px_40px_-28px_rgba(15,23,42,0.4)]">
              <div class="flex flex-col gap-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 class="text-[15px] font-black text-slate-800 m-0">Cards</h4>
                    <p class="text-slate-500 text-[12px] font-medium m-0 mt-1">
                      Use the dropdown to select one or more card types. Each selected item opens its own pricing editor below.
                    </p>
                  </div>
                  <span class="text-[12px] font-bold text-slate-500">{{ pricingCardSelectionSummary }}</span>
                </div>

                <div ref="pricingCardFieldRef" class="catalog-picker">
                  <button
                    type="button"
                    class="catalog-picker-trigger catalog-picker-trigger--multiple"
                    :class="{ 'is-open': openCatalogField === 'pricingCard' }"
                    :disabled="isReadOnly"
                    @click.stop="toggleCatalogField('pricingCard')"
                  >
                    <div v-if="selectedPricingCardItems.length" class="catalog-picker-chip-list">
                      <span
                        v-for="item in selectedPricingCardItems"
                        :key="item.id"
                        class="catalog-picker-chip"
                      >
                        <span class="catalog-picker-chip-label">{{ item.name }}</span>
                        <span
                          class="catalog-picker-chip-remove"
                          :class="{ 'is-disabled': isReadOnly }"
                          @click.stop="confirmRemovePricingCardSelection(item.id)"
                        >
                          <close-outlined />
                        </span>
                      </span>
                    </div>
                    <span v-else class="catalog-picker-text is-placeholder">Select or add Cards</span>
                    <span class="catalog-picker-icons">
                      <search-outlined class="catalog-picker-search-icon" />
                      <down-outlined class="catalog-picker-chevron" :class="{ 'is-open': openCatalogField === 'pricingCard' }" />
                    </span>
                  </button>
                </div>

                <Teleport to="body">
                  <div
                    v-if="openCatalogField === 'pricingCard'"
                    ref="pricingCardPanelRef"
                    class="catalog-picker-panel catalog-picker-panel--teleport pricing-card-panel"
                    :style="catalogPanelStyles.pricingCard"
                    @mousedown.stop
                    @click.stop
                  >
                    <div class="pricing-card-panel-search">
                      <a-input
                        v-model:value="pricingCardSearch"
                        :maxlength="INPUT_LIMITS.search"
                        allow-clear
                        placeholder="Select or add Cards"
                        class="rounded-xl h-[40px] border-slate-200"
                      >
                        <template #prefix><search-outlined class="text-slate-300" /></template>
                      </a-input>
                    </div>
                    <div class="catalog-picker-options">
                      <button
                        v-for="item in filteredPricingCardCatalog"
                        :key="item.id"
                        type="button"
                        class="catalog-picker-option"
                        :class="{ 'is-selected': formState.selectedPricingCardIds.includes(item.id) }"
                        @click="selectCatalogValue('pricingCard', item.id)"
                      >
                        <span class="catalog-picker-option-copy">
                          <span class="catalog-picker-option-label">{{ item.name }}</span>
                          <span v-if="item.system" class="catalog-picker-option-meta">System card</span>
                        </span>
                        <span v-if="!item.system" class="catalog-picker-option-actions">
                          <edit-outlined class="catalog-picker-action" @click.stop="handleEditPricingCardCatalog(item.id)" />
                          <delete-outlined class="catalog-picker-action" @click.stop="handleDeletePricingCardCatalog(item.id)" />
                        </span>
                      </button>
                      <div v-if="filteredPricingCardCatalog.length === 0" class="catalog-picker-empty-state">
                        No cards match your search.
                      </div>
                    </div>
                    <div class="catalog-picker-footer">
                      <div class="text-[12px] font-black text-slate-700 uppercase tracking-widest mb-1.5">Add Card To Pricing Rules</div>
                      <p class="text-[11px] text-slate-400 font-medium mb-4 leading-relaxed">
                        Create a reusable custom Card name for Pricing Rules only. It becomes available across this Pricing workspace immediately.
                      </p>
                      <div class="catalog-picker-footer-actions pricing-card-footer-actions">
                        <a-input
                          v-if="editingPricingCardId"
                          v-model:value="editingPricingCardName"
                          :maxlength="INPUT_LIMITS.name"
                          placeholder="Rename Card"
                          class="catalog-picker-footer-input rounded-lg h-[38px] border-slate-200 text-[13px]"
                          @keydown.enter.prevent="handleUpdatePricingCardCatalog"
                        />
                        <a-input
                          v-else
                          v-model:value="newPricingCardName"
                          :maxlength="INPUT_LIMITS.name"
                          placeholder="Add new Card"
                          class="catalog-picker-footer-input rounded-lg h-[38px] border-slate-200 text-[13px]"
                          @keydown.enter.prevent="handleAddPricingCardCatalog"
                        />
                        <a-button
                          v-if="editingPricingCardId"
                          type="primary"
                          @click.stop="handleUpdatePricingCardCatalog"
                          class="font-bold h-[38px] rounded-lg border-none px-4 text-[13px] bg-[#0284c7]"
                        >
                          Save
                        </a-button>
                        <a-button
                          v-if="editingPricingCardId"
                          @click.stop="resetPricingCardEditor"
                          class="font-bold h-[38px] rounded-lg border-slate-200 px-4 text-[13px]"
                        >
                          Cancel
                        </a-button>
                        <a-button
                          v-else
                          type="default"
                          @click.stop="handleAddPricingCardCatalog"
                          class="flex items-center gap-1 font-bold h-[38px] rounded-lg border-slate-200 bg-white px-4 text-slate-700 text-[13px]"
                        >
                          <template #icon><plus-outlined /></template>Add
                        </a-button>
                      </div>
                    </div>
                  </div>
                </Teleport>
              </div>
            </div>

            <div
              v-if="formState.selectedPricingCardIds.includes(PRICING_RULE_CARD_SYSTEM_IDS.icpp)"
              class="pricing-icpp-card p-6 border border-slate-200 rounded-[24px] shadow-sm bg-white"
            >
              <div class="mb-4">
                <h4 class="text-[15px] font-black text-slate-800 m-0">IC++</h4>
                <p class="text-slate-500 text-[12px] font-medium m-0 mt-1">Input the percentage for this selected card rule.</p>
              </div>
              <a-input-number
                v-model:value="formState.icpp"
                addon-after="%"
                class="pricing-card-icpp-input custom-input-addon-after"
                placeholder="0.00"
              />
            </div>

            <div class="pricing-editor-stack space-y-6">
              <div v-for="item in selectedPricingEditorCards" :key="item.id" class="pricing-editor-card p-6 border border-slate-200 rounded-[24px] shadow-sm bg-white">
                <div class="pricing-editor-header flex justify-between items-start gap-4 mb-6">
                  <div>
                    <h4 class="text-[15px] font-black text-slate-800 m-0">{{ item.name }}</h4>
                    <p class="text-slate-500 text-[12px] font-medium m-0 mt-0.5">{{ cardPricingEditorDescription }}</p>
                  </div>
                  <a-button v-if="!isForceReadOnly" type="link" :disabled="isReadOnly" @click="addPricingRow(item.id)" class="flex items-center gap-1 font-bold text-sky-600 px-0">
                    <template #icon><plus-outlined /></template>Add Tiered Rule
                  </a-button>
                </div>

                <div class="pricing-rule-list space-y-4">
                  <div v-for="(row, idx) in getPricingRules(item.id)" :key="`${item.id}-${idx}`" class="pricing-rule-card p-5 bg-white rounded-[22px] border border-slate-200 last:mb-0 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.05)]">
                    <div class="pricing-rule-toolbar flex items-center justify-between gap-3 mb-5">
                      <p class="text-[12px] font-medium text-slate-500 m-0">
                        {{ cardPricingEditorHint }}
                      </p>
                      <a-button
                        v-if="!isForceReadOnly && getTierRuleActionLabel(row, Number(idx), item.id)"
                        :disabled="isReadOnly"
                        @click="removePricingRow(item.id, Number(idx))"
                        class="h-[32px] rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold"
                        :class="getTierRuleActionLabel(row, Number(idx), item.id) === 'Remove Rule' ? 'text-red-500 border-red-300 hover:text-red-500 hover:border-red-400' : 'text-slate-600 hover:border-slate-300'"
                      >
                        {{ getTierRuleActionLabel(row, Number(idx), item.id) }}
                      </a-button>
                    </div>
                    <div v-if="Number(idx) === 0" class="pricing-rule-base-label flex items-center justify-between gap-3 mb-5">
                      <span class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Base Pricing Rule
                      </span>
                    </div>
                    <div v-if="shouldShowTierRule(row, Number(idx), item.id)" class="tier-rule-box mb-5 rounded-[20px] border border-dashed border-slate-200 bg-slate-50/60 p-4">
                      <div class="text-[13px] font-black text-slate-800 mb-1">Tiered Rule</div>
                      <p class="text-[12px] text-slate-500 font-medium mb-3">
                        Use this label to describe the volume band or condition that activates the rule.
                      </p>
                      <a-input
                        v-model:value="row.tierName"
                        :maxlength="INPUT_LIMITS.name"
                        :disabled="isReadOnly"
                        placeholder="e.g. Domestic cards under 1,000 txns / month"
                        class="rounded-xl h-[42px] border-slate-200 bg-white"
                      />
                    </div>
                    <div class="pricing-rule-fields-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <div class="flex flex-col gap-2">
                        <span class="text-[13px] font-bold text-slate-700 h-6 flex items-center whitespace-nowrap">Fixed Fee</span>
                        <div class="flex h-[44px] gap-2">
                          <a-input-number v-model:value="row.fixedFeeAmount" class="flex-1 h-full" placeholder="0.00" />
                          <a-select v-model:value="row.fixedFeeCurrency" placeholder="Select" class="w-24 h-full custom-select-height-fixed" :bordered="true">
                            <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                          </a-select>
                        </div>
                      </div>
                      <div class="flex flex-col gap-2">
                        <span class="text-[13px] font-bold text-slate-700 h-6 flex items-center whitespace-nowrap">Variable Rate</span>
                        <a-input-number v-model:value="row.variableRate" addon-after="%" class="w-full h-[44px] rounded-xl custom-input-addon-after" placeholder="0.00" />
                      </div>
                      <div class="flex flex-col gap-2">
                        <span class="text-[13px] font-bold text-slate-700 h-6 flex items-center whitespace-nowrap gap-1">
                          Floor Price
                          <a-tooltip :title="floorPriceTooltip"><info-circle-outlined class="text-slate-300 text-[11px]" /></a-tooltip>
                        </span>
                        <div class="flex h-[44px] gap-2">
                          <a-input-number v-model:value="row.floorPrice" class="flex-1 h-full" placeholder="0.00" />
                          <a-select v-model:value="row.fixedFeeCurrency" placeholder="Select" class="w-24 h-full custom-select-height-fixed" :bordered="true">
                            <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                          </a-select>
                        </div>
                      </div>
                      <div class="flex flex-col gap-2">
                        <span class="text-[13px] font-bold text-slate-700 h-6 flex items-center whitespace-nowrap gap-1">
                          Cap Price
                          <a-tooltip :title="capPriceTooltip"><info-circle-outlined class="text-slate-300 text-[11px]" /></a-tooltip>
                        </span>
                        <div class="flex h-[44px] gap-2">
                          <a-input-number v-model:value="row.capPrice" class="flex-1 h-full" placeholder="0.00" />
                          <a-select v-model:value="row.fixedFeeCurrency" placeholder="Select" class="w-24 h-full custom-select-height-fixed" :bordered="true">
                            <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                          </a-select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="pricing-additional-fees p-6 bg-slate-50/30 border border-slate-100 rounded-2xl">
              <div class="mb-4">
                <h4 class="text-[15px] font-black text-slate-800 m-0">Additional Fees</h4>
              </div>
              <div class="card-additional-fees-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <div v-for="item in cardAdditionalFeeFields" :key="item.prop" class="flex flex-col gap-1.5 p-4 bg-white border border-slate-100 rounded-xl">
                  <div class="text-[12px] font-bold text-slate-600 flex items-center gap-1">
                    {{ item.label }}
                    <a-tooltip title="Configure fee for this action."><info-circle-outlined class="text-slate-300 text-[11px]" /></a-tooltip>
                  </div>
                  <div class="flex h-[44px] gap-2">
                    <a-input-number v-model:value="formState.cardAdditionalFees[item.prop].amount" class="flex-1 rounded-lg h-full flex items-center text-[13px]" placeholder="0.00" />
                    <a-select v-model:value="formState.cardAdditionalFees[item.prop].currency" placeholder="Select" class="w-24 rounded-lg h-full flex items-center custom-select-height-fixed additional-fee-select" :bordered="true">
                      <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                    </a-select>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div v-else class="standard-pricing-card p-6 border border-slate-100 rounded-2xl bg-white">
            <div class="standard-pricing-header flex justify-between items-start gap-4 mb-6">
              <div>
                <h4 class="text-[15px] font-black text-slate-800 m-0">Standard Pricing</h4>
                <p class="text-slate-400 text-[12px] font-medium m-0 mt-0.5">Set the base rule first. Tiered rules only appear after you add them.</p>
              </div>
              <a-button v-if="!isForceReadOnly" type="link" :disabled="isReadOnly" @click="addPricingRow('general')" class="flex items-center gap-1 font-bold text-sky-600 px-0">
                <template #icon><plus-outlined /></template>Add Tiered Rule
              </a-button>
            </div>

            <div v-for="(row, idx) in getPricingRules('general')" :key="`general-${idx}`" class="pricing-rule-card mb-4 p-5 border border-slate-100 rounded-2xl bg-white last:mb-0">
              <div class="pricing-rule-toolbar flex items-center justify-between gap-3 mb-5">
                <p class="text-[12px] font-medium text-slate-500 m-0">
                  {{ cardPricingEditorHint }}
                </p>
                <a-button
                  v-if="!isForceReadOnly && getTierRuleActionLabel(row, Number(idx), 'general')"
                  :disabled="isReadOnly"
                  @click="removePricingRow('general', Number(idx))"
                  class="h-[32px] rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold"
                  :class="getTierRuleActionLabel(row, Number(idx), 'general') === 'Remove Rule' ? 'text-red-500 border-red-300 hover:text-red-500 hover:border-red-400' : 'text-slate-600 hover:border-slate-300'"
                >
                  {{ getTierRuleActionLabel(row, Number(idx), 'general') }}
                </a-button>
              </div>
              <div v-if="Number(idx) === 0" class="pricing-rule-base-label flex items-center justify-between gap-3 mb-5">
                <span class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Base Pricing Rule
                </span>
              </div>
              <div v-if="shouldShowTierRule(row, Number(idx), 'general')" class="tier-rule-box mb-5 rounded-[20px] border border-dashed border-slate-200 bg-slate-50/60 p-4">
                <div class="text-[13px] font-black text-slate-800 mb-1">Tiered Rule</div>
                <p class="text-[12px] text-slate-500 font-medium mb-3">
                  Use this label to describe the volume band or condition that activates the rule.
                </p>
                <a-input
                  v-model:value="row.tierName"
                  :maxlength="INPUT_LIMITS.name"
                  :disabled="isReadOnly"
                  placeholder="e.g. Domestic cards under 1,000 txns / month"
                  class="rounded-xl h-[42px] border-slate-200 bg-white"
                />
              </div>
              <div class="pricing-rule-fields-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div class="flex flex-col gap-2">
                  <span class="text-[13px] font-bold text-slate-700 h-6 flex items-center whitespace-nowrap">Fixed Fee</span>
                  <div class="flex h-[44px] gap-2">
                    <a-input-number v-model:value="row.fixedFeeAmount" class="flex-1 h-full" placeholder="0.00" />
                    <a-select v-model:value="row.fixedFeeCurrency" placeholder="Select" class="w-24 h-full custom-select-height-fixed" :bordered="true">
                      <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                    </a-select>
                  </div>
                </div>
                <div class="flex flex-col gap-2">
                  <span class="text-[13px] font-bold text-slate-700 h-6 flex items-center whitespace-nowrap">Variable Rate</span>
                  <a-input-number v-model:value="row.variableRate" addon-after="%" class="w-full h-[44px] rounded-xl custom-input-addon-after" placeholder="0.00" />
                </div>
                <div class="flex flex-col gap-2">
                  <span class="text-[13px] font-bold text-slate-700 h-6 flex items-center whitespace-nowrap gap-1">
                    Floor Price
                    <a-tooltip :title="floorPriceTooltip"><info-circle-outlined class="text-slate-300 text-[11px]" /></a-tooltip>
                  </span>
                  <div class="flex h-[44px] gap-2">
                    <a-input-number v-model:value="row.floorPrice" class="flex-1 h-full" placeholder="0.00" />
                    <a-select v-model:value="row.fixedFeeCurrency" placeholder="Select" class="w-24 h-full custom-select-height-fixed" :bordered="true">
                      <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                    </a-select>
                  </div>
                </div>
                <div class="flex flex-col gap-2">
                  <span class="text-[13px] font-bold text-slate-700 h-6 flex items-center whitespace-nowrap gap-1">
                    Cap Price
                    <a-tooltip :title="capPriceTooltip"><info-circle-outlined class="text-slate-300 text-[11px]" /></a-tooltip>
                  </span>
                  <div class="flex h-[44px] gap-2">
                    <a-input-number v-model:value="row.capPrice" class="flex-1 h-full" placeholder="0.00" />
                    <a-select v-model:value="row.fixedFeeCurrency" placeholder="Select" class="w-24 h-full custom-select-height-fixed" :bordered="true">
                      <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                    </a-select>
                  </div>
                </div>
              </div>
            </div>

            <div class="pricing-additional-fees non-card-additional-fees mt-6 bg-slate-50/30 border border-slate-100 rounded-2xl p-6">
              <div class="mb-4">
                <h4 class="text-[15px] font-black text-slate-800 m-0">Additional Fees</h4>
              </div>
              <div class="non-card-additional-fees-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  v-for="item in nonCardAdditionalFeeFields"
                  :key="item.prop"
                  class="pricing-additional-fee-field flex flex-col gap-1.5 p-4 bg-white border border-slate-100 rounded-xl"
                >
                  <div class="text-[12px] font-bold text-slate-600 flex items-center gap-1">
                    {{ item.label }}
                    <a-tooltip title="Configure fee for this action."><info-circle-outlined class="text-slate-300 text-[11px]" /></a-tooltip>
                  </div>
                  <div class="flex h-[44px] gap-2">
                    <a-input-number
                      v-model:value="formState.cardAdditionalFees[item.prop].amount"
                      class="flex-1 rounded-lg h-full flex items-center text-[13px]"
                      placeholder="0.00"
                    />
                    <a-select
                      v-model:value="formState.cardAdditionalFees[item.prop].currency"
                      placeholder="Select"
                      class="w-24 rounded-lg h-full flex items-center custom-select-height-fixed additional-fee-select"
                      :bordered="true"
                    >
                      <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                    </a-select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a-card>

      <!-- Payment Capability Section -->
      <a-card class="section-card onboarding-card border-none shadow-sm" style="border-radius: 24px; background: #fff">
        <template #title>
          <div class="flex justify-between items-center w-full pr-4">
            <div>
              <h3 class="text-[16px] font-black text-slate-900 m-0">Payment Capability</h3>
              <p class="text-slate-400 text-[12px] font-medium m-0 mt-1">Summary: {{ capabilitySummary }}</p>
            </div>
            <div v-if="!hideHeader && !isForceReadOnly" class="flex gap-2">
              <template v-if="isEditing">
                <a-button size="small" @click="handleDiscardChanges" class="rounded-lg font-bold text-slate-600 border-slate-200 px-4 h-[28px] text-[11px] bg-white">Discard</a-button>
                <a-button type="primary" size="small" @click="handleSave" class="rounded-lg font-bold bg-[#0284c7] border-none px-4 h-[28px] text-[11px] shadow-sm">Save</a-button>
              </template>
              <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="handleEnterEditMode">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </div>
          </div>
        </template>
        <div class="section-body capability-body p-6 pt-0 space-y-8">
          <!-- Ticket Limits -->
          <div class="ticket-limit-grid grid grid-cols-4 gap-4">
            <div class="flex flex-col gap-2">
              <span class="text-[13px] font-bold text-slate-700 flex items-center gap-1">
                Minimum Transaction Amount
                <a-tooltip title="The lowest single transaction amount this payment method accepts. Transactions below this value should be rejected or blocked upstream.">
                  <info-circle-outlined class="text-slate-300 text-[11px]" />
                </a-tooltip>
              </span>
              <a-input-number v-model:value="formState.capabilityFlags.minTicket" class="w-full h-[44px] flex items-center rounded-xl" placeholder="Min" />
            </div>
            <div class="flex flex-col gap-2">
              <span class="text-[13px] font-bold text-slate-700">Currency</span>
              <a-select v-model:value="formState.capabilityFlags.minTicketCurrency" placeholder="Select" class="h-[44px] custom-select-height-fixed">
                <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
              </a-select>
            </div>
            <div class="flex flex-col gap-2">
              <span class="text-[13px] font-bold text-slate-700 flex items-center gap-1">
                Maximum Transaction Amount
                <a-tooltip title="The highest single transaction amount this payment method can process. Transactions above this value should be split or declined.">
                  <info-circle-outlined class="text-slate-300 text-[11px]" />
                </a-tooltip>
              </span>
              <a-input-number v-model:value="formState.capabilityFlags.maxTicket" class="w-full h-[44px] flex items-center rounded-xl" placeholder="Max" />
            </div>
            <div class="flex flex-col gap-2">
              <span class="text-[13px] font-bold text-slate-700">Currency</span>
              <a-select v-model:value="formState.capabilityFlags.maxTicketCurrency" placeholder="Select" class="h-[44px] custom-select-height-fixed">
                <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
              </a-select>
            </div>
          </div>

          <!-- Refund Capability Selection Buttons -->
          <div class="flex flex-col gap-3">
            <span class="text-[13px] font-bold text-slate-700">Refund Capability</span>
            <div class="capability-pill-grid capability-pill-grid--4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <button 
                v-for="opt in capabilityOptionGroups.refundCapability" 
                :key="opt" 
                type="button"
                :disabled="isReadOnly"
                @click="toggleCapabilityOption('refundCapability', opt)"
                class="capability-pill-btn"
                :class="{ 'selected': formState.capabilityFlags.refundCapability.includes(opt) }"
              >
                <span class="pill-check-icon" :class="{ 'selected': formState.capabilityFlags.refundCapability.includes(opt) }">
                  <check-circle-filled v-if="formState.capabilityFlags.refundCapability.includes(opt)" />
                </span>
                <span class="pill-label">{{ opt }}</span>
              </button>
            </div>
          </div>

          <!-- Refund Method Selection Buttons -->
          <div class="flex flex-col gap-3">
            <span class="text-[13px] font-bold text-slate-700">Refund Method</span>
            <div class="capability-pill-grid capability-pill-grid--3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <button 
                v-for="opt in capabilityOptionGroups.refundMethod" 
                :key="opt" 
                type="button"
                :disabled="isReadOnly"
                @click="toggleCapabilityOption('refundMethod', opt)"
                class="capability-pill-btn"
                :class="{ 'selected': formState.capabilityFlags.refundMethod.includes(opt) }"
              >
                <span class="pill-check-icon" :class="{ 'selected': formState.capabilityFlags.refundMethod.includes(opt) }">
                  <check-circle-filled v-if="formState.capabilityFlags.refundMethod.includes(opt)" />
                </span>
                <span class="pill-label">{{ opt }}</span>
              </button>
            </div>
          </div>

          <!-- Auto Debit Selection Buttons -->
          <div class="flex flex-col gap-3">
            <span class="text-[13px] font-bold text-slate-700">Auto Debit Capability</span>
            <div class="capability-pill-grid capability-pill-grid--3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <button 
                v-for="opt in capabilityOptionGroups.autoDebitCapability" 
                :key="opt" 
                type="button"
                :disabled="isReadOnly"
                @click="selectExclusiveCapabilityOption('autoDebitCapability', opt)"
                class="capability-pill-btn"
                :class="{ 'selected': formState.capabilityFlags.autoDebitCapability.includes(opt) }"
              >
                <span class="pill-check-icon" :class="{ 'selected': formState.capabilityFlags.autoDebitCapability.includes(opt) }">
                  <check-circle-filled v-if="formState.capabilityFlags.autoDebitCapability.includes(opt)" />
                </span>
                <span class="pill-label">{{ opt }}</span>
              </button>
            </div>
          </div>
        </div>
      </a-card>

      <!-- Two-column Layout for Reserve and Settlement (Modal Mode) -->
      <div v-if="hideHeader" class="modal-embedded-layout">
        <a-row :gutter="12" class="modal-embedded-row">
          <a-col :span="9">
            <!-- Reserve Section (Embedded) -->
            <a-card class="section-card onboarding-card border-none shadow-sm h-full" style="border-radius: 24px; background: #fff">
              <template #title>
                <h3 class="text-[16px] font-black text-slate-900 m-0">Reserve</h3>
              </template>
              <div class="section-body reserve-body p-6 pt-0 space-y-6">
                <div class="flex flex-col gap-3">
                  <span class="text-[13px] font-bold text-slate-700">Reserve Type</span>
                  <div class="grid grid-cols-2 gap-3">
                    <button 
                      v-for="opt in ['Fixed Reserve', 'Rolling Reserve', 'Case by Case', 'None']" 
                      :key="opt" 
                      type="button"
                      @click="formState.reserve.type = opt"
                      class="capability-pill-btn"
                      :class="{ 'selected': formState.reserve.type === opt }"
                    >
                      <span class="pill-check-icon" :class="{ 'selected': formState.reserve.type === opt }">
                        <check-circle-filled v-if="formState.reserve.type === opt" />
                      </span>
                      <span class="pill-label">{{ opt }}</span>
                    </button>
                  </div>
                </div>

                <!-- Conditional Fields based on Reserve Type -->
                <div v-if="formState.reserve.type === 'Fixed Reserve'" class="flex flex-col gap-2 mt-4">
                  <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">Fixed Reserve Value</span>
                  <div class="flex h-[44px] gap-2">
                    <a-input-number v-model:value="formState.reserve.fixedReserveValue" class="flex-1 h-full" placeholder="0.00" />
                    <a-select v-model:value="formState.reserve.fixedReserveCurrency" placeholder="Select" class="w-24 h-full" :bordered="true">
                      <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                    </a-select>
                  </div>
                </div>

                <div v-if="formState.reserve.type === 'Rolling Reserve'" class="grid grid-cols-2 gap-4 mt-4">
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">Rolling Reserve Rate</span>
                    <a-input-number v-model:value="formState.reserve.rollingReserveRate" suffix="%" class="w-full h-[44px] rounded-xl" placeholder="0.00" />
                  </div>
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">Holding Period (Days)</span>
                    <a-input-number v-model:value="formState.reserve.holdingPeriodDays" class="w-full h-[44px] rounded-xl" placeholder="Days" />
                  </div>
                  <div class="flex flex-col gap-2 col-span-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">Day Type</span>
                    <a-select v-model:value="formState.reserve.holdingPeriodDayType" class="h-[44px] custom-select-height-fixed">
                      <a-select-option value="calendar">Calendar day</a-select-option>
                      <a-select-option value="working">Working day</a-select-option>
                    </a-select>
                  </div>
                </div>

                <div v-if="formState.reserve.type === 'Case by Case'" class="mt-4">
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">Reserve Notes</span>
                    <a-textarea v-model:value="formState.reserve.notes" :maxlength="INPUT_LIMITS.note" :rows="3" show-count placeholder="Enter specific reserve conditions..." class="rounded-xl border-slate-200" />
                  </div>
                </div>
              </div>
            </a-card>
          </a-col>
          <a-col :span="15">
            <!-- Settlement Section (Embedded) -->
            <a-card class="section-card onboarding-card border-none shadow-sm h-full" style="border-radius: 24px; background: #fff">
              <template #title>
                <h3 class="text-[16px] font-black text-slate-900 m-0">Settlement</h3>
              </template>
              <div class="section-body settlement-body p-6 pt-0 space-y-6">
                <div class="settlement-grid grid grid-cols-3 gap-6">
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">Settlement Cycle</span>
                    <a-input-number v-model:value="formState.settlement.cycleDays" addon-before="T+" class="w-full h-[44px] flex items-center rounded-xl" />
                  </div>
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">Settlement Day Type</span>
                    <a-select v-model:value="formState.settlement.cycleDayType" class="h-[44px] custom-select-height-fixed">
                      <a-select-option value="calendar">Calendar day</a-select-option>
                      <a-select-option value="working">Working day</a-select-option>
                    </a-select>
                  </div>
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">Acquiring Currency</span>
                    <a-select v-model:value="formState.settlement.acquiringCurrency" mode="multiple" placeholder="Select" class="h-[44px] custom-select-height-fixed">
                      <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                    </a-select>
                  </div>
                </div>

                <div class="settlement-grid grid grid-cols-3 gap-6">
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">Settlement Holiday Reference</span>
                    <a-select v-model:value="formState.settlement.settlementHolidays" mode="multiple" placeholder="Select" class="h-[44px] custom-select-height-fixed">
                      <a-select-option value="US">US</a-select-option>
                    </a-select>
                  </div>
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center gap-1">
                      Settlement Threshold
                      <a-tooltip title="Minimum amount to trigger settlement.">
                        <info-circle-outlined class="text-slate-300 text-[11px]" />
                      </a-tooltip>
                    </span>
                    <div class="flex h-[44px] gap-2">
                      <a-input-number v-model:value="formState.settlement.settlementThreshold" class="flex-1 h-full" placeholder="0.00" />
                      <a-select v-model:value="formState.settlement.settlementThresholdCurrency" placeholder="Select" class="w-24 h-full custom-select-height-fixed" :bordered="true">
                        <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                      </a-select>
                    </div>
                  </div>
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">Settlement Currency</span>
                    <a-select v-model:value="formState.settlement.settlementCurrency" mode="multiple" placeholder="Select" class="h-[44px] custom-select-height-fixed">
                      <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                    </a-select>
                  </div>
                </div>

                <div class="settlement-grid fx-cost-grid grid gap-6" :class="usesFxDetailField ? 'fx-cost-grid--details' : 'grid-cols-3'">
                  <div class="flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">FX Cost Reference</span>
                    <a-select v-model:value="formState.settlement.fxCostReference" placeholder="Select reference" class="h-[44px] custom-select-height-fixed w-full">
                      <a-select-option v-for="option in FX_COST_REFERENCE_OPTIONS" :key="option" :value="option">{{ option }}</a-select-option>
                    </a-select>
                  </div>
                  <template v-if="usesFxMarkupFields">
                    <div class="flex flex-col gap-2">
                      <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">FX Operator</span>
                      <a-select v-model:value="formState.settlement.fxCostOperator" class="h-[44px] custom-select-height-fixed">
                        <a-select-option value="+">+</a-select-option>
                        <a-select-option value="-">-</a-select-option>
                      </a-select>
                    </div>
                    <div class="flex flex-col gap-2">
                      <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">FX Cost Value</span>
                      <a-input-number
                        v-model:value="formState.settlement.fxCostValue"
                        addon-after="%"
                        class="w-full h-[44px] rounded-xl custom-input-addon-after"
                        placeholder="0.00"
                      />
                    </div>
                  </template>
                  <div v-else-if="usesFxDetailField" class="fx-cost-details-field flex flex-col gap-2">
                    <span class="text-[13px] font-bold text-slate-700 whitespace-nowrap h-6 flex items-center">FX Cost Details</span>
                    <a-textarea
                      v-model:value="formState.settlement.fxCostDetails"
                      :maxlength="INPUT_LIMITS.shortText"
                      :auto-size="{ minRows: 3, maxRows: 6 }"
                      show-count
                      placeholder="Explain FX reference details..."
                      class="rounded-xl border-slate-200"
                    />
                  </div>
                </div>
              </div>
            </a-card>
          </a-col>
        </a-row>
      </div>

      <!-- Individual Sections (Drawer Mode) -->
      <template v-if="!hideHeader">
        <!-- Reserve Section -->
        <a-card class="onboarding-card border-none shadow-sm" style="border-radius: 24px; background: #fff">
          <template #title>
            <div class="flex justify-between items-center w-full pr-4">
              <div>
                <h3 class="text-[16px] font-black text-slate-900 m-0">Reserve</h3>
                <p class="text-slate-400 text-[12px] font-medium m-0 mt-1">Summary: {{ reserveSummary }}</p>
              </div>
              <div v-if="!isForceReadOnly" class="flex gap-2">
                <template v-if="isEditing">
                  <a-button size="small" @click="handleDiscardChanges" class="rounded-lg font-bold text-slate-600 border-slate-200 px-4 h-[28px] text-[11px] bg-white">Discard</a-button>
                  <a-button type="primary" size="small" @click="handleSave" class="rounded-lg font-bold bg-[#0284c7] border-none px-4 h-[28px] text-[11px] shadow-sm">Save</a-button>
                </template>
                <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="handleEnterEditMode">
                  <template #icon><edit-outlined /></template>Edit
                </a-button>
              </div>
            </div>
          </template>
          <div class="p-6 pt-0 space-y-6">
            <div class="flex flex-col gap-3">
              <span class="text-[13px] font-bold text-slate-700">Reserve Type</span>
              <div class="grid grid-cols-4 gap-4">
                <button 
                  v-for="opt in ['Fixed Reserve', 'Rolling Reserve', 'Case by Case', 'None']" 
                  :key="opt" 
                  type="button"
                  :disabled="isReadOnly"
                  @click="formState.reserve.type = opt"
                  class="capability-pill-btn"
                  :class="{ 'selected': formState.reserve.type === opt }"
                >
                  <span class="pill-check-icon" :class="{ 'selected': formState.reserve.type === opt }">
                    <check-circle-filled v-if="formState.reserve.type === opt" />
                  </span>
                  <span class="pill-label">{{ opt }}</span>
                </button>
              </div>
            </div>

            <div v-if="formState.reserve.type === 'Fixed Reserve'" class="grid grid-cols-2 gap-4 max-w-md">
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Fixed Reserve Value</span>
                <a-input-number v-model:value="formState.reserve.fixedReserveValue" class="w-full h-[44px] flex items-center rounded-xl" placeholder="0.00" />
              </div>
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Currency</span>
                <a-select v-model:value="formState.reserve.fixedReserveCurrency" placeholder="Select" class="h-[44px] custom-select-height-fixed">
                  <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                </a-select>
              </div>
            </div>

            <div v-if="formState.reserve.type === 'Rolling Reserve'" class="grid grid-cols-3 gap-4">
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Rolling Reserve Rate</span>
                <a-input-number v-model:value="formState.reserve.rollingReserveRate" suffix="%" class="w-full h-[44px] flex items-center rounded-xl" placeholder="0.00" />
              </div>
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Holding Period (Days)</span>
                <a-input-number v-model:value="formState.reserve.holdingPeriodDays" class="w-full h-[44px] flex items-center rounded-xl" placeholder="Days" />
              </div>
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Day Type</span>
                <a-select v-model:value="formState.reserve.holdingPeriodDayType" class="h-[44px] custom-select-height-fixed">
                  <a-select-option value="calendar">Calendar day</a-select-option>
                  <a-select-option value="working">Working day</a-select-option>
                </a-select>
              </div>
            </div>

            <div v-if="formState.reserve.type === 'Case by Case'">
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Reserve Notes</span>
                <a-textarea v-model:value="formState.reserve.notes" :maxlength="INPUT_LIMITS.note" :rows="3" show-count placeholder="Enter specific reserve conditions..." class="rounded-xl border-slate-200" />
              </div>
            </div>
          </div>
        </a-card>

        <!-- Settlement Section -->
        <a-card class="onboarding-card border-none shadow-sm" style="border-radius: 24px; background: #fff">
          <template #title>
            <div class="flex justify-between items-center w-full pr-4">
              <div>
                <h3 class="text-[16px] font-black text-slate-900 m-0">Settlement</h3>
                <p class="text-slate-400 text-[12px] font-medium m-0 mt-1">Summary: {{ settlementSummary }}</p>
              </div>
              <div v-if="!isForceReadOnly" class="flex gap-2">
                <template v-if="isEditing">
                  <a-button size="small" @click="handleDiscardChanges" class="rounded-lg font-bold text-slate-600 border-slate-200 px-4 h-[28px] text-[11px] bg-white">Discard</a-button>
                  <a-button type="primary" size="small" @click="handleSave" class="rounded-lg font-bold bg-[#0284c7] border-none px-4 h-[28px] text-[11px] shadow-sm">Save</a-button>
                </template>
                <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="handleEnterEditMode">
                  <template #icon><edit-outlined /></template>Edit
                </a-button>
              </div>
            </div>
          </template>
          <div class="p-6 pt-0 space-y-6">
            <div class="grid grid-cols-3 gap-6">
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Settlement Cycle</span>
                <a-input-number v-model:value="formState.settlement.cycleDays" addon-before="T+" class="w-full h-[44px] flex items-center rounded-xl" />
              </div>
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Settlement Day Type</span>
                <a-select v-model:value="formState.settlement.cycleDayType" class="h-[44px] custom-select-height-fixed">
                  <a-select-option value="calendar">Calendar day</a-select-option>
                  <a-select-option value="working">Working day</a-select-option>
                </a-select>
              </div>
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Acquiring Currency</span>
                <a-select v-model:value="formState.settlement.acquiringCurrency" mode="multiple" placeholder="Select currencies" class="h-[44px] custom-select-height-fixed">
                  <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                </a-select>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-6">
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Settlement Holiday Reference</span>
                <a-select v-model:value="formState.settlement.settlementHolidays" mode="multiple" placeholder="Select holiday references" class="h-[44px] custom-select-height-fixed">
                  <a-select-option value="US">US Federal Holidays</a-select-option>
                  <a-select-option value="UK">UK Bank Holidays</a-select-option>
                  <a-select-option value="EU">Target2 Holidays</a-select-option>
                </a-select>
              </div>
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Settlement Threshold <a-tooltip title="Minimum amount to trigger settlement."><info-circle-outlined class="text-slate-300" /></a-tooltip></span>
                <div class="flex h-[44px] gap-2">
                  <a-input-number v-model:value="formState.settlement.settlementThreshold" class="flex-1 h-full" placeholder="0.00" />
                  <a-select v-model:value="formState.settlement.settlementThresholdCurrency" placeholder="Select" class="w-24 h-full custom-select-height-fixed" :bordered="true">
                    <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                  </a-select>
                </div>
              </div>
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">Settlement Currency</span>
                <a-select v-model:value="formState.settlement.settlementCurrency" mode="multiple" placeholder="Select settlement currencies" class="h-[44px] custom-select-height-fixed">
                  <a-select-option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</a-select-option>
                </a-select>
              </div>
            </div>

            <div class="fx-cost-grid grid gap-6" :class="usesFxDetailField ? 'fx-cost-grid--details' : 'grid-cols-3'">
              <div class="flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">FX Cost Reference</span>
                <a-select v-model:value="formState.settlement.fxCostReference" placeholder="Select reference" class="h-[44px] custom-select-height-fixed">
                  <a-select-option v-for="option in FX_COST_REFERENCE_OPTIONS" :key="option" :value="option">{{ option }}</a-select-option>
                </a-select>
              </div>
              <template v-if="usesFxMarkupFields">
                <div class="flex flex-col gap-2">
                  <span class="text-[13px] font-bold text-slate-700">FX Operator</span>
                  <a-select v-model:value="formState.settlement.fxCostOperator" class="h-[44px] custom-select-height-fixed">
                    <a-select-option value="+">+</a-select-option>
                    <a-select-option value="-">-</a-select-option>
                  </a-select>
                </div>
                <div class="flex flex-col gap-2">
                  <span class="text-[13px] font-bold text-slate-700">FX Cost Value</span>
                  <a-input-number
                    v-model:value="formState.settlement.fxCostValue"
                    addon-after="%"
                    class="w-full h-[44px] rounded-xl custom-input-addon-after"
                    placeholder="0.00"
                  />
                </div>
              </template>
              <div v-else-if="usesFxDetailField" class="fx-cost-details-field flex flex-col gap-2">
                <span class="text-[13px] font-bold text-slate-700">FX Cost Details</span>
                <a-textarea
                  v-model:value="formState.settlement.fxCostDetails"
                  :maxlength="INPUT_LIMITS.shortText"
                  :auto-size="{ minRows: 3, maxRows: 6 }"
                  show-count
                  placeholder="Explain FX reference details..."
                  class="rounded-xl border-slate-200"
                />
              </div>
            </div>
          </div>
        </a-card>
      </template>
    </a-form>
  </div>
</template>

<style scoped>
.payment-method-editor {
  max-width: 1360px;
  margin: 0 auto;
  padding: 32px 0;
}

.payment-method-editor.modal-mode {
  max-width: none;
  padding: 0;
}

.payment-method-editor.modal-mode :deep(.section-card) {
  border-radius: 20px !important;
}

.payment-method-editor.modal-mode :deep(.ant-card-head) {
  padding: 16px 18px 10px !important;
}

.payment-method-editor.modal-mode .section-body {
  padding: 12px 16px 16px;
}

.payment-method-editor.modal-mode .overview-grid {
  gap: 10px;
}

@media (min-width: 1280px) {
  .payment-method-editor.modal-mode .overview-grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(250px, 0.92fr) minmax(250px, 0.92fr);
  }
}

.payment-method-editor.modal-mode .overview-field-card {
  padding: 12px;
  border-radius: 14px;
}

.payment-method-editor.modal-mode .pricing-body {
  gap: 10px;
}

.payment-method-editor.modal-mode .pricing-card-selector {
  padding: 14px 16px;
  border-radius: 18px;
}

.payment-method-editor.modal-mode .pricing-icpp-card,
.payment-method-editor.modal-mode .pricing-editor-card,
.payment-method-editor.modal-mode .standard-pricing-card {
  padding: 14px 16px;
  border-radius: 18px;
}

.payment-method-editor.modal-mode .pricing-additional-fees {
  padding: 12px 14px;
}

.payment-method-editor.modal-mode .pricing-additional-fee-field {
  padding: 10px;
}

.payment-method-editor.modal-mode .pricing-editor-stack,
.payment-method-editor.modal-mode .pricing-rule-list {
  gap: 10px;
}

.payment-method-editor.modal-mode .pricing-rule-card {
  padding: 12px;
  border-radius: 16px;
}

.payment-method-editor.modal-mode .pricing-card-icpp-input {
  width: 104px;
}

.payment-method-editor.modal-mode .pricing-editor-header,
.payment-method-editor.modal-mode .standard-pricing-header {
  margin-bottom: 12px !important;
}

.payment-method-editor.modal-mode .pricing-rule-toolbar,
.payment-method-editor.modal-mode .pricing-rule-base-label,
.payment-method-editor.modal-mode .tier-rule-box {
  margin-bottom: 10px !important;
}

.payment-method-editor.modal-mode .tier-rule-box {
  padding: 12px;
  border-radius: 16px;
}

.payment-method-editor.modal-mode .capability-body,
.payment-method-editor.modal-mode .reserve-body,
.payment-method-editor.modal-mode .settlement-body {
  gap: 12px;
}

.payment-method-editor.modal-mode .ticket-limit-grid,
.payment-method-editor.modal-mode .settlement-grid,
.payment-method-editor.modal-mode .pricing-rule-fields-grid,
.payment-method-editor.modal-mode .card-additional-fees-grid,
.payment-method-editor.modal-mode .non-card-additional-fees-grid {
  gap: 10px;
}

.fx-cost-grid--details {
  grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
}

.fx-cost-details-field {
  min-width: 0;
}

.payment-method-editor.modal-mode .capability-pill-grid {
  gap: 8px;
}

.payment-method-editor.modal-mode .capability-pill-btn {
  min-height: 40px;
  padding: 7px 10px;
  gap: 6px;
  border-radius: 11px;
}

.payment-method-editor.modal-mode .pill-check-icon {
  width: 16px;
  height: 16px;
}

.payment-method-editor.modal-mode .pill-label {
  font-size: 11.5px;
}

.payment-method-editor.modal-mode .catalog-picker-trigger {
  border-radius: 12px;
  padding: 0 12px;
  min-height: 40px;
}

.payment-method-editor.modal-mode .catalog-picker-text {
  font-size: 13px;
}

.payment-method-editor.modal-mode .catalog-picker-chip-list {
  gap: 6px;
}

.payment-method-editor.modal-mode .catalog-picker-chip {
  min-height: 22px;
  padding: 2px 7px;
  font-size: 11px;
}

.payment-method-editor.modal-mode .catalog-picker-panel {
  border-radius: 14px;
}

.payment-method-editor.modal-mode .pricing-card-panel-search {
  padding: 10px 10px 0;
}

.payment-method-editor.modal-mode .catalog-picker-option {
  padding: 9px 12px;
}

.payment-method-editor.modal-mode .catalog-picker-footer {
  padding: 12px;
}

.payment-method-editor.modal-mode .catalog-picker-footer-actions {
  gap: 6px;
}

.payment-method-editor.modal-mode :deep(.ant-form-item-label) {
  padding-bottom: 4px !important;
}

.payment-method-editor.modal-mode :deep(.ant-form-item-label label) {
  font-size: 12px !important;
}

.payment-method-editor.modal-mode :deep(.custom-select-height-fixed .ant-select-selector),
.payment-method-editor.modal-mode :deep(.custom-cascader-height .ant-select-selector),
.payment-method-editor.modal-mode :deep(.custom-select-multi-pill .ant-select-selector) {
  min-height: 40px !important;
  padding: 0 10px !important;
}

.payment-method-editor.modal-mode :deep(.ant-select-selection-item),
.payment-method-editor.modal-mode :deep(.ant-select-selection-placeholder) {
  line-height: 36px !important;
}

.payment-method-editor.modal-mode :deep(.ant-input-number),
.payment-method-editor.modal-mode :deep(.ant-input:not(textarea)),
.payment-method-editor.modal-mode :deep(.ant-input-number-group-wrapper),
.payment-method-editor.modal-mode :deep(.ant-input-number-group-addon),
.payment-method-editor.modal-mode :deep(.ant-input-group-wrapper) {
  height: 40px !important;
}

.payment-method-editor.modal-mode :deep(.ant-input-number-input),
.payment-method-editor.modal-mode :deep(.ant-input-number-affix-wrapper),
.payment-method-editor.modal-mode :deep(.ant-input-affix-wrapper) {
  height: 40px !important;
}

.payment-method-editor.modal-mode :deep(.ant-input-number-group-addon) {
  height: 40px !important;
  line-height: 40px !important;
}

.payment-method-editor.modal-mode :deep(.ant-input-number-input) {
  height: 38px !important;
}

.onboarding-card {
  background: #ffffff !important;
  border-radius: 24px !important;
  overflow: visible !important;
}

:deep(.ant-card-head) {
  border-bottom: none;
  padding: 32px 32px 16px !important;
}

:deep(.ant-card-head-title) {
  padding: 0 !important;
}

:deep(.ant-card-body) {
  overflow: visible !important;
}

:deep(.ant-form-item-label label) {
  font-weight: 700 !important;
  color: #64748b !important;
  font-size: 13px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

:deep(.custom-select-height-fixed .ant-select-selector),
:deep(.custom-cascader-height .ant-select-selector) {
  min-height: 44px !important;
  height: auto !important;
  border-radius: 12px !important;
  display: flex !important;
  align-items: center !important;
  border-color: #e2e8f0 !important;
  padding: 0 11px !important;
}

:deep(.ant-select-selection-search) {
  display: flex !important;
  align-items: center !important;
}

:deep(.ant-select-selection-item),
:deep(.ant-select-selection-placeholder) {
  display: flex !important;
  align-items: center !important;
  line-height: 40px !important;
}

:deep(.ant-select-multiple .ant-select-selection-item) {
  line-height: 24px !important; /* 多选标签维持标准行高 */
  margin-top: 2px !important;
  margin-bottom: 2px !important;
}

:deep(.custom-select-no-right .ant-select-selector) {
  height: 100% !important;
  border-radius: 12px 0 0 12px !important;
  display: flex !important;
  align-items: center !important;
  border-right: none !important;
}

:deep(.custom-input-no-left) {
  border-radius: 0 12px 12px 0 !important;
  border-left: none !important;
}

:deep(.custom-select-multi-pill .ant-select-selector) {
  border-radius: 12px !important;
  border-color: #e2e8f0 !important;
  background: #fff !important;
  min-height: 44px !important;
}

:deep(.ant-input-number), 
:deep(.ant-input:not(textarea)),
:deep(.ant-input-number-group-wrapper),
:deep(.ant-input-number-group-addon),
:deep(.ant-input-group-wrapper) {
  border-color: #e2e8f0 !important;
  border-radius: 12px !important;
  height: 44px !important;
}

:deep(.ant-input-number-input),
:deep(.ant-input-number-affix-wrapper),
:deep(.ant-input-affix-wrapper) {
  height: 44px !important;
  border-radius: 12px !important;
}

:deep(.ant-input-number-group-addon) {
  line-height: 42px !important;
  padding: 0 12px !important;
}

:deep(.ant-input-number-input) {
  height: 42px !important;
}

:deep(.custom-input-no-right) {
  border-radius: 12px 0 0 12px !important;
  border-right: none !important;
}

:deep(.custom-select-no-left .ant-select-selector) {
  height: 100% !important;
  border-radius: 0 12px 12px 0 !important;
  display: flex !important;
  align-items: center !important;
  border-left: none !important;
}

:deep(.ant-input-number-group-addon) {
  border-radius: 0 12px 12px 0 !important;
  background: #f8fafc;
  font-weight: 700;
  color: #94a3b8;
  border-color: #e2e8f0;
  height: 44px !important;
  line-height: 44px !important;
}

:deep(.ant-input-number-group-wrapper) {
  height: 44px !important;
}

:deep(.custom-input-addon-after .ant-input-number) {
  border-radius: 12px 0 0 12px !important;
  border-right: none !important;
}

:deep(.ant-select-item-group) {
  font-size: 11px;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 12px 4px;
}

:deep(.ant-select-item-option-content) {
  padding: 4px 0 !important;
}

:deep(.ant-select-item-option-selected) {
  background-color: #f0f7ff !important;
}

:deep(.ant-select-item-option-active) {
  background-color: #f8fbff !important;
}

:deep(.additional-fee-select .ant-select-selector) {
  background: #fcfdff !important;
}

.catalog-picker {
  position: relative;
  display: flex;
  flex-direction: column;
}

.catalog-picker-trigger {
  width: 100%;
  min-height: 44px;
  border-radius: 14px;
  border: 1px solid #d9e2ef;
  background: #ffffff;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  transition: all 0.2s ease;
}

.catalog-picker-trigger:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.payment-method-form--readonly-visual :deep(.ant-input[disabled]),
.payment-method-form--readonly-visual :deep(.ant-input-affix-wrapper-disabled),
.payment-method-form--readonly-visual :deep(.ant-input-number-disabled),
.payment-method-form--readonly-visual :deep(.ant-input-number-disabled .ant-input-number-input),
.payment-method-form--readonly-visual :deep(.ant-select-disabled .ant-select-selector),
.payment-method-form--readonly-visual :deep(.ant-picker-disabled),
.payment-method-form--readonly-visual :deep(.ant-picker-input > input[disabled]),
.payment-method-form--readonly-visual :deep(.ant-cascader-picker-disabled),
.payment-method-form--readonly-visual :deep(.ant-cascader-picker-disabled .ant-input),
.payment-method-form--readonly-visual :deep(textarea.ant-input[disabled]) {
  color: #0f172a !important;
  -webkit-text-fill-color: #0f172a !important;
  background: #ffffff !important;
  border-color: #d9e2ef !important;
  opacity: 1 !important;
  cursor: default !important;
  box-shadow: none !important;
}

.payment-method-form--readonly-visual :deep(.ant-select-disabled .ant-select-arrow),
.payment-method-form--readonly-visual :deep(.ant-picker-suffix),
.payment-method-form--readonly-visual :deep(.ant-input-number-handler-wrap) {
  color: #94a3b8 !important;
}

.payment-method-form--readonly-visual .catalog-picker-trigger:disabled,
.payment-method-form--readonly-visual .capability-pill-btn:disabled {
  opacity: 1;
  cursor: default;
}

.catalog-picker-trigger.is-open {
  border-color: #93c5fd;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08);
}

.catalog-picker-text {
  min-width: 0;
  flex: 1;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.catalog-picker-text.is-placeholder {
  color: #94a3b8;
  font-weight: 500;
}

.catalog-picker-trigger--multiple {
  align-items: center;
}

.catalog-picker-chip-list {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.catalog-picker-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid #d9e2ef;
  background: #f8fafc;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.catalog-picker-chip-label {
  white-space: nowrap;
}

.catalog-picker-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: #94a3b8;
  padding: 0;
  cursor: pointer;
}

.catalog-picker-chip-remove:hover:not(.is-disabled) {
  color: #64748b;
}

.catalog-picker-chip-remove.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.catalog-picker-icons {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #94a3b8;
  flex-shrink: 0;
}

.catalog-picker-search-icon {
  font-size: 13px;
}

.catalog-picker-clear {
  font-size: 14px;
  color: #cbd5e1;
}

.catalog-picker-clear:hover {
  color: #94a3b8;
}

.catalog-picker-chevron {
  font-size: 12px;
  transition: transform 0.2s ease;
}

.catalog-picker-chevron.is-open {
  transform: rotate(180deg);
}

.catalog-picker-panel {
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  box-shadow: 0 22px 50px -18px rgba(15, 23, 42, 0.22);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.catalog-picker-panel--teleport {
  position: fixed;
  z-index: 1600;
}

.overview-field-card {
  position: relative;
}

.catalog-picker-options {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.pricing-card-panel-search {
  padding: 16px 16px 0;
  background: #ffffff;
}

.catalog-picker-option {
  width: 100%;
  border: none;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  padding: 14px 18px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.catalog-picker-option + .catalog-picker-option {
  border-top: 1px solid #f1f5f9;
}

.catalog-picker-option:hover {
  background: #f8fbff;
}

.catalog-picker-option.is-selected {
  background: #f0f7ff;
}

.catalog-picker-option-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.catalog-picker-option-label {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.catalog-picker-option-meta {
  min-width: 0;
  font-size: 10px;
  font-weight: 600;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.catalog-picker-option-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.catalog-picker-action {
  color: #94a3b8;
  font-size: 12px;
}

.catalog-picker-action:hover {
  color: #0284c7;
}

.catalog-picker-footer {
  border-top: 1px solid #e2e8f0;
  padding: 18px;
  background: #ffffff;
}

.catalog-picker-footer-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
}

.catalog-picker-footer-input {
  min-width: 0;
  grid-column: 1 / 2;
}

.catalog-picker-empty-state {
  padding: 18px;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 600;
}

.pricing-card-footer-actions {
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.pricing-card-icpp-input {
  width: 132px;
}

.catalog-picker-footer-actions :deep(.ant-input) {
  min-width: 0;
}

.grid-cols-5 {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.capability-pill-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  min-height: 48px;
  border-radius: 14px;
  border: 1px solid #dbe4ee;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  width: 100%;
}

.capability-pill-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.capability-pill-btn.selected {
  border-color: #93c5fd;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.08);
}

.pill-check-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.pill-check-icon.selected {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
  font-size: 11px;
}

.pill-label {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
}
</style>
