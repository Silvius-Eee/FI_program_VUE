<script setup lang="ts">
import { ref, onMounted, computed, reactive, watch } from 'vue';
import { useAppStore } from '../stores/app';
import {
  PlusOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  ExportOutlined,
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import PaymentMethodDrawer from './PaymentMethodDrawer.vue';
import dayjs from 'dayjs';
import {
  FX_COST_DETAIL_REFERENCE_OPTIONS,
  FX_COST_MARKUP_REFERENCE_OPTIONS,
  getSettlementCycleDisplay,
  getSettlementThresholdDisplay,
  normalizePaymentMethodName,
  normalizePricingRuleCardCatalogItem,
  PRICING_RULE_CARD_SYSTEM_CATALOG,
  PRICING_RULE_CARD_SYSTEM_IDS,
} from '../constants/initialData';
import { getWorkflowStatusTheme, normalizeWorkflowStatusLabel } from '../utils/workflowStatus';

const store = useAppStore();
const emit = defineEmits(['registerToolbar']);

const channel = computed(() => store.selectedChannel || {});
const isReferralMode = (value?: string | null) => (value || '').trim().toLowerCase() === 'referral';
const normalizeCooperationModeList = (value: unknown) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
  }
  const normalized = String(value ?? '').trim();
  return normalized ? [normalized] : [];
};
const availableCooperationModes = computed(() => {
  const modes = normalizeCooperationModeList(channel.value.cooperationModel);
  return modes.length ? modes : ['PayFac'];
});
const activeCooperationMode = ref('PayFac');
const isReferralCooperationMode = computed(() => isReferralMode(activeCooperationMode.value));
const timestampFormat = 'YYYY-MM-DD HH:mm:ss';
const fxMarkupReferenceSet = new Set<string>(FX_COST_MARKUP_REFERENCE_OPTIONS);
const fxDetailReferenceSet = new Set<string>(FX_COST_DETAIL_REFERENCE_OPTIONS);
const isFxMarkupReference = (value?: string | null) => fxMarkupReferenceSet.has((value || '').trim());
const isFxDetailReference = (value?: string | null) => fxDetailReferenceSet.has((value || '').trim());
const pricingRuleCardCatalog = computed(() => (
  (store.globalPricingRuleCardCatalog || [])
    .map((item: any) => normalizePricingRuleCardCatalogItem(item))
    .filter(Boolean)
));

// --- 状态定义 ---
const isAddModalVisible = ref(false);
const isAddMethodModalVisible = ref(false);
const isRenameModalVisible = ref(false);
const isRenameMethodModalVisible = ref(false);
const paymentMethodDrawerRef = ref<any>(null);
const currentView = ref<'list' | 'methodList' | 'detail'>('list');
const activeProposalId = ref<string | null>(null);
const selectedProposalId = ref<string | null>(null);
const activePaymentMethod = ref<any>(null);
const rawPricingProposals = computed(() => channel.value.pricingProposals || []);
const sortProposalsByTimestamp = (items: any[]) =>
  [...items].sort((a: any, b: any) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf());
const proposals = computed(() => sortProposalsByTimestamp(
  rawPricingProposals.value.filter((proposal: any) => (
    String(proposal?.mode ?? '').trim().toLowerCase() === activeCooperationMode.value.trim().toLowerCase()
  )),
));
const pricingStatusLabel = computed(() => normalizeWorkflowStatusLabel(
  channel.value.pricingProposalStatus || channel.value.globalProgress?.pricing,
));
const pricingStatusTheme = computed(() => getWorkflowStatusTheme(pricingStatusLabel.value));
const selectedProposal = computed(() =>
  proposals.value.find((proposal: any) => proposal.id === (selectedProposalId.value || activeProposalId.value))
);
const activeProposal = computed(() =>
  proposals.value.find((proposal: any) => proposal.id === activeProposalId.value)
);
const submissionTargetProposal = computed(() => (
  selectedProposal.value
  || activeProposal.value
  || proposals.value[0]
  || sortProposalsByTimestamp(rawPricingProposals.value)[0]
  || null
));
const getProposalById = (proposalId?: string | null) => (
  rawPricingProposals.value.find((proposal: any) => proposal.id === proposalId)
);

const addFormState = reactive({
  type: 'General',
  customType: '',
  merchant: '',
  referralRule: '',
  link: '',
  remark: '',
});
const renameFormState = reactive({
  proposalId: '',
  name: '',
});
const renameMethodFormState = reactive({
  proposalId: '',
  methodId: '',
  name: '',
  methodForm: 'nonCard',
});

// --- 工具栏注册 ---
const registerToolbar = () => {
  if (currentView.value === 'detail') {
    emit('registerToolbar', {
      title: activePaymentMethod.value?.method ? formatMethodName(activePaymentMethod.value.method) : 'Configure Payment Method',
      backLabel: 'Return to Pricing Schedule',
      onBack: () => {
        currentView.value = selectedProposalId.value ? 'methodList' : 'list';
        registerToolbar();
      },
      centered: true
    });
  } else if (currentView.value === 'methodList') {
    emit('registerToolbar', {
      title: selectedProposal.value?.customProposalType || 'Pricing Schedule',
      backLabel: 'Return to Pricing',
      onBack: () => {
        currentView.value = 'list';
        registerToolbar();
      },
      centered: true
    });
  } else {
    emit('registerToolbar', {
      title: `Pricing`,
      backLabel: 'Return to Corridor Detail',
      onBack: () => store.setView('detail'),
      centered: true
    });
  }
};

watch(currentView, () => {
  registerToolbar();
});

watch(() => activePaymentMethod.value?.method, () => {
  if (currentView.value === 'detail') {
    registerToolbar();
  }
});

watch(availableCooperationModes, (nextModes) => {
  if (!nextModes.length) {
    activeCooperationMode.value = 'PayFac';
    return;
  }

  if (!nextModes.includes(activeCooperationMode.value)) {
    activeCooperationMode.value = nextModes[0];
  }
}, { immediate: true });

watch(proposals, (nextProposals) => {
  if (nextProposals.length === 0) {
    activeProposalId.value = null;
    selectedProposalId.value = null;
    return;
  }

  const proposalIds = nextProposals.map((proposal: any) => proposal.id);
  if (!activeProposalId.value || !proposalIds.includes(activeProposalId.value)) {
    activeProposalId.value = nextProposals[0]?.id || null;
  }
  if (selectedProposalId.value && !proposalIds.includes(selectedProposalId.value)) {
    selectedProposalId.value = null;
  }
}, { immediate: true });

watch(selectedProposal, (proposal: any) => {
  if (!proposal) return;
  if (proposal.type === 'Other' && proposal.specifiedVerticals === undefined) {
    proposal.specifiedVerticals = proposal.customProposalType || '';
  }
}, { immediate: true });

const openAddProposalModal = () => {
  resetAddFormState();
  isAddModalVisible.value = true;
};

const syncActiveModeWithProposal = (proposalId?: string | null) => {
  const proposal = getProposalById(proposalId);
  if (proposal?.mode) {
    activeCooperationMode.value = proposal.mode;
  }
  return proposal;
};

const handleCooperationModeSwitch = (mode: string) => {
  const normalizedMode = String(mode ?? '').trim();
  if (!normalizedMode || normalizedMode === activeCooperationMode.value) return;

  activeCooperationMode.value = normalizedMode;
  activeProposalId.value = null;
  selectedProposalId.value = null;
  activePaymentMethod.value = null;

  if (currentView.value !== 'list') {
    currentView.value = 'list';
  }
};
const handleCooperationModeGroupChange = (event: any) => {
  handleCooperationModeSwitch(event?.target?.value);
};

onMounted(() => {
  registerToolbar();
  if (channel.value?.id && proposals.value.length === 0) {
    openAddProposalModal();
  }
});

watch(() => channel.value?.id, (nextId, previousId) => {
  if (!nextId || nextId === previousId) return;
  activeCooperationMode.value = availableCooperationModes.value[0] || 'PayFac';
  currentView.value = 'list';
  activeProposalId.value = null;
  selectedProposalId.value = null;
  activePaymentMethod.value = null;
  if (proposals.value.length === 0) {
    openAddProposalModal();
  }
});

