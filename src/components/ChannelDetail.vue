<script setup lang="ts">
import { ref, reactive, computed, h, watch } from 'vue';
import { useAppStore } from '../stores/app';
import { appFontFamily, buildCorridorStatusTagStyle, colors, titleFontFamily } from '../styles/colors';
import {
  EditOutlined,
  RocketOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  InfoCircleOutlined,
  FileTextOutlined,
  RollbackOutlined,
  InboxOutlined,
  RobotOutlined,
  EyeOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';
import { 
  geoData, 
  chargebackHandlingOptions,
  contactMethodOptions,
  merchantGeoOptions,
  supportedProductOptions
} from '../constants/channelOptions';
import {
  buildFundPrerequisiteSnapshot,
  buildPricingScheduleSummary,
  getLaunchApprovalLabel,
  getLaunchApprovalTheme,
  normalizeLaunchApproval,
  normalizeFundApprovalStatus,
  type LaunchApprovalHistoryEntry,
} from '../constants/initialData';
import {
  applyOnboardingSubmission,
  getChannelOnboardingWorkflow,
  isOnboardingFiActionStatus,
  revokeOnboardingPendingHandoff,
} from '../constants/onboarding';
import {
  applyFundReviewSubmission,
  applyFundSourceChannelUpdate,
  getFundApprovalLabel,
  getFundApprovalTheme,
  isFundReviewSubmitted,
} from '../utils/fund';
import { isLegacyRevocationCopy } from '../utils/workflowLifecycle';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';
import WorkflowBoard from './WorkflowBoard.vue';
import WorkflowSidePanel from './WorkflowSidePanel.vue';
import CddWorkflowPanelContent from './CddWorkflowPanelContent.vue';
import KycWorkflowPanelContent from './KycWorkflowPanelContent.vue';

const props = defineProps<{
  topOffset: number;
}>();

const store = useAppStore();
const emit = defineEmits(['registerToolbar']);
const unsureOption = "I'm not sure yet";
type WorkflowPanelKey = 'kyc-cdd' | 'kyc-onboarding';
type BackendAccountRow = {
  environmentType: string;
  environmentDetail: string;
  legalName: string;
  tradingName: string;
  address: string;
  account: string;
  password: string;
  remark: string;
  loginMethod: string;
  accountPurpose: string;
  permissionScope: string;
  reviewStep: string;
};
type AttachmentMeta = {
  uid: string;
  name: string;
  status: string;
  size: number;
  type: string;
  url: string;
  urlSessionId: string;
};

const backendAccountEnvironmentOptions = [
  { label: 'Production', value: 'Production' },
  { label: 'Test', value: 'Test' },
];

const backendAccountPlaceholders: Record<keyof BackendAccountRow, string> = {
  environmentType: 'Select type',
  environmentDetail: 'e.g. Production portal / UAT-2026028400103',
  legalName: 'e.g. WooshPay HK Limited',
  tradingName: 'e.g. Kingsmen Pay',
  address: 'https://portal.example.com',
  account: 'e.g. ops@example.com',
  password: 'e.g. Temporary password',
  remark: 'e.g. Shared mailbox / backup login',
  loginMethod: 'e.g. Email + OTP',
  accountPurpose: 'e.g. Balance / statements / refund',
  permissionScope: 'e.g. View-only / refund operator',
  reviewStep: 'e.g. Single login / dual review',
};

const backendAccountEnvironmentTooltip = 'Select whether this backend account is used in the production or test environment.';
const backendAccountLegalNameTooltip = 'Merchant Legal Name indicates which entity opened the backend account.';
const attachmentPreviewSessionId = (() => {
  const scopedGlobal = globalThis as typeof globalThis & { __fiAttachmentPreviewSessionId?: string };
  if (!scopedGlobal.__fiAttachmentPreviewSessionId) {
    scopedGlobal.__fiAttachmentPreviewSessionId = globalThis.crypto?.randomUUID?.() || `attachment-session-${Date.now()}`;
  }

  return scopedGlobal.__fiAttachmentPreviewSessionId;
})();
const reconciliationAttachmentAccept = '.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.jpg,.jpeg,.png,.gif,.webp,.bmp,.heic,.heif';
const supportedReconciliationAttachmentExtensions = new Set([
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

// --- 状态定义 ---
const activeSection = ref('overview');
const isHistorySidebarVisible = ref(false);
const launchTimelineDrawerOpen = ref(false);
const isFundSubmitModalVisible = ref(false);
const isSuspendModalVisible = ref(false);
const activeWorkflowPanel = ref<WorkflowPanelKey | null>(null);
const lostReason = ref('Offline');
const lostRemarks = ref('');
const fundSubmissionNote = ref('');
const channel = computed(() => store.selectedChannel || {});
const isLaunchApprovalReadonlyDetail = computed(() => store.detailEntryMode === 'launchApprovalReadonly');
const canOperateFiChannel = computed(() => store.canOperateFiWork(channel.value) && !isLaunchApprovalReadonlyDetail.value);
const currentActorName = computed(() => store.currentUserName);
const fundPrerequisites = computed(() => buildFundPrerequisiteSnapshot(channel.value));
const fundApprovalStatus = computed(() => normalizeFundApprovalStatus(channel.value.fundApproval?.status));
const fundApprovalTheme = computed(() => getFundApprovalTheme(fundApprovalStatus.value));
const fundApprovalLabel = computed(() => getFundApprovalLabel(fundApprovalStatus.value));
const fundReviewSubmitted = computed(() => isFundReviewSubmitted(channel.value));
const launchApproval = computed(() => normalizeLaunchApproval(channel.value.launchApproval, channel.value));
const launchApprovalTheme = computed(() => getLaunchApprovalTheme(launchApproval.value.status));
const canSubmitFundReviewRole = computed(() => (
  ['FIOP', 'FIBD'].includes(store.currentUserRole)
  && store.canAccessChannel(channel.value)
));
const canSubmitFundReview = computed(() => (
  canSubmitFundReviewRole.value
  && fundPrerequisites.value.ready
  && fundApprovalStatus.value !== 'approved'
  && (!fundReviewSubmitted.value || fundApprovalStatus.value === 'changes_requested')
));
const fundSubmitBlockReason = computed(() => {
  if (!canSubmitFundReviewRole.value) return 'Only assigned FIOP/FIBD users can submit fund review.';
  if (!fundPrerequisites.value.ready) return fundPrerequisites.value.missingItems.join('; ');
  if (fundApprovalStatus.value === 'approved') return 'Fund review is already approved.';
  if (fundReviewSubmitted.value && fundApprovalStatus.value === 'pending') return 'Fund review has already been submitted.';
  return '';
});
const visibleAuditLogs = computed(() => (
  Array.isArray(channel.value.auditLogs)
    ? channel.value.auditLogs.filter((log: any) => !isLegacyRevocationCopy(log?.action))
    : []
));
const companySummary = computed(() => channel.value.companyName || 'Company details pending');
const cooperationSummary = computed(() => {
  const savedModels = Array.isArray(channel.value.cooperationModel) ? channel.value.cooperationModel : [];
  return savedModels.length ? savedModels.join(', ') : channel.value.cooperationModel || 'Model pending';
});
const productSummary = computed(() => {
  const savedProducts = Array.isArray(channel.value.supportedProducts) ? channel.value.supportedProducts : [];
  return savedProducts.length ? savedProducts : ['Pending'];
});
const overviewMetricValueClass = 'text-[16px] font-black text-slate-900 leading-tight whitespace-normal break-words';
const overviewMetricValueStyle = { fontFamily: appFontFamily };
const formatOverviewMetricValue = (value: string | string[] | null | undefined) => {
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : 'Pending';
  }

  return value || 'Pending';
};
const normalizeAssignmentDisplayNames = (primaryOwner: unknown, collaborators: unknown) => {
  const collaboratorNames = Array.isArray(collaborators)
    ? collaborators
    : [collaborators];

  return [...new Set(
    [primaryOwner, ...collaboratorNames]
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  )];
};
const formatMerchantGeoSelection = (selection: unknown) => {
  if (!Array.isArray(selection)) {
    return String(selection || '').trim();
  }

  return selection.map((item) => String(item || '').trim()).filter(Boolean).join(' / ');
};

const merchantGeoAllowedSummary = computed(() => {
  const merchantGeo = Array.isArray(channel.value.merchantGeoAllowed)
    ? channel.value.merchantGeoAllowed
    : Array.isArray(channel.value.merchantGeo)
      ? channel.value.merchantGeo
      : [];
  const formattedGeos = merchantGeo
    .map((selection: unknown) => formatMerchantGeoSelection(selection))
    .filter(Boolean);

  return formattedGeos.length ? formattedGeos.join(', ') : 'Pending';
});

const pricingProposals = computed(() => (
  Array.isArray(channel.value.pricingProposals) ? channel.value.pricingProposals : []
));

const pricingScheduleSummary = computed(() => buildPricingScheduleSummary(pricingProposals.value));
const fiopAssignmentSummary = computed(() => normalizeAssignmentDisplayNames(
  channel.value.fiopOwner,
  channel.value.fiopCollaboratorNames,
));
const fibdAssignmentSummary = computed(() => normalizeAssignmentDisplayNames(
  channel.value.fibdOwner,
  channel.value.fibdCollaboratorNames,
));
const latestPricingScheduleUpdatedAt = computed(() => {
  const latestTimestamp = pricingProposals.value.reduce((latest: string, proposal: any) => {
    const nextUpdatedAt = String(proposal?.updatedAt || '');
    return new Date(nextUpdatedAt).getTime() > new Date(latest).getTime() ? nextUpdatedAt : latest;
  }, '');

  return latestTimestamp || channel.value.submissionHistory?.pricing?.date || '';
});
const workflowPanelTitleMap: Record<WorkflowPanelKey, string> = {
  'kyc-cdd': 'Corridor onboarding',
  'kyc-onboarding': 'WooshPay onboarding',
};
const workflowPanelComponentMap = {
  'kyc-cdd': CddWorkflowPanelContent,
  'kyc-onboarding': KycWorkflowPanelContent,
} as const;
const isKycWorkflowPanel = computed(() => (
  activeWorkflowPanel.value === 'kyc-cdd' || activeWorkflowPanel.value === 'kyc-onboarding'
));
const isWorkflowPanelOpen = computed(() => Boolean(activeWorkflowPanel.value));
const activeWorkflowPanelTitle = computed(() => (
  activeWorkflowPanel.value ? workflowPanelTitleMap[activeWorkflowPanel.value] : ''
));
const activeWorkflowPanelComponent = computed(() => (
  activeWorkflowPanel.value ? workflowPanelComponentMap[activeWorkflowPanel.value] : null
));
const activeWorkflowPanelProps = computed(() => ({}));
const resolveHistoryEntryTimestamp = (value?: string) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const launchTimelineEntries = computed<LaunchApprovalHistoryEntry[]>(() => (
  [...launchApproval.value.history].sort((left, right) => (
    resolveHistoryEntryTimestamp(right.time) - resolveHistoryEntryTimestamp(left.time)
  ))
));

const formatLaunchTimelineTime = (value?: string) => {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
};

const getLaunchTimelineTitle = (entry: LaunchApprovalHistoryEntry) => {
  if (entry.type === 'supervisor_approve') return 'FI Supervisor approved';
  if (entry.type === 'supervisor_return') return 'FI Supervisor returned';
  return 'FI Supervisor decision updated';
};

const getLaunchTimelineColor = (entry: LaunchApprovalHistoryEntry) => {
  if (entry.type === 'supervisor_approve' || entry.status === 'live') return 'green';
  if (entry.type === 'supervisor_return') return 'red';
  return 'blue';
};

const submissionHistoryEntries = computed(() => {
  const history = channel.value.submissionHistory || {};
  const stageMeta: Record<string, string> = {
    cdd: 'Corridor onboarding',
    kyc: 'WooshPay onboarding',
    nda: 'Non-Disclosure Agreement',
    msa: 'Master Services Agreement',
    otherAttachments: 'Other Attachments',
    pricing: 'Pricing Schedule',
    tech: 'Technical Integration'
  };
  const stageStatusMap: Record<string, string> = {
    cdd: channel.value.corridorOnboardingStatus || 'Not Started',
    kyc: channel.value.globalProgress?.kyc || channel.value.complianceStatus || channel.value.wooshpayOnboardingStatus || 'Not Started',
    nda: channel.value.ndaStatus || channel.value.globalProgress?.nda || 'Not Started',
    msa: channel.value.contractStatus || channel.value.globalProgress?.contract || 'Not Started',
    otherAttachments: channel.value.otherAttachmentsStatus || channel.value.globalProgress?.otherAttachments || 'Not Started',
    tech: channel.value.globalProgress?.tech || 'Not Started',
  };

  const baseEntries = Object.entries(history)
    .filter(([key, h]: any) => key !== 'pricing' && Boolean(h?.date))
    .map(([key, h]: any) => ({
      key,
      title: stageMeta[key] || key,
      status: stageStatusMap[key] || 'Not Started',
      ...h
    }));

  const pricingEntries = pricingProposals.value.length
    ? pricingProposals.value
        .filter((proposal: any) => Boolean(proposal?.updatedAt))
        .map((proposal: any) => ({
          key: `pricing-${proposal.id}`,
          title: `Pricing Schedule - ${proposal.customProposalType || 'Pricing Schedule'}`,
          status: proposal.approvalStatus || 'Not Started',
          date: proposal.updatedAt,
          user: channel.value.submissionHistory?.pricing?.user || 'System',
          notes: proposal.remark || channel.value.submissionHistory?.pricing?.notes || '',
        }))
    : (history.pricing?.date
        ? [{
            key: 'pricing',
            title: stageMeta.pricing,
            status: channel.value.globalProgress?.pricing || 'Not Started',
            ...history.pricing,
          }]
        : []);

  return [...baseEntries, ...pricingEntries]
    .sort((a, b) => resolveHistoryEntryTimestamp(b.date) - resolveHistoryEntryTimestamp(a.date));
});

const profileFormState = reactive({
  channelName: '',
  channelId: '',
  companyName: '',
  registrationContinent: undefined as string | undefined,
  registrationGeo: undefined as string | undefined,
  cooperationModel: [] as string[],
  supportedProducts: [] as string[],
  pocName: '',
  pocMethod: 'Email',
  pocDetail: '',
  onboardingEntities: [] as string[],
});

const registrationCountries = computed(() => {
  if (!profileFormState.registrationContinent) return [];
  return geoData[profileFormState.registrationContinent] || [];
});

const handleContinentChange = () => {
  profileFormState.registrationGeo = undefined;
};

const handlePocMethodChange = () => {
  profileFormState.pocDetail = '';
};

const pocPlaceholder = computed(() => {
  const method = contactMethodOptions.find(m => m.value === profileFormState.pocMethod);
  return method?.placeholder || 'Contact Info';
});

// --- 引用定义 ---
const sectionRefs = {
  overview: ref<HTMLElement | null>(null),
  profile: ref<HTMLElement | null>(null),
  pricing: ref<HTMLElement | null>(null),
  capability: ref<HTMLElement | null>(null),
  chargeback: ref<HTMLElement | null>(null),
  reconciliation: ref<HTMLElement | null>(null),
  tax: ref<HTMLElement | null>(null),
  merchantMid: ref<HTMLElement | null>(null),
  fiopTracking: ref<HTMLElement | null>(null),
};

const onboardingEntityOptions = [
  'SwooshTransfer Ltd (UK) - SPI licensed',
  'Steelhenge Pte Ltd (Singapore)',
  'Steelhenge HongKong Group Limited (HK)',
  'Quantumtech Ltd (HK) - MSO licensed',
  'QuantumWing Limited (HK)',
];

const sectionConfigs = [
  { key: 'overview', label: 'Go-live Management', icon: h(RocketOutlined) },
  { key: 'profile', label: 'Corridor Profile', icon: h(FileTextOutlined) },
  { key: 'pricing', label: 'Pricing', icon: h(RobotOutlined) },
  { key: 'capability', label: 'Capability', icon: h(InboxOutlined) },
  { key: 'chargeback', label: 'Dispute SOP', icon: h(RollbackOutlined) },
  { key: 'reconciliation', label: 'Reconciliation', icon: h(CheckCircleFilled) },
  { key: 'tax', label: 'Tax Configuration', icon: h(InfoCircleOutlined) },
  { key: 'merchantMid', label: 'Merchant Onboarding Flow', icon: h(InfoCircleOutlined) },
  { key: 'fiopTracking', label: 'FIOP Tracking', icon: h(ClockCircleFilled) },
];

// --- 工具栏注册 ---
const registerToolbar = () => {
  emit('registerToolbar', {
    title: channel.value.channelName || 'Unnamed Corridor',
    status: channel.value.status,
    statusColor: channel.value.status === 'Live' ? 'success' : 'processing',
    backLabel: isLaunchApprovalReadonlyDetail.value ? 'Return to Launch Approval' : 'Return to Dashboard',
    onBack: () => {
      if (isLaunchApprovalReadonlyDetail.value) {
        store.closeChannelDetail();
        return;
      }
      store.setView('dashboard');
    },
    onShare: isLaunchApprovalReadonlyDetail.value ? null : () => message.success('Share link generated!'),
    onSuspend: isLaunchApprovalReadonlyDetail.value ? null : () => {
      if (!canOperateFiChannel.value) return;
      lostReason.value = channel.value.status === 'Lost connection' ? 'Lost connection' : 'Offline';
      lostRemarks.value = '';
      isSuspendModalVisible.value = true;
    },
  });
};

// --- 业务逻辑 ---
const isEditingProfile = ref(false);
const isEditingCapability = ref(false);
const isEditingChargeback = ref(false);
const isEditingReconciliation = ref(false);
const isEditingTax = ref(false);
const isEditingMerchantMid = ref(false);
const isEditingFiopTracking = ref(false);

const isProgrammaticScroll = ref(false);
const setEditingState = (editable = canOperateFiChannel.value) => {
  isEditingProfile.value = editable;
  isEditingCapability.value = editable;
  isEditingChargeback.value = editable;
  isEditingReconciliation.value = editable;
  isEditingTax.value = editable;
  isEditingMerchantMid.value = editable;
  isEditingFiopTracking.value = editable;
};

const capabilityFormState = reactive({
  merchantGeo: [] as string[][],
  capabilityText: '',
  capabilityLink: '',
  merchantPolicyLink: '',
  merchantPolicyRemark: '',
});

const chargebackFormState = reactive({
  chargebackHandling: ['Email'] as string[],
  chargebackRemarks: '',
});

const reconciliationFormState = reactive({
  reconMethods: [] as string[],
  reconMethodDetail: '',
  backendAccounts: [] as BackendAccountRow[],
  rechargeFlowRemark: '',
  rechargeFlowAttachments: [] as AttachmentMeta[],
  corridorPayoutAccount: '',
  corridorPayoutAccountAttachments: [] as AttachmentMeta[],
  sampleNotes: '',
});

const taxFormState = reactive({
  taxDetails: '',
});

const merchantMidFormState = reactive({
  merchantMidDetails: '',
});

const fiopTrackingFormState = reactive({
  draftRemark: '',
  entries: [] as Array<{ id: string; time: string; remark: string }>,
});

const toStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  return value ? [String(value)] : [];
};

const normalizeSelectableValues = (value: unknown, fallback: string[] = []) => {
  const values = [...new Set(toStringArray(value))];
  return values.length || Array.isArray(value) ? values : [...fallback];
};

const normalizeAttachmentUrl = (value: unknown) => {
  const normalized = String((value as any)?.url || '').trim();
  return /^(blob:|data:|https?:)/i.test(normalized) ? normalized : '';
};

const normalizeAttachmentMeta = (
  value: unknown,
  index = 0,
  previousMap?: Map<string, AttachmentMeta>,
): AttachmentMeta => {
  const candidate = value as any;
  const uid = String(candidate?.uid || `attachment-${Date.now()}-${index}`);
  const previous = previousMap?.get(uid);
  let url = normalizeAttachmentUrl(candidate) || previous?.url || '';
  let urlSessionId = String(candidate?.urlSessionId || previous?.urlSessionId || '');

  if (!url && typeof window !== 'undefined' && candidate?.originFileObj instanceof Blob) {
    url = URL.createObjectURL(candidate.originFileObj);
    urlSessionId = attachmentPreviewSessionId;
  }

  return {
    uid,
    name: String(candidate?.name || 'Attachment'),
    status: String(candidate?.status || 'done'),
    size: Number(candidate?.size || 0),
    type: String(candidate?.type || ''),
    url,
    urlSessionId,
  };
};

const normalizeAttachmentList = (value: unknown, previousList: AttachmentMeta[] = []) => {
  const previousMap = new Map(previousList.map((item) => [item.uid, item] as const));
  return Array.isArray(value)
    ? value.map((item, index) => normalizeAttachmentMeta(item, index, previousMap)).filter((item) => item.name.trim())
    : [];
};

const getAttachmentExtension = (name: string) => {
  const matched = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return matched?.[1] || '';
};

const isSupportedReconciliationAttachment = (file: any) => {
  const extension = getAttachmentExtension(String(file?.name || ''));
  const mimeType = String(file?.type || '').toLowerCase();

  return supportedReconciliationAttachmentExtensions.has(extension)
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

const formatAttachmentSize = (size: number) => {
  if (!size) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const canOpenAttachment = (attachment: AttachmentMeta) => {
  if (!attachment.url) return false;
  if (attachment.url.startsWith('blob:')) {
    return attachment.urlSessionId === attachmentPreviewSessionId;
  }

  return true;
};

const openAttachment = (attachment: AttachmentMeta) => {
  if (!canOpenAttachment(attachment)) {
    message.info('This local file can only be opened in the same browser session it was uploaded in. Re-upload it if needed.');
    return;
  }

  window.open(attachment.url, '_blank', 'noopener,noreferrer');
};

const formatAttachmentKind = (attachment: AttachmentMeta) => {
  const extension = getAttachmentExtension(attachment.name);
  if (extension) return extension.toUpperCase();

  const mimeSegment = attachment.type.split('/').pop();
  return mimeSegment ? mimeSegment.toUpperCase() : 'FILE';
};

const cloneMerchantGeoSelections = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[][];

  return value
    .filter((selection): selection is string[] => Array.isArray(selection))
    .map((selection) => selection.map((item) => String(item)));
};

const cloneFiopTrackingEntries = (value: unknown) => {
  if (!Array.isArray(value)) return [] as Array<{ id: string; time: string; remark: string }>;

  return value
    .map((entry, index) => ({
      id: String((entry as any)?.id || `fiop-track-${index}`),
      time: String((entry as any)?.time || ''),
      remark: String((entry as any)?.remark || ''),
    }))
    .filter((entry) => entry.remark)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
};

const createEmptyBackendAccountRow = (): BackendAccountRow => ({
  environmentType: '',
  environmentDetail: '',
  legalName: '',
  tradingName: '',
  address: '',
  account: '',
  password: '',
  remark: '',
  loginMethod: '',
  accountPurpose: '',
  permissionScope: '',
  reviewStep: '',
});

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

const normalizeBackendAccountRow = (value: unknown): BackendAccountRow => {
  const normalizedValue = value as any;
  const nextEnvironmentType = resolveBackendAccountEnvironmentType(normalizedValue?.environmentType);
  const nextEnvironmentDetail = normalizeBackendAccountText(normalizedValue?.environmentDetail);
  const legacyEnvironment = extractBackendAccountEnvironmentFromLegacy(normalizedValue?.environment);

  return {
    environmentType: nextEnvironmentType || legacyEnvironment.environmentType,
    environmentDetail: nextEnvironmentDetail || legacyEnvironment.environmentDetail,
    legalName: normalizeBackendAccountText(normalizedValue?.legalName),
    tradingName: normalizeBackendAccountText(normalizedValue?.tradingName),
    address: normalizeBackendAccountText(normalizedValue?.address),
    account: normalizeBackendAccountText(normalizedValue?.account),
    password: normalizeBackendAccountText(normalizedValue?.password),
    remark: normalizeBackendAccountText(normalizedValue?.remark),
    loginMethod: normalizeBackendAccountText(normalizedValue?.loginMethod),
    accountPurpose: normalizeBackendAccountText(normalizedValue?.accountPurpose),
    permissionScope: normalizeBackendAccountText(normalizedValue?.permissionScope),
    reviewStep: normalizeBackendAccountText(normalizedValue?.reviewStep),
  };
};

const isBackendAccountRowEmpty = (row: BackendAccountRow) => (
  !Object.values(row).some((value) => value.trim())
);

const cloneBackendAccounts = (value: unknown) => {
  const rows = Array.isArray(value)
    ? value.map((row) => normalizeBackendAccountRow(row)).filter((row) => !isBackendAccountRowEmpty(row))
    : [];

  return rows;
};

const maskPassword = (value: string) => (value.trim() ? '********' : '');

const resolveBackendAccountAddressHref = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) return '';

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const normalizeExclusiveSelection = (values: string[]) => {
  if (!values.includes(unsureOption)) {
    return values;
  }

  return values[values.length - 1] === unsureOption
    ? [unsureOption]
    : values.filter((value) => value !== unsureOption);
};

const resetProfileForm = (source = channel.value) => {
  Object.assign(profileFormState, {
    channelName: source.channelName || '',
    channelId: source.channelId || '',
    companyName: source.companyName || '',
    registrationGeo: source.registrationGeo || undefined,
    registrationContinent: source.registrationContinent || undefined,
    cooperationModel: normalizeExclusiveSelection(toStringArray(source.cooperationModel)),
    supportedProducts: toStringArray(source.supportedProducts),
    pocName: source.pocName || '',
    pocMethod: source.pocMethod || 'Email',
    pocDetail: source.pocDetail || '',
    onboardingEntities: toStringArray(source.onboardingEntities),
  });
};

const resetCapabilityForm = (source = channel.value) => {
  Object.assign(capabilityFormState, {
    merchantGeo: cloneMerchantGeoSelections(source.merchantGeoAllowed || source.merchantGeo),
    capabilityText: source.capabilityText || '',
    capabilityLink: source.capabilityLink || '',
    merchantPolicyLink: source.merchantPolicyLink || '',
    merchantPolicyRemark: source.merchantPolicyRemark || '',
  });
};

const resetChargebackForm = (source = channel.value) => {
  Object.assign(chargebackFormState, {
    chargebackHandling: normalizeSelectableValues(source.chargebackHandling, ['Email']),
    chargebackRemarks: source.chargebackRemarks || '',
  });
};

const resetReconciliationForm = (source = channel.value) => {
  const backendAccounts = cloneBackendAccounts(source.backendAccounts);
  Object.assign(reconciliationFormState, {
    reconMethods: toStringArray(source.reconMethods),
    reconMethodDetail: source.reconMethodDetail || '',
    backendAccounts: backendAccounts.length ? backendAccounts : [createEmptyBackendAccountRow()],
    rechargeFlowRemark: source.rechargeFlowRemark || '',
    rechargeFlowAttachments: normalizeAttachmentList(source.rechargeFlowAttachments),
    corridorPayoutAccount: source.corridorPayoutAccount || '',
    corridorPayoutAccountAttachments: normalizeAttachmentList(source.corridorPayoutAccountAttachments),
    sampleNotes: source.sampleNotes || '',
  });
};

const resetTaxForm = (source = channel.value) => {
  Object.assign(taxFormState, {
    taxDetails: source.taxDetails || '',
  });
};

const resetMerchantMidForm = (source = channel.value) => {
  Object.assign(merchantMidFormState, {
    merchantMidDetails: source.merchantMidDetails || '',
  });
};

const resetFiopTrackingForm = (source = channel.value) => {
  Object.assign(fiopTrackingFormState, {
    draftRemark: '',
    entries: cloneFiopTrackingEntries(source.fiopTrackingEntries),
  });
};

const hydrateAllForms = (source = channel.value) => {
  resetProfileForm(source);
  resetCapabilityForm(source);
  resetChargebackForm(source);
  resetReconciliationForm(source);
  resetTaxForm(source);
  resetMerchantMidForm(source);
  resetFiopTrackingForm(source);
};

const handleProfileCooperationModelChange = (values: string[]) => {
  profileFormState.cooperationModel = normalizeExclusiveSelection(values);
};

const guardPricingNavigation = () => {
  const savedModels = normalizeExclusiveSelection(toStringArray(channel.value.cooperationModel));

  if (!savedModels.includes(unsureOption)) {
    return false;
  }

  message.info('Cooperation Model is still marked as "I\'m not sure yet". Pricing remains accessible and can be refined after the model is confirmed.');
  return false;
};

const navigateToPricing = () => {
  if (!guardPricingNavigation()) {
    store.openPricingProposal(null, {
      returnView: 'detail',
      entryMode: 'default',
    });
  }
};

const attemptNavigateToSection = (key: string) => {
  if (key === 'pricing') {
    navigateToPricing();
    return;
  }
  const target = sectionRefs[key as keyof typeof sectionRefs].value;
  if (target) {
    isProgrammaticScroll.value = true;
    activeSection.value = key;
    target.scrollIntoView({ behavior: 'smooth' });
    
    // 延迟恢复，防止滚动过程中触发 syncActiveSection 的抖动
    setTimeout(() => {
      isProgrammaticScroll.value = false;
    }, 800);
  }
};

const handleContentScroll = (e: Event) => {
  if (isProgrammaticScroll.value) return;

  const scrollRoot = e.target as HTMLElement;
  const scrollTop = scrollRoot.scrollTop;
  const sectionEntries = Object.entries(sectionRefs);
  const offset = 120; // 触发偏移量

  // 按照顺序检查各个 section 的位置
  const entries = Object.entries(sectionRefs);
  void entries;

  for (let i = sectionEntries.length - 1; i >= 0; i -= 1) {
    const [key, ref] = sectionEntries[i];
    if (ref.value && ref.value.offsetTop <= scrollTop + offset) {
      if (activeSection.value !== key) {
        activeSection.value = key;
      }
      break;
    }
  }
};
const ensureFiOperationAccess = () => {
  if (canOperateFiChannel.value) return true;
  message.warning('Only assigned FIOP/FIBD users or the FI Supervisor can edit this corridor.');
  return false;
};

const handleDiscardProfile = () => {
  resetProfileForm();
  isEditingProfile.value = false;
};

const handleDiscardCapability = () => {
  resetCapabilityForm();
  isEditingCapability.value = false;
};

const handleDiscardChargeback = () => {
  resetChargebackForm();
  isEditingChargeback.value = false;
};

const handleDiscardReconciliation = () => {
  resetReconciliationForm();
  isEditingReconciliation.value = false;
};

const handleAddBackendAccountRow = () => {
  reconciliationFormState.backendAccounts.push(createEmptyBackendAccountRow());
};

const removeBackendAccountRow = (index: number) => {
  reconciliationFormState.backendAccounts = reconciliationFormState.backendAccounts.filter((_, rowIndex) => rowIndex !== index);
};

const handleRemoveBackendAccountRow = (index: number) => {
  Modal.confirm({
    title: 'Delete this backend account row?',
    content: 'This will remove the entire row and its current values.',
    okText: 'Delete',
    okType: 'danger',
    cancelText: 'Cancel',
    onOk: () => removeBackendAccountRow(index),
  });
};

const preventReconciliationAttachmentUpload = () => false;

const handleReconciliationAttachmentChange = (info: any) => {
  const nextFiles = Array.isArray(info?.fileList) ? info.fileList : [];
  const invalidCount = nextFiles.filter((file: any) => !isSupportedReconciliationAttachment(file)).length;

  if (invalidCount) {
    message.warning('Only PDF, Word, Excel/CSV, and image files are supported in this section.');
  }

  reconciliationFormState.corridorPayoutAccountAttachments = normalizeAttachmentList(
    nextFiles.filter((file: any) => isSupportedReconciliationAttachment(file)),
    reconciliationFormState.corridorPayoutAccountAttachments,
  );
};

const handleRemoveReconciliationAttachment = (uid: string) => {
  reconciliationFormState.corridorPayoutAccountAttachments = reconciliationFormState.corridorPayoutAccountAttachments
    .filter((file) => file.uid !== uid);
};

const handleRechargeFlowAttachmentChange = (info: any) => {
  const nextFiles = Array.isArray(info?.fileList) ? info.fileList : [];
  const invalidCount = nextFiles.filter((file: any) => !isSupportedReconciliationAttachment(file)).length;

  if (invalidCount) {
    message.warning('Only PDF, Word, Excel/CSV, and image files are supported in this section.');
  }

  reconciliationFormState.rechargeFlowAttachments = normalizeAttachmentList(
    nextFiles.filter((file: any) => isSupportedReconciliationAttachment(file)),
    reconciliationFormState.rechargeFlowAttachments,
  );
};

const handleRemoveRechargeFlowAttachment = (uid: string) => {
  reconciliationFormState.rechargeFlowAttachments = reconciliationFormState.rechargeFlowAttachments
    .filter((file) => file.uid !== uid);
};

const handleDiscardTax = () => {
  resetTaxForm();
  isEditingTax.value = false;
};

const handleDiscardMerchantMid = () => {
  resetMerchantMidForm();
  isEditingMerchantMid.value = false;
};

const handleDiscardFiopTracking = () => {
  resetFiopTrackingForm();
  isEditingFiopTracking.value = false;
};

const handleRemoveFiopTrackingEntry = (entryId: string) => {
  fiopTrackingFormState.entries = fiopTrackingFormState.entries.filter((entry) => entry.id !== entryId);
};

watch(
  [() => channel.value.id, canOperateFiChannel],
  ([nextId, nextCanOperate], previousValues) => {
    const [prevId, prevCanOperate] = previousValues ?? [undefined, undefined];
    if (!nextId || !store.selectedChannel) return;

    const channelChanged = nextId !== prevId;
    const accessChanged = nextCanOperate !== prevCanOperate;
    const lostEditAccess = Boolean(prevCanOperate) && !nextCanOperate;

    // Keep local drafts when the same corridor is updated elsewhere.
    if (channelChanged || lostEditAccess) {
      hydrateAllForms();
    }

    if (channelChanged || accessChanged) {
      setEditingState(nextCanOperate);
    }
  },
  { immediate: true },
);

watch(
  [() => channel.value.id, () => channel.value.channelName, () => channel.value.status, canOperateFiChannel, isLaunchApprovalReadonlyDetail],
  () => {
    if (store.selectedChannel) {
      registerToolbar();
    }
  },
  { immediate: true },
);

const handleSaveProfile = () => {
  if (!ensureFiOperationAccess()) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Corridor Name', value: profileFormState.channelName, max: INPUT_LIMITS.name },
    { label: 'Company Name', value: profileFormState.companyName, max: INPUT_LIMITS.name },
    { label: 'POC Name', value: profileFormState.pocName, max: INPUT_LIMITS.contactName },
    { label: 'POC Detail', value: profileFormState.pocDetail, max: INPUT_LIMITS.contactValue },
  ])) return;

  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = {
    ...channel.value,
    ...profileFormState,
    cooperationModel: normalizeExclusiveSelection([...profileFormState.cooperationModel]),
    supportedProducts: [...profileFormState.supportedProducts],
    onboardingEntities: [...profileFormState.onboardingEntities],
    lastModifiedAt: time,
    auditLogs: [
      { time, user: currentActorName.value, action: 'Updated Corridor Profile', color: 'blue' },
      ...(channel.value.auditLogs || []),
    ],
  };
  store.updateChannel(updated);
  resetProfileForm(updated);
  message.success('Profile updated successfully');
  isEditingProfile.value = false;
};

