<script setup lang="ts">
import { ref, onMounted, computed, reactive, watch } from 'vue';
import { useAppStore } from '../stores/app';
import {
  PlusOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  ExportOutlined,
  LinkOutlined,
  DownloadOutlined,
  EditOutlined,
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import PaymentMethodDrawer from './PaymentMethodDrawer.vue';
import dayjs from 'dayjs';
import {
  applyPricingSubmission,
  FX_COST_DETAIL_REFERENCE_OPTIONS,
  FX_COST_MARKUP_REFERENCE_OPTIONS,
  getPricingLegalStageStatus,
  getSettlementCycleDisplay,
  getSettlementThresholdDisplay,
  normalizePaymentMethodName,
  PRICING_COMPLETED_STATUS,
  PRICING_FI_SUPERVISOR_REVIEW_STATUS,
  PRICING_LEGAL_REVIEW_STATUS,
  normalizePricingRuleCardCatalogItem,
  PRICING_RULE_CARD_SYSTEM_CATALOG,
  PRICING_RULE_CARD_SYSTEM_IDS,
} from '../constants/initialData';
import { openAttachmentUrl } from '../utils/attachment';
import { applyFundSourceChannelUpdate } from '../utils/fund';
import { getWorkflowStatusTheme, normalizeWorkflowStatusLabel } from '../utils/workflowStatus';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';

const store = useAppStore();
const emit = defineEmits(['registerToolbar']);

const channel = computed(() => store.selectedChannel || {});
const canOperatePricing = computed(() => store.canOperateFiWork(channel.value));
const pricingActorName = computed(() => store.currentUserName);
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
const pricingAttachmentPreviewSessionId = (() => {
  const scopedGlobal = globalThis as typeof globalThis & { __fiAttachmentPreviewSessionId?: string };
  if (!scopedGlobal.__fiAttachmentPreviewSessionId) {
    scopedGlobal.__fiAttachmentPreviewSessionId = globalThis.crypto?.randomUUID?.() || `attachment-session-${Date.now()}`;
  }

  return scopedGlobal.__fiAttachmentPreviewSessionId;
})();
const pricingAttachmentAccept = '.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.jpg,.jpeg,.png,.gif,.webp,.bmp,.heic,.heif';
const supportedPricingAttachmentExtensions = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'xlsm',
  'csv',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'heic',
  'heif',
]);
const pendingPricingAttachmentHydration = ref<Promise<any[]> | null>(null);
const pricingAttachmentHydrationVersion = ref(0);
const pendingAddProposalAttachmentHydration = ref<Promise<any[]> | null>(null);
const addProposalAttachmentHydrationVersion = ref(0);
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
const isPricingMetaEditing = ref(true);
const pricingDraft = reactive<{
  proposalId: string;
  link: string;
  remark: string;
  merchant: string;
  referralRule: string;
  specifiedVerticals: string;
  attachments: any[];
}>({
  proposalId: '',
  link: '',
  remark: '',
  merchant: '',
  referralRule: '',
  specifiedVerticals: '',
  attachments: [],
});
const pricingDraftSavedSnapshot = ref('');
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
const isProposalScopedEntry = computed(() => store.pricingEntryMode === 'proposalScoped');
const isApprovalReviewScopedEntry = computed(() => store.pricingEntryMode === 'approvalReviewScoped');
const isLaunchApprovalReadonlyEntry = computed(() => store.detailEntryMode === 'launchApprovalReadonly');
const isFundProposalScopedEntry = computed(() => (
  store.pricingEntryMode === 'fundProposalScoped' || store.pricingEntryMode === 'fundMethodScoped'
));
const isFundSubmitScopedEntry = computed(() => isFundProposalScopedEntry.value && store.pricingReturnView === 'fundSubmit');
const isFundReadonlyScopedEntry = computed(() => isFundProposalScopedEntry.value);
const isPricingReadonlyScopedEntry = computed(() => (
  isFundReadonlyScopedEntry.value
  || isApprovalReviewScopedEntry.value
  || isLaunchApprovalReadonlyEntry.value
));
const canMutatePricing = computed(() => canOperatePricing.value && !isPricingReadonlyScopedEntry.value);
const pricingScopedRootLabel = computed(() => {
  if (isFundProposalScopedEntry.value) return isFundSubmitScopedEntry.value ? 'Fund Submit' : 'Fund Detail';
  if (isProposalScopedEntry.value || isApprovalReviewScopedEntry.value) return 'FI Supervisor Review';
  return 'Corridor Detail';
});
const pricingScopedReadOnlyDescription = computed(() => {
  if (isLaunchApprovalReadonlyEntry.value) {
    return 'FI Supervisor is viewing this pricing schedule in read-only mode from launch approval details.';
  }
  if (isApprovalReviewScopedEntry.value) {
    return 'FI Supervisor is reviewing this pricing schedule in read-only mode and can continue into payment method details below.';
  }
  if (isFundReadonlyScopedEntry.value) {
    return 'Treasury is viewing this pricing schedule in read-only mode and can continue into payment method details below.';
  }
  return '';
});
const selectedProposal = computed(() =>
  proposals.value.find((proposal: any) => proposal.id === (selectedProposalId.value || activeProposalId.value))
);
const activeProposal = computed(() =>
  proposals.value.find((proposal: any) => proposal.id === activeProposalId.value)
);
const pricingOriginBackLabel = computed(() => {
  if (store.pricingReturnView === 'fundSubmit') return 'Return to Fund Submit';
  if (store.pricingReturnView === 'fundDetail') return 'Return to Fund Detail';
  if (store.pricingReturnView === 'pricingApprovalDetail') return 'Return to FI Supervisor Review';
  if (store.pricingReturnView === 'legalDetail') return 'Return to Legal Detail';
  if (store.pricingReturnView === 'dashboard') return 'Return to Dashboard';
  return 'Return to Corridor Detail';
});
const canEditPricingMeta = computed(() => (
  canMutatePricing.value && isPricingMetaEditing.value
));
const isProposalMetaReadOnly = computed(() => !canEditPricingMeta.value);
const getProposalById = (proposalId?: string | null) => (
  rawPricingProposals.value.find((proposal: any) => proposal.id === proposalId)
);
const getMethodById = (proposal: any, methodId?: string | null) => (
  Array.isArray(proposal?.paymentMethods)
    ? proposal.paymentMethods.find((method: any) => method?.id === methodId) || null
    : null
);
const getSortedAllPricingProposals = () => sortProposalsByTimestamp(rawPricingProposals.value);

