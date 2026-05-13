import {
  applyLaunchFundDecision,
  applyLaunchFundReviewRevocation,
  applyLaunchFundReviewSubmission,
  applyLaunchFundSourceChange,
  buildFundPrerequisiteSnapshot,
  getPricingLegalStageStatus,
  isCardPaymentMethodName,
  normalizeFundApprovalStatus,
  normalizeSettlementConfig,
  PRICING_COMPLETED_STATUS,
  type FundApprovalHistoryEntry,
  type FundApprovalStatus,
} from '../constants/initialData';
import { chargebackHandlingOptions } from '../constants/channelOptions';
import {
  createTerminalDecisionLifecycle,
  markLifecycleRevoked,
  recordTerminalDecision,
  revokeTerminalDecision,
  type RevocableAction,
} from './workflowLifecycle';

export type ResolveFundProposalOptions = {
  selectedPricingProposalId?: string | null;
};

export type FundQueueRow = {
  id: string;
  channel: any;
  corridorName: string;
  productType: string;
  flowKey: 'payin' | 'payout' | 'mixed' | 'other';
  acquisitionMethod: string;
  settlementAccountDetails: string;
  disputeHandlingChannel: string;
  handlingNotesReferences: string;
  approvalStatus: FundApprovalStatus;
  updatedAt: string;
};

export type FundPaymentMethodRecord = {
  proposalId: string;
  proposalName: string;
  methodId: string;
  methodName: string;
  method: any;
  settlement: any;
  refundCapability: string[];
  refundMethod: string[];
  isCard: boolean;
};

export type FundPricingScheduleRecord = {
  proposalId: string;
  proposalName: string;
  updatedAt: string;
  proposal: any;
  paymentMethodRecords: FundPaymentMethodRecord[];
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

const normalizeList = (value: unknown) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))];
  }

  const normalized = normalizeText(value);
  return normalized ? [normalized] : [];
};

const dedupeStrings = (values: string[]) => [...new Set(values.map((item) => normalizeText(item)).filter(Boolean))];

const formatListPreview = (values: string[], fallback = 'Not set') => {
  const deduped = dedupeStrings(values);
  return deduped.length ? deduped.join(', ') : fallback;
};

const sortProposalsByUpdatedAt = (proposals: any[] = []) => (
  [...proposals].sort((left, right) => (
    new Date(String(right?.updatedAt || '')).getTime() - new Date(String(left?.updatedAt || '')).getTime()
  ))
);

const getFundApproval = (channel: any) => (
  channel?.fundApproval && typeof channel.fundApproval === 'object' ? channel.fundApproval : {}
);

const getFundHistory = (approval: any): FundApprovalHistoryEntry[] => (
  Array.isArray(approval?.history) ? approval.history : []
);

const sortFundHistoryByTimeDesc = (history: FundApprovalHistoryEntry[] = []) => (
  [...history].sort((left, right) => (
    new Date(String(right?.time || '')).getTime() - new Date(String(left?.time || '')).getTime()
  ))
);

const isFundDecisionEntry = (entry: any) => entry?.type === 'approve' || entry?.type === 'request_changes';

const getLatestVisibleFundHistoryEntry = (history: FundApprovalHistoryEntry[] = []) => (
  sortFundHistoryByTimeDesc(history).find((entry: any) => entry?.lifecycle?.state !== 'revoked') || null
);

const getLatestVisibleFundDecisionEntry = (history: FundApprovalHistoryEntry[] = []) => {
  const latestVisibleEntry = getLatestVisibleFundHistoryEntry(history);
  return latestVisibleEntry && isFundDecisionEntry(latestVisibleEntry) ? latestVisibleEntry : null;
};

const getLatestVisibleFundSubmissionEntry = (history: FundApprovalHistoryEntry[] = []) => (
  sortFundHistoryByTimeDesc(history).find((entry: any) => (
    entry?.type === 'submit'
    && entry?.lifecycle?.state !== 'revoked'
  )) || null
);

export const isFundReviewSubmitted = (channel: any) => {
  const approval = getFundApproval(channel);
  const status = normalizeFundApprovalStatus(approval.status);
  const latestVisibleSubmit = getLatestVisibleFundSubmissionEntry(getFundHistory(approval));
  const hasActiveSubmitFields = Boolean(
    normalizeText(approval.submittedAt)
    || normalizeText(approval.submittedBy)
  );

  if (status === 'pending') {
    return Boolean(hasActiveSubmitFields || latestVisibleSubmit);
  }

  if (status === 'not_started') return false;

  return Boolean(
    hasActiveSubmitFields
    || status === 'approved'
    || status === 'changes_requested'
  );
};