// --- 数据处理 ---
const getCurrentTimestamp = () => dayjs().format(timestampFormat);
const formatProposalTimestamp = (timestamp?: string) => {
  if (!timestamp) return 'Timestamp unavailable';
  const parsed = dayjs(timestamp);
  return parsed.isValid() ? parsed.format(timestampFormat) : timestamp;
};
const resolveTimestampValue = (timestamp?: string) => {
  const parsed = dayjs(timestamp);
  return parsed.isValid() ? parsed.valueOf() : 0;
};
const getApprovalHistoryEntryTitle = (type?: string) => {
  if (type === 'approve') return 'Approved';
  if (type === 'request_changes') return 'Request Changes';
  return 'Submitted';
};
const getApprovalHistoryEntryStatus = (type?: string) => {
  if (type === 'approve') return 'Approved';
  if (type === 'request_changes') return 'Changes Requested';
  return 'In Review';
};
const currentHistoryProposal = computed(() => submissionTargetProposal.value);
const currentHistoryProposalStatus = computed(() => normalizeWorkflowStatusLabel(
  currentHistoryProposal.value?.approvalStatus || 'Not Started',
));
const pricingHistoryEntries = computed(() => {
  const proposal = currentHistoryProposal.value;
  if (!proposal) return [];

  const history = Array.isArray(proposal.approvalHistory) ? proposal.approvalHistory : [];
  return [...history]
    .sort((left: any, right: any) => resolveTimestampValue(right.time) - resolveTimestampValue(left.time))
    .map((entry: any, index: number) => ({
      key: `${proposal.id}-${entry.type}-${entry.time}-${index}`,
      title: getApprovalHistoryEntryTitle(entry.type),
      status: getApprovalHistoryEntryStatus(entry.type),
      time: entry.time,
      actor: entry.user || 'Current User',
      note: entry.note || '',
    }));
});
const persistProposals = (nextProposals: any[]) => {
  store.updateChannel({
    ...channel.value,
    lastModifiedAt: getCurrentTimestamp(),
    pricingProposals: sortProposalsByTimestamp(nextProposals),
  });
};
const updateProposal = (proposalId: string, updater: (proposal: any) => any) => {
  const nextProposals = rawPricingProposals.value.map((proposal: any) => (
    proposal.id === proposalId ? updater(proposal) : proposal
  ));
  persistProposals(nextProposals);
};
const getPricingScheduleTypeLabel = (type: string) => (
  type === 'Other' ? 'Vertical-specific Pricing Schedule' : 'Standard Pricing Schedule'
);
const buildProposalName = (type: string, customType?: string) => {
  const trimmedCustomType = customType?.trim();
  return type === 'Other'
    ? (trimmedCustomType || 'Vertical-specific Pricing Schedule')
    : 'Standard Pricing Schedule';
};
const buildReferralProposalName = (merchant?: string) => {
  const trimmedMerchant = merchant?.trim();
  return trimmedMerchant ? `${trimmedMerchant} Pricing Schedule` : 'Pricing Schedule';
};
const resetAddFormState = () => {
  addFormState.type = 'General';
  addFormState.customType = '';
  addFormState.merchant = '';
  addFormState.referralRule = '';
  addFormState.link = '';
  addFormState.remark = '';
};
const closeAddProposalModal = () => {
  isAddModalVisible.value = false;
  resetAddFormState();
};
const getProposalReferralRulePreview = (value?: string | null) => {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
};
const isReferralProposal = (proposal?: any) => isReferralMode(proposal?.mode);
const isProposalInReview = (proposal?: any) => normalizeWorkflowStatusLabel(proposal?.approvalStatus) === 'In Review';

const formatFee = (rule: any) => {
  if (!rule) return 'Not set';
  const parts = [];
  if (rule.variableRate !== null && rule.variableRate !== undefined) parts.push(`${rule.variableRate}%`);
  if (rule.fixedFeeAmount !== null && rule.fixedFeeAmount !== undefined) parts.push(`+ ${rule.fixedFeeCurrency || 'USD'} ${rule.fixedFeeAmount}`);
  return parts.length > 0 ? parts.join(' ') : 'Not set';
};

const formatMethodName = (value?: string | null) => {
  const normalized = normalizePaymentMethodName(value);
  return normalized || 'Not set';
};
const normalizeMethodNameForForm = (value?: string | null, _methodForm: 'card' | 'nonCard' = 'nonCard') => {
  return normalizePaymentMethodName(value);
};
const resolvePaymentType = (record: any) => {
  const normalizedType = record?.paymentType?.trim?.() || '';
  if (normalizedType) return normalizedType.toLowerCase() === 'card' ? 'Card' : normalizedType;
  if (record?.methodForm === 'card' || normalizePaymentMethodName(record?.method).startsWith('Card')) return 'Card';
  return '';
};
const isCardPricingRecord = (record: any) => resolvePaymentType(record) === 'Card';
const getPricingCardCatalogItem = (cardId?: string | null) => {
  if (!cardId) return null;
  return pricingRuleCardCatalog.value.find((item: any) => item.id === cardId)
    || PRICING_RULE_CARD_SYSTEM_CATALOG.find((item) => item.id === cardId)
    || null;
};
const getPricingCardLabel = (cardId?: string | null) => {
  if (!cardId) return 'Card';
  if (cardId === 'local') return 'Local Card';
  if (cardId === 'international') return 'International Card';
  return getPricingCardCatalogItem(cardId)?.name || cardId;
};
const normalizeRecordCardPricingRules = (record: any) => {
  const nextRules: Record<string, any[]> = {};
  Object.entries(record?.cardPricingRules || {}).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    if (key === 'local') {
      nextRules[PRICING_RULE_CARD_SYSTEM_IDS.localCard] = value;
      return;
    }
    if (key === 'international') {
      nextRules[PRICING_RULE_CARD_SYSTEM_IDS.internationalCard] = value;
      return;
    }
    nextRules[key] = value;
  });
  return nextRules;
};
const getSelectedPricingCardIds = (record: any) => {
  const ids: string[] = [];
  const appendId = (cardId?: string | null) => {
    if (cardId && !ids.includes(cardId)) {
      ids.push(cardId);
    }
  };

  (record?.selectedPricingCardIds || []).forEach((cardId: string) => appendId(cardId));
  if (hasDisplayValue(record?.icpp)) {
    appendId(PRICING_RULE_CARD_SYSTEM_IDS.icpp);
  }
  if (record?.cardPricingRules?.local?.length) {
    appendId(PRICING_RULE_CARD_SYSTEM_IDS.localCard);
  }
  if (record?.cardPricingRules?.international?.length) {
    appendId(PRICING_RULE_CARD_SYSTEM_IDS.internationalCard);
  }
  Object.keys(normalizeRecordCardPricingRules(record)).forEach((cardId) => appendId(cardId));
  return ids;
};
const getCardPricingEntries = (record: any) => {
  const pricingRules = normalizeRecordCardPricingRules(record);
  return getSelectedPricingCardIds(record)
    .filter((cardId) => cardId !== PRICING_RULE_CARD_SYSTEM_IDS.icpp)
    .map((cardId) => ({
      id: cardId,
      label: getPricingCardLabel(cardId),
      rule: pricingRules[cardId]?.[0],
    }))
    .filter((entry) => entry.rule);
};

const displayFee = (record: any) => {
  if (isCardPricingRecord(record)) {
    const parts = getCardPricingEntries(record)
      .map((entry) => {
        const fee = formatFee(entry.rule);
        return fee !== 'Not set' ? `${entry.label}: ${fee}` : null;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' / ');
  }
  return record.pricingRows?.[0] ? formatFee(record.pricingRows[0]) : 'Not set';
};

const hasDisplayValue = (value: unknown) => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0);
const toDisplayText = (value: unknown) => {
  if (!hasDisplayValue(value)) return 'Not set';
  if (Array.isArray(value)) {
    return value
      .map((item) => Array.isArray(item) ? item.filter(Boolean).join(' / ') : String(item))
      .filter(Boolean)
      .join(', ') || 'Not set';
  }
  return String(value);
};
const formatMoney = (amount: unknown, currency?: string) => (
  hasDisplayValue(amount) ? `${currency || 'USD'} ${amount}` : 'Not set'
);
const getMethodFormLabel = (record: any) => {
  return isCardPricingRecord(record) ? 'Card' : 'Non-card';
};
const getPaymentTypeDisplay = (record: any) => resolvePaymentType(record) || 'Not set';
const collectPrimaryPricingEntries = (record: any, formatter: (rule: any) => string) => {
  const entries: string[] = [];
  const addEntry = (label: string, rule: any) => {
    const value = formatter(rule);
    if (value !== 'Not set') {
      entries.push(label ? `${label}: ${value}` : value);
    }
  };

  if (isCardPricingRecord(record)) {
    const cardEntries = getCardPricingEntries(record);
    cardEntries.forEach((entry) => {
      addEntry(entry.label, entry.rule);
    });
    if (cardEntries.length === 0 && Array.isArray(record?.pricingRows) && record.pricingRows[0]) {
      addEntry('', record.pricingRows[0]);
    }
  } else if (Array.isArray(record?.pricingRows) && record.pricingRows[0]) {
    addEntry('', record.pricingRows[0]);
  }

  return entries.length > 0 ? entries.join('\n') : 'Not set';
};
const formatFloorPrice = (record: any) => (
  collectPrimaryPricingEntries(record, (rule: any) => (
    hasDisplayValue(rule?.floorPrice) ? `${rule.floorPriceCurrency || rule.fixedFeeCurrency || 'USD'} ${rule.floorPrice}` : 'Not set'
  ))
);
const formatCapPrice = (record: any) => (
  collectPrimaryPricingEntries(record, (rule: any) => (
    hasDisplayValue(rule?.capPrice) ? `${rule.capPriceCurrency || rule.fixedFeeCurrency || 'USD'} ${rule.capPrice}` : 'Not set'
  ))
);
const formatSettlementCycle = (record: any) => getSettlementCycleDisplay(record?.settlement);
const formatSettlementDayType = (record: any) => {
  const cycleLabel = formatSettlementCycle(record);
  return cycleLabel === 'Not set' ? 'Not set' : cycleLabel.replace(/^T\+\S+\s*/, '');
};
const formatSettlementThreshold = (record: any) => getSettlementThresholdDisplay(record?.settlement) || 'Not set';
const formatFxMarkup = (record: any) => (
  isFxMarkupReference(record?.settlement?.fxCostReference) && hasDisplayValue(record?.settlement?.fxCostValue)
    ? `${record.settlement.fxCostOperator || '+'} ${record.settlement.fxCostValue}%`
    : 'Not set'
  );