const addFormState = reactive<{
  type: string;
  customType: string;
  merchant: string;
  referralRule: string;
  link: string;
  remark: string;
  attachments: any[];
}>({
  type: 'General',
  customType: '',
  merchant: '',
  referralRule: '',
  link: '',
  remark: '',
  attachments: [],
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
const leavePricing = () => {
  store.closePricingProposal();
};

const returnToProposalList = () => {
  if (isProposalScopedEntry.value || isApprovalReviewScopedEntry.value || isFundProposalScopedEntry.value) {
    leavePricing();
    return;
  }
  currentView.value = 'list';
};

const returnToMethodList = () => {
  if (selectedProposalId.value) {
    activePaymentMethod.value = null;
    if (isFundProposalScopedEntry.value) {
      store.selectedPricingMethodId = null;
    }
    currentView.value = 'methodList';
    return;
  }
  returnToProposalList();
};

const handlePricingRootBreadcrumb = () => {
  if (isFundProposalScopedEntry.value || isProposalScopedEntry.value || isApprovalReviewScopedEntry.value || store.pricingReturnView === 'legalDetail') {
    leavePricing();
    return;
  }
  store.setView('detail');
};

const handleMethodEditorClose = () => {
  returnToMethodList();
};

const registerToolbar = () => {
  if (currentView.value === 'detail') {
    emit('registerToolbar', {
      title: activePaymentMethod.value?.method
        ? formatMethodName(activePaymentMethod.value.method)
        : isPricingReadonlyScopedEntry.value
          ? 'View Payment Method'
          : 'Configure Payment Method',
      backLabel: isFundProposalScopedEntry.value ? 'Return to Pricing Schedule' : 'Return to Pricing Schedule',
      onBack: returnToMethodList,
      centered: true
    });
  } else if (currentView.value === 'methodList') {
    emit('registerToolbar', {
      title: selectedProposal.value?.customProposalType || 'Pricing Schedule',
      backLabel: isFundProposalScopedEntry.value
        ? (isFundSubmitScopedEntry.value ? 'Return to Fund Submit' : 'Return to Fund Detail')
        : (isProposalScopedEntry.value || isApprovalReviewScopedEntry.value ? 'Return to FI Supervisor Review' : 'Return to Pricing'),
      onBack: returnToProposalList,
      centered: true
    });
  } else {
    emit('registerToolbar', {
      title: `Pricing`,
      backLabel: pricingOriginBackLabel.value,
      onBack: leavePricing,
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

const syncDeepLinkedProposal = (proposalId?: string | null) => {
  if (!proposalId) return;
  const proposal = syncActiveModeWithProposal(proposalId);
  if (!proposal) return;

  activeProposalId.value = proposal.id;
  selectedProposalId.value = proposal.id;
  activePaymentMethod.value = null;
  currentView.value = 'methodList';
};

const syncFundScopedMethod = (proposalId?: string | null, methodId?: string | null) => {
  if (!proposalId || !methodId) {
    leavePricing();
    return;
  }

  const proposal = syncActiveModeWithProposal(proposalId);
  const method = getMethodById(proposal, methodId);
  if (!proposal || !method) {
    message.warning('This payment method is no longer available.');
    leavePricing();
    return;
  }

  activeProposalId.value = proposal.id;
  selectedProposalId.value = proposal.id;
  activePaymentMethod.value = JSON.parse(JSON.stringify(method));
  currentView.value = 'detail';
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
  if (!isProposalScopedEntry.value && !isApprovalReviewScopedEntry.value && !isFundProposalScopedEntry.value && channel.value?.id && proposals.value.length === 0) {
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
  if (!isProposalScopedEntry.value && !isApprovalReviewScopedEntry.value && !isFundProposalScopedEntry.value && proposals.value.length === 0) {
    openAddProposalModal();
  }
});

watch(
  [() => store.view, () => store.selectedPricingProposalId, () => store.selectedPricingMethodId, proposals],
  ([nextView, proposalId, methodId]) => {
    if (nextView !== 'pricing') return;
    if (isFundProposalScopedEntry.value) {
      if (!proposalId || !getProposalById(proposalId)) {
        leavePricing();
        return;
      }
      if (methodId) {
        syncFundScopedMethod(proposalId, methodId);
        return;
      }
      syncDeepLinkedProposal(proposalId);
      return;
    }
    if (!proposalId) return;
    if (!getProposalById(proposalId)) return;
    if (
      proposalId === activeProposalId.value
      && proposalId === selectedProposalId.value
      && currentView.value !== 'list'
    ) {
      return;
    }

    syncDeepLinkedProposal(proposalId);
  },
  { immediate: true },
);

// --- 数据处理 ---
const getCurrentTimestamp = () => dayjs().format(timestampFormat);
const formatProposalTimestamp = (timestamp?: string) => {
  if (!timestamp) return 'Timestamp unavailable';
  const parsed = dayjs(timestamp);
  return parsed.isValid() ? parsed.format(timestampFormat) : timestamp;
};
const ensurePricingEditAccess = () => {
  if (canMutatePricing.value) return true;
  message.warning(isPricingReadonlyScopedEntry.value
    ? 'This pricing schedule is available in read-only mode from this workflow.'
    : 'Only assigned FIOP/FIBD users or the FI Supervisor can edit pricing.');
  return false;
};
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
  addProposalAttachmentHydrationVersion.value += 1;
  pendingAddProposalAttachmentHydration.value = null;
  addFormState.type = 'General';
  addFormState.customType = '';
  addFormState.merchant = '';
  addFormState.referralRule = '';
  addFormState.link = '';
  addFormState.remark = '';
  addFormState.attachments = [];
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
const isProposalInReview = (proposal?: any) => {
  const status = getPricingLegalStageStatus(proposal);
  return [
    PRICING_FI_SUPERVISOR_REVIEW_STATUS,
    PRICING_LEGAL_REVIEW_STATUS,
    PRICING_COMPLETED_STATUS,
  ].includes(status);
};
const getAttachmentExtension = (name?: string | null) => {
  const matched = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return matched?.[1] || '';
};
const normalizeAttachmentUrl = (value: unknown) => {
  const normalized = String((value as any)?.url || (value as any)?.downloadUrl || '').trim();
  return /^(blob:|data:|https?:)/i.test(normalized) ? normalized : '';
};
const readBlobAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
  reader.readAsDataURL(blob);
});
const formatPricingAttachmentKind = (attachment: any) => {
  const extension = getAttachmentExtension(attachment?.name);
  if (extension) return extension.toUpperCase();

  const mimeSegment = String(attachment?.type || '').split('/').pop();
  return mimeSegment ? mimeSegment.toUpperCase() : 'FILE';
};
const normalizeProposalAttachmentList = (attachments: any[] = [], previousList: any[] = []) => {
  const previousMap = new Map((Array.isArray(previousList) ? previousList : []).map((attachment: any) => [String(attachment?.uid || ''), attachment] as const));

  return Array.isArray(attachments)
    ? attachments.map((attachment: any, index: number) => {
        const uid = String(attachment?.uid || `pricing-attachment-${index}`);
        const previous = previousMap.get(uid);
        let url = normalizeAttachmentUrl(attachment) || normalizeAttachmentUrl(previous) || '';
        let urlSessionId = String(attachment?.urlSessionId || previous?.urlSessionId || '');

        return {
          uid,
          name: String(attachment?.name || `Attachment ${index + 1}`),
          status: String(attachment?.status || 'done'),
          size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : 0,
          type: String(attachment?.type || ''),
          url,
          urlSessionId,
          downloadUrl: url,
        };
      })
    : [];
};
const buildPersistentProposalAttachmentList = async (attachments: any[] = [], previousList: any[] = []) => {
  const previousMap = new Map((Array.isArray(previousList) ? previousList : []).map((attachment: any) => [String(attachment?.uid || ''), attachment] as const));

  return Promise.all((Array.isArray(attachments) ? attachments : []).map(async (attachment: any, index: number) => {
    const uid = String(attachment?.uid || `pricing-attachment-${index}`);
    const previous = previousMap.get(uid);
    let url = normalizeAttachmentUrl(attachment) || normalizeAttachmentUrl(previous) || '';
    let urlSessionId = String(attachment?.urlSessionId || previous?.urlSessionId || '');

    if (!url && typeof window !== 'undefined' && attachment?.originFileObj instanceof Blob) {
      url = await readBlobAsDataUrl(attachment.originFileObj);
      urlSessionId = '';
    }

    return {
      uid,
      name: String(attachment?.name || `Attachment ${index + 1}`),
      status: String(attachment?.status || 'done'),
      size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : 0,
      type: String(attachment?.type || ''),
      url,
      urlSessionId,
      downloadUrl: url,
    };
  }));
};
const clonePricingAttachments = (attachments: any[] = []) => (
  JSON.parse(JSON.stringify(normalizeProposalAttachmentList(attachments)))
);
const createPricingDraftFromProposal = (proposal?: any) => ({
  proposalId: String(proposal?.id || ''),
  link: String(proposal?.link || ''),
  remark: String(proposal?.remark || ''),
  merchant: String(proposal?.merchant || ''),
  referralRule: String(proposal?.referralRule || ''),
  specifiedVerticals: String(
    proposal?.specifiedVerticals
    ?? (proposal?.type === 'Other' ? proposal?.customProposalType || '' : '')
  ),
  attachments: clonePricingAttachments(proposal?.attachments),
});
const serializePricingDraft = (draft: typeof pricingDraft) => JSON.stringify({
  proposalId: draft.proposalId,
  link: draft.link,
  remark: draft.remark,
  merchant: draft.merchant,
  referralRule: draft.referralRule,
  specifiedVerticals: draft.specifiedVerticals,
  attachments: clonePricingAttachments(draft.attachments),
});
const setPricingDraftFromProposal = (proposal?: any, options: { editing?: boolean } = {}) => {
  const nextDraft = createPricingDraftFromProposal(proposal);
  pricingDraft.proposalId = nextDraft.proposalId;
  pricingDraft.link = nextDraft.link;
  pricingDraft.remark = nextDraft.remark;
  pricingDraft.merchant = nextDraft.merchant;
  pricingDraft.referralRule = nextDraft.referralRule;
  pricingDraft.specifiedVerticals = nextDraft.specifiedVerticals;
  pricingDraft.attachments = nextDraft.attachments;
  pricingDraftSavedSnapshot.value = serializePricingDraft(pricingDraft);
  isPricingMetaEditing.value = Boolean(options.editing && canMutatePricing.value);
};
const clearPricingDraft = () => {
  setPricingDraftFromProposal(null, { editing: false });
};
const getPricingDraftAttachmentFileList = () => normalizeProposalAttachmentList(pricingDraft.attachments);
const isPricingDraftDirtyFor = (proposalId?: string | null) => (
  Boolean(proposalId)
  && pricingDraft.proposalId === proposalId
  && serializePricingDraft(pricingDraft) !== pricingDraftSavedSnapshot.value
);
const handleEnterPricingEditMode = () => {
  if (!ensurePricingEditAccess()) return;
  isPricingMetaEditing.value = true;
};
const handleDiscardPricingDraft = () => {
  const proposal = getProposalById(pricingDraft.proposalId) || selectedProposal.value;
  setPricingDraftFromProposal(proposal, { editing: false });
};
watch(
  () => selectedProposal.value?.id || '',
  () => {
    const proposal = selectedProposal.value;
    if (!proposal) {
      clearPricingDraft();
      return;
    }
    setPricingDraftFromProposal(proposal, {
      editing: canMutatePricing.value,
    });
  },
  { immediate: true },
);
const formatAttachmentSize = (size: number) => {
  if (!size) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
const isSupportedPricingAttachment = (file: any) => {
  const extension = getAttachmentExtension(file?.name);
  const mimeType = String(file?.type || '').toLowerCase();

  return supportedPricingAttachmentExtensions.has(extension)
    || mimeType.startsWith('image/')
    || [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ].includes(mimeType);
};
const canOpenPricingAttachment = (attachment: any) => {
  const url = normalizeAttachmentUrl(attachment);
  if (!url) return false;
  if (url.startsWith('blob:')) {
    return String(attachment?.urlSessionId || '') === pricingAttachmentPreviewSessionId;
  }

  return true;
};
const openPricingAttachment = (attachment: any) => {
  const url = normalizeAttachmentUrl(attachment);
  if (!url || !canOpenPricingAttachment(attachment)) {
    message.info('This local file can only be opened in the same browser session it was uploaded in. Re-upload it if needed.');
    return;
  }

  openAttachmentUrl(url);
};
const openDocumentLink = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (!normalized) return;
  window.open(normalized, '_blank', 'noopener,noreferrer');
};
const preventProposalAttachmentUpload = () => false;
const getAddProposalAttachmentFileList = () => normalizeProposalAttachmentList(addFormState.attachments);
const handleAddProposalAttachmentChange = async (info: any) => {
  const nextFiles = Array.isArray(info?.fileList) ? info.fileList : [];
  const invalidCount = nextFiles.filter((file: any) => !isSupportedPricingAttachment(file)).length;

  if (invalidCount) {
    message.warning('Only PDF, Word, Excel/CSV, and image files are supported in pricing attachments.');
  }

  const validFiles = nextFiles.filter((file: any) => isSupportedPricingAttachment(file));
  const version = addProposalAttachmentHydrationVersion.value + 1;
  addProposalAttachmentHydrationVersion.value = version;
  const hydrationPromise = buildPersistentProposalAttachmentList(
    validFiles,
    getAddProposalAttachmentFileList(),
  );
  pendingAddProposalAttachmentHydration.value = hydrationPromise;

  try {
    const nextAttachments = await hydrationPromise;
    if (addProposalAttachmentHydrationVersion.value !== version) return;

    addFormState.attachments = nextAttachments;
  } catch {
    message.error('Failed to process pricing attachment. Please retry the upload.');
  } finally {
    if (pendingAddProposalAttachmentHydration.value === hydrationPromise) {
      pendingAddProposalAttachmentHydration.value = null;
    }
  }
};
const handleProposalAttachmentChange = async (info: any) => {
  if (!selectedProposal.value || !canEditPricingMeta.value) return;
  const nextFiles = Array.isArray(info?.fileList) ? info.fileList : [];
  const invalidCount = nextFiles.filter((file: any) => !isSupportedPricingAttachment(file)).length;

  if (invalidCount) {
    message.warning('Only PDF, Word, Excel/CSV, and image files are supported in pricing attachments.');
  }

  const validFiles = nextFiles.filter((file: any) => isSupportedPricingAttachment(file));
  const version = pricingAttachmentHydrationVersion.value + 1;
  pricingAttachmentHydrationVersion.value = version;
  const hydrationPromise = buildPersistentProposalAttachmentList(
    validFiles,
    getPricingDraftAttachmentFileList(),
  );
  pendingPricingAttachmentHydration.value = hydrationPromise;

  try {
    const nextAttachments = await hydrationPromise;
    if (!selectedProposal.value || pricingAttachmentHydrationVersion.value !== version) return;

    pricingDraft.attachments = nextAttachments;
  } catch {
    message.error('Failed to process pricing attachment. Please retry the upload.');
  } finally {
    if (pendingPricingAttachmentHydration.value === hydrationPromise) {
      pendingPricingAttachmentHydration.value = null;
    }
  }
};
const handleRemoveProposalAttachment = (uid: string) => {
  if (!selectedProposal.value || !canEditPricingMeta.value) return;
  const nextAttachments = getPricingDraftAttachmentFileList()
    .filter((attachment: any) => attachment.uid !== uid);
  pricingDraft.attachments = nextAttachments;
};

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
  attachments?: any[];
  openAfterCreate?: boolean;
  silent?: boolean;
}) => {
  if (!ensurePricingEditAccess()) return null;
  const mode = activeCooperationMode.value;
  const type = options?.type ?? addFormState.type;
  const customType = options?.customType ?? addFormState.customType;
  const merchant = options?.merchant ?? addFormState.merchant;
  const referralRule = options?.referralRule ?? addFormState.referralRule;
  const link = options?.link ?? addFormState.link;
  const remark = options?.remark ?? addFormState.remark;
  const attachments = clonePricingAttachments(options?.attachments ?? addFormState.attachments);

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
  if (showTextLimitWarning(message.warning, [
    { label: 'Merchant', value: merchant, max: INPUT_LIMITS.name },
    { label: 'Referral Rule', value: referralRule, max: INPUT_LIMITS.note },
    { label: 'Please Specify Verticals', value: customType, max: INPUT_LIMITS.name },
    { label: 'Document Link', value: link, max: INPUT_LIMITS.url },
    { label: 'Remark', value: remark, max: INPUT_LIMITS.note },
  ])) return null;

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
        attachments,
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
        attachments,
        paymentMethods: [],
        approvalHistory: [],
      };

  persistProposals([...rawPricingProposals.value, newProposal]);
  activeProposalId.value = newProposal.id;

  if (options?.openAfterCreate) {
    selectedProposalId.value = newProposal.id;
    setPricingDraftFromProposal(newProposal, {
      editing: canMutatePricing.value,
    });
    currentView.value = 'methodList';
  }

  if (!options?.silent) {
    message.success('New pricing schedule created');
  }

  return newProposal;
};

const waitForAddProposalAttachmentHydration = async () => {
  if (pendingAddProposalAttachmentHydration.value) {
    try {
      await pendingAddProposalAttachmentHydration.value;
    } catch {
      message.error('Pricing attachments are still processing. Please retry after upload completes.');
      return false;
    }
  }

  return true;
};
const handleAddProposal = async () => {
  if (!(await waitForAddProposalAttachmentHydration())) return;

  const createdProposal = createProposal({
    attachments: getAddProposalAttachmentFileList(),
    openAfterCreate: true,
  });
  if (!createdProposal) return;
  closeAddProposalModal();
};

const handleOpenMethodList = (proposalId: string) => {
  const proposal = syncActiveModeWithProposal(proposalId);
  activeProposalId.value = proposalId;
  selectedProposalId.value = proposalId;
  setPricingDraftFromProposal(proposal, {
    editing: canMutatePricing.value,
  });
  if (isFundProposalScopedEntry.value) {
    store.selectedPricingMethodId = null;
  }
  currentView.value = 'methodList';
};

const handleEditMethod = (proposalId: string, method: any) => {
  syncActiveModeWithProposal(proposalId);
  activeProposalId.value = proposalId;
  selectedProposalId.value = currentView.value === 'methodList' ? proposalId : null;
  activePaymentMethod.value = JSON.parse(JSON.stringify(method));
  if (isFundProposalScopedEntry.value) {
    store.selectedPricingMethodId = method?.id || null;
  }
  currentView.value = 'detail';
};

const customRow = (record: any, proposalId: string) => {
  const isClickable = canMutatePricing.value || isPricingReadonlyScopedEntry.value;
  return {
    onClick: () => {
      if (isClickable) {
        handleEditMethod(proposalId, record);
      }
    },
    class: isClickable ? 'cursor-pointer' : 'cursor-default'
  };
};

const handleAddMethod = (proposalId: string) => {
  if (!ensurePricingEditAccess()) return;
  syncActiveModeWithProposal(proposalId);
  activeProposalId.value = proposalId;
  selectedProposalId.value = currentView.value === 'methodList' ? proposalId : null;
  activePaymentMethod.value = null;
  isAddMethodModalVisible.value = true;
};

const onSaveMethod = (data: any) => {
  if (!ensurePricingEditAccess()) return;
  if (!activeProposalId.value) return;
  const updatedAt = getCurrentTimestamp();
  let savedMethod = JSON.parse(JSON.stringify(data));
  const nextProposals = rawPricingProposals.value.map((proposal: any) => {
    if (proposal.id !== activeProposalId.value) return proposal;
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
      updatedAt,
    };
  });
  store.updateChannel(applyFundSourceChannelUpdate(
    channel.value,
    {
      pricingProposals: sortProposalsByTimestamp(nextProposals),
    },
    pricingActorName.value,
    updatedAt,
    `Updated payment method snapshot mirrored to fund review for ${normalizePaymentMethodName(data.method) || 'payment method'}.`,
  ));
  message.success('Configuration saved');
  if (isAddMethodModalVisible.value) {
    isAddMethodModalVisible.value = false;
    currentView.value = selectedProposalId.value ? 'methodList' : 'list';
    return;
  }
  activePaymentMethod.value = savedMethod;
};

