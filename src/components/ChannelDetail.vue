<script setup lang="ts">
import { ref, reactive, computed, h, nextTick, watch } from 'vue';
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
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';
import { 
  geoData, 
  contactMethodOptions,
  merchantGeoOptions,
  supportedProductOptions
} from '../constants/channelOptions';
import { buildPricingScheduleSummary } from '../constants/initialData';
import { applyOnboardingSubmission, getChannelOnboardingWorkflow } from '../constants/onboarding';
import WorkflowBoard from './WorkflowBoard.vue';
import WorkflowSidePanel from './WorkflowSidePanel.vue';
import CddWorkflowPanelContent from './CddWorkflowPanelContent.vue';
import KycWorkflowPanelContent from './KycWorkflowPanelContent.vue';
import LegalWorkflowPanelContent from './LegalWorkflowPanelContent.vue';
import PricingWorkflowPanelContent from './PricingWorkflowPanelContent.vue';
import TechWorkflowPanelContent from './TechWorkflowPanelContent.vue';

const props = defineProps<{
  topOffset: number;
}>();

const store = useAppStore();
const emit = defineEmits(['registerToolbar']);
const unsureOption = "I'm not sure yet";
type WorkflowPanelKey = 'kyc-cdd' | 'kyc-onboarding' | 'nda' | 'msa' | 'pricing' | 'tech';

// --- 状态定义 ---
const activeSection = ref('overview');
const isHistorySidebarVisible = ref(false);
const isLaunchModalVisible = ref(false);
const isSuspendModalVisible = ref(false);
const activeWorkflowPanel = ref<WorkflowPanelKey | null>(null);
const lostReason = ref('Offline');
const lostRemarks = ref('');
const channel = computed(() => store.selectedChannel || {});
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
const latestPricingScheduleUpdatedAt = computed(() => {
  const latestTimestamp = pricingProposals.value.reduce((latest: string, proposal: any) => {
    const nextUpdatedAt = String(proposal?.updatedAt || '');
    return new Date(nextUpdatedAt).getTime() > new Date(latest).getTime() ? nextUpdatedAt : latest;
  }, '');

  return latestTimestamp || channel.value.submissionHistory?.pricing?.date || '';
});
const legalDocumentTitleMap: Record<string, string> = {
  NDA: 'Non-Disclosure Agreement',
  MSA: 'Master Services Agreement',
};
const resolveLegalDocumentTitle = (docType?: string) => (
  legalDocumentTitleMap[String(docType || '').toUpperCase()] || String(docType || '').toUpperCase()
);
const workflowPanelTitleMap: Record<WorkflowPanelKey, string> = {
  'kyc-cdd': 'Corridor onboarding',
  'kyc-onboarding': 'WooshPay onboarding',
  nda: 'Non-Disclosure Agreement',
  msa: 'Master Services Agreement',
  pricing: 'Pricing Schedule',
  tech: 'Technical Integration',
};
const workflowPanelComponentMap = {
  'kyc-cdd': CddWorkflowPanelContent,
  'kyc-onboarding': KycWorkflowPanelContent,
  nda: LegalWorkflowPanelContent,
  msa: LegalWorkflowPanelContent,
  pricing: PricingWorkflowPanelContent,
  tech: TechWorkflowPanelContent,
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
const activeLegalDocType = computed(() => (
  activeWorkflowPanel.value === 'msa' ? 'MSA' : 'NDA'
));
const activeWorkflowPanelProps = computed(() => (
  activeWorkflowPanel.value === 'nda' || activeWorkflowPanel.value === 'msa'
    ? { docType: activeLegalDocType.value }
    : {}
));
const resolveHistoryEntryTimestamp = (value?: string) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const submissionHistoryEntries = computed(() => {
  const history = channel.value.submissionHistory || {};
  const stageMeta: Record<string, string> = {
    cdd: 'Corridor onboarding',
    kyc: 'WooshPay onboarding',
    nda: 'Non-Disclosure Agreement',
    msa: 'Master Services Agreement',
    pricing: 'Pricing Schedule',
    tech: 'Technical Integration'
  };
  const stageStatusMap: Record<string, string> = {
    cdd: channel.value.corridorOnboardingStatus || channel.value.complianceStatus || 'Not Started',
    kyc: channel.value.wooshpayOnboardingStatus || channel.value.globalProgress?.kyc || 'Not Started',
    nda: channel.value.globalProgress?.nda || 'Not Started',
    msa: channel.value.globalProgress?.contract || 'Not Started',
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

const cooperationModelFieldRef = ref<any>(null);
const cooperationModelSelectRef = ref<any>(null);

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
    onBack: () => store.setView('dashboard'),
    onShare: () => message.success('Share link generated!'),
    showLaunch: channel.value.status === 'Ongoing' || channel.value.status === 'Offline',
    onLaunch: () => { isLaunchModalVisible.value = true },
    onSuspend: () => {
      lostReason.value = channel.value.status === 'Lost connection' ? 'Lost connection' : 'Offline';
      lostRemarks.value = '';
      isSuspendModalVisible.value = true;
    },
  });
};

// --- 业务逻辑 ---
const isEditingProfile = ref(true);
const isEditingCapability = ref(true);
const isEditingChargeback = ref(true);
const isEditingReconciliation = ref(true);
const isEditingTax = ref(true);
const isEditingMerchantMid = ref(true);
const isEditingFiopTracking = ref(true);

const isProgrammaticScroll = ref(false);

const capabilityFormState = reactive({
  merchantGeo: [] as string[][],
  capabilityText: '',
  capabilityLink: '',
  merchantPolicyLink: '',
  merchantPolicyRemark: '',
});

const chargebackFormState = reactive({
  chargebackHandling: 'Email',
  chargebackRemarks: '',
});

const reconciliationFormState = reactive({
  reconMethods: [] as string[],
  reconMethodDetail: '',
  corridorPayoutAccount: '',
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
    chargebackHandling: source.chargebackHandling || 'Email',
    chargebackRemarks: source.chargebackRemarks || '',
  });
};