const handleSaveCapability = () => {
  if (!ensureFiOperationAccess()) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Capability Link', value: capabilityFormState.capabilityLink, max: INPUT_LIMITS.url },
    { label: 'Capability Description', value: capabilityFormState.capabilityText, max: INPUT_LIMITS.longText },
    { label: 'Merchant Policy Link', value: capabilityFormState.merchantPolicyLink, max: INPUT_LIMITS.url },
    { label: 'Merchant Policy Remark', value: capabilityFormState.merchantPolicyRemark, max: INPUT_LIMITS.longText },
  ])) return;

  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const merchantGeoAllowed = cloneMerchantGeoSelections(capabilityFormState.merchantGeo);
  const updated = {
    ...channel.value,
    merchantGeoAllowed,
    merchantGeo: merchantGeoAllowed,
    capabilityText: capabilityFormState.capabilityText,
    capabilityLink: capabilityFormState.capabilityLink,
    merchantPolicyLink: capabilityFormState.merchantPolicyLink,
    merchantPolicyRemark: capabilityFormState.merchantPolicyRemark,
    lastModifiedAt: time,
  };
  store.updateChannel(updated);
  resetCapabilityForm(updated);
  message.success('Capability updated');
  isEditingCapability.value = false;
};

const handleSaveChargeback = () => {
  if (!ensureFiOperationAccess()) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Chargeback Remarks', value: chargebackFormState.chargebackRemarks, max: INPUT_LIMITS.note },
  ])) return;

  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = applyFundSourceChannelUpdate(
    channel.value,
    {
      ...chargebackFormState,
      chargebackHandling: [...new Set(chargebackFormState.chargebackHandling)],
    },
    currentActorName.value,
    time,
    'Updated Dispute SOP mirrored to fund review.',
  );
  store.updateChannel(updated);
  resetChargebackForm(updated);
  message.success('Dispute SOP updated');
  isEditingChargeback.value = false;
};