const getSupportedProducts = (channel: any) => normalizeList(channel?.supportedProducts);

const getProposalName = (proposal: any) => normalizeText(proposal?.customProposalType) || 'Pricing Schedule';

const chargebackHandlingLabelMap = new Map(chargebackHandlingOptions.map((option) => [option.value, option.label]));

const mapPaymentMethodRecord = (proposal: any, method: any): FundPaymentMethodRecord => ({
  proposalId: normalizeText(proposal?.id),
  proposalName: getProposalName(proposal),
  methodId: normalizeText(method?.id),
  methodName: normalizeText(method?.method) || 'Unnamed method',
  method,
  settlement: normalizeSettlementConfig(method?.settlement),
  refundCapability: normalizeList(method?.capabilityFlags?.refundCapability),
  refundMethod: normalizeList(method?.capabilityFlags?.refundMethod),
  isCard: isCardPaymentMethodName(method?.method),
});

export const getFundFlowKey = (channel: any): FundQueueRow['flowKey'] => {
  const products = getSupportedProducts(channel);
  const hasPayin = products.some((item) => /pay\s*in|payin|acquiring|collect/i.test(item));
  const hasPayout = products.some((item) => /pay\s*out|payout|disbursement|withdraw/i.test(item));

  if (hasPayin && hasPayout) return 'mixed';
  if (hasPayin) return 'payin';
  if (hasPayout) return 'payout';
  return 'other';
};

export const isFundPayinEligible = (channel: any) => {
  const flowKey = getFundFlowKey(channel);
  return flowKey === 'payin' || flowKey === 'mixed';
};

export const getFundProductTypeLabel = (channel: any) => (
  isFundPayinEligible(channel) ? 'Payin' : formatListPreview(getSupportedProducts(channel), 'Unspecified')
);

export const getFundApprovalLabel = (status: FundApprovalStatus) => {
  if (status === 'approved') return 'completed';
  if (status === 'changes_requested') return 'Revision Required';
  if (status === 'not_started') return 'not started';
  return 'Under fund review';
};

