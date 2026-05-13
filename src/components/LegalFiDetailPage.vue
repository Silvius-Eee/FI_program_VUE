<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { message, Modal } from 'ant-design-vue';
import { ArrowLeftOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons-vue';
import { useAppStore } from '../stores/app';
import LegalStatusTimeline from './LegalStatusTimeline.vue';
import { openAttachmentRecord } from '../utils/attachment';
import { saveAttachmentBlob } from '../utils/attachmentStorage';
import {
  applyPricingLegalDecision,
  buildPricingUnifiedHistory,
  getPricingLegalStatusOptions,
  getLatestPricingApprovalHistoryEvent,
  getLatestVisiblePricingUnifiedHistoryEntry,
  getLegalVisiblePricingProposals,
  getPricingRevocableAction,
  getPricingLegalStageStatus,
  PRICING_COMPLETED_STATUS,
  PRICING_CORRIDOR_REVIEW_STATUS,
  PRICING_LEGAL_QUEUE_STATUS_VALUES,
  PRICING_LEGAL_REVIEW_STATUS,
  revokePricingLegalDecision,
  revokePricingPendingHandoff,
  type PricingUnifiedHistoryEntry,
} from '../constants/initialData';
import {
  applyLegalStatusUpdate,
  getDefaultLegalSubmissionStatus,
  getInitialLegalStatusForActor,
  getLegalRevocableAction,
  getLegalDocumentStatusTheme,
  getLegalQueueGroup,
  getLegalRequestPacket,
  getLegalStatusHistory,
  getLegalStatusOptions,
  revokeLegalPendingHandoff,
  revokeLegalTerminalDecision,
  normalizeLegalDocumentStatusLabel,
  normalizeWorkflowStatusLabel,
  getWorkflowStatusTheme,
  type LegalAttachment,
  type LegalDocType,
} from '../utils/workflowStatus';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';

type LegalTabKey = 'nda' | 'msa' | 'pricing' | 'otherAttachments';
type LegalTabOption = { key: LegalTabKey; label: string; docType?: LegalDocType };

const store = useAppStore();
const uploadFileList = ref<any[]>([]);
const legalUploadFileList = ref<any[]>([]);
const packetDraft = reactive({ entities: [] as string[], documentLink: '', remarks: '' });
const legalDraft = reactive({ status: '', note: '' });
const pricingLegalDraft = reactive({ status: PRICING_COMPLETED_STATUS, note: '' });
const legalAttachmentAccept = '.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.jpg,.jpeg,.png,.gif,.webp,.bmp,.heic,.heif';
const supportedLegalAttachmentExtensions = new Set([
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
const pendingFiAttachmentHydration = ref<Promise<LegalAttachment[]> | null>(null);
const pendingLegalAttachmentHydration = ref<Promise<LegalAttachment[]> | null>(null);
const fiAttachmentHydrationVersion = ref(0);
const legalAttachmentHydrationVersion = ref(0);

const entityOptions = [
  'SwooshTransfer Ltd (UK) - SPI licensed',
  'Steelhenge Pte Ltd (Singapore)',
  'Steelhenge HongKong Group Limited (HK)',
  'Quantumtech Ltd (HK) - MSO licensed',
  'QuantumWing Limited (HK)',
];
const legalTabOptions: LegalTabOption[] = [
  { key: 'nda', label: 'NDA', docType: 'NDA' },
  { key: 'msa', label: 'MSA', docType: 'MSA' },
  { key: 'pricing', label: 'Pricing Schedule' },
  { key: 'otherAttachments', label: 'Other Attachments', docType: 'OTHER_ATTACHMENTS' },
];

const docMetaMap: Record<LegalDocType, { title: string; subtitleFi: string; subtitleLegal: string; linkLabel: string; linkPlaceholder: string; remarksPlaceholder: string }> = {
  NDA: {
    title: 'Non-Disclosure Agreement',
    subtitleFi: 'FIOP maintains the shared NDA packet here before Legal takes action.',
    subtitleLegal: 'Legal reviews the latest NDA packet from FIOP and updates the shared status.',
    linkLabel: 'NDA Document Link',
    linkPlaceholder: 'Paste the NDA source link or signing URL',
    remarksPlaceholder: 'Add the latest remarks, signature details, or blocker for Legal',
  },
  MSA: {
    title: 'Master Services Agreement',
    subtitleFi: 'FIOP maintains the shared MSA packet here before Legal takes action.',
    subtitleLegal: 'Legal reviews the latest MSA packet from FIOP and updates the shared status.',
    linkLabel: 'MSA Document Link',
    linkPlaceholder: 'Paste the MSA source link, dataroom URL, or signing URL',
    remarksPlaceholder: 'Add the latest remarks, redline status, or blocker for Legal',
  },
  OTHER_ATTACHMENTS: {
    title: 'Other Attachments',
    subtitleFi: 'FIOP maintains supplemental files and references here before Legal reviews them.',
    subtitleLegal: 'Legal reviews the latest supporting attachments from FIOP and updates the shared status.',
    linkLabel: 'Attachment Link',
    linkPlaceholder: 'Paste the dataroom, folder, or source link for these supporting attachments',
    remarksPlaceholder: 'Add what these attachments contain, what changed, or what Legal should pay attention to',
  },
};

const channel = computed(() => store.selectedChannel || null);
const isLegalReviewer = computed(() => store.currentUserRole === 'LEGAL');
const isFiEditor = computed(() => store.canOperateFiWork(channel.value));
const getRawLegalDocumentStatus = (targetChannel: any, targetDocType: LegalDocType) => (
  targetDocType === 'NDA'
    ? (targetChannel?.ndaStatus || targetChannel?.globalProgress?.nda)
    : targetDocType === 'MSA'
      ? (targetChannel?.contractStatus || targetChannel?.globalProgress?.contract)
      : (targetChannel?.otherAttachmentsStatus || targetChannel?.globalProgress?.otherAttachments)
);
const isLegalDocumentVisibleToLegal = (targetChannel: any, targetDocType: LegalDocType) => (
  getLegalQueueGroup(
    targetDocType,
    normalizeLegalDocumentStatusLabel(targetDocType, getRawLegalDocumentStatus(targetChannel, targetDocType)),
  ) !== 'inactive'
);
const tab = computed<LegalTabKey>({
  get: () => store.legalDetailActiveTab,
  set: (value) => {
    store.legalDetailActiveTab = value;
    if (value !== 'pricing') store.selectedPricingProposalId = null;
  },
});
const docType = computed<LegalDocType | null>(() => (
  tab.value === 'nda' ? 'NDA' : tab.value === 'msa' ? 'MSA' : tab.value === 'otherAttachments' ? 'OTHER_ATTACHMENTS' : null
));
const docMeta = computed(() => (docType.value ? docMetaMap[docType.value] : null));
const requestPacket = computed(() => (
  channel.value && docType.value ? getLegalRequestPacket(channel.value, docType.value) : { entities: [], documentLink: '', remarks: '', attachments: [], submittedAt: '', submittedBy: '' }
));
const historyEntries = computed(() => (channel.value && docType.value ? getLegalStatusHistory(channel.value, docType.value) : []));
const docStatus = computed(() => (
  docType.value
    ? normalizeLegalDocumentStatusLabel(docType.value, getRawLegalDocumentStatus(channel.value, docType.value))
    : 'Not Started'
));
const docTheme = computed(() => getLegalDocumentStatusTheme(docType.value || 'MSA', docStatus.value));
const legalOptions = computed(() => (docType.value ? getLegalStatusOptions(docType.value, 'Legal') : []));
const getAttachmentExtension = (name?: string | null) => {
  const matched = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return matched?.[1] || '';
};
const normalizeAttachmentUrl = (value: unknown) => {
  const normalized = String((value as any)?.url || (value as any)?.downloadUrl || '').trim();
  return /^https?:/i.test(normalized) ? normalized : '';
};
const normalizeLegacyLocalAttachmentUrl = (value: unknown) => {
  const normalized = String((value as any)?.url || (value as any)?.downloadUrl || '').trim();
  return /^(data:|blob:)/i.test(normalized) ? normalized : '';
};
const normalizeLegalAttachmentList = (attachments: any[] = [], previousList: any[] = []): LegalAttachment[] => {
  const previousMap = new Map((Array.isArray(previousList) ? previousList : []).map((attachment: any) => [String(attachment?.uid || ''), attachment] as const));

  return Array.isArray(attachments)
    ? attachments.map((attachment: any, index: number) => {
        const uid = String(attachment?.uid || `legal-attachment-${index}`);
        const previous = previousMap.get(uid);
        const url = normalizeAttachmentUrl(attachment) || normalizeAttachmentUrl(previous) || '';

        return {
          uid,
          name: String(attachment?.name || `Attachment ${index + 1}`),
          status: String(attachment?.status || 'done'),
          size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : 0,
          type: String(attachment?.type || ''),
          storageId: String(attachment?.storageId || previous?.storageId || ''),
          url,
          downloadUrl: url,
          urlSessionId: '',
        };
      })
    : [];
};
const getAttachmentBlobForStorage = async (attachment: any, previous?: any) => {
  if (typeof window === 'undefined') return null;

  if (attachment?.originFileObj instanceof Blob) {
    return attachment.originFileObj;
  }

  const legacyLocalUrl = normalizeLegacyLocalAttachmentUrl(attachment) || normalizeLegacyLocalAttachmentUrl(previous);
  if (!legacyLocalUrl) return null;

  try {
    const response = await fetch(legacyLocalUrl);
    return await response.blob();
  } catch {
    return null;
  }
};
const buildPersistentLegalAttachmentList = async (attachments: any[] = [], previousList: any[] = []) => {
  const previousMap = new Map((Array.isArray(previousList) ? previousList : []).map((attachment: any) => [String(attachment?.uid || ''), attachment] as const));

  return Promise.all((Array.isArray(attachments) ? attachments : []).map(async (attachment: any, index: number) => {
    const uid = String(attachment?.uid || `legal-attachment-${index}`);
    const previous = previousMap.get(uid);
    const name = String(attachment?.name || previous?.name || `Attachment ${index + 1}`);
    const type = String(attachment?.type || previous?.type || '');
    const size = Number.isFinite(Number(attachment?.size ?? previous?.size)) ? Number(attachment?.size ?? previous?.size) : 0;
    let storageId = String(attachment?.storageId || previous?.storageId || '');
    const url = normalizeAttachmentUrl(attachment) || normalizeAttachmentUrl(previous) || '';
    const blob = await getAttachmentBlobForStorage(attachment, previous);

    if (blob) {
      storageId = await saveAttachmentBlob({
        id: storageId || undefined,
        blob,
        name,
        type,
        size,
        prefix: 'legal-attachment',
      });
    }

    return {
      uid,
      name,
      status: String(attachment?.status || 'done'),
      size,
      type,
      storageId,
      url,
      downloadUrl: url,
      urlSessionId: '',
    };
  }));
};
const isSupportedLegalAttachment = (file: any) => {
  const extension = getAttachmentExtension(file?.name);
  const mimeType = String(file?.type || '').toLowerCase();

  return supportedLegalAttachmentExtensions.has(extension)
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
const formatAttachmentKind = (attachment: LegalAttachment) => {
  const extension = getAttachmentExtension(attachment.name);
  if (extension) return extension.toUpperCase();

  const mimeSegment = String(attachment.type || '').split('/').pop();
  return mimeSegment ? mimeSegment.toUpperCase() : 'FILE';
};
const openLegalAttachment = async (attachment: LegalAttachment) => {
  const opened = await openAttachmentRecord(attachment);
  if (!opened) {
    message.info('This attachment file is not available. Re-upload it or use the shared document link.');
  }
};
const serializedAttachments = computed(() => normalizeLegalAttachmentList(uploadFileList.value));
const serializedLegalAttachments = computed(() => normalizeLegalAttachmentList(legalUploadFileList.value));
const legalActorName = computed(() => {
  if (isLegalReviewer.value) return 'Legal Team';
  if (isFiEditor.value) return store.currentUserName;
  return channel.value?.fiopOwner || 'Unassigned';
});
const legalBackLabel = computed(() => (
  store.legalDetailReturnView === 'pricing' ? 'Back to Pricing' : 'Back to Corridor'
));
const legalRevocableAction = computed(() => (
  channel.value && docType.value && (isLegalReviewer.value || isFiEditor.value)
    ? getLegalRevocableAction(
        channel.value,
        docType.value,
        isLegalReviewer.value ? 'Legal' : 'FIOP',
        legalActorName.value,
      )
    : null
));
const isLegalDecisionLocked = computed(() => (
  isLegalReviewer.value && legalRevocableAction.value?.type === 'terminal_revoke'
));
const isPricingProposalManuallyCollapsed = ref(false);

watch([channel, docType, docStatus, isLegalReviewer], () => {
  packetDraft.entities = [...requestPacket.value.entities];
  packetDraft.documentLink = requestPacket.value.documentLink;
  packetDraft.remarks = requestPacket.value.remarks;
  legalDraft.status = docType.value
    ? getInitialLegalStatusForActor(docType.value, isLegalReviewer.value ? 'Legal' : 'FIOP', docStatus.value)
    : '';
  legalDraft.note = '';
  uploadFileList.value = requestPacket.value.attachments.map((item) => ({ ...item, status: item.status || 'done' }));
  legalUploadFileList.value = [];
}, { immediate: true });

const proposals = computed(() => (
  Array.isArray(channel.value?.pricingProposals)
    ? (isLegalReviewer.value
        ? getLegalVisiblePricingProposals(channel.value.pricingProposals)
        : [...channel.value.pricingProposals])
        .filter((item: any) => {
          const stageStatus = getPricingLegalStageStatus(item);

          if (isLegalReviewer.value) {
            return PRICING_LEGAL_QUEUE_STATUS_VALUES.includes(stageStatus as any);
          }

          const approvalStatus = normalizeWorkflowStatusLabel(item?.approvalStatus || 'Not Started');
          return approvalStatus !== 'Not Started'
            || stageStatus !== 'Not Started'
            || Boolean(getLatestVisiblePricingUnifiedHistoryEntry(item));
        })
        .sort((left: any, right: any) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime())
    : []
));
const visibleLegalTabOptions = computed(() => {
  if (!isLegalReviewer.value) return legalTabOptions;

  return legalTabOptions.filter((option) => {
    if (option.key === 'pricing') return proposals.value.length > 0;
    return Boolean(channel.value && option.docType && isLegalDocumentVisibleToLegal(channel.value, option.docType));
  });
});
const hasVisibleLegalTabs = computed(() => visibleLegalTabOptions.value.length > 0);

watch([visibleLegalTabOptions, tab], ([options]) => {
  if (!isLegalReviewer.value) return;
  if (options.some((option) => option.key === tab.value)) return;

  const nextTab = options[0]?.key;
  if (nextTab) {
    tab.value = nextTab;
    return;
  }

  store.selectedPricingProposalId = null;
}, { immediate: true });

watch(proposals, (items) => {
  if (tab.value !== 'pricing') return;
  if (store.selectedPricingProposalId && items.some((item) => item.id === store.selectedPricingProposalId)) return;
  if (isPricingProposalManuallyCollapsed.value) return;
  store.selectedPricingProposalId = items[0]?.id || null;
}, { immediate: true });

watch(tab, (value) => {
  if (value !== 'pricing') {
    isPricingProposalManuallyCollapsed.value = false;
    return;
  }
  if (store.selectedPricingProposalId || isPricingProposalManuallyCollapsed.value) return;
  store.selectedPricingProposalId = proposals.value[0]?.id || null;
});

watch(channel, (nextChannel, previousChannel) => {
  if (nextChannel === previousChannel) return;
  isPricingProposalManuallyCollapsed.value = false;
  if (tab.value !== 'pricing') return;
  if (store.selectedPricingProposalId && proposals.value.some((item) => item.id === store.selectedPricingProposalId)) return;
  store.selectedPricingProposalId = proposals.value[0]?.id || null;
});

const proposal = computed(() => proposals.value.find((item: any) => item.id === store.selectedPricingProposalId) || null);
const pricingLegalOptions = computed(() => getPricingLegalStatusOptions());
const canLegalReviewPricing = computed(() => (
  isLegalReviewer.value
  && proposal.value
  && getPricingLegalStageStatus(proposal.value) === PRICING_LEGAL_REVIEW_STATUS
));
watch([proposal, isLegalReviewer], () => {
  const status = proposal.value ? getPricingLegalStageStatus(proposal.value) : '';
  pricingLegalDraft.status = status === PRICING_CORRIDOR_REVIEW_STATUS
    ? PRICING_CORRIDOR_REVIEW_STATUS
    : PRICING_COMPLETED_STATUS;
  pricingLegalDraft.note = '';
}, { immediate: true });
const pricingRevocableAction = computed(() => {
  if (!proposal.value) return null;
  if (isLegalReviewer.value) {
    return getPricingRevocableAction(proposal.value, 'Legal', legalActorName.value);
  }
  if (isFiEditor.value) {
    return getPricingRevocableAction(proposal.value, 'FIOP', store.currentUserName);
  }
  return null;
});
const isPricingLegalDecisionLocked = computed(() => (
  isLegalReviewer.value && pricingRevocableAction.value?.type === 'terminal_revoke'
));
const getProposalPacket = (item: any) => ({
  documentLink: String(item?.legalRequestPacket?.documentLink || item?.link || '').trim(),
  remarks: String(item?.legalRequestPacket?.remarks || item?.remark || '').trim(),
  attachments: Array.isArray(item?.legalRequestPacket?.attachments) ? item.legalRequestPacket.attachments : [],
  submittedAt: String(item?.legalRequestPacket?.submittedAt || getLatestPricingApprovalHistoryEvent(item, 'approve')?.time || '').trim(),
  submittedBy: String(item?.legalRequestPacket?.submittedBy || getLatestPricingApprovalHistoryEvent(item, 'approve')?.user || '').trim(),
});
const proposalHistoryEntries = computed(() => buildPricingUnifiedHistory(proposal.value));
const pricingLegalGeneratedNotes = new Set([
  'Legal completed pricing schedule review.',
  'Legal returned pricing schedule to FIOP for updates.',
]);
const getVisiblePricingHistoryNote = (entry: PricingUnifiedHistoryEntry) => {
  const note = String(entry.note || '').trim();
  if (!note) return '';
  return entry.stage === 'legal' && pricingLegalGeneratedNotes.has(note) ? '' : note;
};
const getPricingHistoryDisplayStatus = (entry: PricingUnifiedHistoryEntry, index: number) => {
  if (entry.displayStatus) return entry.displayStatus;
  if (entry.lifecycle?.state !== 'revoked') return entry.status;

  const previousVisibleEntry = proposalHistoryEntries.value.slice(index + 1).find((candidate) => candidate.lifecycle?.state !== 'revoked');
  if (entry.stage === 'legal' && previousVisibleEntry?.stage === 'fi_supervisor') {
    return PRICING_LEGAL_REVIEW_STATUS;
  }
  return normalizeWorkflowStatusLabel(previousVisibleEntry?.status || 'Not Started');
};
const shouldShowPricingHistoryTitle = (entry: PricingUnifiedHistoryEntry) => entry.stage === 'fi_supervisor';

const getProposalLegalStatus = (item: any) => getPricingLegalStageStatus(item);
const getProposalLegalTheme = (item: any) => getWorkflowStatusTheme(getProposalLegalStatus(item));
const isReferralMode = (value?: string | null) => (value || '').trim().toLowerCase() === 'referral';
const isReferralProposal = (item: any) => isReferralMode(item?.mode);
const getProposalReferralRuleText = (item: any) => (
  String(item?.referralRule || '').replace(/\s+/g, ' ').trim() || 'No referral rule captured.'
);
const getProposalLatestSyncTime = (item: any) => (
  getLatestVisiblePricingUnifiedHistoryEntry(item)?.time
  || getProposalPacket(item).submittedAt
  || String(item?.updatedAt || '').trim()
  || 'No synced update yet'
);
const canEditReturnedPricing = (item: any) => (
  isFiEditor.value
  && ['FIOP', 'FIBD'].includes(store.currentUserRole)
  && getPricingLegalStageStatus(item) === PRICING_CORRIDOR_REVIEW_STATUS
);
const openReturnedPricingProposal = (proposalId?: string | null) => {
  store.openPricingProposal(proposalId, {
    returnView: 'legalDetail',
    entryMode: 'proposalScoped',
  });
};
const handlePricingProposalPanelChange = (nextKey: string | string[]) => {
  const resolvedKey = Array.isArray(nextKey) ? nextKey[0] : nextKey;
  if (!resolvedKey) {
    isPricingProposalManuallyCollapsed.value = true;
    store.selectedPricingProposalId = null;
    return;
  }
  isPricingProposalManuallyCollapsed.value = false;
  store.selectedPricingProposalId = resolvedKey;
};
const getPricingHistoryTheme = (_entry: PricingUnifiedHistoryEntry, displayStatus: string) => (
  getWorkflowStatusTheme(displayStatus)
);
const getPricingHistoryStageStyle = (entry: PricingUnifiedHistoryEntry) => {
  if (entry.stage === 'legal') {
    return { backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' };
  }
  if (entry.stage === 'fi_supervisor') {
    return { backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe' };
  }
  return { backgroundColor: '#ecfeff', color: '#0f766e', borderColor: '#99f6e4' };
};

const preventUpload = () => false;
const hydrateAttachmentSelection = async (
  info: any,
  previousList: LegalAttachment[],
) => {
  const nextFiles = Array.isArray(info?.fileList) ? info.fileList : [];
  const invalidCount = nextFiles.filter((file: any) => !isSupportedLegalAttachment(file)).length;

  if (invalidCount) {
    message.warning('Only PDF, Word, Excel/CSV, and image files are supported.');
  }

  return buildPersistentLegalAttachmentList(
    nextFiles.filter((file: any) => isSupportedLegalAttachment(file)),
    previousList,
  );
};
const onUploadChange = async (info: any) => {
  const version = fiAttachmentHydrationVersion.value + 1;
  fiAttachmentHydrationVersion.value = version;
  const hydrationPromise = hydrateAttachmentSelection(info, serializedAttachments.value);
  pendingFiAttachmentHydration.value = hydrationPromise;

  try {
    const nextAttachments = await hydrationPromise;
    if (fiAttachmentHydrationVersion.value !== version) return;
    uploadFileList.value = nextAttachments;
  } catch {
    message.error('Failed to process attachment. Please retry the upload.');
  } finally {
    if (pendingFiAttachmentHydration.value === hydrationPromise) {
      pendingFiAttachmentHydration.value = null;
    }
  }
};
const onLegalUploadChange = async (info: any) => {
  const version = legalAttachmentHydrationVersion.value + 1;
  legalAttachmentHydrationVersion.value = version;
  const hydrationPromise = hydrateAttachmentSelection(info, serializedLegalAttachments.value);
  pendingLegalAttachmentHydration.value = hydrationPromise;

  try {
    const nextAttachments = await hydrationPromise;
    if (legalAttachmentHydrationVersion.value !== version) return;
    legalUploadFileList.value = nextAttachments;
  } catch {
    message.error('Failed to process legal attachment. Please retry the upload.');
  } finally {
    if (pendingLegalAttachmentHydration.value === hydrationPromise) {
      pendingLegalAttachmentHydration.value = null;
    }
  }
};
const removeLegalAttachment = (uid: string) => {
  legalUploadFileList.value = serializedLegalAttachments.value.filter((file) => file.uid !== uid);
};

const onSaveFiPacket = async () => {
  if (!channel.value || !docType.value || !docMeta.value) return;
  if (!isFiEditor.value) {
    message.warning('Only assigned FIOP/FIBD users or the FI Supervisor can send packets to Legal.');
    return;
  }
  if (pendingFiAttachmentHydration.value) {
    try {
      await pendingFiAttachmentHydration.value;
    } catch {
      message.error('Attachments are still processing. Please retry save after upload completes.');
      return;
    }
  }
  if (!packetDraft.entities.length) return message.warning('Select at least one contracting entity before sending to Legal.');
  if (!packetDraft.remarks.trim()) return message.warning('Add remarks before sending the packet to Legal.');
  if (showTextLimitWarning(message.warning, [
    { label: docMeta.value.linkLabel, value: packetDraft.documentLink, max: INPUT_LIMITS.url },
    { label: 'Remarks', value: packetDraft.remarks, max: INPUT_LIMITS.note },
  ])) return;

  const activeChannel = channel.value;
  const activeDocType = docType.value;
  const activeDocMeta = docMeta.value;
  const nextStatus = getDefaultLegalSubmissionStatus(activeDocType);
  Modal.confirm({
    title: `Send ${activeDocMeta.title} to Legal?`,
    okText: 'Send to Legal',
    onOk: () => {
      const updated = applyLegalStatusUpdate({
        channel: activeChannel,
        docType: activeDocType,
        actorRole: 'FIOP',
        actorName: legalActorName.value,
        nextStatus,
        note: packetDraft.remarks.trim(),
        timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        packetUpdate: {
          entities: [...packetDraft.entities],
          documentLink: packetDraft.documentLink.trim(),
          remarks: packetDraft.remarks.trim(),
          attachments: serializedAttachments.value,
        },
      });
      store.updateChannel(updated);
      message.success(`${activeDocMeta.title} sent to Legal.`);
    },
  });
};

const onSaveLegalStatus = async () => {
  if (!channel.value || !docType.value || !docMeta.value) return;
  if (!isLegalReviewer.value) {
    message.warning('Only Legal can update legal status.');
    return;
  }
  if (isLegalDecisionLocked.value) {
    message.warning('Revoke the latest Legal status or wait for FIOP to resubmit before approving again.');
    return;
  }
  if (pendingLegalAttachmentHydration.value) {
    try {
      await pendingLegalAttachmentHydration.value;
    } catch {
      message.error('Legal attachments are still processing. Please retry save after upload completes.');
      return;
    }
  }
  if (showTextLimitWarning(message.warning, [
    { label: 'Remarks', value: legalDraft.note, max: INPUT_LIMITS.note },
  ])) return;

  const activeChannel = channel.value;
  const activeDocType = docType.value;
  const activeDocMeta = docMeta.value;
  const activeLegalAttachments = serializedLegalAttachments.value;
  Modal.confirm({
    title: `Update ${activeDocMeta.title} status?`,
    okText: 'Save Status',
    onOk: () => {
      const updated = applyLegalStatusUpdate({
        channel: activeChannel,
        docType: activeDocType,
        actorRole: 'Legal',
        actorName: legalActorName.value,
        nextStatus: legalDraft.status as any,
        note: legalDraft.note.trim(),
        timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        historyAttachments: activeLegalAttachments,
      });
      store.updateChannel(updated);
      legalUploadFileList.value = [];
      message.success(`${activeDocMeta.title} status updated.`);
    },
  });
};

const onSavePricingLegalStatus = () => {
  if (!channel.value || !proposal.value) return;
  if (!isLegalReviewer.value) {
    message.warning('Only Legal can update pricing legal status.');
    return;
  }
  if (isPricingLegalDecisionLocked.value) {
    message.warning('Revoke the latest Pricing Legal decision or wait for FIOP to resubmit before approving again.');
    return;
  }
  if (![PRICING_CORRIDOR_REVIEW_STATUS, PRICING_COMPLETED_STATUS].includes(pricingLegalDraft.status)) {
    message.warning('Select a valid Legal status for this pricing schedule.');
    return;
  }
  if (showTextLimitWarning(message.warning, [
    { label: 'Legal feedback', value: pricingLegalDraft.note, max: INPUT_LIMITS.note },
  ])) return;

  const activeProposal = proposal.value;
  Modal.confirm({
    title: `Update ${activeProposal.customProposalType || 'Pricing Schedule'} legal status?`,
    okText: 'Save Status',
    onOk: () => {
      const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const updated = applyPricingLegalDecision(
        channel.value,
        activeProposal.id,
        pricingLegalDraft.status,
        legalActorName.value,
        timestamp,
        pricingLegalDraft.note.trim(),
      );
      store.updateChannel({
        ...updated,
        auditLogs: [
          {
            time: timestamp,
            user: legalActorName.value,
            action: `Updated pricing schedule "${activeProposal.customProposalType || 'Pricing Schedule'}" legal status to ${pricingLegalDraft.status}.${pricingLegalDraft.note.trim() ? ` ${pricingLegalDraft.note.trim()}` : ''}`,
            color: pricingLegalDraft.status === PRICING_COMPLETED_STATUS ? 'green' : 'orange',
          },
          ...(channel.value.auditLogs || []),
        ],
      });
      pricingLegalDraft.note = '';
      message.success('Pricing legal status updated.');
    },
  });
};

const handleRevokeLegalAction = () => {
  if (!channel.value || !docType.value || !legalRevocableAction.value) return;

  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const actionType = legalRevocableAction.value.type;
  const updated = actionType === 'handoff_revoke'
    ? revokeLegalPendingHandoff(
        channel.value,
        docType.value,
        isLegalReviewer.value ? 'Legal' : 'FIOP',
        legalActorName.value,
        timestamp,
      )
    : revokeLegalTerminalDecision(
        channel.value,
        docType.value,
        legalActorName.value,
        timestamp,
      );

  store.updateChannel(updated);
  message.success(
    actionType === 'handoff_revoke'
      ? `${docMeta.value?.title || 'Legal document'} send revoked.`
      : `${docMeta.value?.title || 'Legal document'} status revoked.`,
  );
};

const handleRevokePricingAction = () => {
  if (!channel.value || !proposal.value || !pricingRevocableAction.value) return;

  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  if (pricingRevocableAction.value.type === 'handoff_revoke') {
    store.updateChannel(
      revokePricingPendingHandoff(
        channel.value,
        proposal.value.id,
        'FIOP',
        store.currentUserName,
        timestamp,
      ),
    );
    message.success('Pricing send revoked.');
    return;
  }

  store.updateChannel(
    revokePricingLegalDecision(
      channel.value,
      proposal.value.id,
      legalActorName.value,
      timestamp,
    ),
  );
  message.success('Pricing legal status revoked.');
};
</script>

<template>
  <div class="legal-page px-5 py-6">
    <div class="mx-auto max-w-[1280px] space-y-5">
      <div v-if="!channel" class="panel-card px-10 py-12 text-center">
        <a-empty description="No legal task selected." />
        <a-button type="primary" class="mt-6 h-[42px] rounded-xl px-6 font-bold" @click="store.closeLegalDetail()">Return</a-button>
      </div>

      <template v-else>
        <section class="panel-card p-6">
          <a-button type="text" class="!mb-4 !px-0 font-bold text-slate-500" @click="store.closeLegalDetail()">
            <template #icon><arrow-left-outlined /></template>
            {{ legalBackLabel }}
          </a-button>
          <div class="flex flex-wrap items-start justify-between gap-5">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="m-0 text-[28px] font-black tracking-[-0.02em] text-slate-950">{{ channel.channelName || 'Unnamed Corridor' }}</h2>
              </div>
              <p class="mt-3 mb-0 text-[13px] font-medium leading-relaxed text-slate-500">
                Use this legal workbench to keep the current packet, Legal feedback, and status updates for this corridor in one place.
              </p>
            </div>
            <div class="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <div class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">FIOP</div>
              <div class="mt-2 text-[13px] font-semibold text-slate-700">{{ channel.fiopOwner || 'Unassigned' }}</div>
            </div>
          </div>
        </section>

        <section class="panel-card p-6">
          <a-tabs v-if="hasVisibleLegalTabs" v-model:activeKey="tab" class="legal-tabs">
            <a-tab-pane
              v-for="option in visibleLegalTabOptions"
              :key="option.key"
              :tab="option.label"
            />
          </a-tabs>
          <a-empty v-else description="No submitted legal content for this corridor." />
        </section>

        <section v-if="hasVisibleLegalTabs && tab !== 'pricing'" class="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <article class="panel-card p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="kicker">{{ isLegalReviewer ? 'Submission Packet' : isFiEditor ? 'FIOP Packet' : 'FI Packet' }}</div>
                <h3 class="panel-title">{{ docMeta?.title }}</h3>
                <p class="panel-copy">{{ isLegalReviewer ? docMeta?.subtitleLegal : isFiEditor ? docMeta?.subtitleFi : 'Review the latest FI packet and current legal status for this corridor.' }}</p>
              </div>
              <a-tag :style="{ backgroundColor: docTheme.bg, color: docTheme.text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '6px 14px' }">
                {{ docStatus }}
              </a-tag>
            </div>

            <template v-if="isLegalReviewer">
              <div class="mt-5 grid gap-4 md:grid-cols-3">
                <div class="info-card">
                  <div class="info-label">Submitted At</div>
                  <div class="info-value">{{ requestPacket.submittedAt || 'No packet yet' }}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Submitted By</div>
                  <div class="info-value">{{ requestPacket.submittedBy || channel.fiopOwner || 'Unassigned' }}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Entities</div>
                  <div class="info-value">{{ requestPacket.entities.length ? requestPacket.entities.join(', ') : 'No entities captured.' }}</div>
                </div>
              </div>

              <div class="mt-4 grid gap-4">
                <div class="info-card">
                  <div class="info-label">{{ docMeta?.linkLabel }}</div>
                  <div class="info-value break-all">{{ requestPacket.documentLink || 'No link shared.' }}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Remarks</div>
                  <div class="info-value">{{ requestPacket.remarks || 'No remarks shared.' }}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Attachments</div>
                  <div class="flex flex-wrap gap-2">
                    <button v-for="file in requestPacket.attachments" :key="file.uid" type="button" class="chip chip--clickable" @click="openLegalAttachment(file)">{{ file.name }}</button>
                    <span v-if="!requestPacket.attachments.length" class="text-[12px] font-semibold text-slate-400">No attachments captured.</span>
                  </div>
                </div>
                <div class="info-card">
                  <div class="info-label">Legal Status</div>
                  <a-select v-model:value="legalDraft.status" class="mt-3 w-full status-select" :options="legalOptions" :disabled="isLegalDecisionLocked" />
                  <div v-if="isLegalDecisionLocked" class="mt-3 rounded-[14px] border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] font-bold leading-relaxed text-orange-700">
                    Revoke the latest Legal status, or wait for FIOP to resubmit, before approving again.
                  </div>
                </div>
                <div class="info-card">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div class="info-label">Legal Attachments</div>
                      <div class="mt-2 text-[12px] font-semibold leading-relaxed text-slate-400">
                        Upload files that Legal wants to send back with this status update.
                      </div>
                    </div>
                    <a-upload
                      multiple
                      :accept="legalAttachmentAccept"
                      :before-upload="preventUpload"
                      :file-list="legalUploadFileList"
                      :show-upload-list="false"
                      :disabled="isLegalDecisionLocked"
                      @change="onLegalUploadChange"
                    >
                      <a-button class="h-[38px] rounded-xl border-sky-200 bg-sky-50 px-4 font-bold text-sky-700" :disabled="isLegalDecisionLocked">
                        <template #icon><upload-outlined /></template>
                        Upload files
                      </a-button>
                    </a-upload>
                  </div>

                  <div v-if="serializedLegalAttachments.length" class="mt-4 space-y-2">
                    <div
                      v-for="file in serializedLegalAttachments"
                      :key="file.uid"
                      class="flex items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-white px-3 py-2"
                    >
                      <div class="min-w-0">
                        <div class="truncate text-[13px] font-bold text-slate-700">{{ file.name }}</div>
                        <div class="mt-0.5 text-[11px] font-semibold text-slate-400">{{ formatAttachmentKind(file) }} / {{ formatAttachmentSize(file.size) }}</div>
                      </div>
                      <a-tooltip title="Remove file">
                        <a-button
                          type="text"
                          class="shrink-0 rounded-lg text-slate-400 hover:text-rose-600"
                          @click="removeLegalAttachment(file.uid)"
                        >
                          <template #icon><delete-outlined /></template>
                        </a-button>
                      </a-tooltip>
                    </div>
                  </div>
                  <div v-else class="mt-4 rounded-[14px] border border-dashed border-slate-200 bg-white px-3 py-3 text-[12px] font-semibold text-slate-400">
                    No legal attachments selected for this update.
                  </div>
                </div>
                <div class="info-card">
                  <div class="info-label">Remarks</div>
                  <a-textarea v-model:value="legalDraft.note" :maxlength="INPUT_LIMITS.note" :rows="6" show-count class="mt-3" placeholder="Add remarks for the legal conclusion, requested changes, or archive record" :readonly="isLegalDecisionLocked" />
                </div>
              </div>

              <div class="mt-5 flex justify-center">
                <a-button type="primary" class="action-button" :disabled="isLegalDecisionLocked" @click="onSaveLegalStatus">Save Status</a-button>
              </div>
            </template>

            <template v-else>
              <div class="mt-5 space-y-4">
                <div class="info-card">
                  <div class="info-label">Contracting Entities</div>
                  <div class="mt-3 grid gap-3 md:grid-cols-2">
                    <label v-for="entity in entityOptions" :key="entity" class="option-card" :class="packetDraft.entities.includes(entity) ? 'option-card--active' : ''">
                      <a-checkbox :checked="packetDraft.entities.includes(entity)" :disabled="!isFiEditor" @change="() => packetDraft.entities = packetDraft.entities.includes(entity) ? packetDraft.entities.filter((item) => item !== entity) : [...packetDraft.entities, entity]">
                        <span class="text-[13px] font-semibold text-slate-700">{{ entity }}</span>
                      </a-checkbox>
                    </label>
                  </div>
                </div>
                <div class="info-card">
                  <div class="info-label">Attachments</div>
                  <a-upload-dragger class="mt-3" multiple :disabled="!isFiEditor" :accept="legalAttachmentAccept" :before-upload="preventUpload" :file-list="uploadFileList" :show-upload-list="false" @change="onUploadChange">
                    <div class="py-6 text-center">
                      <div class="text-[15px] font-black text-slate-900">Drop files here or select attachments</div>
                      <div class="mt-1 text-[12px] font-medium text-slate-400">Support PDF, Word, Excel/CSV, and image files.</div>
                    </div>
                  </a-upload-dragger>
                  <div v-if="serializedAttachments.length" class="mt-3 flex flex-wrap gap-2">
                    <button v-for="file in serializedAttachments" :key="file.uid" type="button" class="chip chip--clickable" @click="openLegalAttachment(file)">{{ file.name }}</button>
                  </div>
                </div>
                <div class="info-card">
                  <div class="info-label">{{ docMeta?.linkLabel }}</div>
                  <a-input v-model:value="packetDraft.documentLink" :maxlength="INPUT_LIMITS.url" :readonly="!isFiEditor" class="mt-3" :placeholder="docMeta?.linkPlaceholder" />
                </div>
                <div class="info-card">
                  <div class="info-label">Remarks</div>
                  <a-textarea v-model:value="packetDraft.remarks" :maxlength="INPUT_LIMITS.note" :readonly="!isFiEditor" :rows="6" show-count class="mt-3" :placeholder="docMeta?.remarksPlaceholder" />
                </div>
              </div>

              <div v-if="isFiEditor" class="mt-5 flex justify-center">
                <a-button type="primary" class="action-button" @click="onSaveFiPacket">Send to Legal</a-button>
              </div>
              <div v-else class="mt-5 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-semibold text-slate-500">
                Assigned FIOP/FIBD users and the FI Supervisor can update this packet here.
              </div>
            </template>
          </article>

          <article class="panel-card p-6">
            <div class="kicker">Legal Timeline</div>
            <h3 class="panel-title">{{ docMeta?.title }}</h3>
            <div class="mt-5">
              <LegalStatusTimeline
                v-if="docType"
                :doc-type="docType"
                :events="historyEntries"
                :revocable-action="legalRevocableAction"
                empty-title="No legal history yet"
                :empty-description="`${docMeta?.title} has not entered the legal workflow for this corridor.`"
                @revoke="handleRevokeLegalAction"
              />
            </div>
          </article>
        </section>

        <section v-else-if="hasVisibleLegalTabs" class="grid gap-5 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
          <article class="panel-card p-6">
            <div>
              <div>
                <div class="kicker">Pricing in Legal</div>
                <h3 class="panel-title">Submitted pricing schedules</h3>
                <p class="panel-copy">Review each submitted quotation, shared packet, attachments, and current pricing status.</p>
              </div>
            </div>

            <div v-if="proposals.length" class="mt-5">
              <a-collapse
                accordion
                class="pricing-proposal-collapse"
                :bordered="false"
                :active-key="store.selectedPricingProposalId || undefined"
                @change="handlePricingProposalPanelChange"
              >
                <a-collapse-panel
                  v-for="item in proposals"
                  :key="item.id"
                  class="pricing-proposal-panel"
                >
                  <template #header>
                    <div class="pricing-proposal-header">
                      <div class="pricing-proposal-heading">
                        <div class="pricing-proposal-title">
                          {{ item.customProposalType || 'Pricing Schedule' }}
                        </div>
                        <div class="pricing-status-row">
                          <a-tag class="pricing-status-tag" :style="{ backgroundColor: getProposalLegalTheme(item).bg, color: getProposalLegalTheme(item).text, border: 'none', borderRadius: '999px', fontWeight: 800, padding: '4px 12px' }">
                            {{ getProposalLegalStatus(item) }}
                          </a-tag>
                        </div>
                      </div>

                      <div class="pricing-meta-row">
                        <span class="pricing-meta-chip">
                          <span class="pricing-meta-label">Mode</span>
                          <span class="pricing-meta-value">{{ item.mode || 'N/A' }}</span>
                        </span>
                        <span class="pricing-meta-chip pricing-meta-chip--wide">
                          <span class="pricing-meta-label">Submitted at</span>
                          <span class="pricing-meta-value">{{ getProposalLatestSyncTime(item) }}</span>
                        </span>
                        <span v-if="isReferralProposal(item)" class="pricing-meta-chip pricing-meta-chip--full">
                          <span class="pricing-meta-label">Referral rule</span>
                          <span class="pricing-meta-value">{{ getProposalReferralRuleText(item) }}</span>
                        </span>
                      </div>
                    </div>
                  </template>

                  <div class="pricing-proposal-body">
                    <div class="pricing-detail-grid">
                      <div class="pricing-detail-block">
                        <div class="pricing-detail-label">Document Link</div>
                        <div class="pricing-detail-value">{{ getProposalPacket(item).documentLink || 'No document link.' }}</div>
                      </div>

                      <div class="pricing-detail-block">
                        <div class="pricing-detail-label">Remarks</div>
                        <div class="pricing-detail-value">{{ getProposalPacket(item).remarks || 'No pricing remarks shared for legal yet.' }}</div>
                      </div>

                      <div class="pricing-detail-block pricing-detail-block--wide">
                        <div class="pricing-detail-label">Attachments</div>
                        <div class="pricing-attachment-list">
                          <button
                            v-for="file in getProposalPacket(item).attachments"
                            :key="file.uid"
                            type="button"
                            class="chip chip--clickable pricing-attachment-chip"
                            @click.stop="openLegalAttachment(file)"
                          >
                            {{ file.name }}
                          </button>
                          <span v-if="!getProposalPacket(item).attachments.length" class="pricing-empty-text">No attachments captured.</span>
                        </div>
                      </div>
                    </div>

                    <div v-if="canEditReturnedPricing(item)" class="pricing-return-card">
                      <div>
                        <div class="info-label">FIOP Action Required</div>
                        <div class="pricing-return-copy">
                          Legal returned this pricing schedule. Update it in Pricing and resubmit for review.
                        </div>
                      </div>
                      <a-button
                        type="primary"
                        class="action-button pricing-return-button"
                        @click.stop="openReturnedPricingProposal(item.id)"
                      >
                        Edit and Resubmit
                      </a-button>
                    </div>

                    <div v-if="isLegalReviewer && proposal?.id === item.id" class="pricing-legal-decision-card">
                      <div class="pricing-legal-decision-head">
                        <div>
                          <div class="info-label">Legal Decision</div>
                          <div class="pricing-legal-decision-copy">
                            Legal can return the pricing schedule to FIOP or mark it completed.
                          </div>
                          <div v-if="isPricingLegalDecisionLocked" class="mt-3 rounded-[14px] border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] font-bold leading-relaxed text-orange-700">
                            Revoke the latest Pricing Legal decision, or wait for FIOP to resubmit, before approving again.
                          </div>
                        </div>
                      </div>

                      <div class="pricing-legal-decision-fields">
                        <a-select
                          v-model:value="pricingLegalDraft.status"
                          class="w-full status-select"
                          :options="pricingLegalOptions"
                          :disabled="!canLegalReviewPricing || isPricingLegalDecisionLocked"
                        />
                        <a-textarea
                          v-model:value="pricingLegalDraft.note"
                          :maxlength="INPUT_LIMITS.note"
                          :rows="3"
                          show-count
                          placeholder="Add Legal feedback or completion remarks"
                          :readonly="!canLegalReviewPricing || isPricingLegalDecisionLocked"
                        />
                      </div>

                      <div class="pricing-legal-decision-actions">
                        <div class="pricing-legal-decision-hint">
                          {{ isPricingLegalDecisionLocked ? 'Latest Legal decision is waiting for FIOP response.' : canLegalReviewPricing ? 'Ready for Legal decision.' : 'Legal action is available only while status is Under legal review.' }}
                        </div>
                        <a-button
                          type="primary"
                          class="action-button"
                          :disabled="!canLegalReviewPricing || isPricingLegalDecisionLocked"
                          @click.stop="onSavePricingLegalStatus"
                        >
                          Save Legal Status
                        </a-button>
                      </div>
                    </div>

                  </div>
                </a-collapse-panel>
              </a-collapse>
            </div>

            <div v-else class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
              <div class="text-[15px] font-black text-slate-500">No submitted pricing schedules yet</div>
              <div class="mt-2 text-[12px] font-semibold leading-relaxed text-slate-400">Only quotations already submitted from Pricing are shown here for Legal review tracking.</div>
            </div>
          </article>

          <article class="panel-card p-6">
            <div v-if="proposal" class="space-y-5">
              <div>
                <div class="kicker">Approval History</div>
                <h3 class="panel-title">{{ proposal.customProposalType || 'Pricing Schedule' }}</h3>
              </div>

              <div v-if="proposalHistoryEntries.length" class="pricing-history-list">
                <div
                  v-for="(entry, index) in proposalHistoryEntries"
                  :key="entry.key"
                  class="pricing-history-card"
                >
                  <div class="pricing-history-head">
                    <div class="pricing-history-title-wrap">
                      <div class="pricing-history-title-row">
                        <span
                          class="pricing-stage-pill"
                          :style="getPricingHistoryStageStyle(entry)"
                        >
                          {{ entry.stageLabel }}
                        </span>
                      </div>
                      <div v-if="shouldShowPricingHistoryTitle(entry)" class="pricing-history-title">{{ entry.title }}</div>
                    </div>

                    <a-tag
                      class="pricing-status-tag"
                      :style="{
                        backgroundColor: getPricingHistoryTheme(entry, getPricingHistoryDisplayStatus(entry, index)).bg,
                        color: getPricingHistoryTheme(entry, getPricingHistoryDisplayStatus(entry, index)).text,
                        border: 'none',
                        borderRadius: '999px',
                        fontWeight: 800,
                        padding: '4px 12px',
                      }"
                    >
                      {{ getPricingHistoryDisplayStatus(entry, index) }}
                    </a-tag>
                  </div>

                  <div class="pricing-history-meta">
                    <span>{{ entry.time }}</span>
                    <span v-if="entry.user">Actor: {{ entry.user }}</span>
                  </div>

                  <div v-if="entry.lifecycle?.state === 'revoked'" class="mt-3">
                    <span class="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-orange-700">
                      Revoked
                    </span>
                  </div>

                  <div v-if="getVisiblePricingHistoryNote(entry)" class="pricing-history-note">
                    <div class="pricing-history-note-label">Note</div>
                    <div class="pricing-history-note-value">{{ getVisiblePricingHistoryNote(entry) }}</div>
                  </div>

                  <div
                    v-if="pricingRevocableAction && pricingRevocableAction.eventId === entry.eventId"
                    class="mt-4 flex justify-end"
                  >
                    <a-button
                      class="h-[36px] rounded-xl border-orange-200 bg-orange-50 px-4 font-bold text-orange-700"
                      @click="handleRevokePricingAction"
                    >
                      {{ pricingRevocableAction.label }}
                    </a-button>
                  </div>
                </div>
              </div>

              <div v-else class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
                <div class="text-[15px] font-black text-slate-500">{{ proposal.customProposalType || 'Pricing Schedule' }} has no approval history yet</div>
                <div class="mt-2 text-[12px] font-semibold leading-relaxed text-slate-400">This quotation is synced here, but there is no submit, FI Supervisor, or Legal event recorded yet.</div>
              </div>
            </div>

            <div v-else class="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center">
              <div class="text-[15px] font-black text-slate-500">Select a pricing schedule</div>
              <div class="mt-2 text-[12px] font-semibold leading-relaxed text-slate-400">Choose one item from the left-side quotation list to review its combined approval history.</div>
            </div>
          </article>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.legal-page {
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 24%),
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.06), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #f8fafc 42%, #f8fafc 100%);
}

.panel-card {
  border-radius: 28px;
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 24px 54px -34px rgba(15, 23, 42, 0.3);
}

.kicker {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.panel-title {
  margin: 8px 0 0;
  color: #0f172a;
  font-size: 22px;
  font-weight: 900;
}

.panel-copy {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.6;
}

.info-card {
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.78);
  padding: 18px;
}

.info-label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.info-value {
  margin-top: 10px;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}

.chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid #e2e8f0;
  background: #fff;
  padding: 4px 12px;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
}

.chip--clickable {
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}

.chip--clickable:hover {
  border-color: #7dd3fc;
  background: #f0f9ff;
  color: #0369a1;
}

.chip--accent {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.pricing-proposal-header {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 10px;
  padding-right: 8px;
}

.pricing-proposal-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px 12px;
  min-width: 0;
}

.pricing-proposal-title {
  min-width: min(220px, 100%);
  flex: 1 1 240px;
  color: #0f172a;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: normal;
}

.pricing-status-row {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 100%;
}

.pricing-status-tag {
  max-width: 100%;
  margin-inline-end: 0;
  white-space: normal !important;
  text-align: center;
  line-height: 1.25;
}

.pricing-meta-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.65fr) minmax(180px, 1fr);
  gap: 8px;
}