const handleSaveReconciliation = () => {
  if (!ensureFiOperationAccess()) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Reconciliation Method Detail', value: reconciliationFormState.reconMethodDetail, max: INPUT_LIMITS.longText },
    { label: 'Recharge Flow Remark', value: reconciliationFormState.rechargeFlowRemark, max: INPUT_LIMITS.longText },
    { label: 'Corridor Payout Account', value: reconciliationFormState.corridorPayoutAccount, max: INPUT_LIMITS.longText },
    { label: 'Sample Notes', value: reconciliationFormState.sampleNotes, max: INPUT_LIMITS.longText },
    ...reconciliationFormState.backendAccounts.flatMap((row, index) => [
      { label: `Backend Account ${index + 1} Environment Detail`, value: row.environmentDetail, max: INPUT_LIMITS.shortText },
      { label: `Backend Account ${index + 1} Legal Name`, value: row.legalName, max: INPUT_LIMITS.name },
      { label: `Backend Account ${index + 1} Trading Name`, value: row.tradingName, max: INPUT_LIMITS.name },
      { label: `Backend Account ${index + 1} Address`, value: row.address, max: INPUT_LIMITS.shortText },
      { label: `Backend Account ${index + 1} Account`, value: row.account, max: INPUT_LIMITS.shortText },
      { label: `Backend Account ${index + 1} Password`, value: row.password, max: INPUT_LIMITS.shortText },
      { label: `Backend Account ${index + 1} Remark`, value: row.remark, max: INPUT_LIMITS.note },
    ]),
  ])) return;

  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const backendAccounts = cloneBackendAccounts(reconciliationFormState.backendAccounts);
  const updated = applyFundSourceChannelUpdate(
    channel.value,
    {
      ...reconciliationFormState,
      reconMethods: [...reconciliationFormState.reconMethods],
      backendAccounts,
      rechargeFlowAttachments: normalizeAttachmentList(reconciliationFormState.rechargeFlowAttachments),
      corridorPayoutAccountAttachments: normalizeAttachmentList(reconciliationFormState.corridorPayoutAccountAttachments),
    },
    currentActorName.value,
    time,
    'Updated Reconciliation and Backend Account mirrored to fund review.',
  );
  store.updateChannel(updated);
  resetReconciliationForm(updated);
  message.success('Reconciliation updated');
  isEditingReconciliation.value = false;
};

const handleSaveTax = () => {
  if (!ensureFiOperationAccess()) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Tax Details', value: taxFormState.taxDetails, max: INPUT_LIMITS.longText },
  ])) return;

  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = { ...channel.value, ...taxFormState, lastModifiedAt: time };
  store.updateChannel(updated);
  resetTaxForm(updated);
  message.success('Tax configuration updated');
  isEditingTax.value = false;
};

const handleSaveMerchantMid = () => {
  if (!ensureFiOperationAccess()) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Merchant Onboarding Flow', value: merchantMidFormState.merchantMidDetails, max: INPUT_LIMITS.longText },
  ])) return;

  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = { ...channel.value, ...merchantMidFormState, lastModifiedAt: time };
  store.updateChannel(updated);
  resetMerchantMidForm(updated);
  message.success('Merchant Onboarding Flow updated');
  isEditingMerchantMid.value = false;
};

const handleSaveFiopTracking = () => {
  if (!ensureFiOperationAccess()) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Latest FIOP Tracking', value: fiopTrackingFormState.draftRemark, max: INPUT_LIMITS.note },
    ...fiopTrackingFormState.entries.map((entry, index) => ({
      label: `FIOP Tracking Note ${index + 1}`,
      value: entry.remark,
      max: INPUT_LIMITS.note,
    })),
  ])) return;

  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const savedEntriesById = new Map(
    cloneFiopTrackingEntries(channel.value.fiopTrackingEntries).map((entry) => [entry.id, entry]),
  );
  const normalizedEntries = fiopTrackingFormState.entries
    .map((entry) => ({
      id: entry.id,
      time: (() => {
        const nextRemark = entry.remark.trim();
        const savedEntry = savedEntriesById.get(entry.id);
        const remarkChanged = savedEntry ? savedEntry.remark.trim() !== nextRemark : true;

        return remarkChanged || !entry.time ? time : entry.time;
      })(),
      remark: entry.remark.trim(),
    }))
    .filter((entry) => entry.remark);
  const nextDraft = fiopTrackingFormState.draftRemark.trim();

  if (nextDraft) {
    normalizedEntries.unshift({
      id: `fiop-track-${Date.now()}`,
      time,
      remark: nextDraft,
    });
  }

  const updated = {
    ...channel.value,
    fiopTrackingEntries: normalizedEntries,
    lastModifiedAt: time,
    auditLogs: [
      { time, user: currentActorName.value, action: 'Updated FIOP Tracking', color: 'blue' },
      ...(channel.value.auditLogs || []),
    ],
  };

  store.updateChannel(updated);
  resetFiopTrackingForm(updated);
  message.success('FIOP tracking updated');
  isEditingFiopTracking.value = false;
};