export const getFundApprovalTheme = (status: FundApprovalStatus) => {
  if (status === 'approved') {
    return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
  }

  if (status === 'changes_requested') {
    return { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' };
  }

  if (status === 'not_started') {
    return { bg: '#f8fafc', text: '#64748b', border: '#cbd5e1' };
  }

  return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
};

export const resolveFundCurrentProposal = (
  channel: any,
  options: ResolveFundProposalOptions = {},
) => {
  const proposals = sortProposalsByUpdatedAt(Array.isArray(channel?.pricingProposals) ? channel.pricingProposals : []);
  const selectedProposalId = normalizeText(options.selectedPricingProposalId);

  if (selectedProposalId) {
    const selectedProposal = proposals.find((proposal: any) => normalizeText(proposal?.id) === selectedProposalId);
    if (selectedProposal) return selectedProposal;
  }

  return proposals[0] || null;
};

export const getFundCurrentProposalLabel = (
  channel: any,
  options: ResolveFundProposalOptions = {},
) => {
  const proposal = resolveFundCurrentProposal(channel, options);
  return proposal ? getProposalName(proposal) : 'No current pricing proposal';
};

export const getFundPaymentMethodRecords = (
  channel: any,
  options: ResolveFundProposalOptions = {},
): FundPaymentMethodRecord[] => {
  const proposal = resolveFundCurrentProposal(channel, options);
  if (!proposal) return [];

  const methods = Array.isArray(proposal?.paymentMethods) ? proposal.paymentMethods : [];
  return methods.map((method: any) => mapPaymentMethodRecord(proposal, method));
};

export const getFundPricingScheduleList = (channel: any): FundPricingScheduleRecord[] => {
  const proposals = sortProposalsByUpdatedAt(Array.isArray(channel?.pricingProposals) ? channel.pricingProposals : [])
    .filter((proposal: any) => getPricingLegalStageStatus(proposal) === PRICING_COMPLETED_STATUS);

  return proposals.map((proposal: any) => {
    const methods = Array.isArray(proposal?.paymentMethods) ? proposal.paymentMethods : [];
    return {
      proposalId: normalizeText(proposal?.id),
      proposalName: getProposalName(proposal),
      updatedAt: normalizeText(proposal?.updatedAt),
      proposal,
      paymentMethodRecords: methods.map((method: any) => mapPaymentMethodRecord(proposal, method)),
    };
  });
};

const getAcquisitionMethod = (channel: any) => (
  formatListPreview(normalizeList(channel?.reconMethods), 'No acquisition method')
);

const getSettlementAccountDetails = (channel: any) => (
  normalizeText(channel?.corridorPayoutAccount) || 'No settlement account details'
);

const getDisputeHandlingChannel = (channel: any) => {
  const labels = normalizeList(channel?.chargebackHandling)
    .map((value) => chargebackHandlingLabelMap.get(value) || value);

  return formatListPreview(labels, 'No dispute handling channel');
};

const getHandlingNotesReferences = (channel: any) => (
  normalizeText(channel?.chargebackRemarks) || 'No notes captured'
);

export const buildFundQueueRows = (channels: any[] = []): FundQueueRow[] => (
  channels
    .filter((channel) => isFundReviewSubmitted(channel) && buildFundPrerequisiteSnapshot(channel).ready)
    .map((channel) => {
    const approvalStatus = normalizeFundApprovalStatus(getFundApproval(channel).status);

    return {
      id: `fund-${normalizeText(channel?.id || channel?.channelId || channel?.channelName)}`,
      channel,
      corridorName: normalizeText(channel?.channelName) || 'Unnamed Corridor',
      productType: getFundProductTypeLabel(channel),
      flowKey: getFundFlowKey(channel),
      acquisitionMethod: getAcquisitionMethod(channel),
      settlementAccountDetails: getSettlementAccountDetails(channel),
      disputeHandlingChannel: getDisputeHandlingChannel(channel),
      handlingNotesReferences: getHandlingNotesReferences(channel),
      approvalStatus,
      updatedAt: normalizeText(getFundApproval(channel).lastActionAt)
        || normalizeText(getFundApproval(channel).submittedAt)
        || normalizeText(channel?.lastModifiedAt),
    };
  }).sort((left, right) => (
    new Date(String(right.updatedAt || '')).getTime() - new Date(String(left.updatedAt || '')).getTime()
  ))
);

const createFundHistoryEntry = (
  type: FundApprovalHistoryEntry['type'],
  status: FundApprovalStatus,
  actor: string,
  time: string,
  note: string,
  extra: Partial<FundApprovalHistoryEntry> = {},
): FundApprovalHistoryEntry => ({
  id: `fund-${type}-${time}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  status,
  user: actor,
  time,
  note,
  ...extra,
});

export const applyFundSourceChannelUpdate = (
  channel: any,
  patch: Record<string, any>,
  actor: string,
  time: string,
  action: string,
) => {
  const currentApproval = getFundApproval(channel);
  const history = Array.isArray(currentApproval.history) ? currentApproval.history : [];
  const currentStatus = normalizeFundApprovalStatus(currentApproval.status);
  const shouldReopen = currentStatus === 'approved' || currentStatus === 'changes_requested';
  const reopenedNote = currentStatus === 'changes_requested'
    ? 'FIOP updated mirrored source data; fund review moved back to Not Started.'
    : 'Mirrored source data changed after approval; fund review moved back to Not Started.';

  const nextApproval = shouldReopen
    ? {
        ...currentApproval,
        status: 'not_started' as FundApprovalStatus,
        note: reopenedNote,
        submittedAt: '',
        submittedBy: '',
        submitNote: '',
        lastActionAt: time,
        lastActionBy: actor,
        history: [
          createFundHistoryEntry(
            'reopened',
            'not_started',
            actor,
            time,
            reopenedNote,
          ),
          ...history,
        ],
      }
    : currentApproval;

  const updatedChannel = {
    ...channel,
    ...patch,
    fundApproval: nextApproval,
    lastModifiedAt: time,
    auditLogs: [
      {
        time,
        user: actor,
        action,
        color: 'orange',
      },
      ...(Array.isArray(channel?.auditLogs) ? channel.auditLogs : []),
    ],
  };

  return shouldReopen
    ? applyLaunchFundSourceChange(updatedChannel, actor, time)
    : updatedChannel;
};

export const applyFundEditableChannelUpdate = applyFundSourceChannelUpdate;

export const applyFundReviewSubmission = (
  channel: any,
  actor: string,
  time: string,
  note = '',
) => {
  const currentApproval = getFundApproval(channel);
  const normalizedNote = normalizeText(note);
  const history = Array.isArray(currentApproval.history) ? currentApproval.history : [];
  const previousStatus = normalizeFundApprovalStatus(currentApproval.status);
  const nextApproval = {
    ...currentApproval,
    status: 'pending' as FundApprovalStatus,
    submittedAt: time,
    submittedBy: actor,
    submitNote: normalizedNote,
    note: normalizedNote || normalizeText(currentApproval.note),
    lastActionAt: time,
    lastActionBy: actor,
    history: [
      createFundHistoryEntry(
        'submit',
        'pending',
        actor,
        time,
        normalizedNote || 'Fund review submitted.',
        { previousStatus },
      ),
      ...history,
    ],
  };

  const updatedChannel = {
    ...channel,
    fundApproval: nextApproval,
    lastModifiedAt: time,
    auditLogs: [
      {
        time,
        user: actor,
        action: `${isFundReviewSubmitted(channel) ? 'Resubmitted' : 'Submitted'} fund review to Fund.${normalizedNote ? ` ${normalizedNote}` : ''}`,
        color: 'blue',
      },
      ...(Array.isArray(channel?.auditLogs) ? channel.auditLogs : []),
    ],
  };

  return applyLaunchFundReviewSubmission(
    updatedChannel,
    actor,
    time,
    normalizedNote || 'Fund review submitted.',
  );
};

export const canRevokeFundReviewSubmission = (channel: any) => {
  const approval = getFundApproval(channel);
  const latestSubmit = getLatestVisibleFundSubmissionEntry(getFundHistory(approval));
  return (
    normalizeFundApprovalStatus(approval.status) === 'pending'
    && Boolean(
      latestSubmit
      || normalizeText(approval.submittedAt)
      || normalizeText(approval.submittedBy)
    )
  );
};

export const applyFundReviewRevocation = (
  channel: any,
  actor: string,
  time: string,
  note = '',
) => {
  if (!canRevokeFundReviewSubmission(channel)) return channel;

  const currentApproval = getFundApproval(channel);
  const history = Array.isArray(currentApproval.history) ? currentApproval.history : [];
  const latestSubmit = history.find((entry: any) => (
    entry?.type === 'submit'
    && entry?.lifecycle?.state !== 'revoked'
  ));
  const normalizedNote = normalizeText(note) || 'Fund review submission revoked before Fund decision.';
  const restoredStatus = normalizeFundApprovalStatus(latestSubmit?.previousStatus || 'not_started');
  const nextHistory = history.map((entry: any) => (
    latestSubmit && entry.id === latestSubmit.id
      ? { ...entry, lifecycle: markLifecycleRevoked(entry.lifecycle) }
      : entry
  ));

  const nextApproval = {
    ...currentApproval,
    status: restoredStatus,
    submittedAt: '',
    submittedBy: '',
    submitNote: '',
    note: normalizedNote,
    lastActionAt: time,
    lastActionBy: actor,
    history: [
      createFundHistoryEntry(
        'revoke',
        restoredStatus,
        actor,
        time,
        normalizedNote,
        latestSubmit ? { originEventId: latestSubmit.id } : {},
      ),
      ...nextHistory,
    ],
  };

  const updatedChannel = {
    ...channel,
    fundApproval: nextApproval,
    lastModifiedAt: time,
    auditLogs: [
      {
        time,
        user: actor,
        action: normalizedNote,
        color: 'orange',
      },
      ...(Array.isArray(channel?.auditLogs) ? channel.auditLogs : []),
    ],
  };

  return applyLaunchFundReviewRevocation(
    updatedChannel,
    actor,
    time,
    normalizedNote,
  );
};

export const applyFundApprovalDecision = (
  channel: any,
  type: 'approve' | 'request_changes',
  actor: string,
  time: string,
  note: string,
) => {
  const status: FundApprovalStatus = type === 'approve' ? 'approved' : 'changes_requested';
  const currentApproval = getFundApproval(channel);
  const history = getFundHistory(currentApproval);
  const decisionEntryId = `fund-${type}-${time}-${Math.random().toString(36).slice(2, 8)}`;
  const previousStatus = normalizeFundApprovalStatus(currentApproval.status);
  const nextApproval = {
    ...currentApproval,
    status,
    note,
    lastActionAt: time,
    lastActionBy: actor,
    history: [
      {
        ...createFundHistoryEntry(type, status, actor, time, note, {
          lifecycle: createTerminalDecisionLifecycle(),
          terminalDecision: recordTerminalDecision({
            decisionEventId: decisionEntryId,
            revocableByActor: actor,
            previousStatus,
            previousQueueState: previousStatus,
          }),
        }),
        id: decisionEntryId,
      },
      ...history,
    ],
  };

  const updatedChannel = {
    ...channel,
    fundApproval: nextApproval,
    lastModifiedAt: time,
    auditLogs: [
      {
        time,
        user: actor,
        action: type === 'approve'
          ? 'Approved fund go-live confirmation.'
          : `Requested changes for fund go-live confirmation.${note ? ` ${note}` : ''}`,
        color: type === 'approve' ? 'green' : 'orange',
      },
      ...(Array.isArray(channel?.auditLogs) ? channel.auditLogs : []),
    ],
  };
  return applyLaunchFundDecision(
    updatedChannel,
    type,
    actor,
    time,
    note,
  );
};

export const getFundRevocableAction = (
  channel: any,
  actorName: string,
): RevocableAction | null => {
  const approval = getFundApproval(channel);
  const latestDecision = getLatestVisibleFundDecisionEntry(getFundHistory(approval));
  if (!latestDecision) return null;

  const eventId = normalizeText(latestDecision.id);
  const terminalDecision = latestDecision.terminalDecision || recordTerminalDecision({
    decisionEventId: eventId,
    revocableByActor: normalizeText(latestDecision.user),
    previousStatus: 'pending',
    previousQueueState: 'pending',
  });

  if (
    !eventId
    || !terminalDecision.revocable
    || terminalDecision.revokedAt
    || terminalDecision.revocableByActor !== normalizeText(actorName)
  ) {
    return null;
  }

  return {
    type: 'terminal_revoke',
    eventId,
    label: 'Revoke',
  };
};

export const revokeFundApprovalDecision = (
  channel: any,
  actor: string,
  time: string,
  reason = '',
) => {
  const currentApproval = getFundApproval(channel);
  const history = getFundHistory(currentApproval);
  const latestDecision = getLatestVisibleFundDecisionEntry(history);
  const action = getFundRevocableAction(channel, actor);
  if (!latestDecision || !action || action.eventId !== latestDecision.id) return channel;

  const restoredStatus = normalizeFundApprovalStatus(latestDecision.terminalDecision?.previousStatus || 'pending');
  const latestSubmit = getLatestVisibleFundSubmissionEntry(history);
  const normalizedReason = normalizeText(reason) || `Restored ${getFundApprovalLabel(restoredStatus)} after Fund status revoke.`;
  const terminalDecision = latestDecision.terminalDecision || recordTerminalDecision({
    decisionEventId: latestDecision.id,
    revocableByActor: normalizeText(latestDecision.user),
    previousStatus: restoredStatus,
    previousQueueState: restoredStatus,
  });
  const revokedDecision = revokeTerminalDecision(
    terminalDecision,
    actor,
    normalizedReason,
    time,
  );
  const nextHistory = history.map((entry: any) => (
    entry.id === latestDecision.id
      ? {
          ...entry,
          lifecycle: markLifecycleRevoked(entry.lifecycle),
          terminalDecision: revokedDecision,
        }
      : entry
  ));
  const restoredSubmittedAt = restoredStatus === 'pending'
    ? normalizeText(currentApproval.submittedAt) || normalizeText(latestSubmit?.time)
    : '';
  const restoredSubmittedBy = restoredStatus === 'pending'
    ? normalizeText(currentApproval.submittedBy) || normalizeText(latestSubmit?.user)
    : '';
  const restoredSubmitNote = restoredStatus === 'pending'
    ? normalizeText(currentApproval.submitNote) || normalizeText(latestSubmit?.note)
    : '';

  const nextApproval = {
    ...currentApproval,
    status: restoredStatus,
    note: normalizedReason,
    submittedAt: restoredSubmittedAt,
    submittedBy: restoredSubmittedBy,
    submitNote: restoredSubmitNote,
    lastActionAt: time,
    lastActionBy: actor,
    history: nextHistory,
  };

  return {
    ...channel,
    fundApproval: nextApproval,
    lastModifiedAt: time,
    auditLogs: [
      {
        time,
        user: actor,
        action: normalizedReason,
        color: 'orange',
      },
      ...(Array.isArray(channel?.auditLogs) ? channel.auditLogs : []),
    ],
  };
};