const resetReconciliationForm = (source = channel.value) => {
  Object.assign(reconciliationFormState, {
    reconMethods: toStringArray(source.reconMethods),
    reconMethodDetail: source.reconMethodDetail || '',
    corridorPayoutAccount: source.corridorPayoutAccount || '',
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

const focusCooperationModelField = async () => {
  isEditingProfile.value = true;
  activeSection.value = 'profile';
  isProgrammaticScroll.value = true;
  sectionRefs.profile.value?.scrollIntoView({ behavior: 'smooth' });

  await nextTick();

  setTimeout(() => {
    const fieldElement = cooperationModelFieldRef.value?.$el ?? cooperationModelFieldRef.value;
    fieldElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    cooperationModelSelectRef.value?.focus?.();
    isProgrammaticScroll.value = false;
  }, 260);
};

const guardPricingNavigation = () => {
  const savedModels = normalizeExclusiveSelection(toStringArray(channel.value.cooperationModel));

  if (!savedModels.includes(unsureOption)) {
    return false;
  }

  Modal.warning({
    title: 'Select Cooperation Model',
    content: 'Pricing is unavailable while the saved Cooperation Model is set to "I\'m not sure yet". Please choose a confirmed model and save the profile first.',
    okText: 'Go to Cooperation Model',
    onOk: () => focusCooperationModelField(),
  });

  return true;
};

const navigateToPricing = () => {
  if (!guardPricingNavigation()) {
    store.setView('pricing');
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
  () => channel.value.id,
  (nextId) => {
    if (nextId && store.selectedChannel) {
      hydrateAllForms();
    }
  },
  { immediate: true },
);

watch(
  () => [channel.value.id, channel.value.channelName, channel.value.status],
  () => {
    if (store.selectedChannel) {
      registerToolbar();
    }
  },
  { immediate: true },
);

const handleSaveProfile = () => {
  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = {
    ...channel.value,
    ...profileFormState,
    cooperationModel: normalizeExclusiveSelection([...profileFormState.cooperationModel]),
    supportedProducts: [...profileFormState.supportedProducts],
    onboardingEntities: [...profileFormState.onboardingEntities],
    lastModifiedAt: time,
    auditLogs: [
      { time, user: 'Current User', action: 'Updated Corridor Profile', color: 'blue' },
      ...(channel.value.auditLogs || []),
    ],
  };
  store.updateChannel(updated);
  resetProfileForm(updated);
  message.success('Profile updated successfully');
  isEditingProfile.value = false;
};

const handleSaveCapability = () => {
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
  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = { ...channel.value, ...chargebackFormState, lastModifiedAt: time };
  store.updateChannel(updated);
  resetChargebackForm(updated);
  message.success('Dispute SOP updated');
  isEditingChargeback.value = false;
};

const handleSaveReconciliation = () => {
  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = {
    ...channel.value,
    ...reconciliationFormState,
    reconMethods: [...reconciliationFormState.reconMethods],
    lastModifiedAt: time,
  };
  store.updateChannel(updated);
  resetReconciliationForm(updated);
  message.success('Reconciliation updated');
  isEditingReconciliation.value = false;
};

const handleSaveTax = () => {
  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = { ...channel.value, ...taxFormState, lastModifiedAt: time };
  store.updateChannel(updated);
  resetTaxForm(updated);
  message.success('Tax configuration updated');
  isEditingTax.value = false;
};

const handleSaveMerchantMid = () => {
  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = { ...channel.value, ...merchantMidFormState, lastModifiedAt: time };
  store.updateChannel(updated);
  resetMerchantMidForm(updated);
  message.success('Merchant Onboarding Flow updated');
  isEditingMerchantMid.value = false;
};

const handleSaveFiopTracking = () => {
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
      { time, user: 'Current User', action: 'Updated FIOP Tracking', color: 'blue' },
      ...(channel.value.auditLogs || []),
    ],
  };

  store.updateChannel(updated);
  resetFiopTrackingForm(updated);
  message.success('FIOP tracking updated');
  isEditingFiopTracking.value = false;
};

const handleWorkflowNodeClick = (key: string) => {
  if (key === 'kyc') {
    const preferredTrack = ['wooshpay', 'corridor'].find((track) => {
      const workflow = getChannelOnboardingWorkflow(channel.value, track as 'wooshpay' | 'corridor');
      return workflow.status === 'not_started' || workflow.status === 'self_preparation';
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

  if (['kyc-cdd', 'kyc-onboarding', 'nda', 'msa', 'pricing', 'tech'].includes(key)) {
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

  if (activeWorkflowPanel.value === 'pricing') {
    handlePricingSubmit(payload);
    return;
  }

  if (activeWorkflowPanel.value === 'tech') {
    handleTechSubmit(payload);
    return;
  }

  handleLegalSubmit(payload);
};

const handleCddSubmit = (values: any) => {
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = {
    ...applyOnboardingSubmission(channel.value, 'corridor', {
      documentLink: values.documentLink,
      notes: values.notes,
      attachments: values.attachments,
    }, 'Current User', timestamp),
    auditLogs: [
      { time: timestamp, user: 'Current User', action: 'Submitted Corridor onboarding package to Compliance.', color: 'blue' },
      ...(channel.value.auditLogs || [])
    ]
  };
  store.updateChannel(updated);
};

const handleKycSubmit = (values: any) => {
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = {
    ...applyOnboardingSubmission(channel.value, 'wooshpay', {
      entities: values.entities,
      documentLink: values.documentLink,
      notes: values.notes,
      attachments: values.attachments,
    }, 'Current User', timestamp),
    auditLogs: [
      { time: timestamp, user: 'Current User', action: 'Submitted WooshPay onboarding package to Compliance.', color: 'blue' },
      ...(channel.value.auditLogs || [])
    ]
  };
  store.updateChannel(updated);
};

const handleLegalSubmit = (values: any) => {
  const time = dayjs().format('YYYY-MM-DD');
  const stageKey = values.docType.toLowerCase() === 'msa' ? 'contract' : values.docType.toLowerCase();
  const historyKey = values.docType.toLowerCase() === 'msa' ? 'msa' : values.docType.toLowerCase();
  const documentTitle = resolveLegalDocumentTitle(values.docType);
  
  const updated = {
    ...channel.value,
    globalProgress: {
      ...channel.value.globalProgress,
      [stageKey]: 'Under Review'
    },
    submissionHistory: {
      ...channel.value.submissionHistory,
      [historyKey]: { date: time, user: 'Current User', notes: values.remarks }
    },
    auditLogs: [
      { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), user: 'Current User', action: `Submitted ${documentTitle} to Legal for review.`, color: 'blue' },
      ...(channel.value.auditLogs || [])
    ]
  };
  store.updateChannel(updated);
};

const handlePricingSubmit = (values: any) => {
  const time = dayjs().format('YYYY-MM-DD');
  const proposalTimestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const latestProposal = [...pricingProposals.value]
    .sort((a: any, b: any) => resolveHistoryEntryTimestamp(b.updatedAt) - resolveHistoryEntryTimestamp(a.updatedAt))[0];
  const updated = {
    ...channel.value,
    pricingProposals: latestProposal
      ? pricingProposals.value.map((proposal: any) => (
          proposal.id === latestProposal.id
            ? { ...proposal, approvalStatus: 'In Review', updatedAt: proposalTimestamp }
            : proposal
        ))
      : pricingProposals.value,
    globalProgress: {
      ...channel.value.globalProgress,
      pricing: 'In Progress'
    },
    submissionHistory: {
      ...channel.value.submissionHistory,
      pricing: { date: time, user: 'Current User', notes: values.remarks }
    },
    auditLogs: [
      { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), user: 'Current User', action: 'Submitted Pricing Schedule for review.', color: 'blue' },
      ...(channel.value.auditLogs || [])
    ]
  };
  store.updateChannel(updated);
};

const handleTechSubmit = (values: any) => {
  const time = dayjs().format('YYYY-MM-DD');
  const updated = {
    ...channel.value,
    globalProgress: {
      ...channel.value.globalProgress,
      tech: 'In Progress'
    },
    submissionHistory: {
      ...channel.value.submissionHistory,
      tech: { date: time, user: 'Current User', notes: values.techRawInfo ? 'Information synced via portal.' : '' }
    },
    auditLogs: [
      { time: dayjs().format('YYYY-MM-DD HH:mm:ss'), user: 'Current User', action: 'Synced technical documents to tech team.', color: 'cyan' },
      ...(channel.value.auditLogs || [])
    ]
  };
  store.updateChannel(updated);
};

const handleConfirmSuspend = () => {
  const time = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const updated = { 
    ...channel.value, 
    status: lostReason.value,
    lastModifiedAt: time,
    auditLogs: [
      { time, user: 'Current User', action: `Marked corridor as ${lostReason.value}.${lostRemarks.value ? ` ${lostRemarks.value}` : ''}`, color: 'red' },
      ...(channel.value.auditLogs || [])
    ]
  };
  store.updateChannel(updated);
  message.success('Corridor status updated successfully.');
  isSuspendModalVisible.value = false;
};

const handleInitiateLaunch = () => {
  message.loading('Initiating launch sequence...', 2).then(() => {
    const updated = { ...channel.value, status: 'Live' };
    store.updateChannel(updated);
    message.success('Channel is now LIVE');
    isLaunchModalVisible.value = false;
  });
};

</script>

<template>
  <a-layout class="fitrem-detail-layout" :style="{ background: '#ffffff', height: '100vh', fontFamily: appFontFamily }">
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
        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-6 px-1">Management</div>
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

              <div class="grid grid-cols-4 gap-6">
                <div v-for="item in [
                  { label: 'FI Owner', value: channel.fiopOwner || 'Unassigned' },
                  { label: 'Merchant Geo Allowed', value: merchantGeoAllowedSummary },
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
              :complianceStatus="channel.complianceStatus"
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
              <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingProfile = true">
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
                  <a-form-item extra="Use the shared internal naming convention used across dashboard, pricing, and launch workflows.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Corridor Name</span></template>
                    <a-input v-model:value="profileFormState.channelName" :readonly="!isEditingProfile" class="rounded-lg border-slate-200 h-[40px] flex items-center" :class="!isEditingProfile ? 'bg-slate-50' : 'bg-white'" />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item extra="Generated automatically for new corridors and kept read-only for traceability.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Corridor ID</span></template>
                    <a-input v-model:value="profileFormState.channelId" readonly class="rounded-lg border-slate-100 bg-slate-50 text-slate-400 font-mono h-[40px] flex items-center" />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item extra="Legal entity name used for corridor review, contracting, and ongoing operations.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Company Name</span></template>
                    <a-input v-model:value="profileFormState.companyName" :readonly="!isEditingProfile" class="rounded-lg border-slate-200 h-[40px] flex items-center" :class="!isEditingProfile ? 'bg-slate-50' : 'bg-white'" />
                  </a-form-item>
                </a-col>
                
                <a-col :span="8">
                  <a-form-item>
                    <template #label>
                      <a-space size="4">
                        <span class="text-[13px] font-bold text-slate-700">Registration Country</span>
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
                <a-col :span="8" ref="cooperationModelFieldRef">
                  <a-form-item extra="Keep this aligned with the active commercial model used by Pricing and Legal.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Cooperation Model</span></template>
                    <a-select
                      ref="cooperationModelSelectRef"
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
                  <a-form-item extra="Select only the product lines currently confirmed for onboarding and downstream setup.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Supported Products</span></template>
                    <a-select v-model:value="profileFormState.supportedProducts" mode="multiple" :disabled="!isEditingProfile" class="w-full custom-select-height" placeholder="Select products">
                      <a-select-option v-for="option in supportedProductOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>

                <a-col :span="12">
                  <a-form-item extra="Primary business contact used for day-to-day follow-up and cross-functional coordination.">
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
                        :readonly="!isEditingProfile" 
                        class="flex-1 min-w-0 rounded-r-lg border-l-0 border-slate-200 h-full flex items-center" 
                        :class="!isEditingProfile ? 'bg-slate-50' : 'bg-white'" 
                        :placeholder="pocPlaceholder" 
                      />
                    </div>
                  </a-form-item>
                </a-col>

                <a-col :span="12">
                  <a-form-item extra="Tip: If the corridor has no specific requirements, please default to SwooshTransfer Ltd (UK) for SPI license compliance.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Our Onboarding Entity</span></template>
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
              <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingCapability = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <div class="mb-8 space-y-2">
              <h4 class="text-[18px] font-black text-slate-900 m-0">Service Coverage & Requirements</h4>
              <p class="text-[14px] text-slate-500 m-0 font-medium">Keep corridor availability, supported payment methods, and merchant restriction policies aligned in one section.</p>
            </div>

            <a-form layout="vertical" class="space-y-6">
              <div class="rounded-3xl border border-slate-100 bg-slate-50/70 p-6">
                <a-form-item extra="Define the merchant registration or operating geographies this corridor is willing to support." class="mb-0">
                  <template #label><span class="text-[13px] font-bold text-slate-700">Merchant Geo Allowed</span></template>
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
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Capability Details</div>
                  <p class="text-[12px] text-slate-500 mt-2 mb-0 font-medium">Summarize the geographical coverage and payment methods supported by the corridor.</p>
                </div>
                <div class="space-y-4">
                  <a-upload v-if="isEditingCapability">
                    <a-button class="h-9 px-4 rounded-lg font-bold"><template #icon><plus-outlined /></template>Upload Document</a-button>
                  </a-upload>
                  <a-input v-model:value="capabilityFormState.capabilityLink" :readonly="!isEditingCapability" class="rounded-lg border-slate-200 h-[40px] flex items-center" :class="!isEditingCapability ? 'bg-white/70' : 'bg-white'" placeholder="Paste capability document link" />
                  <a-textarea v-model:value="capabilityFormState.capabilityText" :readonly="!isEditingCapability" :rows="4" class="rounded-xl border-slate-200 p-3" :class="!isEditingCapability ? 'bg-white/70' : 'bg-white'" placeholder="Summarize the geographical coverage and payment methods supported by the corridor." />
                </div>
              </div>

              <div class="rounded-3xl border border-slate-100 bg-slate-50/70 p-6">
                <div class="mb-5">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Merchant Prohibition/Restriction Policies</div>
                  <p class="text-[12px] text-slate-500 mt-2 mb-0 font-medium">Upload or link the policy source and note restricted merchants, industries, geographies, or payment methods.</p>
                </div>
                <div class="space-y-4">
                  <a-upload v-if="isEditingCapability">
                    <a-button class="h-9 px-4 rounded-lg font-bold"><template #icon><plus-outlined /></template>Upload Document</a-button>
                  </a-upload>
                  <a-input v-model:value="capabilityFormState.merchantPolicyLink" :readonly="!isEditingCapability" class="rounded-lg border-slate-200 h-[40px] flex items-center" :class="!isEditingCapability ? 'bg-white/70' : 'bg-white'" placeholder="Paste merchant policy document link" />
                  <a-textarea v-model:value="capabilityFormState.merchantPolicyRemark" :readonly="!isEditingCapability" :rows="4" class="rounded-xl border-slate-200 p-3" :class="!isEditingCapability ? 'bg-white/70' : 'bg-white'" placeholder="Summarize prohibited or restricted merchant, geography, payment method, or industry scenarios..." />
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
              <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingChargeback = true">
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
                    <a-radio-group v-model:value="chargebackFormState.chargebackHandling" :disabled="!isEditingChargeback" class="flex gap-8 mt-2">
                      <a-radio value="Email" class="font-bold text-slate-600">Email</a-radio>
                      <a-radio value="API" class="font-bold text-slate-600">API</a-radio>
                      <a-radio value="Portal" class="font-bold text-slate-600">Portal</a-radio>
                    </a-radio-group>
                  </a-form-item>
                </a-col>
                <a-col :span="24">
                  <a-form-item extra="Keep the dispute handling path aligned with the current operating workflow and source-of-truth doc.">
                    <template #label><span class="text-[13px] font-bold text-slate-700">Handling Notes & References</span></template>
                    <a-textarea v-model:value="chargebackFormState.chargebackRemarks" :readonly="!isEditingChargeback" :rows="4" class="rounded-xl border-slate-200 p-3" :class="!isEditingChargeback ? 'bg-slate-50' : 'bg-white'" placeholder="Paste Feishu link for the dispute SOP or add short handling notes..." />
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
              <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingReconciliation = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <div class="mb-6">
              <h4 class="text-[18px] font-black text-slate-900 m-0">Data Acquisition & Accounts</h4>
              <p class="text-slate-500 text-[14px] mt-2 font-medium">Define how reconciliation files are acquired, where payout account details live, and what sample material the operations team should reference.</p>
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
                    <div class="p-5 rounded-2xl border border-slate-100 bg-slate-50/30">
                      <div class="font-black text-slate-900 text-[13px] mb-3 uppercase tracking-widest">Detail</div>
                      <a-input v-model:value="reconciliationFormState.reconMethodDetail" :readonly="!isEditingReconciliation" placeholder="Add acquisition detail" class="rounded-lg h-[40px] flex items-center border-slate-200" :class="!isEditingReconciliation ? 'bg-slate-50' : 'bg-white'" />
                    </div>
                  </div>
                </a-checkbox-group>
                <div class="mt-4 text-[12px] text-slate-400 font-medium">Select every method currently used to obtain reconciliation files. Multiple methods can be active at the same time.</div>
              </div>

              <div class="space-y-8">
                <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                  <a-form-item extra="Record the payout account details or the source-of-truth reference used during reconciliation and settlement review.">
                    <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Corridor Payout Account</span></template>
                    <a-textarea v-model:value="reconciliationFormState.corridorPayoutAccount" :readonly="!isEditingReconciliation" :rows="3" class="rounded-2xl border-slate-200 p-4" :class="!isEditingReconciliation ? 'bg-white/50' : 'bg-white'" placeholder="Account details for corridor payouts..." />
                  </a-form-item>

                  <div class="mt-8">
                    <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest mb-2">Payout Account Images</div>
                    <p class="text-[12px] text-slate-400 mb-4 font-medium">Upload, drag, or paste screenshots here for account verification.</p>
                    <a-upload-dragger v-if="isEditingReconciliation" class="bg-white rounded-2xl border-slate-200 border-2">
                      <div class="ant-upload-drag-icon"><inbox-outlined class="text-sky-500 text-4xl" /></div>
                      <p class="ant-upload-text text-slate-700 font-black text-[16px]">Click, drag, or paste payout account images here</p>
                      <p class="ant-upload-hint text-slate-400 text-[12px] font-medium">Accepted: PNG, JPG, WEBP and other image formats.</p>
                    </a-upload-dragger>
                    <div v-else class="h-[140px] rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 flex flex-col items-center justify-center gap-2">
                      <eye-outlined class="text-slate-300 text-2xl" />
                      <span class="text-slate-400 font-black text-[13px] uppercase tracking-widest">No images uploaded</span>
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
                      <a-textarea v-model:value="reconciliationFormState.sampleNotes" :readonly="!isEditingReconciliation" :rows="4" class="rounded-2xl border-slate-200 p-4" :class="!isEditingReconciliation ? 'bg-white/50' : 'bg-white'" placeholder="Describe important columns, file formatting, validation rules, naming conventions, or parsing notes..." />
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
              <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingTax = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <a-form layout="vertical">
              <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                <div class="mb-6">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Tax Details & Reporting Rules</div>
                  <p class="text-[12px] text-slate-500 mt-2 mb-0 font-medium">Explain the concrete tax handling cases for this corridor, including who reports tax, VAT/GST or withholding ownership, market-specific filing treatment, and known exceptions.</p>
                </div>
                <a-form-item class="mb-0">
                  <template #label><span class="text-[13px] font-black text-slate-700">Tax Case Notes</span></template>
                  <a-textarea v-model:value="taxFormState.taxDetails" :readonly="!isEditingTax" :rows="6" class="rounded-2xl border-slate-200 p-4" :class="!isEditingTax ? 'bg-white/50' : 'bg-white'" placeholder="Describe concrete tax scenarios, for example who reports VAT/GST, whether withholding applies, country-specific filing rules, and any exceptions the operations team must follow..." />
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
              <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingMerchantMid = true">
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
                  <a-textarea v-model:value="merchantMidFormState.merchantMidDetails" :readonly="!isEditingMerchantMid" :rows="6" class="rounded-2xl border-slate-200 p-4" :class="!isEditingMerchantMid ? 'bg-white/50' : 'bg-white'" placeholder="Describe the merchant onboarding flow, including who creates the MID, required documents, KYB/KYC checkpoints, approval dependencies, activation conditions, common blockers, and escalation paths..." />
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
              <a-button v-else type="text" size="small" class="text-sky-600 font-bold hover:bg-sky-50 px-3 rounded-lg" @click="isEditingFiopTracking = true">
                <template #icon><edit-outlined /></template>Edit
              </a-button>
            </a-space>
          </div>
          <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
            <a-form layout="vertical" class="space-y-6">
              <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                <div class="mb-6">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Latest Progress Remark</div>
                  <p class="text-[12px] text-slate-500 mt-2 mb-0 font-medium">Use this box to capture the newest FIOP follow-up. A timestamp is generated on save and the newest entry is synced to the Corridor view.</p>
                </div>
                <a-form-item class="mb-0">
                  <template #label><span class="text-[13px] font-black text-slate-700">Remark</span></template>
                  <a-textarea v-model:value="fiopTrackingFormState.draftRemark" :readonly="!isEditingFiopTracking" :rows="4" class="rounded-2xl border-slate-200 p-4" :class="!isEditingFiopTracking ? 'bg-white/50' : 'bg-white'" placeholder="Record the latest progress, blocker, owner follow-up, or next step..." />
                </a-form-item>
              </div>

              <div class="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                <div class="mb-6">
                  <div class="text-[13px] font-black text-slate-700 uppercase tracking-widest">History</div>
                  <p class="text-[12px] text-slate-500 mt-2 mb-0 font-medium">Past records remain editable so FIOP can refine the running narrative without losing the original timestamps.</p>
                </div>

                <div v-if="fiopTrackingFormState.entries.length" class="space-y-4">
                  <div v-for="entry in fiopTrackingFormState.entries" :key="entry.id" class="rounded-2xl border border-slate-200 bg-white/70 p-5">
                    <div class="flex items-center justify-between gap-4 mb-3">
                      <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest">{{ entry.time }}</div>
                      <a-button v-if="isEditingFiopTracking" type="text" danger size="small" class="px-0 h-auto font-bold" @click="handleRemoveFiopTrackingEntry(entry.id)">Remove</a-button>
                    </div>
                    <a-textarea v-model:value="entry.remark" :readonly="!isEditingFiopTracking" :auto-size="{ minRows: 3, maxRows: 6 }" class="rounded-2xl border-slate-200 p-4" :class="!isEditingFiopTracking ? 'bg-white/80' : 'bg-white'" placeholder="Progress note" />
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
          <a-timeline v-if="channel.auditLogs?.length">
            <a-timeline-item v-for="(log, idx) in channel.auditLogs" :key="idx" :color="log.color || 'blue'">
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
    <a-modal v-model:open="isLaunchModalVisible" title="Initiate Launch Sequence" @ok="handleInitiateLaunch" okText="Confirm & Go Live">
      <div class="text-center py-6">
        <div class="w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <rocket-outlined class="text-3xl" />
        </div>
        <h3 class="text-lg font-bold text-slate-900">Are you ready to go LIVE?</h3>
        <p class="text-slate-500">This will synchronize all pricing rules and tech configurations to the production environment.</p>
        <div class="mt-4 p-4 bg-slate-50 rounded-lg text-left text-xs text-slate-400 space-y-2">
          <div class="flex items-center gap-2"><check-circle-filled class="text-emerald-500" /> KYC Verification Passed</div>
          <div class="flex items-center gap-2"><check-circle-filled class="text-emerald-500" /> Master Services Agreement Signed</div>
          <div class="flex items-center gap-2"><check-circle-filled class="text-emerald-500" /> Technical User Acceptance Testing Passed</div>
        </div>
      </div>
    </a-modal>

    <!-- 挂起/标记丢失弹窗 -->
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
          <a-textarea v-model:value="lostRemarks" :rows="3" placeholder="Please provide details..." />
        </a-form-item>
      </a-form>
    </a-modal>

  </a-layout>
</template>

<style scoped>
.clean-card {
  border-radius: 16px;
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