const formatFxDetails = (record: any) => (
  isFxDetailReference(record?.settlement?.fxCostReference) && record?.settlement?.fxCostDetails
    ? record.settlement.fxCostDetails
    : 'Not set'
);
const formatCardAdditionalFees = (record: any) => {
  if (!isCardPricingRecord(record)) return 'Not set';
  const feeLabelMap: Record<string, string> = {
    preAuthorizationFee: 'Pre-authorization',
    authorizationFee: 'Authorization',
    captureFee: 'Capture',
    refundFee: 'Refund',
    chargebackFee: 'Chargeback',
    representmentFee: 'Representment',
    retrievalFee: 'Retrieval',
    threeDSecureFee: '3DS',
    tokenizationFee: 'Tokenization',
    accountUpdaterFee: 'Account Updater',
  };

  const feeLines = Object.entries(record?.cardAdditionalFees || {})
    .map(([key, value]: [string, any]) => {
      if (!hasDisplayValue(value?.amount)) return null;
      return `${feeLabelMap[key] || key}: ${value.currency || 'USD'} ${value.amount}`;
    })
    .filter(Boolean);

  return feeLines.length > 0 ? feeLines.join('\n') : 'Not set';
};
const formatHoldingPeriod = (reserve: any) => {
  if (!hasDisplayValue(reserve?.holdingPeriodDays)) return 'Not set';
  return `${reserve.holdingPeriodDays} ${reserve.holdingPeriodDayType || 'calendar'}`;
};

// --- 交互方法 ---
const createProposal = (options?: {
  type?: string;
  customType?: string;
  merchant?: string;
  referralRule?: string;
  link?: string;
  remark?: string;
  openAfterCreate?: boolean;
  silent?: boolean;
}) => {
  const mode = activeCooperationMode.value;
  const type = options?.type ?? addFormState.type;
  const customType = options?.customType ?? addFormState.customType;
  const merchant = options?.merchant ?? addFormState.merchant;
  const referralRule = options?.referralRule ?? addFormState.referralRule;
  const link = options?.link ?? addFormState.link;
  const remark = options?.remark ?? addFormState.remark;

  if (isReferralMode(mode)) {
    if (!merchant.trim()) {
      message.warning('Merchant is required');
      return null;
    }
    if (!referralRule.trim()) {
      message.warning('Referral rule is required');
      return null;
    }
  } else if (type === 'Other' && !customType.trim()) {
    message.warning('Please specify verticals');
    return null;
  }

  const newProposal = isReferralMode(mode)
    ? {
        id: `prop-${Date.now()}`,
        customProposalType: buildReferralProposalName(merchant),
        specifiedVerticals: '',
        type: 'General',
        merchant: merchant.trim(),
        referralRule: referralRule.trim(),
        link,
        remark,
        mode,
        approvalStatus: 'Not Started',
        updatedAt: getCurrentTimestamp(),
        paymentMethods: [],
        approvalHistory: [],
      }
    : {
        id: `prop-${Date.now()}`,
        customProposalType: buildProposalName(type, customType),
        specifiedVerticals: type === 'Other' ? customType.trim() : '',
        type,
        link,
        remark,
        mode,
        approvalStatus: 'Not Started',
        updatedAt: getCurrentTimestamp(),
        paymentMethods: [],
        approvalHistory: [],
      };

  persistProposals([...rawPricingProposals.value, newProposal]);
  activeProposalId.value = newProposal.id;

  if (options?.openAfterCreate) {
    selectedProposalId.value = newProposal.id;
    currentView.value = 'methodList';
  }

  if (!options?.silent) {
    message.success('New pricing schedule created');
  }

  return newProposal;
};

const handleAddProposal = () => {
  const createdProposal = createProposal();
  if (!createdProposal) return;
  closeAddProposalModal();
};

const handleOpenMethodList = (proposalId: string) => {
  syncActiveModeWithProposal(proposalId);
  activeProposalId.value = proposalId;
  selectedProposalId.value = proposalId;
  currentView.value = 'methodList';
};

const handleEditMethod = (proposalId: string, method: any) => {
  syncActiveModeWithProposal(proposalId);
  activeProposalId.value = proposalId;
  selectedProposalId.value = currentView.value === 'methodList' ? proposalId : null;
  activePaymentMethod.value = JSON.parse(JSON.stringify(method));
  currentView.value = 'detail';
};

const customRow = (record: any, proposalId: string) => {
  return {
    onClick: () => handleEditMethod(proposalId, record),
    class: 'cursor-pointer'
  };
};

const handleAddMethod = (proposalId: string) => {
  syncActiveModeWithProposal(proposalId);
  activeProposalId.value = proposalId;
  selectedProposalId.value = currentView.value === 'methodList' ? proposalId : null;
  activePaymentMethod.value = null;
  isAddMethodModalVisible.value = true;
};

const onSaveMethod = (data: any) => {
  if (!activeProposalId.value) return;
  let savedMethod = JSON.parse(JSON.stringify(data));
  updateProposal(activeProposalId.value, (proposal: any) => {
    const methods = [...proposal.paymentMethods];
    const idx = methods.findIndex((method: any) => method.id === data.id);
    if (idx !== -1) {
      methods[idx] = data;
      savedMethod = JSON.parse(JSON.stringify(methods[idx]));
    } else {
      const createdMethod = { ...data, id: `pm-${Date.now()}` };
      methods.push(createdMethod);
      savedMethod = JSON.parse(JSON.stringify(createdMethod));
    }
    return {
      ...proposal,
      paymentMethods: methods,
      updatedAt: getCurrentTimestamp(),
    };
  });
  message.success('Configuration saved');
  if (isAddMethodModalVisible.value) {
    isAddMethodModalVisible.value = false;
    currentView.value = selectedProposalId.value ? 'methodList' : 'list';
    return;
  }
  activePaymentMethod.value = savedMethod;
};

const handleDuplicateMethod = (proposalId: string, methodId: string) => {
  const proposal = rawPricingProposals.value.find((p: any) => p.id === proposalId);
  if (!proposal) return;

  const sourceIndex = proposal.paymentMethods.findIndex((pm: any) => pm.id === methodId);
  if (sourceIndex < 0) return;

  const source = proposal.paymentMethods[sourceIndex];
  const newMethod = {
    ...JSON.parse(JSON.stringify(source)),
    id: `pm-${Date.now()}`,
    method: `${source.method} Copy`,
  };

  updateProposal(proposalId, (currentProposal: any) => {
    const methods = [...currentProposal.paymentMethods];
    methods.splice(sourceIndex + 1, 0, newMethod);
    return {
      ...currentProposal,
      paymentMethods: methods,
      updatedAt: getCurrentTimestamp(),
    };
  });
  message.success('Payment method duplicated');
};

const openRenameMethodModal = (proposalId: string, method: any) => {
  renameMethodFormState.proposalId = proposalId;
  renameMethodFormState.methodId = method.id;
  renameMethodFormState.name = formatMethodName(method.method || '');
  renameMethodFormState.methodForm = getMethodFormLabel(method) === 'Card' ? 'card' : 'nonCard';
  isRenameMethodModalVisible.value = true;
};