.pricing-meta-chip {
  display: grid;
  min-width: 0;
  gap: 3px;
  border: 1px solid #dbeafe;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  padding: 8px 10px;
}

.pricing-meta-chip--full {
  grid-column: 1 / -1;
}

.pricing-meta-label,
.pricing-detail-label,
.pricing-history-note-label {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pricing-meta-value {
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.pricing-proposal-body {
  display: grid;
  gap: 12px;
  padding-top: 4px;
}

.pricing-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.pricing-detail-block {
  min-width: 0;
  border: 1px solid #dbe3ef;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  padding: 12px 14px;
}

.pricing-detail-block--wide {
  grid-column: 1 / -1;
}

.pricing-detail-value {
  margin-top: 6px;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
  overflow-wrap: anywhere;
  word-break: normal;
}

.pricing-attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.pricing-attachment-chip {
  min-height: 34px;
  max-width: 100%;
  border-radius: 12px;
  text-align: left;
  white-space: normal;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.pricing-empty-text {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
}

.pricing-return-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #fed7aa;
  border-radius: 18px;
  background: #fff7ed;
  padding: 14px;
}

.pricing-return-copy {
  margin-top: 5px;
  color: #9a3412;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.5;
}

.pricing-return-button {
  flex: 0 0 auto;
  min-width: 150px;
}

.pricing-legal-decision-card {
  display: grid;
  gap: 12px;
  border: 1px solid #bfdbfe;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
  padding: 14px;
}

.pricing-legal-decision-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px 12px;
}

.pricing-legal-decision-copy {
  margin-top: 5px;
  color: #64748b;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.45;
}

.pricing-legal-decision-fields {
  display: grid;
  gap: 10px;
}

.pricing-legal-decision-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.pricing-legal-decision-hint {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
}

.pricing-history-list {
  display: grid;
  gap: 12px;
}

.pricing-history-card {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.75);
  padding: 16px;
}