const handleDuplicateMethod = (proposalId: string, methodId: string) => {
  if (!ensurePricingEditAccess()) return;
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
  if (!ensurePricingEditAccess()) return;
  renameMethodFormState.proposalId = proposalId;
  renameMethodFormState.methodId = method.id;
  renameMethodFormState.name = formatMethodName(method.method || '');
  renameMethodFormState.methodForm = getMethodFormLabel(method) === 'Card' ? 'card' : 'nonCard';
  isRenameMethodModalVisible.value = true;
};

const handleRenameMethod = () => {
  if (!ensurePricingEditAccess()) return;
  const trimmedName = normalizeMethodNameForForm(renameMethodFormState.name, renameMethodFormState.methodForm as 'card' | 'nonCard');
  if (!trimmedName) {
    message.warning('Payment method name is required');
    return;
  }
  if (showTextLimitWarning(message.warning, [
    { label: 'Payment Method Name', value: renameMethodFormState.name, max: INPUT_LIMITS.name },
  ])) return;

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
  if (!ensurePricingEditAccess()) return;
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
  if (!ensurePricingEditAccess()) return;
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
  if (!ensurePricingEditAccess()) return;
  renameFormState.proposalId = proposal.id;
  renameFormState.name = proposal.customProposalType || getPricingScheduleTypeLabel(proposal.type);
  isRenameModalVisible.value = true;
};