const handleRenameMethod = () => {
  const trimmedName = normalizeMethodNameForForm(renameMethodFormState.name, renameMethodFormState.methodForm as 'card' | 'nonCard');
  if (!trimmedName) {
    message.warning('Payment method name is required');
    return;
  }

  updateProposal(renameMethodFormState.proposalId, (proposal: any) => ({
    ...proposal,
    paymentMethods: proposal.paymentMethods.map((method: any) => (
      method.id === renameMethodFormState.methodId
        ? { ...method, method: trimmedName }
        : method
    )),
    updatedAt: getCurrentTimestamp(),
  }));

  isRenameMethodModalVisible.value = false;
  renameMethodFormState.proposalId = '';
  renameMethodFormState.methodId = '';
  renameMethodFormState.name = '';
  renameMethodFormState.methodForm = 'nonCard';
  message.success('Payment method renamed');
};

const confirmDuplicateMethod = (proposalId: string, method: any) => {
  Modal.confirm({
    title: 'Duplicate payment method?',
    content: `A copy of "${formatMethodName(method.method)}" will be inserted right below the current row.`,
    okText: 'Duplicate',
    onOk: () => handleDuplicateMethod(proposalId, method.id),
  });
};

const handleDuplicateProposal = (id: string) => {
  const source = rawPricingProposals.value.find((p: any) => p.id === id);
  if (!source) return;

  const newProposal = {
    ...JSON.parse(JSON.stringify(source)),
    id: `prop-${Date.now()}`,
    customProposalType: `${source.customProposalType || 'Pricing Schedule'} Copy`,
    specifiedVerticals: source.specifiedVerticals || (source.type === 'Other' ? source.customProposalType || '' : ''),
    approvalStatus: 'Not Started',
    updatedAt: getCurrentTimestamp(),
    approvalHistory: [],
  };
  
  // Update IDs for payment methods to ensure uniqueness
  newProposal.paymentMethods.forEach((pm: any, idx: number) => {
    pm.id = `pm-${Date.now()}-${idx}`;
  });

  persistProposals([...rawPricingProposals.value, newProposal]);
  activeProposalId.value = newProposal.id;
  message.success('Pricing schedule duplicated');
};

const confirmDuplicateProposal = (proposal: any) => {
  Modal.confirm({
    title: 'Duplicate pricing schedule?',
    content: `A copy of "${proposal.customProposalType || 'Pricing Schedule'}" will be created with the same payment methods.`,
    okText: 'Duplicate',
    onOk: () => handleDuplicateProposal(proposal.id),
  });
};