.pricing-history-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px 12px;
}

.pricing-history-title-wrap {
  min-width: min(260px, 100%);
  flex: 1 1 280px;
}

.pricing-history-title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pricing-stage-pill {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  border-radius: 999px;
  border: 1px solid;
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  line-height: 1.25;
  text-transform: uppercase;
  white-space: normal;
}

.pricing-history-title {
  margin-top: 8px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.pricing-history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
}

.pricing-history-note {
  margin-top: 12px;
  border-radius: 14px;
  background: #ffffff;
  padding: 10px 12px;
}

.pricing-history-note-value {
  margin-top: 4px;
  color: #334155;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.option-card {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  padding: 12px 14px;
  transition: all 0.2s ease;
}

.option-card--active {
  border-color: #7dd3fc;
  background: rgba(240, 249, 255, 0.8);
}

.action-button {
  height: 44px;
  border: none;
  border-radius: 16px;
  background: #0284c7;
  padding: 0 20px;
  font-weight: 900;
  box-shadow: 0 18px 32px -20px rgba(2, 132, 199, 0.45);
}

.status-select :deep(.ant-select-selector) {
  min-height: 44px;
  border-radius: 14px !important;
}

.pricing-proposal-collapse {
  background: transparent;
}

.pricing-proposal-collapse :deep(.ant-collapse-item) {
  margin-bottom: 14px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  background: rgba(248, 250, 252, 0.78);
}