const handleRenameProposal = () => {
  if (!ensurePricingEditAccess()) return;
  const trimmedName = renameFormState.name.trim();
  if (!trimmedName) {
    message.warning('Pricing schedule name is required');
    return;
  }
  if (showTextLimitWarning(message.warning, [
    { label: 'Pricing Schedule Name', value: renameFormState.name, max: INPUT_LIMITS.name },
  ])) return;

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

const waitForPricingAttachmentHydration = async (actionLabel: 'save' | 'submit') => {
  if (pendingPricingAttachmentHydration.value) {
    try {
      await pendingPricingAttachmentHydration.value;
    } catch {
      message.error(`Pricing attachments are still processing. Please retry ${actionLabel} after upload completes.`);
      return false;
    }
  }

  return true;
};
const validatePricingDraftForProposal = (proposal?: any) => {
  if (isReferralProposal(proposal)) {
    if (!pricingDraft.merchant.trim()) {
      message.warning('Merchant is required');
      return false;
    }
    if (!pricingDraft.referralRule.trim()) {
      message.warning('Referral rule is required');
      return false;
    }
  }
  if (showTextLimitWarning(message.warning, [
    { label: 'Merchant', value: pricingDraft.merchant, max: INPUT_LIMITS.name },
    { label: 'Referral Rule', value: pricingDraft.referralRule, max: INPUT_LIMITS.note },
    { label: 'Please Specify Verticals', value: pricingDraft.specifiedVerticals, max: INPUT_LIMITS.name },
    { label: 'Document Link', value: pricingDraft.link, max: INPUT_LIMITS.url },
    { label: 'Remark', value: pricingDraft.remark, max: INPUT_LIMITS.note },
  ])) return false;

  return true;
};
const buildSavedProposalFromDraft = (proposal: any, updatedAt: string) => {
  const link = pricingDraft.link.trim();
  const remark = pricingDraft.remark.trim();
  const merchant = pricingDraft.merchant.trim();
  const referralRule = pricingDraft.referralRule.trim();
  const specifiedVerticals = pricingDraft.specifiedVerticals.trim();
  const attachments = normalizeProposalAttachmentList(pricingDraft.attachments);

  return {
    ...proposal,
    link,
    remark,
    merchant,
    referralRule,
    specifiedVerticals: proposal?.type === 'Other' ? specifiedVerticals : proposal?.specifiedVerticals,
    attachments,
    legalRequestPacket: {
      ...(proposal.legalRequestPacket || {}),
      documentLink: link,
      remarks: remark,
      attachments,
    },
    updatedAt,
  };
};
const savePricingDraft = async (options: { silent?: boolean; targetProposalId?: string } = {}) => {
  if (!ensurePricingEditAccess()) return null;
  if (!(await waitForPricingAttachmentHydration('save'))) return null;

  const proposalId = options.targetProposalId || pricingDraft.proposalId || selectedProposalId.value || activeProposalId.value;
  if (!proposalId || pricingDraft.proposalId !== proposalId) return null;

  const currentProposal = rawPricingProposals.value.find((proposal: any) => proposal.id === proposalId);
  if (!currentProposal || !validatePricingDraftForProposal(currentProposal)) return null;

  const updatedAt = getCurrentTimestamp();
  let savedProposal: any = null;
  const nextProposals = rawPricingProposals.value.map((proposal: any) => {
    if (proposal.id !== proposalId) return proposal;
    savedProposal = buildSavedProposalFromDraft(proposal, updatedAt);
    return savedProposal;
  });

  persistProposals(nextProposals);
  setPricingDraftFromProposal(savedProposal, { editing: false });
  if (!options.silent) {
    message.success('Pricing configuration saved');
  }

  return savedProposal;
};
const handleSavePricing = async () => {
  await savePricingDraft();
};

const normalizeSubmitProposalId = (proposalId?: string | Event | null) => (
  typeof proposalId === 'string' && proposalId.trim() ? proposalId : undefined
);

const resolveSubmitTargetProposal = (proposalId?: string | Event | null) => {
  const normalizedProposalId = normalizeSubmitProposalId(proposalId);
  if (normalizedProposalId) {
    return syncActiveModeWithProposal(normalizedProposalId);
  }

  const prioritizedIds = currentView.value === 'list'
    ? [activeProposalId.value, selectedProposalId.value]
    : [selectedProposalId.value, activeProposalId.value];

  for (const candidateId of prioritizedIds) {
    const proposal = syncActiveModeWithProposal(candidateId);
    if (proposal) return proposal;
  }

  return proposals.value[0] || getSortedAllPricingProposals()[0] || null;
};

const submitPricingForReview = (proposal: any) => {
  const updatedAt = getCurrentTimestamp();
  const historyNote = proposal.remark || 'Pricing schedule submitted for review.';

  activeProposalId.value = proposal.id;
  if (currentView.value === 'methodList' || currentView.value === 'detail') {
    selectedProposalId.value = proposal.id;
  }

  const updatedChannel = {
    ...applyPricingSubmission(channel.value, proposal.id, pricingActorName.value, updatedAt, historyNote),
    auditLogs: [
      {
        time: updatedAt,
        user: pricingActorName.value,
        action: `Submitted pricing schedule "${proposal.customProposalType || 'Pricing Schedule'}" for review.`,
        color: 'blue',
      },
      ...(channel.value.auditLogs || []),
    ],
  };
  const updatedProposal = updatedChannel.pricingProposals?.find((item: any) => item.id === proposal.id);

  store.updateChannel(updatedChannel);

  message.success('Pricing schedule submitted for review.');
  if (getPricingLegalStageStatus(updatedProposal) === PRICING_LEGAL_REVIEW_STATUS) {
    store.openLegalDetail('PRICING', 'pricing', { proposalId: proposal.id });
  }
};

const handleSubmitPricingForReview = async (proposalId?: string | Event | null) => {
  if (!ensurePricingEditAccess()) return;
  if (!(await waitForPricingAttachmentHydration('submit'))) return;
  if (!rawPricingProposals.value.length) {
    message.warning('Create or select a pricing schedule before submitting it for review.');
    return;
  }

  const proposal = resolveSubmitTargetProposal(proposalId);
  if (!proposal) return;

  if (isProposalInReview(proposal)) {
    message.warning('This pricing schedule is not available for resubmission in its current status.');
    return;
  }

  if (isPricingDraftDirtyFor(proposal.id)) {
    if (!validatePricingDraftForProposal(proposal)) return;

    Modal.confirm({
      title: 'Save and submit this pricing schedule?',
      content: `This will save your latest edits to "${proposal.customProposalType || 'Pricing Schedule'}" before sending it to the next reviewer.`,
      okText: 'Save and Submit',
      onOk: async () => {
        const savedProposal = await savePricingDraft({ silent: true, targetProposalId: proposal.id });
        if (!savedProposal) return Promise.reject();
        submitPricingForReview(savedProposal);
      },
    });
    return;
  }

  Modal.confirm({
    title: 'Submit this pricing schedule for review?',
    content: `This will send "${proposal.customProposalType || 'Pricing Schedule'}" to the next reviewer in the pricing workflow.`,
    okText: 'Submit',
    onOk: () => submitPricingForReview(proposal),
  });
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
      <div
        v-if="(isProposalScopedEntry || isApprovalReviewScopedEntry) && !selectedProposal"
        class="rounded-[28px] border border-dashed border-slate-200 bg-white px-8 py-14 text-center shadow-[0_24px_50px_-32px_rgba(15,23,42,0.28)]"
      >
        <a-empty description="This pricing schedule is no longer available." />
        <a-button
          type="primary"
          class="mt-6 h-[42px] rounded-lg px-6 font-bold bg-[#0284c7] border-none"
          @click="leavePricing"
        >
          {{ pricingOriginBackLabel }}
        </a-button>
      </div>

      <div v-if="currentView === 'list' && !isProposalScopedEntry && !isApprovalReviewScopedEntry">
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
        <div v-if="canMutatePricing" class="flex items-center gap-3">
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
                  <div v-if="canMutatePricing" class="flex items-center gap-2" @click.stop>
                    <a-button
                      size="small"
                      :disabled="isProposalInReview(proposal)"
                      @click="handleSubmitPricingForReview(proposal.id)"
                      class="h-[30px] rounded-lg border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-600"
                    >
                      Submit
                    </a-button>
                    <a-dropdown placement="bottomRight">
                    <a-button size="small" class="h-[30px] rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600">More actions</a-button>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item key="duplicate" @click="confirmDuplicateProposal(proposal)">Duplicate</a-menu-item>
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

            <div v-if="canMutatePricing" class="p-4 bg-slate-50/20 border-t border-slate-50 flex justify-center">
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
                  <a-breadcrumb-item @click="handlePricingRootBreadcrumb" class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium">
                    {{ pricingScopedRootLabel }}
                  </a-breadcrumb-item>
                  <a-breadcrumb-item
                    v-if="!isProposalScopedEntry && !isApprovalReviewScopedEntry && !isFundProposalScopedEntry"
                    @click="returnToProposalList"
                    class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium"
                  >
                    Pricing
                  </a-breadcrumb-item>
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
                {{
                  isPricingReadonlyScopedEntry
                    ? pricingScopedReadOnlyDescription
                    : 'Review this pricing schedule, update the basic information here, and manage the payment methods below.'
                }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <a-button @click="handleExportProposal(selectedProposal.id)" class="h-[36px] px-4 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 flex items-center gap-2">
                <template #icon><export-outlined /></template>Export CSV
              </a-button>
              <a-button v-if="canMutatePricing" @click="handleSubmitPricingForReview()" class="h-[36px] rounded-xl border-slate-200 px-4 font-black text-slate-700">
                Submit for Review
              </a-button>
              <template v-if="canMutatePricing">
                <template v-if="isPricingMetaEditing">
                  <a-button @click="handleDiscardPricingDraft" class="h-[36px] px-4 rounded-xl font-bold text-slate-400 bg-slate-50 border-none">Discard</a-button>
                  <a-button type="primary" @click="handleSavePricing" class="h-[36px] px-6 rounded-xl font-black bg-[#0284c7] border-none shadow-md">Save</a-button>
                </template>
                <a-button v-else type="text" @click="handleEnterPricingEditMode" class="h-[36px] rounded-xl px-4 font-bold text-sky-600 hover:bg-sky-50">
                  <template #icon><edit-outlined /></template>
                  Edit
                </a-button>
              </template>
            </div>
          </div>

          <a-form layout="vertical" class="pricing-meta-form">
            <a-row v-if="isReferralProposal(selectedProposal)" :gutter="16">
              <a-col :span="12">
                <a-form-item label="Merchant">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Merchant</span></template>
                  <a-input
                    v-model:value="pricingDraft.merchant"
                    :maxlength="INPUT_LIMITS.name"
                    placeholder="Enter merchant name"
                    class="rounded-xl h-[44px] border-slate-200"
                    :readonly="isProposalMetaReadOnly"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="Document Link">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Document Link</span></template>
                  <div class="flex items-center gap-2">
                    <a-input v-model:value="pricingDraft.link" :maxlength="INPUT_LIMITS.url" :readonly="isProposalMetaReadOnly" placeholder="Paste document link" class="rounded-xl h-[44px] border-slate-200" />
                    <a-button
                      v-if="pricingDraft.link"
                      class="h-[44px] rounded-xl border-slate-200 px-4 font-bold"
                      @click="openDocumentLink(pricingDraft.link)"
                    >
                      <template #icon><link-outlined /></template>
                      Open
                    </a-button>
                  </div>
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item label="Remark">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Remark</span></template>
                  <a-textarea
                    v-model:value="pricingDraft.remark"
                    :maxlength="INPUT_LIMITS.note"
                    :readonly="isProposalMetaReadOnly"
                    :auto-size="{ minRows: 4, maxRows: 8 }"
                    show-count
                    placeholder="Internal notes"
                    class="rounded-xl border-slate-200"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item label="Referral Rule">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Referral Rule</span></template>
                  <a-textarea
                    v-model:value="pricingDraft.referralRule"
                    :maxlength="INPUT_LIMITS.note"
                    :rows="4"
                    show-count
                    placeholder="Input referral rule"
                    class="rounded-xl border-slate-200"
                    :readonly="isProposalMetaReadOnly"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item label="Attachments">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Attachments</span></template>
                  <template v-if="isPricingReadonlyScopedEntry">
                    <div class="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                      <div v-if="getPricingDraftAttachmentFileList().length" class="space-y-3">
                        <div
                          v-for="file in getPricingDraftAttachmentFileList()"
                          :key="file.uid"
                          class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <button
                            type="button"
                            class="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                            @click="openPricingAttachment(file)"
                          >
                            <div class="truncate text-[13px] font-bold text-slate-800">{{ file.name }}</div>
                            <div class="mt-1 text-[12px] font-medium text-slate-400">
                              {{ formatPricingAttachmentKind(file) }} / {{ formatAttachmentSize(file.size) }}
                            </div>
                            <div class="mt-1 text-[12px] font-semibold" :class="canOpenPricingAttachment(file) ? 'text-sky-600' : 'text-slate-400'">
                              {{ canOpenPricingAttachment(file) ? 'Click to open' : 'Re-upload in this session to open' }}
                            </div>
                          </button>
                          <a-button
                            v-if="canOpenPricingAttachment(file)"
                            type="default"
                            size="small"
                            class="inline-flex items-center gap-1 rounded-lg border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-700 hover:border-sky-300 hover:text-sky-600"
                            @click="openPricingAttachment(file)"
                          >
                            <template #icon><download-outlined /></template>
                            Open
                          </a-button>
                          <span v-else class="text-[12px] font-semibold text-slate-400">Unavailable in this session</span>
                        </div>
                      </div>
                      <div v-else class="text-[13px] font-medium text-slate-400">
                        No pricing attachments uploaded for this schedule.
                      </div>
                    </div>
                  </template>
                  <a-upload-dragger
                    v-else
                    :file-list="getPricingDraftAttachmentFileList()"
                    :before-upload="preventProposalAttachmentUpload"
                    :accept="pricingAttachmentAccept"
                    :show-upload-list="false"
                    :disabled="!canEditPricingMeta"
                    multiple
                    class="bg-slate-50/50 border-dashed border-slate-200 rounded-2xl py-5"
                    @change="handleProposalAttachmentChange"
                  >
                    <div class="ant-upload-drag-icon">
                      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-100 bg-white shadow-sm">
                        <inbox-outlined class="text-xl text-sky-600" />
                      </div>
                    </div>
                    <p class="mb-1 text-[14px] font-black text-slate-800">Upload pricing attachments here</p>
                    <p class="text-[12px] font-medium text-slate-400">Support PDF, Word, Excel/CSV, and image files. Attachments added here will be available in Legal after submit.</p>
                  </a-upload-dragger>
                  <div v-if="!isPricingReadonlyScopedEntry && getPricingDraftAttachmentFileList().length" class="mt-3 space-y-3">
                    <div
                      v-for="file in getPricingDraftAttachmentFileList()"
                      :key="file.uid"
                      class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <button
                        type="button"
                        class="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                        @click="openPricingAttachment(file)"
                      >
                        <div class="truncate text-[13px] font-bold text-slate-800">{{ file.name }}</div>
                        <div class="mt-1 text-[12px] font-medium text-slate-400">
                          {{ formatPricingAttachmentKind(file) }} / {{ formatAttachmentSize(file.size) }}
                        </div>
                        <div class="mt-1 text-[12px] font-semibold" :class="canOpenPricingAttachment(file) ? 'text-sky-600' : 'text-slate-400'">
                          {{ canOpenPricingAttachment(file) ? 'Click to open' : 'Re-upload in this session to open' }}
                        </div>
                      </button>
                      <a-space size="small">
                        <a-button
                          v-if="canOpenPricingAttachment(file)"
                          type="default"
                          size="small"
                          class="rounded-lg border-slate-200 px-3 text-[12px] font-bold text-slate-700 hover:border-sky-300 hover:text-sky-600"
                          @click="openPricingAttachment(file)"
                        >
                          <template #icon><download-outlined /></template>
                          Open
                        </a-button>
                        <a-button
                          v-if="canEditPricingMeta"
                          type="text"
                          size="small"
                          class="text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                          @click="handleRemoveProposalAttachment(file.uid)"
                        >
                          Remove
                        </a-button>
                      </a-space>
                    </div>
                  </div>
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
                  <div class="flex items-center gap-2">
                    <a-input v-model:value="pricingDraft.link" :maxlength="INPUT_LIMITS.url" :readonly="isProposalMetaReadOnly" placeholder="Paste document link" class="rounded-xl h-[44px] border-slate-200" />
                    <a-button
                      v-if="pricingDraft.link"
                      class="h-[44px] rounded-xl border-slate-200 px-4 font-bold"
                      @click="openDocumentLink(pricingDraft.link)"
                    >
                      <template #icon><link-outlined /></template>
                      Open
                    </a-button>
                  </div>
                </a-form-item>
              </a-col>
              <a-col v-if="selectedProposal?.type === 'Other'" :span="6">
                <a-form-item label="Please Specify Verticals">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Please Specify Verticals</span></template>
                  <a-input
                    v-model:value="pricingDraft.specifiedVerticals"
                    :maxlength="INPUT_LIMITS.name"
                    placeholder="Enter specific verticals"
                    class="rounded-xl h-[44px] border-slate-200"
                    :readonly="isProposalMetaReadOnly"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item label="Remark">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Remark</span></template>
                  <a-textarea
                    v-model:value="pricingDraft.remark"
                    :maxlength="INPUT_LIMITS.note"
                    :readonly="isProposalMetaReadOnly"
                    :auto-size="{ minRows: 4, maxRows: 8 }"
                    show-count
                    placeholder="Internal notes"
                    class="rounded-xl border-slate-200"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="24">
                <a-form-item label="Attachments">
                  <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Attachments</span></template>
                  <template v-if="isPricingReadonlyScopedEntry">
                    <div class="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                      <div v-if="getPricingDraftAttachmentFileList().length" class="space-y-3">
                        <div
                          v-for="file in getPricingDraftAttachmentFileList()"
                          :key="file.uid"
                          class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <button
                            type="button"
                            class="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                            @click="openPricingAttachment(file)"
                          >
                            <div class="truncate text-[13px] font-bold text-slate-800">{{ file.name }}</div>
                            <div class="mt-1 text-[12px] font-medium text-slate-400">
                              {{ formatPricingAttachmentKind(file) }} / {{ formatAttachmentSize(file.size) }}
                            </div>
                            <div class="mt-1 text-[12px] font-semibold" :class="canOpenPricingAttachment(file) ? 'text-sky-600' : 'text-slate-400'">
                              {{ canOpenPricingAttachment(file) ? 'Click to open' : 'Re-upload in this session to open' }}
                            </div>
                          </button>
                          <a-button
                            v-if="canOpenPricingAttachment(file)"
                            type="default"
                            size="small"
                            class="inline-flex items-center gap-1 rounded-lg border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-700 hover:border-sky-300 hover:text-sky-600"
                            @click="openPricingAttachment(file)"
                          >
                            <template #icon><download-outlined /></template>
                            Open
                          </a-button>
                          <span v-else class="text-[12px] font-semibold text-slate-400">Unavailable in this session</span>
                        </div>
                      </div>
                      <div v-else class="text-[13px] font-medium text-slate-400">
                        No pricing attachments uploaded for this schedule.
                      </div>
                    </div>
                  </template>
                  <a-upload-dragger
                    v-else
                    :file-list="getPricingDraftAttachmentFileList()"
                    :before-upload="preventProposalAttachmentUpload"
                    :accept="pricingAttachmentAccept"
                    :show-upload-list="false"
                    :disabled="!canEditPricingMeta"
                    multiple
                    class="bg-slate-50/50 border-dashed border-slate-200 rounded-2xl py-5"
                    @change="handleProposalAttachmentChange"
                  >
                    <div class="ant-upload-drag-icon">
                      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-100 bg-white shadow-sm">
                        <inbox-outlined class="text-xl text-sky-600" />
                      </div>
                    </div>
                    <p class="mb-1 text-[14px] font-black text-slate-800">Upload pricing attachments here</p>
                    <p class="text-[12px] font-medium text-slate-400">Support PDF, Word, Excel/CSV, and image files. Attachments added here will be available in Legal after submit.</p>
                  </a-upload-dragger>
                  <div v-if="!isPricingReadonlyScopedEntry && getPricingDraftAttachmentFileList().length" class="mt-3 space-y-3">
                    <div
                      v-for="file in getPricingDraftAttachmentFileList()"
                      :key="file.uid"
                      class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <button
                        type="button"
                        class="min-w-0 flex-1 border-0 bg-transparent p-0 text-left"
                        @click="openPricingAttachment(file)"
                      >
                        <div class="truncate text-[13px] font-bold text-slate-800">{{ file.name }}</div>
                        <div class="mt-1 text-[12px] font-medium text-slate-400">
                          {{ formatPricingAttachmentKind(file) }} / {{ formatAttachmentSize(file.size) }}
                        </div>
                        <div class="mt-1 text-[12px] font-semibold" :class="canOpenPricingAttachment(file) ? 'text-sky-600' : 'text-slate-400'">
                          {{ canOpenPricingAttachment(file) ? 'Click to open' : 'Re-upload in this session to open' }}
                        </div>
                      </button>
                      <a-space size="small">
                        <a-button
                          v-if="canOpenPricingAttachment(file)"
                          type="default"
                          size="small"
                          class="rounded-lg border-slate-200 px-3 text-[12px] font-bold text-slate-700 hover:border-sky-300 hover:text-sky-600"
                          @click="openPricingAttachment(file)"
                        >
                          <template #icon><download-outlined /></template>
                          Open
                        </a-button>
                        <a-button
                          v-if="canEditPricingMeta"
                          type="text"
                          size="small"
                          class="text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                          @click="handleRemoveProposalAttachment(file.uid)"
                        >
                          Remove
                        </a-button>
                      </a-space>
                    </div>
                  </div>
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
            <a-button v-if="canMutatePricing" type="primary" @click="handleAddMethod(selectedProposal.id)" class="h-[40px] px-5 rounded-lg font-bold flex items-center gap-2 bg-[#0284c7] border-none shadow-sm">
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
                  <div v-if="canMutatePricing" class="flex items-center gap-2" @click.stop>
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
      <div v-if="currentView === 'detail' && selectedProposal">
        <div class="mb-8">
          <a-breadcrumb separator="/">
            <a-breadcrumb-item @click="handlePricingRootBreadcrumb" class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium">
              {{ pricingScopedRootLabel }}
            </a-breadcrumb-item>
            <a-breadcrumb-item
              v-if="!isProposalScopedEntry && !isApprovalReviewScopedEntry && !isFundProposalScopedEntry"
              @click="returnToProposalList"
              class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium"
            >
              Pricing
            </a-breadcrumb-item>
            <a-breadcrumb-item
              v-if="selectedProposalId"
              @click="returnToMethodList"
              class="cursor-pointer text-slate-400 hover:text-sky-600 transition-colors text-[13px] font-medium"
            >
              {{ selectedProposal?.customProposalType || 'Pricing Schedule' }}
            </a-breadcrumb-item>
            <a-breadcrumb-item class="text-slate-900 font-bold text-[13px]">
            {{ isPricingReadonlyScopedEntry ? 'View Payment Method' : 'Configure Payment Method' }}
            </a-breadcrumb-item>
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
          :force-read-only="isPricingReadonlyScopedEntry"
          :breadcrumb-root-label="pricingScopedRootLabel"
          :breadcrumb-section-label="isPricingReadonlyScopedEntry ? 'Pricing Schedule' : 'Pricing'"
          :breadcrumb-proposal-label="selectedProposal?.customProposalType || 'Pricing Schedule'"
          :read-only-description="isApprovalReviewScopedEntry ? 'FI Supervisor is reviewing this payment method in read-only mode.' : isFundReadonlyScopedEntry ? 'Treasury is viewing the mirrored payment method snapshot in read-only mode.' : undefined"
          @update:open="handleMethodEditorClose"
          @save="onSaveMethod"
        />
      </div>
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
                :maxlength="INPUT_LIMITS.name"
                placeholder="Enter merchant name"
                class="rounded-xl h-[44px] border-slate-200"
              />
            </a-form-item>

            <a-form-item required>
              <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Referral Rule</span></template>
              <a-textarea
                v-model:value="addFormState.referralRule"
                :maxlength="INPUT_LIMITS.note"
                :rows="5"
                show-count
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
              <a-input v-model:value="addFormState.customType" :maxlength="INPUT_LIMITS.name" placeholder="e.g. Gaming, Travel" class="rounded-xl h-[44px] border-slate-200" />
            </a-form-item>
          </template>

          <a-form-item>
            <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Pricing Schedule Document</span></template>
            <a-upload-dragger
              class="bg-slate-50/50 border-dashed border-slate-200 rounded-2xl py-8"
              multiple
              :accept="pricingAttachmentAccept"
              :before-upload="preventProposalAttachmentUpload"
              :file-list="getAddProposalAttachmentFileList()"
              @change="handleAddProposalAttachmentChange"
            >
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
            <a-input v-model:value="addFormState.link" :maxlength="INPUT_LIMITS.url" placeholder="Paste the uploaded pricing schedule document link" class="rounded-xl h-[44px] border-slate-200" />
          </a-form-item>

          <a-form-item class="mb-0">
            <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Remark</span></template>
            <a-textarea v-model:value="addFormState.remark" :maxlength="INPUT_LIMITS.note" :rows="4" show-count placeholder="Optional internal notes for this pricing schedule." class="rounded-xl border-slate-200" />
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
      :mask-closable="false"
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
          <a-input v-model:value="renameFormState.name" :maxlength="INPUT_LIMITS.name" placeholder="Enter pricing schedule name" class="rounded-xl h-[44px] border-slate-200" />
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
          <a-input v-model:value="renameMethodFormState.name" :maxlength="INPUT_LIMITS.name" placeholder="Enter payment method name" class="rounded-xl h-[44px] border-slate-200" />
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