const handleExportProposal = (proposalId: string) => {
  const proposal = rawPricingProposals.value.find((p: any) => p.id === proposalId);
  if (!proposal) return;

  const hide = message.loading('Preparing export...', 0);
  setTimeout(() => {
    hide();
    const rows: any[] = [];
    proposal.paymentMethods.forEach((pm: any) => {
      rows.push({
        method: pm.method,
        fee: displayFee(pm),
        cycle: formatSettlementCycle(pm),
        currencies: (pm.settlement?.settlementCurrency || []).join(', '),
      });
    });

    const headers = ['Payment Method', 'Fee', 'Settlement Cycle', 'Settlement Currency'];
    const lines = [headers.join(',')];
    rows.forEach(row => {
      lines.push([row.method, row.fee, row.cycle, row.currencies].map(v => `"${v}"`).join(','));
    });

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pricing_export_${proposal.customProposalType || 'Pricing'}_${dayjs().format('YYYYMMDD')}.csv`);
    link.click();
    message.success('Export successful');
  }, 1000);
};

const handleDeleteProposal = (id: string) => {
  Modal.confirm({
    title: 'Delete Quotation?',
    content: 'All payment methods under this quotation will be removed.',
    okText: 'Delete',
    okType: 'danger',
    onOk: () => {
      const updated = rawPricingProposals.value.filter((p: any) => p.id !== id);
      persistProposals(updated);
    }
  });
};

const openRenameProposalModal = (proposal: any) => {
  renameFormState.proposalId = proposal.id;
  renameFormState.name = proposal.customProposalType || getPricingScheduleTypeLabel(proposal.type);
  isRenameModalVisible.value = true;
};

const handleRenameProposal = () => {
  const trimmedName = renameFormState.name.trim();
  if (!trimmedName) {
    message.warning('Pricing schedule name is required');
    return;
  }
  updateProposal(renameFormState.proposalId, (proposal: any) => ({
    ...proposal,
    specifiedVerticals: proposal.specifiedVerticals || (proposal.type === 'Other' ? proposal.customProposalType || '' : ''),
    customProposalType: trimmedName,
    updatedAt: getCurrentTimestamp(),
  }));
  isRenameModalVisible.value = false;
  renameFormState.proposalId = '';
  renameFormState.name = '';
  registerToolbar();
  message.success('Pricing schedule name updated');
};

const handleSavePricing = () => {
  const proposalId = selectedProposalId.value || activeProposalId.value;
  if (!proposalId) return;
  const currentProposal = rawPricingProposals.value.find((proposal: any) => proposal.id === proposalId);
  if (isReferralProposal(currentProposal)) {
    if (!currentProposal?.merchant?.trim()) {
      message.warning('Merchant is required');
      return;
    }
    if (!currentProposal?.referralRule?.trim()) {
      message.warning('Referral rule is required');
      return;
    }
  }
  updateProposal(proposalId, (proposal: any) => ({
    ...proposal,
    merchant: proposal.merchant?.trim?.() || proposal.merchant,
    referralRule: proposal.referralRule?.trim?.() || proposal.referralRule,
    updatedAt: getCurrentTimestamp(),
  }));
  message.success('Pricing configuration saved');
};

const handleSubmitPricingForReview = (proposalId?: string) => {
  const proposal = proposalId ? syncActiveModeWithProposal(proposalId) : submissionTargetProposal.value;
  if (!proposal) {
    message.warning('Create or select a pricing schedule before submitting it for review.');
    return;
  }

  if (isProposalInReview(proposal)) {
    message.warning('This pricing schedule is already in review.');
    return;
  }

  const updatedAt = getCurrentTimestamp();
  const historyNote = proposal.remark || 'Pricing schedule submitted for review.';
  const nextProposals = sortProposalsByTimestamp(
    rawPricingProposals.value.map((currentProposal: any) => (
      currentProposal.id === proposal.id
        ? {
            ...currentProposal,
            approvalStatus: 'In Review',
            updatedAt,
            approvalHistory: [
              ...(Array.isArray(currentProposal.approvalHistory) ? currentProposal.approvalHistory : []),
              {
                type: 'submit',
                time: updatedAt,
                user: 'Current User',
                note: historyNote,
              },
            ],
          }
        : currentProposal
    )),
  );

  activeProposalId.value = proposal.id;
  if (currentView.value === 'methodList') {
    selectedProposalId.value = proposal.id;
  }

  store.updateChannel({
    ...channel.value,
    lastModifiedAt: updatedAt,
    pricingProposals: nextProposals,
    pricingProposalStatus: 'In Review',
    globalProgress: {
      ...(channel.value.globalProgress || {}),
      pricing: 'In Review',
    },
    submissionHistory: {
      ...(channel.value.submissionHistory || {}),
      pricing: {
        date: updatedAt,
        user: 'Current User',
        notes: historyNote,
        proposalId: proposal.id,
        proposalName: proposal.customProposalType || 'Pricing Schedule',
      },
    },
    auditLogs: [
      {
        time: updatedAt,
        user: 'Current User',
        action: `Submitted pricing schedule "${proposal.customProposalType || 'Pricing Schedule'}" for review.`,
        color: 'blue',
      },
      ...(channel.value.auditLogs || []),
    ],
  });

  message.success('Pricing schedule submitted for review.');
};

</script>

<template>
  <div
    class="min-h-screen bg-[#f8fafc]"
    :style="{
      padding: '24px 32px',
      background: 'radial-gradient(circle at top left, rgba(14, 165, 233, 0.05), transparent 25%), #f8fafc',
    }"
  >
    <div style="max-width: 1200px; margin: 0 auto">
      <div v-if="currentView === 'list'">
        <!-- Header Card -->
        <a-card
        class="mb-5 onboarding-card"
        :body-style="{ padding: '16px 20px' }"
        :bordered="false"
      >
        <div class="mb-3">
          <a-breadcrumb separator="/">
            <a-breadcrumb-item @click="store.setView('detail')" class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium">Corridor Detail</a-breadcrumb-item>
            <a-breadcrumb-item class="text-slate-900 font-bold text-[13px]">Pricing</a-breadcrumb-item>
          </a-breadcrumb>
        </div>

        <div class="mb-1 flex flex-wrap items-center gap-3">
          <h2 class="m-0 text-[22px] font-black leading-tight tracking-tight text-[#0f172a]">Pricing</h2>
          <a-tag
            :style="{ backgroundColor: pricingStatusTheme.bg, color: pricingStatusTheme.text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
          >
            {{ pricingStatusLabel }}
          </a-tag>
        </div>
        <p class="text-slate-500 text-[13px] m-0 max-w-2xl font-medium mb-4 leading-relaxed">
          Manage pricing schedules and drill down into payment methods through a linked workflow.
        </p>

        <div class="flex items-center gap-3">
          <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">COOPERATION MODE</span>
          <a-radio-group
            :value="activeCooperationMode"
            button-style="solid"
            class="fitrem-segmented"
            @change="handleCooperationModeGroupChange"
          >
            <a-radio-button
              v-for="mode in availableCooperationModes"
              :key="mode"
              :value="mode"
            >
              {{ mode }}
            </a-radio-button>
          </a-radio-group>
        </div>
      </a-card>

      <!-- List Section Header -->
      <div class="mb-6 flex items-center justify-between px-2">
        <div class="flex items-center gap-3">
          <h3 class="text-[18px] font-black text-slate-900 m-0">Pricing schedule list</h3>
          <span class="text-[13px] text-slate-400 font-medium">Last updated: {{ channel.lastModifiedAt || '2026-03-31 16:02:02' }}</span>
        </div>
        <div class="flex items-center gap-3">
          <a-button
            @click="handleSubmitPricingForReview"
            class="h-[40px] rounded-xl border-slate-200 px-5 font-black text-slate-700"
          >
            Submit for Review
          </a-button>
          <a-button 
            type="primary" 
            @click="openAddProposalModal"
            class="flex h-[40px] items-center gap-2 rounded-xl border-none bg-[#0284c7] px-6 font-black shadow-md"
          >
            <template #icon><plus-outlined /></template>
            Create Pricing Schedule
          </a-button>
        </div>
      </div>

      <!-- Pricing Schedule List -->
      <div v-if="proposals.length === 0" class="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
        <div class="text-slate-200 mb-6 text-7xl opacity-40"><info-circle-outlined /></div>
        <h3 class="text-[22px] font-black text-slate-900 m-0">No Pricing Proposals Found</h3>
        <p class="text-slate-500 mt-2 text-[16px] font-medium">Start by creating a new pricing schedule for this channel.</p>
      </div>

      <div v-else class="space-y-6">
        <a-collapse v-model:activeKey="activeProposalId" :bordered="false" expand-icon-position="start" class="fitrem-collapse">
          <a-collapse-panel v-for="proposal in proposals" :key="proposal.id" class="mb-6 bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
            <template #header>
              <div class="flex justify-between items-start gap-4 w-full pr-2">
                <div class="min-w-0">
                  <span 
                    class="block text-[15px] font-black text-slate-800 hover:text-sky-600 transition-colors cursor-pointer truncate"
                    @click.stop="handleOpenMethodList(proposal.id)"
                  >
                    {{ proposal.customProposalType || 'Other Pricing Schedule' }}
                  </span>
                  <div class="mt-2 flex items-center gap-2 text-[12px]">
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 font-black uppercase tracking-widest text-slate-400">Timestamp</span>
                    <span class="font-semibold text-slate-500 tabular-nums">{{ formatProposalTimestamp(proposal.updatedAt) }}</span>
                  </div>
                  <p
                    v-if="isReferralProposal(proposal) && proposal.referralRule"
                    class="mt-2 text-[12px] font-medium text-slate-500 max-w-2xl"
                  >
                    <span class="font-black uppercase tracking-widest text-slate-400 mr-2">Referral Rule</span>
                    {{ getProposalReferralRulePreview(proposal.referralRule) }}
                  </p>
                </div>
                  <div class="flex items-center gap-2" @click.stop>
                    <a-button size="small" @click="confirmDuplicateProposal(proposal)" class="rounded-lg font-bold text-slate-600 border border-slate-200 px-4 h-[28px] text-[11px] bg-white">Duplicate</a-button>
                    <a-dropdown placement="bottomRight">
                    <a-button size="small" class="rounded-lg font-bold text-sky-600 border border-sky-100 px-3 h-[28px] text-[11px] bg-sky-50/50">More actions</a-button>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item key="submit" :disabled="isProposalInReview(proposal)" @click="handleSubmitPricingForReview(proposal.id)">Submit</a-menu-item>
                        <a-menu-item key="rename" @click="openRenameProposalModal(proposal)">Rename schedule</a-menu-item>
                        <a-menu-item key="export" @click="handleExportProposal(proposal.id)">Export CSV</a-menu-item>
                        <a-menu-divider />
                        <a-menu-item key="delete" danger @click="handleDeleteProposal(proposal.id)">Delete</a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>
              </div>
            </template>

            <a-table
              :data-source="proposal.paymentMethods"
              :pagination="false"
              row-key="id"
              class="fitrem-pricing-table-v3"
              :custom-row="(record: any) => customRow(record, proposal.id)"
              :row-class-name="(_record: any, index: number) => index === 0 ? 'bg-[#f0f7ff]' : ''"
            >
              <a-table-column title="Payment Method" data-index="method" key="method" :width="350">
                <template #default="{ text }">
                  <span class="font-bold text-slate-800 text-[13px] ml-6">{{ text }}</span>
                </template>
              </a-table-column>

              <a-table-column title="Fee" key="fees" :width="200">
                <template #default="{ record }">
                  <span class="font-medium text-[13px]" :class="displayFee(record) !== 'Not set' ? 'text-slate-900' : 'text-slate-300 italic'">
                    {{ displayFee(record) }}
                  </span>
                </template>
              </a-table-column>

              <a-table-column title="Settlement Cycle" key="cycle" :width="250">
                <template #default="{ record }">
                  <span class="font-medium text-[13px]" :class="formatSettlementCycle(record) !== 'Not set' ? 'text-slate-900' : 'text-slate-300 italic'">
                    {{ formatSettlementCycle(record) }}
                  </span>
                </template>
              </a-table-column>

              <a-table-column title="Settlement Currency" key="currency">
                <template #default="{ record }">
                  <div class="flex items-center gap-2 ml-4">
                    <template v-if="record.settlement?.settlementCurrency?.length">
                      <div 
                        v-for="c in record.settlement.settlementCurrency" 
                        :key="c" 
                        class="bg-[#f1f5f9] text-slate-400 font-bold text-[10px] px-2 py-0.5 rounded-[4px] min-w-[36px] text-center"
                      >
                        {{ c }}
                      </div>
                    </template>
                    <span v-else class="text-slate-300 italic text-[13px]">Not set</span>
                  </div>
                </template>
              </a-table-column>
            </a-table>

            <div class="p-4 bg-slate-50/20 border-t border-slate-50 flex justify-center">
              <a-button type="dashed" @click="handleAddMethod(proposal.id)" class="px-8 border-slate-300 text-slate-400 font-bold hover:text-sky-600 hover:border-sky-500 rounded-xl h-[40px] border-dashed">
                <template #icon><plus-outlined /></template> Add Payment Method
              </a-button>
            </div>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </div>

      <!-- Payment Method List View (Drill down) -->
      <div v-if="currentView === 'methodList' && selectedProposal">
        <!-- Proposal Meta Card (Matches React renderProposalMetaCard) -->
        <a-card
          class="mb-4 onboarding-card"
          :body-style="{ padding: '18px 24px' }"
          :bordered="false"
          :style="{
            borderRadius: '20px',
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.04)',
          }"
        >
          <div class="flex justify-between items-start gap-4 mb-4">
            <div>
              <div class="mb-2">
                <a-breadcrumb separator="/">
                  <a-breadcrumb-item @click="store.setView('detail')" class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium">Corridor Detail</a-breadcrumb-item>
                  <a-breadcrumb-item @click="currentView = 'list'" class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium">Pricing</a-breadcrumb-item>
                  <a-breadcrumb-item class="text-slate-600 font-medium text-[13px]">{{ selectedProposal.customProposalType || 'Pricing Schedule' }}</a-breadcrumb-item>
                </a-breadcrumb>
              </div>
              <div class="mb-1 flex flex-wrap items-center gap-3">
                <h2 class="m-0 text-[24px] font-black leading-tight tracking-tight text-[#0f172a]">{{ selectedProposal.customProposalType || 'Pricing Schedule' }}</h2>
                <a-tag
                  :style="{ backgroundColor: pricingStatusTheme.bg, color: pricingStatusTheme.text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
                >
                  {{ pricingStatusLabel }}
                </a-tag>
              </div>
              <p class="text-slate-400 text-[13px] m-0 max-w-2xl font-medium">
                Review this pricing schedule, update the basic information here, and manage the payment methods below.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <a-button @click="handleExportProposal(selectedProposal.id)" class="h-[36px] px-4 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 flex items-center gap-2">
                <template #icon><export-outlined /></template>Export
              </a-button>
              <a-button @click="handleSubmitPricingForReview" class="h-[36px] rounded-xl border-slate-200 px-4 font-black text-slate-700">
                Submit for Review
              </a-button>
              <a-button @click="currentView = 'list'" class="h-[36px] px-4 rounded-xl font-bold text-slate-400 bg-slate-50 border-none">Discard</a-button>
              <a-button type="primary" @click="handleSavePricing" class="h-[36px] px-6 rounded-xl font-black bg-[#0284c7] border-none shadow-md">Save</a-button>
            </div>
          </div>

          <a-form layout="vertical" class="pricing-meta-form">
            <a-row v-if="isReferralProposal(selectedProposal)" :gutter="16">
              <a-col :span="8">
                <a-form-item label="Merchant">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Merchant</span></template>
                  <a-input
                    v-model:value="selectedProposal.merchant"
                    placeholder="Enter merchant name"
                    class="rounded-xl h-[44px] border-slate-200"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Document Link">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Document Link</span></template>
                  <a-input v-model:value="selectedProposal.link" placeholder="Paste document link" class="rounded-xl h-[44px] border-slate-200" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="Remark">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Remark</span></template>
                  <a-input v-model:value="selectedProposal.remark" placeholder="Internal notes" class="rounded-xl h-[44px] border-slate-200" />
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item label="Referral Rule">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Referral Rule</span></template>
                  <a-textarea
                    v-model:value="selectedProposal.referralRule"
                    :rows="4"
                    placeholder="Input referral rule"
                    class="rounded-xl border-slate-200"
                  />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row v-else :gutter="16">
              <a-col :span="selectedProposal?.type === 'Other' ? 6 : 8">
                <a-form-item label="Pricing Schedule Type">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Pricing Schedule Type</span></template>
                  <a-input
                    :value="getPricingScheduleTypeLabel(selectedProposal.type)"
                    readonly
                    class="rounded-xl h-[44px] border-slate-200 bg-slate-50"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="selectedProposal?.type === 'Other' ? 6 : 8">
                <a-form-item label="Document Link">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Document Link</span></template>
                  <a-input v-model:value="selectedProposal.link" placeholder="Paste document link" class="rounded-xl h-[44px] border-slate-200" />
                </a-form-item>
              </a-col>
              <a-col :span="selectedProposal?.type === 'Other' ? 6 : 8">
                <a-form-item label="Remark">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Remark</span></template>
                  <a-input v-model:value="selectedProposal.remark" placeholder="Internal notes" class="rounded-xl h-[44px] border-slate-200" />
                </a-form-item>
              </a-col>
              <a-col v-if="selectedProposal?.type === 'Other'" :span="6">
                <a-form-item label="Please Specify Verticals">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Please Specify Verticals</span></template>
                  <a-input
                    v-model:value="selectedProposal.specifiedVerticals"
                    placeholder="Enter specific verticals"
                    class="rounded-xl h-[44px] border-slate-200"
                  />
                </a-form-item>
              </a-col>
            </a-row>
          </a-form>
        </a-card>

        <!-- Payment Method List Card -->
        <a-card
          class="bg-white rounded-[22px] overflow-hidden border border-slate-100 shadow-sm"
          :body-style="{ padding: '20px 24px' }"
        >
          <div class="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex flex-col gap-1">
                <h3 class="text-[16px] font-bold text-slate-900 m-0">Payment Method List</h3>
                <p class="text-slate-400 text-[13px] m-0">Most of the workspace stays here for payment method review and entry.</p>
              </div>
              <div class="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 shadow-sm">
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Timestamp</span>
                <span class="text-[12px] font-bold text-slate-700 tabular-nums">{{ formatProposalTimestamp(selectedProposal.updatedAt) }}</span>
              </div>
            </div>
            <a-button type="primary" @click="handleAddMethod(selectedProposal.id)" class="h-[40px] px-5 rounded-lg font-bold flex items-center gap-2 bg-[#0284c7] border-none shadow-sm">
              <template #icon><plus-outlined /></template>
              Add Payment Method
            </a-button>
          </div>

          <a-table
            :data-source="selectedProposal.paymentMethods"
            :pagination="false"
            row-key="id"
            class="fitrem-pricing-table-v3 payment-method-detail-table"
            :custom-row="(record: any) => customRow(record, selectedProposal.id)"
            :scroll="{ x: 'max-content', y: 520 }"
          >
            <a-table-column title="Payment Type" key="methodType" :width="150" fixed="left">
              <template #default="{ record }">
                <span class="text-[13px] font-medium text-slate-700">
                  {{ getPaymentTypeDisplay(record) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Payment Method" data-index="method" key="method" :width="250" fixed="left">
              <template #default="{ record }">
                <div class="flex flex-col gap-2">
                  <span class="font-bold text-slate-800 text-[13px]">{{ formatMethodName(record.method) }}</span>
                  <div class="flex items-center gap-2" @click.stop>
                    <a-button type="link" size="small" @click.stop="openRenameMethodModal(selectedProposal.id, record)" class="text-[#0284c7] font-bold p-0 h-auto text-[11px]">Rename</a-button>
                    <a-button type="link" size="small" @click.stop="confirmDuplicateMethod(selectedProposal.id, record)" class="text-slate-500 font-bold p-0 h-auto text-[11px]">Duplicate</a-button>
                  </div>
                </div>
              </template>
            </a-table-column>

            <a-table-column title="Consumer Region" key="consumerRegion" :width="280">
              <template #default="{ record }">
                <div class="flex flex-wrap gap-2">
                  <template v-if="record.consumerRegion?.length">
                    <div
                      v-for="(region, idx) in record.consumerRegion"
                      :key="`${record.id}-region-${idx}`"
                      class="bg-sky-50 text-sky-700 font-semibold text-[12px] px-3 py-1 rounded-full"
                    >
                      {{ Array.isArray(region) ? region.join(' / ') : region }}
                    </div>
                  </template>
                  <span v-else class="text-slate-300 italic text-[13px]">Not set</span>
                </div>
              </template>
            </a-table-column>

            <a-table-column title="Fee" key="fees" :width="220">
              <template #default="{ record }">
                <span class="whitespace-pre-line font-medium text-[13px]" :class="displayFee(record) !== 'Not set' ? 'text-slate-900' : 'text-slate-300 italic'">
                  {{ displayFee(record) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Floor Price" key="floorPrice" :width="180">
              <template #default="{ record }">
                <span class="whitespace-pre-line text-[13px]" :class="formatFloorPrice(record) !== 'Not set' ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatFloorPrice(record) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Cap Price" key="capPrice" :width="180">
              <template #default="{ record }">
                <span class="whitespace-pre-line text-[13px]" :class="formatCapPrice(record) !== 'Not set' ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatCapPrice(record) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Settlement Cycle" key="cycle" :width="180">
              <template #default="{ record }">
                <span class="text-[13px]" :class="formatSettlementCycle(record) !== 'Not set' ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatSettlementCycle(record) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Settlement Currency" key="settlementCurrency" :width="220">
              <template #default="{ record }">
                <div class="flex flex-wrap gap-2">
                  <template v-if="record.settlement?.settlementCurrency?.length">
                    <div v-for="currency in record.settlement.settlementCurrency" :key="`${record.id}-settlement-${currency}`" class="bg-[#f1f5f9] text-slate-500 font-bold text-[10px] px-2 py-0.5 rounded-[4px] min-w-[36px] text-center">
                      {{ currency }}
                    </div>
                  </template>
                  <span v-else class="text-slate-300 italic text-[13px]">Not set</span>
                </div>
              </template>
            </a-table-column>

            <a-table-column title="Acquiring Currency" key="acquiringCurrency" :width="220">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.settlement?.acquiringCurrency?.length ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ toDisplayText(record.settlement?.acquiringCurrency) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Settlement Day Type" key="settlementDayType" :width="180">
              <template #default="{ record }">
                <span class="text-[13px]" :class="formatSettlementDayType(record) !== 'Not set' ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatSettlementDayType(record) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Settlement Holidays" key="settlementHolidays" :width="220">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.settlement?.settlementHolidays?.length ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ toDisplayText(record.settlement?.settlementHolidays) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Settlement Threshold" key="settlementThreshold" :width="190">
              <template #default="{ record }">
                <span class="text-[13px]" :class="formatSettlementThreshold(record) !== 'Not set' ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatSettlementThreshold(record) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="FX Cost Reference" key="fxCostReference" :width="170">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.settlement?.fxCostReference ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ toDisplayText(record.settlement?.fxCostReference) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="FX Cost Markup" key="fxCostMarkup" :width="160">
              <template #default="{ record }">
                <span class="text-[13px]" :class="formatFxMarkup(record) !== 'Not set' ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatFxMarkup(record) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="FX Cost Details" key="fxCostDetails" :width="220">
              <template #default="{ record }">
                <span class="whitespace-pre-line text-[13px]" :class="formatFxDetails(record) !== 'Not set' ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatFxDetails(record) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Refund Capability" key="refundCapability" :width="180">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.capabilityFlags?.refundCapability ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ toDisplayText(record.capabilityFlags?.refundCapability) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Refund Method" key="refundMethod" :width="160">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.capabilityFlags?.refundMethod ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ toDisplayText(record.capabilityFlags?.refundMethod) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Auto Debit Capability" key="autoDebitCapability" :width="190">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.capabilityFlags?.autoDebitCapability ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ toDisplayText(record.capabilityFlags?.autoDebitCapability) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Min Ticket" key="minTicket" :width="150">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.capabilityFlags?.minTicket ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatMoney(record.capabilityFlags?.minTicket, record.capabilityFlags?.minTicketCurrency) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Max Ticket" key="maxTicket" :width="150">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.capabilityFlags?.maxTicket ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatMoney(record.capabilityFlags?.maxTicket, record.capabilityFlags?.maxTicketCurrency) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Reserve Type" key="reserveType" :width="160">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.reserve?.type ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ toDisplayText(record.reserve?.type) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Fixed Reserve Value" key="fixedReserveValue" :width="190">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.reserve?.fixedReserveValue ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatMoney(record.reserve?.fixedReserveValue, record.reserve?.fixedReserveCurrency) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Rolling Reserve Rate" key="rollingReserveRate" :width="180">
              <template #default="{ record }">
                <span class="text-[13px]" :class="record.reserve?.rollingReserveRate ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ hasDisplayValue(record.reserve?.rollingReserveRate) ? `${record.reserve.rollingReserveRate}%` : 'Not set' }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Holding Period" key="holdingPeriod" :width="170">
              <template #default="{ record }">
                <span class="text-[13px]" :class="formatHoldingPeriod(record.reserve) !== 'Not set' ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatHoldingPeriod(record.reserve) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Reserve Notes" key="reserveNotes" :width="220">
              <template #default="{ record }">
                <span class="whitespace-pre-line text-[13px]" :class="record.reserve?.notes ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ toDisplayText(record.reserve?.notes) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="IC++" key="icpp" :width="120">
              <template #default="{ record }">
                <span class="text-[13px]" :class="hasDisplayValue(record.icpp) ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ hasDisplayValue(record.icpp) ? `${record.icpp}%` : 'Not set' }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Card Additional Fees" key="cardAdditionalFees" :width="260">
              <template #default="{ record }">
                <span class="whitespace-pre-line text-[13px]" :class="formatCardAdditionalFees(record) !== 'Not set' ? 'text-slate-700' : 'text-slate-300 italic'">
                  {{ formatCardAdditionalFees(record) }}
                </span>
              </template>
            </a-table-column>
          </a-table>
        </a-card>
      </div>

      <!-- Detail Editor View -->
      <div v-if="currentView === 'detail'">
        <div class="mb-8">
          <a-breadcrumb separator="/">
            <a-breadcrumb-item @click="store.setView('detail')" class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium">Corridor Detail</a-breadcrumb-item>
            <a-breadcrumb-item @click="currentView = 'list'" class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium">Pricing</a-breadcrumb-item>
            <a-breadcrumb-item v-if="selectedProposalId" @click="currentView = 'methodList'" class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium">{{ selectedProposal?.customProposalType || 'Pricing Schedule' }}</a-breadcrumb-item>
            <a-breadcrumb-item class="text-slate-900 font-bold text-[13px]">Configure Payment Method</a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        <div class="mb-5 flex flex-wrap items-center gap-3">
          <h2 class="m-0 text-[24px] font-black leading-tight tracking-tight text-[#0f172a]">
            {{ selectedProposal?.customProposalType || 'Pricing Schedule' }}
          </h2>
          <a-tag
            :style="{ backgroundColor: pricingStatusTheme.bg, color: pricingStatusTheme.text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
          >
            {{ pricingStatusLabel }}
          </a-tag>
        </div>
        <PaymentMethodDrawer
          :open="true"
          :initial-data="activePaymentMethod"
          :proposal-mode="activeProposal?.mode || activeCooperationMode"
          @update:open="currentView = selectedProposalId ? 'methodList' : 'list'"
          @save="onSaveMethod"
        />
      </div>

      <section class="mt-6">
        <a-card
          class="rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_42px_-30px_rgba(15,23,42,0.28)]"
          :body-style="{ padding: '24px' }"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Shared History</div>
              <h3 class="mt-2 mb-0 text-[22px] font-black text-slate-950">{{ currentHistoryProposal?.customProposalType || 'Pricing Schedule' }}</h3>
              <p class="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                Only submission and approval actions are recorded here for the current pricing schedule.
              </p>
            </div>
            <a-tag
              :style="{ backgroundColor: getWorkflowStatusTheme(currentHistoryProposalStatus).bg, color: getWorkflowStatusTheme(currentHistoryProposalStatus).text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
            >
              {{ currentHistoryProposalStatus }}
            </a-tag>
          </div>

          <div v-if="pricingHistoryEntries.length" class="mt-5 space-y-4">
            <div
              v-for="entry in pricingHistoryEntries"
              :key="entry.key"
              class="rounded-[20px] border border-slate-200 bg-slate-50/70 p-5"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="text-[13px] font-black text-slate-900">{{ entry.title }}</div>
                </div>
                <a-tag
                  :style="{ backgroundColor: getWorkflowStatusTheme(entry.status).bg, color: getWorkflowStatusTheme(entry.status).text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }"
                >
                  {{ normalizeWorkflowStatusLabel(entry.status) }}
                </a-tag>
              </div>

              <div class="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Updated At</div>
                  <div class="mt-2 text-[13px] font-semibold text-slate-700">{{ entry.time }}</div>
                </div>
                <div>
                  <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Actor</div>
                  <div class="mt-2 text-[13px] font-semibold text-slate-700">{{ entry.actor }}</div>
                </div>
                <div class="md:col-span-2">
                  <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Notes</div>
                  <div class="mt-2 text-[13px] font-semibold leading-relaxed text-slate-700">
                    {{ entry.note || 'No notes recorded for this update.' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <a-empty v-else class="mt-5" description="No pricing schedule history yet." />
        </a-card>
      </section>
    </div>

    <!-- 辅助弹窗 -->
    <a-modal
      v-model:open="isAddModalVisible"
      title="Add New Pricing Schedule"
      centered
      :width="640"
      class="fitrem-modal"
      @cancel="closeAddProposalModal"
      @ok="handleAddProposal"
    >
      <template #footer>
        <div class="flex justify-center gap-3 pt-2 pb-4">
          <a-button @click="closeAddProposalModal" class="px-8 h-[40px] rounded-xl font-bold border-slate-200">Cancel</a-button>
          <a-button type="primary" @click="handleAddProposal" class="px-8 h-[40px] rounded-xl font-bold bg-[#0f172a] border-none">Create Pricing Schedule</a-button>
        </div>
      </template>

      <div class="py-2">
        <a-form layout="vertical">
          <template v-if="isReferralCooperationMode">
            <a-form-item required>
              <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Merchant</span></template>
              <a-input
                v-model:value="addFormState.merchant"
                placeholder="Enter merchant name"
                class="rounded-xl h-[44px] border-slate-200"
              />
            </a-form-item>

            <a-form-item required>
              <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Referral Rule</span></template>
              <a-textarea
                v-model:value="addFormState.referralRule"
                :rows="5"
                placeholder="Input referral rule"
                class="rounded-xl border-slate-200"
              />
            </a-form-item>
          </template>

          <template v-else>
            <a-form-item required>
              <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Pricing Schedule Type</span></template>
              <div class="grid grid-cols-2 gap-4 mt-1">
                <a-button 
                  :type="addFormState.type === 'General' ? 'primary' : 'default'" 
                  class="h-[48px] rounded-xl font-bold"
                  :class="addFormState.type === 'General' ? 'bg-[#f0f7ff] text-[#0284c7] border-[#0284c7]' : 'text-slate-500 border-slate-200'"
                  @click="addFormState.type = 'General'"
                >Standard Pricing Schedule</a-button>
                <a-button 
                  :type="addFormState.type === 'Other' ? 'primary' : 'default'" 
                  class="h-[48px] rounded-xl font-bold"
                  :class="addFormState.type === 'Other' ? 'bg-[#f0f7ff] text-[#0284c7] border-[#0284c7]' : 'text-slate-500 border-slate-200'"
                  @click="addFormState.type = 'Other'"
                >Vertical-specific Pricing Schedule</a-button>
              </div>
            </a-form-item>

            <a-form-item v-if="addFormState.type === 'Other'" required>
              <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Please Specify Verticals</span></template>
              <a-input v-model:value="addFormState.customType" placeholder="e.g. Gaming, Travel" class="rounded-xl h-[44px] border-slate-200" />
            </a-form-item>
          </template>

          <a-form-item>
            <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Pricing Schedule Document</span></template>
            <a-upload-dragger class="bg-slate-50/50 border-dashed border-slate-200 rounded-2xl py-8">
              <div class="ant-upload-drag-icon">
                <div class="w-14 h-14 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
                  <inbox-outlined class="text-2xl text-sky-600" />
                </div>
              </div>
              <p class="text-[15px] font-black text-slate-800 mb-1">Upload the pricing schedule document here</p>
              <p class="text-[13px] text-slate-400 font-medium">Or skip upload and add the document link below.</p>
            </a-upload-dragger>
          </a-form-item>

          <a-form-item>
            <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Document Link</span></template>
            <a-input v-model:value="addFormState.link" placeholder="Paste the uploaded pricing schedule document link" class="rounded-xl h-[44px] border-slate-200" />
          </a-form-item>

          <a-form-item class="mb-0">
            <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Remark</span></template>
            <a-textarea v-model:value="addFormState.remark" :rows="4" placeholder="Optional internal notes for this pricing schedule." class="rounded-xl border-slate-200" />
          </a-form-item>
        </a-form>
      </div>
    </a-modal>

    <!-- Add Payment Method Modal -->
    <a-modal
      v-model:open="isAddMethodModalVisible"
      title="Add Payment Method"
      centered
      :width="1460"
      class="fitrem-modal payment-method-create-modal"
      destroy-on-close
      @ok="() => paymentMethodDrawerRef?.handleSave()"
    >
      <template #footer>
        <div class="flex justify-end gap-2 pt-2 pb-2 px-4 border-t border-slate-50">
          <a-button @click="isAddMethodModalVisible = false" class="rounded-lg px-6 h-[36px] font-bold text-slate-600 border-slate-200">Cancel</a-button>
          <a-button type="default" @click="() => paymentMethodDrawerRef?.handleSave()" class="rounded-lg px-6 h-[36px] font-black border-slate-300">Create Payment Method</a-button>
        </div>
      </template>
      <div class="payment-method-popup-root max-h-[calc(100vh-156px)] overflow-y-auto px-0.5 py-1">
        <PaymentMethodDrawer
          ref="paymentMethodDrawerRef"
          :open="true"
          :initial-data="activePaymentMethod"
          :proposal-mode="activeProposal?.mode || activeCooperationMode"
          hide-header
          @update:open="isAddMethodModalVisible = false"
          @save="onSaveMethod"
        />
      </div>
    </a-modal>

    <a-modal
      v-model:open="isRenameModalVisible"
      title="Rename Pricing Schedule"
      centered
      :width="520"
      class="fitrem-modal"
      @ok="handleRenameProposal"
    >
      <template #footer>
        <div class="flex justify-end gap-3 pt-2 pb-2">
          <a-button @click="isRenameModalVisible = false" class="px-6 h-[40px] rounded-xl font-bold border-slate-200">Cancel</a-button>
          <a-button type="primary" @click="handleRenameProposal" class="px-6 h-[40px] rounded-xl font-bold bg-[#0284c7] border-none">Save Name</a-button>
        </div>
      </template>

      <a-form layout="vertical" class="pt-2">
        <a-form-item required>
          <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Pricing Schedule Name</span></template>
          <a-input v-model:value="renameFormState.name" placeholder="Enter pricing schedule name" class="rounded-xl h-[44px] border-slate-200" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="isRenameMethodModalVisible"
      title="Rename Payment Method"
      centered
      :width="520"
      class="fitrem-modal"
      @ok="handleRenameMethod"
    >
      <template #footer>
        <div class="flex justify-end gap-3 pt-2 pb-2">
          <a-button @click="isRenameMethodModalVisible = false" class="px-6 h-[40px] rounded-xl font-bold border-slate-200">Cancel</a-button>
          <a-button type="primary" @click="handleRenameMethod" class="px-6 h-[40px] rounded-xl font-bold bg-[#0284c7] border-none">Rename</a-button>
        </div>
      </template>

      <a-form layout="vertical" class="pt-2">
        <a-form-item required>
          <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Payment Method Name</span></template>
          <a-input v-model:value="renameMethodFormState.name" placeholder="Enter payment method name" class="rounded-xl h-[44px] border-slate-200" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.onboarding-card {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 24px !important;
  box-shadow: 0 10px 30px -15px rgba(15, 23, 42, 0.08) !important;
}

.fitrem-segmented :deep(.ant-radio-button-wrapper) {
  height: 40px;
  line-height: 38px;
  border-radius: 20px !important;
  border: 1px solid #e2e8f0 !important;
  margin-right: 8px;
  color: #64748b;
  font-weight: 700;
  font-size: 13px;
  transition: all 0.3s;
}

.fitrem-segmented :deep(.ant-radio-button-wrapper-checked) {
  background: #f0f7ff !important;
  border-color: #0284c7 !important;
  color: #0284c7 !important;
  box-shadow: none !important;
}

.fitrem-segmented :deep(.ant-radio-button-wrapper:before) {
  display: none !important;
}

.fitrem-collapse :deep(.ant-collapse-item) {
  border: 1px solid #f1f5f9 !important;
  margin-bottom: 16px !important;
}

.fitrem-collapse :deep(.ant-collapse-header) {
  padding: 16px 24px !important;
  background: #fff !important;
}

.fitrem-pricing-table-v3 :deep(.ant-table-thead > tr > th) {
  background: #f8fafc !important;
  color: #64748b !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  padding: 16px 24px !important;
  border-bottom: 1px solid #f1f5f9 !important;
}

.fitrem-pricing-table-v3 :deep(.ant-table-tbody > tr > td) {
  padding: 20px 24px !important;
  border-bottom: 1px solid #f1f5f9 !important;
}

.fitrem-pricing-table-v3 :deep(.ant-table-tbody > tr.bg-\[\#f0f7ff\] > td) {
  background-color: #f0f7ff !important;
}

.onboarding-card {
  border: 1px solid #f1f5f9 !important;
}

.fitrem-pricing-table-v3 :deep(.ant-table-row:hover > td) {
  background-color: #f8fbff !important;
}

.fitrem-modal :deep(.ant-modal-content) {
  border-radius: 24px;
  padding: 24px 32px;
}

.fitrem-modal :deep(.ant-modal-header) {
  border-bottom: none;
  margin-bottom: 24px;
}

.fitrem-modal :deep(.ant-modal-title) {
  font-size: 20px;
  font-weight: 900;
  color: #0f172a;
}

.fitrem-modal :deep(.ant-modal-body) {
  padding: 0;
}

.fitrem-modal :deep(.ant-modal-header) {
  border-bottom: 1px solid #f1f5f9;
  padding: 20px 24px;
}

.payment-method-create-modal :deep(.ant-modal-content) {
  padding: 12px 16px 16px;
}

.payment-method-create-modal :deep(.ant-modal-header) {
  margin-bottom: 10px;
  padding: 12px 16px;
}

.payment-method-create-modal :deep(.ant-modal-title) {
  font-size: 17px;
}

.payment-method-popup-root {
  scrollbar-gutter: stable both-edges;
}

.pricing-meta-form :deep(.ant-form-item) {
  margin-bottom: 8px !important;
}

:deep(.custom-select-height-fixed .ant-select-selector) {
  min-height: 44px !important;
  height: auto !important;
  display: flex !important;
  align-items: center !important;
  border-radius: 12px !important;
  border-color: #e2e8f0 !important;
  padding: 0 11px !important;
}

:deep(.custom-select-height-fixed .ant-select-selection-item),
:deep(.custom-select-height-fixed .ant-select-selection-placeholder) {
  display: flex !important;
  align-items: center !important;
  line-height: 40px !important;
}

:deep(.ant-input:not(textarea)), :deep(.ant-input-number) {
  height: 44px !important;
}

:deep(.ant-input-number-input) {
  height: 42px !important;
}
</style>