.pricing-proposal-collapse :deep(.ant-collapse-item-active) {
  border-color: #bfdbfe;
  background: rgba(239, 246, 255, 0.72);
  box-shadow: 0 18px 36px -28px rgba(37, 99, 235, 0.35);
}

.pricing-proposal-collapse :deep(.ant-collapse-header) {
  padding: 18px 20px !important;
  align-items: flex-start !important;
}

.pricing-proposal-collapse :deep(.ant-collapse-header-text) {
  min-width: 0;
}

.pricing-proposal-collapse :deep(.ant-collapse-content) {
  border-top: 1px solid #dbeafe;
  background: transparent;
}

.pricing-proposal-collapse :deep(.ant-collapse-content-box) {
  padding: 0 20px 20px !important;
}

.legal-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.legal-tabs :deep(.ant-tabs-tab) {
  padding: 14px 2px 16px;
  margin-right: 24px;
  font-weight: 800;
  font-size: 14px;
}

@media (max-width: 720px) {
  .pricing-meta-row,
  .pricing-detail-grid {
    grid-template-columns: 1fr;
  }

  .pricing-status-row {
    justify-content: flex-start;
  }

  .pricing-proposal-collapse :deep(.ant-collapse-header) {
    padding: 16px !important;
  }

  .pricing-proposal-collapse :deep(.ant-collapse-content-box) {
    padding: 0 16px 16px !important;
  }
}
</style>