const handleWorkflowNodeClick = (key: string) => {
  if (key === 'tech') return;

  if (isLaunchApprovalReadonlyDetail.value && ['fund', 'kyc', 'kyc-cdd', 'kyc-onboarding', 'legal'].includes(key)) {
    message.info('Launch approval details are read-only from this entry.');
    return;
  }

  if (key === 'fund') {
    if (!canOperateFiChannel.value) {
      message.info('Only assigned FIOP/FIBD users or FI Supervisor can open this fund review.');
      return;
    }
    store.openFundSubmit(channel.value, { returnView: 'detail' });
    return;
  }

  if (['kyc', 'kyc-cdd', 'kyc-onboarding'].includes(key) && !canOperateFiChannel.value) {
    message.info('Only assigned FIOP/FIBD users or the FI Supervisor can operate this workflow from corridor detail.');
    return;
  }

  if (key === 'kyc') {
    const preferredTrack = ['wooshpay', 'corridor'].find((track) => {
      const workflow = getChannelOnboardingWorkflow(channel.value, track as 'wooshpay' | 'corridor');
      return workflow.status === 'not_started' || isOnboardingFiActionStatus(track as 'wooshpay' | 'corridor', workflow.status);
    }) as 'wooshpay' | 'corridor' | undefined;

    store.openKycSubmit(channel.value, {
      track: preferredTrack || 'wooshpay',
      returnView: 'detail',
    });
    return;
  }

  if (key === 'kyc-cdd') {
    store.openKycSubmit(channel.value, {
      track: 'corridor',
      returnView: 'detail',
    });
    return;
  }

  if (key === 'kyc-onboarding') {
    store.openKycSubmit(channel.value, {
      track: 'wooshpay',
      returnView: 'detail',
    });
    return;
  }

  if (key === 'legal') {
    store.openLegalDetail('NDA', 'detail');
    return;
  }

  if (key === 'launch') {
    launchTimelineDrawerOpen.value = true;
    return;
  }

  if (['kyc-cdd', 'kyc-onboarding'].includes(key)) {
    activeWorkflowPanel.value = key as WorkflowPanelKey;
    return;
  }

  message.info(`Navigating to ${key} workflow`);
};

const handleCloseWorkflowPanel = () => {
  activeWorkflowPanel.value = null;
};

const handleWorkflowPanelSubmit = (payload: any) => {
  if (activeWorkflowPanel.value === 'kyc-cdd') {
    handleCddSubmit(payload);
    return;
  }

  if (activeWorkflowPanel.value === 'kyc-onboarding') {
    handleKycSubmit(payload);
    return;
  }
};

const handleCddSubmit = (values: any) => {
  if (!ensureFiOperationAccess()) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Contact Name', value: values.contactName, max: INPUT_LIMITS.contactName },
    { label: 'Contact Method', value: values.contactMethod, max: INPUT_LIMITS.contactMethod },
    { label: 'Contact Detail', value: values.contactValue, max: INPUT_LIMITS.contactValue },
    { label: 'What Compliance should know', value: values.handoffNote, max: INPUT_LIMITS.note },
  ])) return;

  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = {
    ...applyOnboardingSubmission(channel.value, 'corridor', {
      contactName: values.contactName,
      contactMethod: values.contactMethod,
      contactValue: values.contactValue,
      handoffNote: values.handoffNote,
      notes: values.handoffNote,
      documentLink: '',
      attachments: [],
    }, currentActorName.value, timestamp),
    pocName: values.contactName,
    pocMethod: values.contactMethod,
    pocDetail: values.contactValue,
    auditLogs: [
      { time: timestamp, user: currentActorName.value, action: 'Submitted Corridor onboarding details to Compliance.', color: 'blue' },
      ...(channel.value.auditLogs || [])
    ]
  };
  store.updateChannel(updated);
};

const handleCddRevoke = () => {
  if (!ensureFiOperationAccess()) return;
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = revokeOnboardingPendingHandoff(channel.value, 'corridor', 'FIOP', currentActorName.value, timestamp);
  store.updateChannel(updated);
  message.success('Corridor onboarding send revoked.');
};

const handleKycSubmit = (values: any) => {
  if (!ensureFiOperationAccess()) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Document Link', value: values.documentLink, max: INPUT_LIMITS.url },
    { label: 'Additional Notes', value: values.notes, max: INPUT_LIMITS.note },
  ])) return;

  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = {
    ...applyOnboardingSubmission(channel.value, 'wooshpay', {
      entities: values.entities,
      documentLink: values.documentLink,
      notes: values.notes,
      attachments: values.attachments,
    }, currentActorName.value, timestamp),
    auditLogs: [
      { time: timestamp, user: currentActorName.value, action: 'Submitted WooshPay onboarding details to Compliance.', color: 'blue' },
      ...(channel.value.auditLogs || [])
    ]
  };
  store.updateChannel(updated);
};

const handleKycRevoke = () => {
  if (!ensureFiOperationAccess()) return;
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = revokeOnboardingPendingHandoff(channel.value, 'wooshpay', 'FIOP', currentActorName.value, timestamp);
  store.updateChannel(updated);
  message.success('WooshPay onboarding send revoked.');
};

const handleSubmitFundReview = () => {
  if (!ensureFiOperationAccess()) return;
  if (!canSubmitFundReview.value) {
    message.warning(fundSubmitBlockReason.value || 'This fund review cannot be submitted in its current status.');
    return;
  }
  if (showTextLimitWarning(message.warning, [
    { label: 'Fund Submission Note', value: fundSubmissionNote.value, max: INPUT_LIMITS.note },
  ])) return;

  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = applyFundReviewSubmission(
    channel.value,
    currentActorName.value,
    time,
    fundSubmissionNote.value,
  );
  store.updateChannel(updated);
  message.success('Fund review submitted.');
  isFundSubmitModalVisible.value = false;
  fundSubmissionNote.value = '';
};

const handleConfirmSuspend = () => {
  if (!ensureFiOperationAccess()) return;
  if (showTextLimitWarning(message.warning, [
    { label: 'Suspend Remarks', value: lostRemarks.value, max: INPUT_LIMITS.note },
  ])) return;

  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = { 
    ...channel.value, 
    status: lostReason.value,
    lastModifiedAt: time,
    auditLogs: [
      { time, user: currentActorName.value, action: `Marked corridor as ${lostReason.value}.${lostRemarks.value ? ` ${lostRemarks.value}` : ''}`, color: 'red' },
      ...(channel.value.auditLogs || [])
    ]
  };
  store.updateChannel(updated);
  message.success('Corridor status updated successfully.');
  isSuspendModalVisible.value = false;
};

</script>

<template>
  <a-layout
    class="fitrem-detail-layout"
    :style="{
      background: '#ffffff',
      height: `calc(100vh - ${props.topOffset}px)`,
      overflow: 'hidden',
      fontFamily: appFontFamily,
    }"
  >
    <!-- 侧边栏导航 -->
    <a-layout-sider
      width="280"
      :style="{
        background: '#ffffff',
        borderRight: `1px solid ${colors.border}`,
        height: `calc(100vh - ${props.topOffset}px)`,
        position: 'fixed',
        left: 0,
        top: `${props.topOffset}px`,
        zIndex: 10,
        padding: '24px 14px',
      }"
    >
      <div class="mb-4 px-3">
        <div class="flex flex-col gap-1.5">
          <button
            v-for="section in sectionConfigs"
            :key="section.key"
            type="button"
            @click="attemptNavigateToSection(section.key)"
            class="w-full text-left flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative group"
            :style="{
              background: activeSection === section.key ? '#f0f7ff' : 'transparent',
            }"
          >
            <!-- Active indicator bar -->
            <div 
              v-if="activeSection === section.key"
              class="absolute left-0 top-2 bottom-2 w-[3px] bg-sky-600 rounded-r-full"
            ></div>

            <div class="flex items-center gap-3">
              <span :style="{ color: activeSection === section.key ? '#0284c7' : '#64748b' }">
                <component :is="section.icon" />
              </span>
              <span class="text-[13px] font-bold" :style="{ color: activeSection === section.key ? '#0284c7' : '#0f172a' }">
                {{ section.label }}
              </span>
            </div>
            
            <!-- 状态指示器 -->
            <div class="flex items-center justify-center">
              <div v-if="section.key !== 'capability' && section.key !== 'reconciliation'" 
                class="w-[18px] h-[18px] rounded-full bg-emerald-500 flex items-center justify-center"
              >
                <check-circle-filled :style="{ color: '#ffffff', fontSize: '11px' }" />
              </div>
              <div v-else 
                class="w-[18px] h-[18px] rounded-full border-2 border-slate-200 bg-white"
              ></div>
            </div>
          </button>
        </div>
      </div>
    </a-layout-sider>

    <a-layout-content
      class="fitrem-detail-content"
      :style="{
        marginLeft: '280px',
        padding: '32px',
        height: `calc(100vh - ${props.topOffset}px)`,
        overflow: 'hidden',
        background: '#ffffff',
      }"
    >
      <div
        :style="{
          display: 'grid',
          gridTemplateColumns: isWorkflowPanelOpen
            ? (isKycWorkflowPanel
                ? 'minmax(0, 1fr) clamp(420px, 34vw, 476px)'
                : 'minmax(0, 1fr) clamp(392px, 31vw, 438px)')
            : 'minmax(0, 1fr)',
          gap: isWorkflowPanelOpen ? (isKycWorkflowPanel ? '28px' : '24px') : '0px',
          width: '100%',
          height: '100%',
          minWidth: 0,
          transition: 'grid-template-columns 0.22s ease, gap 0.22s ease',
        }"
      >
      <div
        class="fitrem-detail-main"
        :style="{
          minWidth: 0,
          height: '100%',
          overflowY: 'auto',
          scrollBehavior: 'smooth',
          paddingRight: isWorkflowPanelOpen ? (isKycWorkflowPanel ? '8px' : '4px') : '0px',
        }"
        @scroll="handleContentScroll"
      >
      <div style="width: min(100%, 1360px); margin: 0 auto 0 0; display: flex; flex-direction: column; gap: 24px;">
        <!-- Overview Section -->
        <div :ref="sectionRefs.overview" id="section-overview">
          <div class="space-y-6">
            <!-- Banner Card -->
            <a-card
              class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden"
              :body-style="{ padding: '32px' }"
            >
              <div class="flex justify-between items-start gap-8 mb-10">
                <div class="flex-1">
                <div class="mb-4">
                    <a-tag :style="buildCorridorStatusTagStyle(channel.status)" class="border-none">
                      {{ channel.status || 'Live' }}
                    </a-tag>
                  </div>
                  <h1 class="text-[32px] font-black text-slate-900 leading-tight m-0 mb-3 tracking-tight" :style="{ fontFamily: titleFontFamily }">
                    {{ channel.channelName }}
                  </h1>
                  <p class="text-slate-500 text-[15px] leading-relaxed max-w-2xl m-0 font-medium">
                    {{ companySummary }}<template v-if="channel.registrationGeo"> registered in {{ channel.registrationGeo }}</template>, operating as {{ cooperationSummary }}.
                  </p>
                </div>

                <div 
                  class="flex-none w-[280px] p-5 rounded-2xl bg-slate-50/50 border border-slate-100/80 cursor-pointer hover:bg-sky-50 transition-all text-left"
                  @click="isHistorySidebarVisible = true"
                >
                  <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Updated</div>
                  <div class="text-[16px] font-black text-slate-900">{{ channel.lastModifiedAt || '2026-03-18 16:20:00' }}</div>
                  <div class="mt-2 text-[12px] font-black text-sky-600 flex items-center gap-1">
                    View modification history
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-6 xl:grid-cols-5">
                <div v-for="item in [
                  { label: 'FIOP', value: fiopAssignmentSummary },
                  { label: 'FIBD', value: fibdAssignmentSummary },
                  { label: 'Supported Merchant Jurisdictions', value: merchantGeoAllowedSummary },
                  { label: 'Cooperation Model', value: Array.isArray(channel.cooperationModel) && channel.cooperationModel.length ? channel.cooperationModel[0] : (channel.cooperationModel || 'Pending') },
                  { label: 'Products', value: productSummary }
                ]" :key="item.label" class="p-5 rounded-2xl bg-slate-50/50 border border-slate-100/80">
                  <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{{ item.label }}</div>
                  <div :class="overviewMetricValueClass" :style="overviewMetricValueStyle">{{ formatOverviewMetricValue(item.value) }}</div>
                </div>
              </div>
            </a-card>

            <!-- Workflow Board -->
            <WorkflowBoard 
              :channel="channel"
              :globalProgress="channel.globalProgress" 
              :submissionHistory="channel.submissionHistory"
              :pricingSummary="pricingScheduleSummary"
              :pricingUpdatedAt="latestPricingScheduleUpdatedAt"
              @nodeClick="handleWorkflowNodeClick" 
            />
          </div>
        </div>

        <!-- Profile Section -->
        <div :ref="sectionRefs.profile" id="section-profile" class="mb-4">
          <div class="flex justify-between items-center mb-4 px-1">
            <h3 class="text-[20px] font-black text-slate-900 m-0">Corridor Profile</h3>
            <a-space size="middle">
              <a-button v-if="isEditingProfile" size="small" type="text" @click="handleDiscardProfile" class="font-bold text-slate-500">Discard</a-button>
              <a-button v-if="isEditingProfile" type="primary" size="small" @click="handleSaveProfile" class="rounded-lg px-6 h-9 font-bold shadow-md shadow-sky-100">Save</a-button>
              <a-button v-else-if="canOperateFiChannel" type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingProfile = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <div class="mb-8">
              <h4 class="text-[18px] font-black text-slate-900 m-0">Basic Information</h4>
            </div>
            
            <a-form layout="vertical">
              <a-row :gutter="[32, 28]">
                <a-col :span="8">
                  <a-form-item extra="Internal display name for this corridor.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Corridor Name</span></template>
                    <a-input v-model:value="profileFormState.channelName" :maxlength="INPUT_LIMITS.name" :readonly="!isEditingProfile" class="rounded-lg border-slate-200 h-[40px] flex items-center" :class="!isEditingProfile ? 'bg-slate-50' : 'bg-white'" />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item extra="System-generated unique identifier.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Corridor ID</span></template>
                    <a-input v-model:value="profileFormState.channelId" :maxlength="INPUT_LIMITS.idCode" readonly class="rounded-lg border-slate-100 bg-slate-50 text-slate-400 font-mono h-[40px] flex items-center" />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item extra="Official registered name for contracting and compliance.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Company Name</span></template>
                    <a-input v-model:value="profileFormState.companyName" :maxlength="INPUT_LIMITS.name" :readonly="!isEditingProfile" class="rounded-lg border-slate-200 h-[40px] flex items-center" :class="!isEditingProfile ? 'bg-slate-50' : 'bg-white'" />
                  </a-form-item>
                </a-col>
                
                <a-col :span="8">
                  <a-form-item>
                    <template #label>
                      <a-space size="4">
                        <span class="text-[13px] font-bold text-slate-700">Country of Incorporation</span>
                        <info-circle-outlined class="text-slate-400 text-[12px]" />
                      </a-space>
                    </template>
                    <div class="flex gap-0 h-[40px] w-full items-stretch">
                      <!-- 大洲选择：固定宽度 110px，禁止缩放 -->
                      <a-select 
                        v-model:value="profileFormState.registrationContinent" 
                        :disabled="!isEditingProfile" 
                        class="custom-select-height-left shrink-0" 
                        style="width: 110px; flex: 0 0 110px;"
                        placeholder="Continent"
                        @change="handleContinentChange"
                      >
                        <a-select-option v-for="(_, continent) in geoData" :key="continent" :value="continent">{{ continent }}</a-select-option>
                      </a-select>
                      
                      <!-- 国家选择：自适应剩余空间 -->
                      <a-select 
                        v-model:value="profileFormState.registrationGeo" 
                        :disabled="!isEditingProfile || !profileFormState.registrationContinent" 
                        class="flex-1 custom-select-height-right min-w-0" 
                        placeholder="Country"
                        show-search
                        :filter-option="(input: string, option: any) => option.value.toLowerCase().includes(input.toLowerCase())"
                      >
                        <a-select-option v-for="country in registrationCountries" :key="country" :value="country">{{ country }}</a-select-option>
                      </a-select>
                    </div>
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item extra="Confirmed commercial setup (e.g., PayFac, Referral, MoR).">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Cooperation Model</span></template>
                    <a-select
                      v-model:value="profileFormState.cooperationModel"
                      mode="multiple"
                      :disabled="!isEditingProfile"
                      class="w-full custom-select-height"
                      placeholder="Select model"
                      @change="handleProfileCooperationModelChange"
                    >
                      <a-select-option value="Referral">Referral</a-select-option>
                      <a-select-option value="PayFac">PayFac</a-select-option>
                      <a-select-option value="MoR">MoR</a-select-option>
                      <a-select-option value="I'm not sure yet">I'm not sure yet</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item extra="Product lines confirmed for this corridor.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Supported Products</span></template>
                    <a-select v-model:value="profileFormState.supportedProducts" mode="multiple" :disabled="!isEditingProfile" class="w-full custom-select-height" placeholder="Select products">
                      <a-select-option v-for="option in supportedProductOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>

                <a-col :span="12">
                  <a-form-item extra="Main point of contact for daily operations.">
                    <template #label>
                      <a-space size="4">
                        <span class="text-red-500">*</span>
                        <span class="text-[13px] font-bold text-slate-700">General Contact</span>
                      </a-space>
                    </template>
                    <div class="flex gap-0 h-[40px] w-full items-stretch">
                      <!-- 姓名输入框：固定宽度 120px，禁止缩放 -->
                      <a-input 
                        v-model:value="profileFormState.pocName" 
                        :maxlength="INPUT_LIMITS.contactName"
                        :readonly="!isEditingProfile" 
                        class="shrink-0 rounded-l-lg border-slate-200 h-full flex items-center" 
                        :class="!isEditingProfile ? 'bg-slate-50' : 'bg-white'" 
                        style="width: 120px; flex: 0 0 120px;"
                        placeholder="Name" 
                      />
                      
                      <!-- 中间下拉框：极窄固定宽度 95px，禁止缩放 -->
                      <a-select 
                        v-model:value="profileFormState.pocMethod" 
                        :disabled="!isEditingProfile" 
                        class="custom-select-height-middle shrink-0"
                        style="width: 95px; flex: 0 0 95px;"
                        @change="handlePocMethodChange"
                      >
                        <a-select-option v-for="opt in contactMethodOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
                      </a-select>
                      
                      <!-- 右侧详情输入框：自适应剩余空间 -->
                      <a-input 
                        v-model:value="profileFormState.pocDetail" 
                        :maxlength="INPUT_LIMITS.contactValue"
                        :readonly="!isEditingProfile" 
                        class="flex-1 min-w-0 rounded-r-lg border-l-0 border-slate-200 h-full flex items-center" 
                        :class="!isEditingProfile ? 'bg-slate-50' : 'bg-white'" 
                        :placeholder="pocPlaceholder" 
                      />
                    </div>
                  </a-form-item>
                </a-col>

                <a-col :span="12">
                  <a-form-item extra="Default to SwooshTransfer Ltd (UK) unless specified by the corridor.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">WooshPay Contracting Entity</span></template>
                    <a-checkbox-group v-model:value="profileFormState.onboardingEntities" :disabled="!isEditingProfile" class="w-full">
                      <div class="flex flex-col gap-3 mt-1">
                        <a-checkbox v-for="opt in onboardingEntityOptions" :key="opt" :value="opt" class="m-0">
                          <span class="text-[13px] font-medium text-slate-600">{{ opt }}</span>
                        </a-checkbox>
                      </div>
                    </a-checkbox-group>
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-card>
        </div>
        

        <!-- Capability Section -->
        <div :ref="sectionRefs.capability" id="section-capability" class="mb-4">
          <div class="flex justify-between items-center mb-4 px-1">
            <h3 class="text-[20px] font-black text-slate-900 m-0">Capability</h3>
            <a-space size="middle">
              <a-button v-if="isEditingCapability" size="small" type="text" @click="handleDiscardCapability" class="font-bold text-slate-500">Discard</a-button>
              <a-button v-if="isEditingCapability" type="primary" size="small" @click="handleSaveCapability" class="rounded-lg px-6 h-9 font-bold shadow-md shadow-sky-100">Save</a-button>
              <a-button v-else-if="canOperateFiChannel" type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingCapability = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <div class="mb-8 space-y-2">
              <h4 class="text-[18px] font-black text-slate-900 m-0">Capabilities & Policies</h4>
              <p class="text-[14px] text-slate-500 m-0 font-medium">Overview of supported payment methods, geographical coverage, and compliance restrictions.</p>
            </div>

            <a-form layout="vertical" class="space-y-6">
              <div class="rounded-3xl border border-slate-100 bg-slate-50/70 p-6">
                <a-form-item extra="Countries or regions where merchants can be supported by this corridor." class="mb-0">
                  <template #label><span class="text-[13px] font-bold text-slate-700">Supported Merchant Jurisdictions</span></template>
                  <a-cascader
                    v-model:value="capabilityFormState.merchantGeo"
                    multiple
                    :options="merchantGeoOptions"
                    :disabled="!isEditingCapability"
                    placeholder="Select allowed regions"
                    class="w-full custom-cascader-multi"
                    expand-trigger="hover"
                    :show-search="{ filter: (inputValue: string, path: Array<{ label: string }>) => path.some((option: { label: string }) => String(option.label).toLowerCase().includes(inputValue.toLowerCase())) }"
                  />
                </a-form-item>
              </div>

              <div class="rounded-3xl border border-slate-100 bg-slate-50/70 p-6">
                <div class="mb-5">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Service Coverage Details</div>
                  <p class="text-[12px] text-slate-500 mt-2 mb-0 font-medium">Upload or link the corridor's official capability deck or coverage matrix.</p>
                </div>
                <div class="space-y-4">
                  <a-upload v-if="isEditingCapability">
                    <a-button class="h-9 px-4 rounded-lg font-bold"><template #icon><plus-outlined /></template>Upload Document</a-button>
                  </a-upload>
                  <a-input v-model:value="capabilityFormState.capabilityLink" :maxlength="INPUT_LIMITS.url" :readonly="!isEditingCapability" class="rounded-lg border-slate-200 h-[40px] flex items-center" :class="!isEditingCapability ? 'bg-white/70' : 'bg-white'" placeholder="e.g., API docs or internal capability Notion link (optional)" />
                  <a-textarea v-model:value="capabilityFormState.capabilityText" :maxlength="INPUT_LIMITS.longText" :readonly="!isEditingCapability" :rows="4" show-count class="rounded-xl border-slate-200 p-3" :class="!isEditingCapability ? 'bg-white/70' : 'bg-white'" placeholder="Briefly outline supported payment methods, payout networks, settlement cycle and key technical features." />
                </div>
              </div>

              <div class="rounded-3xl border border-slate-100 bg-slate-50/70 p-6">
                <div class="mb-5">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Prohibited & Restricted Businesses</div>
                  <p class="text-[12px] text-slate-500 mt-2 mb-0 font-medium">Official guidelines on prohibited industries, high-risk merchants, and restricted regions.</p>
                </div>
                <div class="space-y-4">
                  <a-upload v-if="isEditingCapability">
                    <a-button class="h-9 px-4 rounded-lg font-bold"><template #icon><plus-outlined /></template>Upload Document</a-button>
                  </a-upload>
                  <a-input v-model:value="capabilityFormState.merchantPolicyLink" :maxlength="INPUT_LIMITS.url" :readonly="!isEditingCapability" class="rounded-lg border-slate-200 h-[40px] flex items-center" :class="!isEditingCapability ? 'bg-white/70' : 'bg-white'" placeholder="e.g., Official policy document URL (optional)" />
                  <a-textarea v-model:value="capabilityFormState.merchantPolicyRemark" :maxlength="INPUT_LIMITS.longText" :readonly="!isEditingCapability" :rows="4" show-count class="rounded-xl border-slate-200 p-3" :class="!isEditingCapability ? 'bg-white/70' : 'bg-white'" placeholder="Highlight key restricted business types (e.g., Crypto, Gaming) or prohibited geographies." />
                </div>
              </div>
            </a-form>
          </a-card>
        </div>

        <!-- Dispute SOP Section -->
        <div :ref="sectionRefs.chargeback" id="section-chargeback" class="mb-4">
          <div class="flex justify-between items-center mb-4 px-1">
            <h3 class="text-[20px] font-black text-slate-900 m-0">Dispute SOP</h3>
            <a-space size="middle">
              <a-button v-if="isEditingChargeback" size="small" type="text" @click="handleDiscardChargeback" class="font-bold text-slate-500">Discard</a-button>
              <a-button v-if="isEditingChargeback" type="primary" size="small" @click="handleSaveChargeback" class="rounded-lg px-6 h-9 font-bold shadow-md shadow-sky-100">Save</a-button>
              <a-button v-else-if="canOperateFiChannel" type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingChargeback = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <div class="mb-8">
              <h4 class="text-[18px] font-black text-slate-900 m-0">Chargeback Handling</h4>
            </div>
            
            <a-form layout="vertical">
              <a-row :gutter="[32, 28]">
                <a-col :span="24">
                  <a-form-item>
                    <template #label><span class="text-[13px] font-bold text-slate-700">Dispute Handling Channel</span></template>
                    <a-checkbox-group v-model:value="chargebackFormState.chargebackHandling" :disabled="!isEditingChargeback" class="flex flex-wrap gap-8 mt-2">
                      <a-checkbox
                        v-for="option in chargebackHandlingOptions"
                        :key="option.value"
                        :value="option.value"
                        class="font-bold text-slate-600"
                      >
                        {{ option.label }}
                      </a-checkbox>
                    </a-checkbox-group>
                    <div class="mt-3 text-[12px] text-slate-400 font-medium">Select one or more channels currently used for dispute handling.</div>
                  </a-form-item>
                </a-col>
                <a-col :span="24">
                  <a-form-item extra="Keep the dispute handling path aligned with the current operating workflow and source-of-truth doc.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Handling Notes & References</span></template>
                    <a-textarea v-model:value="chargebackFormState.chargebackRemarks" :maxlength="INPUT_LIMITS.note" :readonly="!isEditingChargeback" :rows="4" show-count class="rounded-xl border-slate-200 p-3" :class="!isEditingChargeback ? 'bg-slate-50' : 'bg-white'" placeholder="Paste Feishu link for the dispute SOP or add short handling notes..." />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
          </a-card>
        </div>

        <!-- Reconciliation Section -->
        <div :ref="sectionRefs.reconciliation" id="section-reconciliation" class="mb-4">
          <div class="flex justify-between items-center mb-4 px-1">
            <h3 class="text-[20px] font-black text-slate-900 m-0">Reconciliation</h3>
            <a-space size="middle">
              <a-button v-if="isEditingReconciliation" size="small" type="text" @click="handleDiscardReconciliation" class="font-bold text-slate-500">Discard</a-button>
              <a-button v-if="isEditingReconciliation" type="primary" size="small" @click="handleSaveReconciliation" class="rounded-lg px-6 h-9 font-bold shadow-md shadow-sky-100">Save</a-button>
              <a-button v-else-if="canOperateFiChannel" type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingReconciliation = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <div class="mb-6">
              <h4 class="text-[18px] font-black text-slate-900 m-0">Data Acquisition Method</h4>
              <p class="text-slate-500 text-[14px] mt-2 font-medium">Select applicable file retrieval methods.</p>
            </div>
            
            <a-form layout="vertical">
              <div class="mb-10">
                <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest mb-4">Acquisition Method</div>
                <a-checkbox-group v-model:value="reconciliationFormState.reconMethods" :disabled="!isEditingReconciliation" class="w-full">
                  <div class="grid grid-cols-3 gap-6">
                    <div v-for="method in [
                      { key: 'API', desc: 'Fetch reconciliation files or raw data through an API endpoint.' },
                      { key: 'Portal', desc: 'Download files manually from the corridor portal.' },
                      { key: 'SFTP', desc: 'Receive files through an agreed SFTP path.' },
                      { key: 'Email', desc: 'Receive recurring files by email from the corridor team.' },
                      { key: 'Other', desc: 'Use another method that needs to be documented in notes.' }
                    ]" :key="method.key" class="p-5 rounded-2xl border border-slate-100 transition-all" :class="reconciliationFormState.reconMethods.includes(method.key) ? 'bg-sky-50 border-sky-200' : 'bg-slate-50/30'">
                      <a-checkbox :value="method.key">
                        <span class="font-black text-slate-900">{{ method.key }}</span>
                      </a-checkbox>
                      <p class="text-[12px] text-slate-500 mt-2 mb-0 leading-relaxed font-medium">{{ method.desc }}</p>
                    </div>
                  </div>
                </a-checkbox-group>
                <div class="mt-4 text-[12px] text-slate-400 font-medium">Select every method currently used to obtain reconciliation files. Multiple methods can be active at the same time.</div>
                <div class="reconciliation-detail-card mt-6">
                  <div class="font-black text-slate-900 text-[13px] mb-3 uppercase tracking-widest">Detail</div>
                  <a-textarea
                    v-model:value="reconciliationFormState.reconMethodDetail"
                    :maxlength="INPUT_LIMITS.longText"
                    :readonly="!isEditingReconciliation"
                    :rows="4"
                    show-count
                    class="rounded-2xl border-slate-200 p-4"
                    :class="!isEditingReconciliation ? 'bg-slate-50' : 'bg-white'"
                    placeholder="Add acquisition detail"
                  />
                </div>
              </div>

              <div class="space-y-8">
                <div class="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                  <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div class="min-w-0">
                      <div class="text-[16px] font-black text-slate-900 leading-none">Backend Account</div>
                    </div>
                    <a-button
                      v-if="isEditingReconciliation"
                      size="small"
                      class="h-8 rounded-lg border-slate-200 px-3 text-[12px] font-bold text-slate-600"
                      @click="handleAddBackendAccountRow"
                    >
                      <template #icon><plus-outlined /></template>
                      Add row
                    </a-button>
                  </div>

                  <div class="backend-account-table-shell">
                    <div class="backend-account-table-scroll">
                      <table class="backend-account-table">
                        <colgroup>
                          <col style="width: 170px" />
                          <col style="width: 260px" />
                          <col style="width: 240px" />
                          <col style="width: 220px" />
                          <col style="width: 320px" />
                          <col style="width: 220px" />
                          <col style="width: 180px" />
                          <col v-if="isEditingReconciliation" style="width: 56px" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>
                              <div class="backend-account-table__header">
                                <span>Environment Type</span>
                                <a-tooltip :title="backendAccountEnvironmentTooltip">
                                  <info-circle-outlined class="backend-account-table__info" />
                                </a-tooltip>
                              </div>
                            </th>
                            <th>Environment Detail</th>
                            <th>
                              <div class="backend-account-table__header">
                                <span>Merchant Legal Name</span>
                                <a-tooltip :title="backendAccountLegalNameTooltip">
                                  <info-circle-outlined class="backend-account-table__info" />
                                </a-tooltip>
                              </div>
                            </th>
                            <th>Merchant Trading Name</th>
                            <th>Address</th>
                            <th>Account</th>
                            <th>Password</th>
                            <th v-if="isEditingReconciliation" class="backend-account-table__action-head">
                              <span class="backend-account-table__action-label">Delete</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <template
                            v-for="(row, index) in reconciliationFormState.backendAccounts"
                            :key="`backend-account-${index}`"
                          >
                            <tr class="backend-account-table__row">
                              <td>
                                <a-select
                                  v-if="isEditingReconciliation"
                                  v-model:value="row.environmentType"
                                  :options="backendAccountEnvironmentOptions"
                                  allow-clear
                                  :placeholder="backendAccountPlaceholders.environmentType"
                                  class="backend-account-table__select w-full"
                                />
                                <div v-else class="backend-account-table__text">{{ row.environmentType }}</div>
                              </td>
                              <td>
                                <a-input
                                  v-if="isEditingReconciliation"
                                  v-model:value="row.environmentDetail"
                                  :maxlength="INPUT_LIMITS.shortText"
                                  :placeholder="backendAccountPlaceholders.environmentDetail"
                                  class="backend-account-table__input"
                                />
                                <div v-else class="backend-account-table__text">{{ row.environmentDetail }}</div>
                              </td>
                              <td>
                                <a-input
                                  v-if="isEditingReconciliation"
                                  v-model:value="row.legalName"
                                  :maxlength="INPUT_LIMITS.name"
                                  :placeholder="backendAccountPlaceholders.legalName"
                                  class="backend-account-table__input"
                                />
                                <div v-else class="backend-account-table__text">{{ row.legalName }}</div>
                              </td>
                              <td>
                                <a-input
                                  v-if="isEditingReconciliation"
                                  v-model:value="row.tradingName"
                                  :maxlength="INPUT_LIMITS.name"
                                  :placeholder="backendAccountPlaceholders.tradingName"
                                  class="backend-account-table__input"
                                />
                                <div v-else class="backend-account-table__text">{{ row.tradingName }}</div>
                              </td>
                              <td>
                                <a-input
                                  v-if="isEditingReconciliation"
                                  v-model:value="row.address"
                                  :maxlength="INPUT_LIMITS.shortText"
                                  :placeholder="backendAccountPlaceholders.address"
                                  class="backend-account-table__input"
                                />
                                <a
                                  v-else-if="row.address"
                                  :href="resolveBackendAccountAddressHref(row.address)"
                                  target="_blank"
                                  rel="noreferrer"
                                  class="backend-account-table__link"
                                >
                                  {{ row.address }}
                                </a>
                                <div v-else class="backend-account-table__text"></div>
                              </td>
                              <td>
                                <a-input
                                  v-if="isEditingReconciliation"
                                  v-model:value="row.account"
                                  :maxlength="INPUT_LIMITS.shortText"
                                  :placeholder="backendAccountPlaceholders.account"
                                  class="backend-account-table__input"
                                />
                                <div v-else class="backend-account-table__text">{{ row.account }}</div>
                              </td>
                              <td>
                                <a-input
                                  v-if="isEditingReconciliation"
                                  v-model:value="row.password"
                                  :maxlength="INPUT_LIMITS.shortText"
                                  :placeholder="backendAccountPlaceholders.password"
                                  class="backend-account-table__input"
                                />
                                <div v-else class="backend-account-table__text">{{ maskPassword(row.password) }}</div>
                              </td>
                              <td
                                v-if="isEditingReconciliation"
                                class="backend-account-table__action-cell"
                              >
                                <a-tooltip title="Delete row">
                                  <a-button
                                    type="text"
                                    size="small"
                                    aria-label="Delete row"
                                    class="backend-account-table__delete text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                                    @click="handleRemoveBackendAccountRow(index)"
                                  >
                                    <template #icon><delete-outlined /></template>
                                  </a-button>
                                </a-tooltip>
                              </td>
                            </tr>
                            <tr class="backend-account-table__remark-row">
                              <td :colspan="isEditingReconciliation ? 8 : 7" class="backend-account-table__remark-cell">
                                <div class="backend-account-table__remark-label">Remarks</div>
                                <a-textarea
                                  v-if="isEditingReconciliation"
                                  v-model:value="row.remark"
                                  :maxlength="INPUT_LIMITS.note"
                                  :auto-size="{ minRows: 3, maxRows: 6 }"
                                  show-count
                                  :placeholder="backendAccountPlaceholders.remark"
                                  class="backend-account-table__remark-field"
                                />
                                <div v-else class="backend-account-table__remark-copy">{{ row.remark || 'No remarks provided.' }}</div>
                              </td>
                            </tr>
                          </template>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest mb-1">Recharge Flow</div>
                  <p class="text-[12px] text-slate-400 mb-8 font-medium">Process for funding the corridor from our side, including negative balances, pre-funding, and other fee payments.</p>

                  <div class="grid grid-cols-2 gap-10">
                    <a-form-item class="mb-0">
                      <template #label><span class="text-[13px] font-black text-slate-700">Remark</span></template>
                      <a-textarea
                        v-model:value="reconciliationFormState.rechargeFlowRemark"
                        :maxlength="INPUT_LIMITS.longText"
                        :readonly="!isEditingReconciliation"
                        :rows="4"
                        show-count
                        class="rounded-2xl border-slate-200 p-4"
                        :class="!isEditingReconciliation ? 'bg-white/50' : 'bg-white'"
                        placeholder="Describe recharge scenarios, funding steps, owners, timing, required references, and exception handling..."
                      />
                    </a-form-item>

                    <a-form-item class="mb-0">
                      <template #label><span class="text-[13px] font-black text-slate-700">Upload Files</span></template>
                      <div class="mt-2">
                        <a-upload
                          v-if="isEditingReconciliation"
                          multiple
                          :accept="reconciliationAttachmentAccept"
                          :before-upload="preventReconciliationAttachmentUpload"
                          :file-list="reconciliationFormState.rechargeFlowAttachments"
                          :show-upload-list="false"
                          @change="handleRechargeFlowAttachmentChange"
                        >
                          <a-button class="h-10 px-6 rounded-xl font-black flex items-center gap-2">
                            <template #icon><plus-outlined /></template>
                            Upload Files
                          </a-button>
                        </a-upload>
                        <div v-else-if="!reconciliationFormState.rechargeFlowAttachments.length" class="h-10 flex items-center px-4 rounded-xl bg-white/50 border border-slate-200 text-slate-400 italic text-[13px]">
                          No recharge files uploaded
                        </div>
                      </div>
                      <p class="text-[12px] text-slate-400 mt-4 mb-0 font-medium">Support PDF, Word, Excel/CSV, and photo files. Multiple attachments can be added for recharge evidence.</p>

                      <div v-if="reconciliationFormState.rechargeFlowAttachments.length" class="mt-4 space-y-3">
                        <div
                          v-for="file in reconciliationFormState.rechargeFlowAttachments"
                          :key="file.uid"
                          class="rounded-[18px] border border-slate-200 bg-white px-4 py-3"
                        >
                          <div class="flex items-start gap-3">
                            <button
                              type="button"
                              class="flex min-w-0 flex-1 items-start gap-3 border-0 bg-transparent p-0 text-left"
                              @click="openAttachment(file)"
                            >
                              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                                <file-text-outlined class="text-[16px]" />
                              </div>
                              <div class="min-w-0 flex-1">
                                <div class="truncate text-[13px] font-black text-slate-900">{{ file.name }}</div>
                                <div class="mt-1 text-[11px] font-semibold text-slate-400">{{ formatAttachmentKind(file) }} / {{ formatAttachmentSize(file.size) }}</div>
                                <div class="mt-1 text-[11px] font-semibold" :class="canOpenAttachment(file) ? 'text-sky-600' : 'text-slate-400'">
                                  {{ canOpenAttachment(file) ? 'Click to open' : 'Re-upload in this session to open' }}
                                </div>
                              </div>
                            </button>
                            <a-button
                              v-if="isEditingReconciliation"
                              type="text"
                              size="small"
                              class="text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                              @click="handleRemoveRechargeFlowAttachment(file.uid)"
                            >
                              <template #icon><delete-outlined /></template>
                            </a-button>
                          </div>
                        </div>
                      </div>
                    </a-form-item>
                  </div>
                </div>

                <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                  <a-form-item>
                    <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Settlement Account Details</span></template>
                    <a-textarea v-model:value="reconciliationFormState.corridorPayoutAccount" :maxlength="INPUT_LIMITS.longText" :readonly="!isEditingReconciliation" :rows="3" show-count class="rounded-2xl border-slate-200 p-4" :class="!isEditingReconciliation ? 'bg-white/50' : 'bg-white'" placeholder="Account details for corridor payouts..." />
                  </a-form-item>

                  <div class="mt-8">
                    <p class="text-[12px] text-slate-400 mb-4 font-medium">Support PDF, Word, Excel/CSV, and photo files. Multiple attachments can be added for verification.</p>
                    <a-upload-dragger
                      v-if="isEditingReconciliation"
                      class="bg-white rounded-2xl border-slate-200 border-2"
                      multiple
                      :accept="reconciliationAttachmentAccept"
                      :before-upload="preventReconciliationAttachmentUpload"
                      :file-list="reconciliationFormState.corridorPayoutAccountAttachments"
                      :show-upload-list="false"
                      @change="handleReconciliationAttachmentChange"
                    >
                      <div class="flex flex-col items-center gap-3 py-4">
                        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                          <inbox-outlined class="text-[20px]" />
                        </div>
                        <p class="ant-upload-text text-slate-700 font-black text-[16px] mb-0">Drop files here or select attachments</p>
                        <p class="text-[12px] font-medium text-slate-400 mb-0">PDF, Word, Excel, CSV, JPG, PNG and more. Files are stored as metadata in this prototype.</p>
                      </div>
                    </a-upload-dragger>
                    <div v-else-if="!reconciliationFormState.corridorPayoutAccountAttachments.length" class="h-[140px] rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 flex flex-col items-center justify-center gap-2">
                      <eye-outlined class="text-slate-300 text-2xl" />
                      <span class="text-slate-400 font-black text-[13px] uppercase tracking-widest">No supporting files uploaded</span>
                    </div>
                    <div v-if="reconciliationFormState.corridorPayoutAccountAttachments.length" class="mt-4 space-y-3">
                      <div
                        v-for="file in reconciliationFormState.corridorPayoutAccountAttachments"
                        :key="file.uid"
                        class="rounded-[18px] border border-slate-200 bg-white px-4 py-3"
                      >
                        <div class="flex items-start gap-3">
                          <button
                            type="button"
                            class="flex min-w-0 flex-1 items-start gap-3 border-0 bg-transparent p-0 text-left"
                            @click="openAttachment(file)"
                          >
                            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                              <file-text-outlined class="text-[16px]" />
                            </div>
                            <div class="min-w-0 flex-1">
                              <div class="truncate text-[13px] font-black text-slate-900">{{ file.name }}</div>
                              <div class="mt-1 text-[11px] font-semibold text-slate-400">{{ formatAttachmentKind(file) }} / {{ formatAttachmentSize(file.size) }}</div>
                              <div class="mt-1 text-[11px] font-semibold" :class="canOpenAttachment(file) ? 'text-sky-600' : 'text-slate-400'">
                                {{ canOpenAttachment(file) ? 'Click to open' : 'Re-upload in this session to open' }}
                              </div>
                            </div>
                          </button>
                          <a-button
                            v-if="isEditingReconciliation"
                            type="text"
                            size="small"
                            class="text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                            @click="handleRemoveReconciliationAttachment(file.uid)"
                          >
                            <template #icon><delete-outlined /></template>
                          </a-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest mb-1">Reconciliation File Sample & Notes</div>
                  <p class="text-[12px] text-slate-400 mb-8 font-medium">Upload a representative sample and document any parsing rules, field definitions, or formatting caveats the team should watch for.</p>
                  
                  <div class="grid grid-cols-2 gap-10">
                    <a-form-item label="Upload Sample" class="mb-0">
                      <template #label><span class="text-[13px] font-black text-slate-700">Upload Sample</span></template>
                      <div class="mt-2">
                        <a-upload v-if="isEditingReconciliation">
                          <a-button class="h-10 px-6 rounded-xl font-black flex items-center gap-2"><template #icon><plus-outlined /></template>Choose File</a-button>
                        </a-upload>
                        <div v-else class="h-10 flex items-center px-4 rounded-xl bg-white/50 border border-slate-200 text-slate-400 italic text-[13px]">
                          No sample file uploaded
                        </div>
                      </div>
                    </a-form-item>

                    <a-form-item class="mb-0">
                      <template #label><span class="text-[13px] font-black text-slate-700">Sample Notes & Instructions</span></template>
                      <a-textarea v-model:value="reconciliationFormState.sampleNotes" :maxlength="INPUT_LIMITS.longText" :readonly="!isEditingReconciliation" :rows="4" show-count class="rounded-2xl border-slate-200 p-4" :class="!isEditingReconciliation ? 'bg-white/50' : 'bg-white'" placeholder="Describe important columns, file formatting, validation rules, naming conventions, or parsing notes..." />
                    </a-form-item>
                  </div>
                </div>
              </div>
            </a-form>
          </a-card>
        </div>

        <!-- Tax Configuration Section -->
        <div :ref="sectionRefs.tax" id="section-tax" class="mb-4">
          <div class="flex justify-between items-center mb-4 px-1">
            <h3 class="text-[20px] font-black text-slate-900 m-0">Tax Configuration</h3>
            <a-space size="middle">
              <a-button v-if="isEditingTax" size="small" type="text" @click="handleDiscardTax" class="font-bold text-slate-500">Discard</a-button>
              <a-button v-if="isEditingTax" type="primary" size="small" @click="handleSaveTax" class="rounded-lg px-6 h-9 font-bold shadow-md shadow-sky-100">Save</a-button>
              <a-button v-else-if="canOperateFiChannel" type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingTax = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <a-form layout="vertical">
              <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                <div class="mb-6">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Tax &amp; Withholding Policies</div>
                  <p class="text-[12px] text-slate-500 mt-2 mb-0 font-medium">Explain the concrete tax handling cases for this corridor, including who reports tax, VAT/GST or withholding ownership, market-specific filing treatment, and known exceptions.</p>
                </div>
                <a-form-item class="mb-0">
                  <template #label><span class="text-[13px] font-black text-slate-700">Tax Instructions</span></template>
                  <a-textarea v-model:value="taxFormState.taxDetails" :maxlength="INPUT_LIMITS.longText" :readonly="!isEditingTax" :rows="6" show-count class="rounded-2xl border-slate-200 p-4" :class="!isEditingTax ? 'bg-white/50' : 'bg-white'" placeholder="Describe concrete tax scenarios, for example who reports VAT/GST, whether withholding applies, country-specific filing rules, and any exceptions the operations team must follow..." />
                </a-form-item>
              </div>
            </a-form>
          </a-card>
        </div>

        <div :ref="sectionRefs.merchantMid" id="section-merchantMid" class="mb-4">
          <div class="flex justify-between items-center mb-4 px-1">
            <h3 class="text-[20px] font-black text-slate-900 m-0">Merchant Onboarding Flow</h3>
            <a-space size="middle">
              <a-button v-if="isEditingMerchantMid" size="small" type="text" @click="handleDiscardMerchantMid" class="font-bold text-slate-500">Discard</a-button>
              <a-button v-if="isEditingMerchantMid" type="primary" size="small" @click="handleSaveMerchantMid" class="rounded-lg px-6 h-9 font-bold shadow-md shadow-sky-100">Save</a-button>
              <a-button v-else-if="canOperateFiChannel" type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingMerchantMid = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <a-form layout="vertical">
              <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                <div class="mb-6">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Details</div>
                  <p class="text-[12px] text-slate-500 mt-2 mb-0 font-medium">Document the merchant onboarding workflow for this corridor, including document collection, KYB/KYC review, remediation steps, risk approval, MID creation ownership, activation prerequisites, and exception handling.</p>
                </div>
                <a-form-item class="mb-0">
                  <a-textarea v-model:value="merchantMidFormState.merchantMidDetails" :maxlength="INPUT_LIMITS.longText" :readonly="!isEditingMerchantMid" :rows="6" show-count class="rounded-2xl border-slate-200 p-4" :class="!isEditingMerchantMid ? 'bg-white/50' : 'bg-white'" placeholder="Describe the merchant onboarding flow, including who creates the MID, required documents, KYB/KYC checkpoints, approval dependencies, activation conditions, common blockers, and escalation paths..." />
                </a-form-item>
              </div>
            </a-form>
          </a-card>
        </div>

        <div :ref="sectionRefs.fiopTracking" id="section-fiopTracking" class="mb-4">
          <div class="flex justify-between items-center mb-4 px-1">
            <h3 class="text-[20px] font-black text-slate-900 m-0">FIOP Tracking</h3>
            <a-space size="middle">
              <a-button v-if="isEditingFiopTracking" size="small" type="text" @click="handleDiscardFiopTracking" class="font-bold text-slate-500">Discard</a-button>
              <a-button v-if="isEditingFiopTracking" type="primary" size="small" @click="handleSaveFiopTracking" class="rounded-lg px-6 h-9 font-bold shadow-md shadow-sky-100">Save</a-button>
              <a-button v-else-if="canOperateFiChannel" type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingFiopTracking = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <a-form layout="vertical" class="space-y-6">
              <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                <div class="mb-6">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Add New Update</div>
                  <p class="text-[12px] text-slate-500 mt-2 mb-0 font-medium">Use this box to capture the newest FIOP follow-up. A timestamp is generated on save and the newest entry is synced to the Corridor view.</p>
                </div>
                <a-form-item class="mb-0">
                  <template #label><span class="text-[13px] font-black text-slate-700">Remark</span></template>
                  <a-textarea v-model:value="fiopTrackingFormState.draftRemark" :maxlength="INPUT_LIMITS.note" :readonly="!isEditingFiopTracking" :rows="4" show-count class="rounded-2xl border-slate-200 p-4" :class="!isEditingFiopTracking ? 'bg-white/50' : 'bg-white'" placeholder="Record the latest progress, blocker, owner follow-up, or next step..." />
                </a-form-item>
              </div>

              <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                <div class="mb-6">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Activity History</div>
                </div>

                <div v-if="fiopTrackingFormState.entries.length" class="space-y-4">
                  <div v-for="entry in fiopTrackingFormState.entries" :key="entry.id" class="rounded-2xl border border-slate-200 bg-white/70 p-5">
                    <div class="flex items-center justify-between gap-4 mb-3">
                      <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest">{{ entry.time }}</div>
                      <a-button v-if="isEditingFiopTracking" type="text" danger size="small" class="px-0 h-auto font-bold" @click="handleRemoveFiopTrackingEntry(entry.id)">Remove</a-button>
                    </div>
                    <a-textarea v-model:value="entry.remark" :maxlength="INPUT_LIMITS.note" :readonly="!isEditingFiopTracking" :auto-size="{ minRows: 3, maxRows: 6 }" show-count class="rounded-2xl border-slate-200 p-4" :class="!isEditingFiopTracking ? 'bg-white/80' : 'bg-white'" placeholder="Progress note" />
                  </div>
                </div>
                <a-empty v-else :image="h(InboxOutlined)" description="No FIOP tracking records yet" />
              </div>
            </a-form>
          </a-card>
        </div>
      </div>
      </div>

      <WorkflowSidePanel
        v-if="isWorkflowPanelOpen"
        :title="activeWorkflowPanelTitle"
        @close="handleCloseWorkflowPanel"
      >
        <component
          :is="activeWorkflowPanelComponent"
          v-if="activeWorkflowPanelComponent"
          :channel="channel"
          v-bind="activeWorkflowPanelProps"
          @submit="handleWorkflowPanelSubmit"
          @revoke="activeWorkflowPanel === 'kyc-cdd' ? handleCddRevoke() : activeWorkflowPanel === 'kyc-onboarding' ? handleKycRevoke() : undefined"
          @close="handleCloseWorkflowPanel"
        />
      </WorkflowSidePanel>
      </div>
    </a-layout-content>

    <!-- 侧边栏: Modification History -->
    <a-drawer
      placement="right"
      :open="isHistorySidebarVisible"
      @close="isHistorySidebarVisible = false"
      :width="420"
      :closable="false"
      class="history-drawer"
    >
      <template #title>
        <div class="flex justify-between items-start">
          <div>
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">History</div>
            <h3 class="text-[18px] font-black text-slate-900 m-0">Modification History</h3>
            <p class="text-[12px] text-slate-500 mt-1.5 mb-0 leading-relaxed">Review recent saved changes and approval submissions without leaving the detail page.</p>
          </div>
          <a-button type="text" @click="isHistorySidebarVisible = false" class="text-slate-400 font-bold hover:text-slate-600">Close</a-button>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Change Log -->
        <div class="p-5 rounded-2xl border border-slate-100 bg-white">
          <div class="mb-6">
            <h4 class="text-[14px] font-bold text-slate-900 m-0">Change Log</h4>
            <p class="text-[12px] text-slate-400 mt-1 mb-0">Recent saved updates across profile, pricing, operational setup, and launch actions.</p>
          </div>
          <a-timeline v-if="visibleAuditLogs.length">
            <a-timeline-item v-for="(log, idx) in visibleAuditLogs" :key="idx" :color="log.color || 'blue'">
              <div class="font-bold text-slate-700 text-sm">{{ log.action }}</div>
              <div class="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <div class="text-[11px] text-slate-500 flex flex-col gap-1">
                  <span>Updated at: {{ log.time }}</span>
                  <span>Actor: {{ log.user || 'N/A' }}</span>
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-else :image="h(InboxOutlined)" description="No saved changes yet" />
        </div>

        <!-- Submission History -->
        <div class="p-5 rounded-2xl border border-slate-100 bg-white">
          <div class="mb-6">
            <h4 class="text-[14px] font-bold text-slate-900 m-0">Submission History</h4>
            <p class="text-[12px] text-slate-400 mt-1 mb-0">Approval milestones from Compliance, Legal, Pricing, and Tech.</p>
          </div>
          <a-timeline v-if="submissionHistoryEntries.length">
            <a-timeline-item v-for="entry in submissionHistoryEntries" :key="entry.key" :color="entry.status === 'Completed' ? 'green' : 'blue'">
              <div class="font-bold text-slate-700 text-sm">{{ entry.title }}</div>
              <div class="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <div class="text-[11px] text-slate-500 flex flex-col gap-1.5">
                  <span class="font-medium">Submitted at: {{ entry.date }}</span>
                  <span class="font-medium">Submitted by: {{ entry.user || 'N/A' }}</span>
                  <span v-if="entry.notes" class="italic">Remarks: "{{ entry.notes }}"</span>
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-else :image="h(InboxOutlined)" description="No submission history yet" />
        </div>
      </div>
    </a-drawer>

    <!-- 启动上线确认弹窗 -->
    <a-modal
      v-model:open="isFundSubmitModalVisible"
      title="Fund Review"
      :ok-text="fundReviewSubmitted && fundApprovalStatus === 'changes_requested' ? 'Resubmit to Fund' : 'Submit to Fund'"
      :ok-button-props="{ disabled: !canSubmitFundReview }"
      @ok="handleSubmitFundReview"
    >
      <div class="py-3">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
            <file-text-outlined class="text-2xl" />
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-lg font-black text-slate-900 m-0">{{ fundApprovalLabel }}</h3>
              <a-tag
                :style="{
                  backgroundColor: fundApprovalTheme.bg,
                  color: fundApprovalTheme.text,
                  border: 'none',
                  borderRadius: '999px',
                  fontWeight: 900,
                  padding: '3px 10px',
                }"
              >
                {{ fundApprovalLabel }}
              </a-tag>
            </div>
            <p class="text-slate-500 text-[13px] font-semibold leading-relaxed mt-2 mb-0">
              Submit fund review after KYC, NDA, MSA, and Pricing Schedule are complete.
            </p>
          </div>
        </div>

        <div class="mt-5 grid gap-3">
          <div
            v-for="item in fundPrerequisites.legalItems"
            :key="item.key"
            class="launch-modal-gate"
            :class="{
              'launch-modal-gate--ready': item.ready,
              'launch-modal-gate--optional': item.key === 'otherAttachments',
            }"
          >
            <span>{{ item.label }}{{ item.key === 'otherAttachments' ? ' (Optional)' : '' }}</span>
            <strong>{{ item.status }}</strong>
          </div>
          <div class="launch-modal-gate" :class="{ 'launch-modal-gate--ready': fundPrerequisites.kycReady }">
            <span>KYC verification</span>
            <strong>WooshPay {{ fundPrerequisites.wooshpayKycStatus }} / Corridor {{ fundPrerequisites.corridorKycStatus }}</strong>
          </div>
        </div>

        <div v-if="fundPrerequisites.missingItems.length" class="mt-4 rounded-xl bg-rose-50 border border-rose-100 p-3">
          <div class="text-[12px] font-black text-rose-700 uppercase tracking-[0.12em]">Missing before fund review</div>
          <ul class="mt-2 mb-0 pl-5 text-[13px] font-semibold leading-relaxed text-rose-700">
            <li v-for="item in fundPrerequisites.missingItems" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div v-else-if="fundReviewSubmitted && fundApprovalStatus === 'pending'" class="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-3 text-[13px] font-semibold leading-relaxed text-amber-700">
          Fund review has already been submitted and is waiting for Fund approval.
        </div>

        <a-form layout="vertical" class="mt-4">
          <a-form-item label="Submission note">
            <a-textarea
              v-model:value="fundSubmissionNote"
              :maxlength="INPUT_LIMITS.note"
              :rows="3"
              show-count
              :disabled="!canSubmitFundReview"
              placeholder="Optional context for Fund."
            />
          </a-form-item>
        </a-form>
      </div>
    </a-modal>

    <!-- 挂起/标记丢失弹窗 -->
    <a-drawer
      placement="right"
      :open="launchTimelineDrawerOpen"
      @close="launchTimelineDrawerOpen = false"
      :width="480"
      :closable="false"
      class="history-drawer launch-timeline-drawer"
    >
      <template #title>
        <div class="flex justify-between items-start gap-4">
          <div class="min-w-0">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Final Launch</div>
            <h3 class="text-[18px] font-black text-slate-900 m-0">Approval timeline</h3>
            <p class="text-[12px] text-slate-500 mt-1.5 mb-0 leading-relaxed">Read FI Supervisor messages and launch approval milestones.</p>
          </div>
          <a-button type="text" @click="launchTimelineDrawerOpen = false" class="text-slate-400 font-bold hover:text-slate-600">Close</a-button>
        </div>
      </template>

      <div class="space-y-5">
        <div class="p-5 rounded-2xl border border-slate-100 bg-white">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="text-[11px] font-black uppercase tracking-widest text-slate-400">Corridor</div>
              <h4 class="text-[18px] font-black text-slate-900 m-0 mt-2 leading-tight">{{ channel.channelName || 'Unnamed Corridor' }}</h4>
            </div>
            <a-tag
              :style="{
                backgroundColor: launchApprovalTheme.bg,
                color: launchApprovalTheme.text,
                border: 'none',
                borderRadius: '999px',
                fontWeight: 900,
                padding: '4px 12px',
              }"
            >
              {{ getLaunchApprovalLabel(launchApproval.status) }}
            </a-tag>
          </div>
        </div>

        <div class="p-5 rounded-2xl border border-slate-100 bg-white">
          <div class="mb-6">
            <h4 class="text-[14px] font-bold text-slate-900 m-0">Launch Approval History</h4>
            <p class="text-[12px] text-slate-400 mt-1 mb-0">FI Supervisor final decisions in reverse chronological order.</p>
          </div>
          <a-timeline v-if="launchTimelineEntries.length">
            <a-timeline-item
              v-for="entry in launchTimelineEntries"
              :key="entry.id"
              :color="getLaunchTimelineColor(entry)"
            >
              <div class="font-bold text-slate-700 text-sm">{{ getLaunchTimelineTitle(entry) }}</div>
              <div class="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <div class="text-[11px] text-slate-500 flex flex-col gap-1.5">
                  <span class="font-medium">Updated at: {{ formatLaunchTimelineTime(entry.time) }}</span>
                  <span class="font-medium">Actor: {{ entry.actor || 'System' }}</span>
                  <span class="font-medium">Role: {{ entry.actorRole || 'System' }}</span>
                  <span v-if="entry.note" class="italic">Remarks: "{{ entry.note }}"</span>
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-else :image="h(InboxOutlined)" description="No FI Supervisor final decision history yet" />
        </div>
      </div>
    </a-drawer>

    <a-modal
      v-model:open="isSuspendModalVisible"
      title="Mark Corridor as Lost"
      @ok="handleConfirmSuspend"
      okText="Confirm"
    >
      <a-form layout="vertical">
        <a-form-item label="Reason">
          <a-radio-group v-model:value="lostReason">
            <a-space direction="vertical">
              <a-radio value="Offline">Offline</a-radio>
              <a-radio value="Lost connection">Lost connection</a-radio>
            </a-space>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="Additional Remarks">
          <a-textarea v-model:value="lostRemarks" :maxlength="INPUT_LIMITS.note" :rows="3" show-count placeholder="Please provide details..." />
        </a-form-item>
      </a-form>
    </a-modal>

  </a-layout>
</template>

<style scoped>
.clean-card {
  border-radius: 16px;
  background: #ffffff !important;
}

.fitrem-detail-layout,
.fitrem-detail-content,
.fitrem-detail-main {
  background: #ffffff !important;
  background-image: none !important;
}

.fitrem-detail-layout :deep(.clean-card.ant-card),
.fitrem-detail-layout :deep(.clean-card .ant-card-body) {
  background: #ffffff !important;
}

.launch-modal-gate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #fecdd3;
  border-radius: 14px;
  background: #fff1f2;
  padding: 12px 14px;
}

.launch-modal-gate--ready {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.launch-modal-gate--optional {
  border-color: #e2e8f0;
  background: #f8fafc;
}

.launch-modal-gate span {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
}

.launch-modal-gate strong {
  color: #0f172a;
  font-size: 13px;
  text-align: right;
}

:deep(.ant-card-head) {
  border-bottom: none !important;
  padding: 20px 24px 0;
}

:deep(.ant-card-head-title) {
  color: #0f172a !important;
  font-weight: 900 !important;
  font-size: 18px !important;
  letter-spacing: -0.01em;
}

:deep(.ant-card-body) {
  padding: 24px !important;
}

:deep(.fitrem-descriptions .ant-descriptions-item-label) {
  background: #f8fafc !important;
  color: #64748b !important;
  font-weight: 700 !important;
  font-size: 12px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  width: 200px;
}

:deep(.ant-form-item-label label) {
  font-weight: 700 !important;
  color: #475569 !important;
  font-size: 13px !important;
}

:deep(.custom-select-height .ant-select-selector) {
  height: 40px !important;
  border-radius: 8px !important;
  display: flex !important;
  align-items: center !important;
  border-color: #e2e8f0 !important;
}

:deep(.custom-select-height-left .ant-select-selector) {
  height: 40px !important;
  border-radius: 8px 0 0 8px !important;
  border-right: none !important;
  display: flex !important;
  align-items: center !important;
  border-color: #e2e8f0 !important;
}

:deep(.custom-select-height-right .ant-select-selector) {
  height: 40px !important;
  border-radius: 0 8px 8px 0 !important;
  display: flex !important;
  align-items: center !important;
  border-color: #e2e8f0 !important;
}

:deep(.custom-select-height-middle .ant-select-selector) {
  height: 40px !important;
  border-radius: 0 !important;
  border-left: none !important;
  border-right: none !important;
  display: flex !important;
  align-items: center !important;
  border-color: #e2e8f0 !important;
  min-width: 0 !important;
}

:deep(.custom-select-height-middle .ant-select-selection-item) {
  padding-right: 0 !important;
  padding-left: 8px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
}

:deep(.custom-select-height-middle .ant-select-arrow) {
  right: 8px !important;
}

.backend-account-table-shell {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
  overflow: hidden;
}

.backend-account-table-scroll {
  overflow-x: auto;
  padding-right: 8px;
}

.backend-account-table {
  width: auto;
  min-width: 1906px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.backend-account-table th {
  background: #f6f8fb;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e8edf5;
  color: #0f172a;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.45;
  padding: 11px 14px;
  text-align: left;
  vertical-align: top;
  white-space: normal;
}

.backend-account-table td {
  background: #ffffff;
  border-bottom: 1px solid #edf2f7;
  border-right: 1px solid #edf2f7;
  padding: 12px 14px;
  vertical-align: middle;
}

.backend-account-table__row td {
  border-bottom: none;
}

.backend-account-table th:last-child,
.backend-account-table td:last-child {
  border-right: none;
}

.backend-account-table tbody tr:last-child td {
  border-bottom: none;
}

.backend-account-table__header {
  display: inline-flex;
  align-items: flex-start;
  gap: 6px;
}

.backend-account-table__info {
  margin-top: 1px;
  color: #94a3b8;
  font-size: 13px;
  cursor: help;
}

.backend-account-table__text {
  min-height: 40px;
  color: #0f172a;
  display: flex;
  align-items: center;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.backend-account-table__link {
  min-height: 40px;
  display: flex;
  align-items: center;
  color: #2563eb;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.5;
  text-decoration: none;
  word-break: break-all;
}

.backend-account-table__link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.backend-account-table__remark-cell {
  padding: 14px 16px 16px;
  background: #fbfdff;
}

.backend-account-table__remark-label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.backend-account-table__remark-copy {
  margin-top: 8px;
  color: #0f172a;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.backend-account-table__action-head {
  background: #f6f8fb;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
  border-right: none;
  padding: 11px 8px;
  text-align: center;
}

.backend-account-table__action-label {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.backend-account-table__action-cell {
  position: relative;
  border-right: none;
  background: #ffffff;
  padding: 12px 8px 12px 6px;
  width: 56px;
  text-align: center;
}

.backend-account-table__delete {
  min-width: 32px;
  height: 32px;
  border-radius: 999px;
  opacity: 0.62;
  pointer-events: auto;
  transform: none;
  transition: opacity 0.16s ease, color 0.16s ease, background-color 0.16s ease;
}

.backend-account-table__row:hover .backend-account-table__delete,
.backend-account-table__row:focus-within .backend-account-table__delete {
  opacity: 1;
}

:deep(.backend-account-table .ant-input) {
  border-radius: 10px;
  border-color: #d9e2ee;
  box-shadow: none;
}

:deep(.backend-account-table input.ant-input) {
  height: 40px;
  font-size: 12.5px;
  font-weight: 500;
  padding-inline: 12px;
}

:deep(.backend-account-table textarea.ant-input) {
  min-height: 88px;
  padding: 10px 12px;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.6;
  resize: vertical;
}

:deep(.backend-account-table .ant-input::placeholder) {
  color: #94a3b8;
}

:deep(.backend-account-table .ant-input:hover),
:deep(.backend-account-table .ant-input:focus) {
  border-color: #93c5fd;
}

:deep(.backend-account-table__select .ant-select-selector) {
  height: 40px !important;
  border-radius: 10px !important;
  border-color: #d9e2ee !important;
  box-shadow: none !important;
  padding: 0 12px !important;
}

:deep(.backend-account-table__select .ant-select-selection-item),
:deep(.backend-account-table__select .ant-select-selection-placeholder) {
  line-height: 38px !important;
  font-size: 12.5px !important;
  font-weight: 500 !important;
}

:deep(.backend-account-table__select .ant-select-selection-placeholder) {
  color: #94a3b8 !important;
}

:deep(.backend-account-table__select .ant-select-selection-search-input) {
  height: 38px !important;
}

:deep(.backend-account-table__select.ant-select:hover .ant-select-selector),
:deep(.backend-account-table__select.ant-select-focused .ant-select-selector) {
  border-color: #93c5fd !important;
}

:deep(.backend-account-table__remark-field .ant-input) {
  background: #ffffff;
}

.reconciliation-detail-card {
  padding: 20px;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.72);
}

:deep(.no-radius-select .ant-select-selector) {
  border-radius: 0 !important;
  border-left: none !important;
}

:deep(.ant-select-disabled .ant-select-selector) {
  background-color: #f8fafc !important;
}

:deep(.ant-input-group .ant-select-selector) {
  border-radius: 8px 0 0 8px !important;
}

:deep(.custom-cascader-multi .ant-select-selector) {
  min-height: 40px !important;
  border-radius: 8px !important;
  border-color: #e2e8f0 !important;
  padding: 4px 11px !important;
  display: flex !important;
  align-items: center !important;
}

.fitrem-detail-main::-webkit-scrollbar {
  width: 6px;
}

.fitrem-detail-main::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}

.fitrem-detail-main::-webkit-scrollbar-track {
  background: transparent;
}

:deep(.history-drawer .ant-drawer-header) {
  padding: 24px 24px 20px !important;
  border-bottom: 1px solid #f1f5f9 !important;
}

:deep(.history-drawer .ant-drawer-body) {
  padding: 24px !important;
  background: #f8fafc !important;
}

:deep(.history-drawer .ant-timeline-item-label) {
  font-size: 12px !important;
  color: #64748b !important;
}

:deep(.history-drawer .ant-timeline-item-tail) {
  border-inline-start: 2px solid #e2e8f0 !important;
}
</style>
