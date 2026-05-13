<template>
  <div
    :style="{
      padding: '12px 20px 16px',
      minHeight: 'calc(100vh - 64px)',
      background: 'radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 26%), linear-gradient(180deg, #f8fbff 0%, #f8fafc 45%, #f8fafc 100%)',
    }"
  >
    <div style="max-width: 1180px; margin: 0 auto">
      <a-spin :spinning="loading" tip="Creating Corridor..." size="large">
        <a-card 
          class="onboarding-card" 
          :body-style="{ padding: '22px' }"
          :bordered="false"
        >
          <a-form :model="formState" layout="vertical" @finish="onFinish" :required-mark="false">
            <div class="form-shell">
              <div class="hero-strip">
                <div>
                  <a-button
                    type="text"
                    @click="handleBack"
                    :style="{ marginLeft: '-8px', color: '#475569', fontWeight: 600 }"
                  >
                    <template #icon><arrow-left-outlined /></template>
                    Back
                  </a-button>
                  <h3 class="text-[24px] font-bold text-[#0f172a] m-0">New Corridor</h3>
                  <p class="text-[#64748b] text-[12px] mt-1 m-0">
                    Fill in the basic information below. Further details can be updated later.
                  </p>
                </div>
              </div>

              <a-row :gutter="[20, 12]" align="top">
                <a-col :xs="24" :lg="12">
                  <a-form-item
                    name="channelName"
                    :rules="[{ required: true, message: 'Please input the Corridor Name.' }]"
                    style="margin-bottom: 0"
                  >
                    <template #label>
                      <span class="label-style">
                        Corridor Name
                        <a-tooltip title="Internal display name for this corridor.">
                          <info-circle-outlined style="font-size: 14px; color: #94a3b8" />
                        </a-tooltip>
                      </span>
                    </template>
                    <a-input v-model:value="formState.channelName" :maxlength="INPUT_LIMITS.name" placeholder="Stripe, Worldpay, Rapyd..." size="large" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="12">
                  <a-form-item required style="margin-bottom: 0">
                    <template #label>
                      <span class="label-style">
                        General Contact
                        <a-tooltip title="Main point of contact for daily operations.">
                          <info-circle-outlined style="font-size: 14px; color: #94a3b8" />
                        </a-tooltip>
                      </span>
                    </template>
                    <div class="poc-grid">
                      <a-form-item
                        name="pocName"
                        :rules="[{ required: true, message: 'Name is required' }]"
                        style="margin-bottom: 0"
                      >
                        <a-input v-model:value="formState.pocName" :maxlength="INPUT_LIMITS.contactName" placeholder="e.g., Jane Doe" size="large" />
                      </a-form-item>

                      <a-form-item name="pocMethod" style="margin-bottom: 0">
                        <a-select
                          v-model:value="formState.pocMethod"
                          size="large"
                          @change="() => { formState.pocDetail = ''; formState.otherPocDetail = ''; }"
                        >
                          <a-select-option value="WeCom">WeCom</a-select-option>
                          <a-select-option value="Email">Email</a-select-option>
                          <a-select-option value="WhatsApp">WhatsApp</a-select-option>
                          <a-select-option value="Telegram">Telegram</a-select-option>
                          <a-select-option value="Other">Other</a-select-option>
                        </a-select>
                      </a-form-item>

                      <div v-if="formState.pocMethod === 'Other'">
                        <a-form-item
                          name="otherPocDetail"
                          :rules="[{ required: true, message: 'Please specify the contact method.' }]"
                          style="margin-bottom: 0"
                        >
                          <a-input v-model:value="formState.otherPocDetail" :maxlength="INPUT_LIMITS.contactValue" placeholder="Specify method and contact details" size="large" />
                        </a-form-item>
                      </div>
                      <div v-else>
                        <a-form-item
                          name="pocDetail"
                          :rules="[{ required: true, message: 'Contact detail is required.' }]"
                          style="margin-bottom: 0"
                        >
                          <a-input v-model:value="formState.pocDetail" :maxlength="INPUT_LIMITS.contactValue" :placeholder="getPocPlaceholder(formState.pocMethod)" size="large" />
                        </a-form-item>
                      </div>
                    </div>
                  </a-form-item>
                </a-col>
              </a-row>

              <a-row :gutter="[16, 12]">
                <a-col :xs="24">
                  <a-form-item
                    name="cooperationModel"
                    :rules="[{ required: true, message: 'Please select at least one Cooperation Model.' }]"
                    style="margin-bottom: 0"
                  >
                    <template #label>
                      <div>
                        <span class="label-style">Cooperation Model</span>
                        <p class="section-description m-0">
                          Confirmed commercial setup (e.g., PayFac, Referral, MoR).
                        </p>
                      </div>
                    </template>
                    <a-checkbox-group
                      v-model:value="formState.cooperationModel"
                      class="w-full"
                      @change="handleCooperationModelChange"
                    >
                      <div class="choice-grid">
                        <label
                          v-for="option in cooperationOptions"
                          :key="option.value"
                          class="compact-choice"
                          :class="{
                            selected: formState.cooperationModel.includes(option.value),
                            disabled: isChoiceDisabled('cooperationModel', option.value),
                          }"
                        >
                          <a-checkbox :value="option.value" :disabled="isChoiceDisabled('cooperationModel', option.value)">
                            <span class="choice-option-content">
                              <span>{{ option.label }}</span>
                              <a-tooltip :title="option.description">
                                <span class="choice-info-trigger" @click.stop @mousedown.stop>
                                  <info-circle-outlined class="choice-info-icon" />
                                </span>
                              </a-tooltip>
                            </span>
                          </a-checkbox>
                        </label>
                      </div>
                    </a-checkbox-group>
                  </a-form-item>
                </a-col>

                <a-col :xs="24">
                  <a-form-item
                    name="supportedProducts"
                    :rules="[{ required: true, message: 'Please select at least one product.' }]"
                    style="margin-bottom: 0"
                  >
                    <template #label>
                      <div>
                        <span class="label-style">Supported Products</span>
                        <p class="section-description m-0">
                          Product lines confirmed for this corridor.
                        </p>
                      </div>
                    </template>
                    <a-checkbox-group
                      v-model:value="formState.supportedProducts"
                      class="w-full"
                      @change="handleSupportedProductsChange"
                    >
                      <div class="choice-grid">
                        <label
                          v-for="option in onboardingSupportedProductOptions"
                          :key="option.value"
                          class="compact-choice"
                          :class="{
                            selected: formState.supportedProducts.includes(option.value),
                            disabled: isChoiceDisabled('supportedProducts', option.value),
                          }"
                        >
                          <a-checkbox :value="option.value" :disabled="isChoiceDisabled('supportedProducts', option.value)">
                            <span class="choice-option-content">
                              <span>{{ option.label }}</span>
                              <a-tooltip :title="option.description">
                                <span class="choice-info-trigger" @click.stop @mousedown.stop>
                                  <info-circle-outlined class="choice-info-icon" />
                                </span>
                              </a-tooltip>
                            </span>
                          </a-checkbox>
                        </label>
                      </div>
                    </a-checkbox-group>
                  </a-form-item>
                </a-col>
              </a-row>

              <div class="action-row">
                <a-button
                  type="primary"
                  html-type="submit"
                  size="large"
                  :loading="loading"
                  class="submit-btn"
                >
                  <template #icon><rocket-outlined /></template>
                  Create New Corridor
                </a-button>
              </div>
            </div>
          </a-form>
        </a-card>
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, ref, reactive } from 'vue';
import { useAppStore } from '../stores/app';
import { Modal, message } from 'ant-design-vue';
import { 
  ArrowLeftOutlined, 
  InfoCircleOutlined,
  RocketOutlined
} from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import { supportedProductOptions } from '../constants/channelOptions';
import { createTechStepsData, type ChannelAssignment } from '../constants/initialData';
import { INPUT_LIMITS, showTextLimitWarning } from '../constants/inputLimits';
import type { CheckboxValueType } from 'ant-design-vue/es/checkbox/interface';

const store = useAppStore();

const formState = reactive({
  channelName: '',
  pocName: '',
  pocMethod: 'Email',
  pocDetail: '',
  otherPocDetail: '',
  cooperationModel: [] as string[],
  supportedProducts: [] as string[],
});

const loading = ref(false);
const unsureOption = "I'm not sure yet";
type ExclusiveField = 'cooperationModel' | 'supportedProducts';
type OnboardingChoiceOption = {
  value: string;
  label: string;
  description: string;
};

const cooperationOptions: OnboardingChoiceOption[] = [
  {
    value: 'Referral',
    label: 'Referral',
    description: 'WooshPay refers merchants to the corridor and earns a commission/revenue share. The corridor directly handles merchant KYC and fund settlement.',
  },
  {
    value: 'PayFac',
    label: 'PayFac',
    description: 'WooshPay registers as a PayFac via the acquirer. WooshPay assumes responsibility for merchant KYC and handles fund settlement to sub-merchants.',
  },
  {
    value: 'MoR',
    label: 'MoR',
    description: 'WooshPay acts as the primary merchant and assumes transaction liability. Fund flow goes through WooshPay, and we conduct merchant KYC.',
  },
  {
    value: unsureOption,
    label: unsureOption,
    description: 'The commercial setup and fund flow model are still under negotiation.',
  },
];

const supportedProductDescriptions: Record<string, string> = {
  Payin: 'Money Collection',
  Payout: 'Money Disbursement',
  'Issuing Cards': 'Card issuance including virtual cards',
  [unsureOption]: 'The product lines are still under negotiation.',
};

const onboardingSupportedProductOptions: OnboardingChoiceOption[] = supportedProductOptions.map((option) => ({
  ...option,
  description: supportedProductDescriptions[option.value] || '',
}));

const getPocPlaceholder = (method: string) => {
  const placeholders: Record<string, string> = {
    Email: 'e.g., jane.doe@example.com',
    WeCom: 'e.g., JaneID_123',
    WhatsApp: 'e.g., +1 234 567 890',
    Telegram: 'e.g., @janedoe',
    Other: 'Specify method and contact details',
  };
  return placeholders[method] || 'Contact detail';
};

const normalizeExclusiveSelection = (values: string[]) => {
  if (!values.includes(unsureOption)) {
    return values;
  }
  return values[values.length - 1] === unsureOption
    ? [unsureOption]
    : values.filter((value) => value !== unsureOption);
};

const handleExclusiveGroupChange = (field: ExclusiveField, values: string[]) => {
  formState[field] = normalizeExclusiveSelection(values);
};

const handleCooperationModelChange = (values: CheckboxValueType[]) => {
  handleExclusiveGroupChange('cooperationModel', values as string[]);
};

const handleSupportedProductsChange = (values: CheckboxValueType[]) => {
  handleExclusiveGroupChange('supportedProducts', values as string[]);
};

const isChoiceDisabled = (field: ExclusiveField, optionValue: string) => {
  return formState[field].includes(unsureOption) && optionValue !== unsureOption;
};

const buildCreatorAssignment = (timestamp: string): ChannelAssignment => {
  if (store.currentUserRole === 'FIOP') {
    return {
      primaryFiopUserId: store.currentUserId,
      primaryFibdUserId: null,
      fiopCollaboratorUserIds: [store.currentUserId],
      fibdCollaboratorUserIds: [],
      updatedAt: timestamp,
      updatedByUserId: store.currentUserId,
    };
  }

  if (store.currentUserRole === 'FIBD') {
    return {
      primaryFiopUserId: null,
      primaryFibdUserId: store.currentUserId,
      fiopCollaboratorUserIds: [],
      fibdCollaboratorUserIds: [store.currentUserId],
      updatedAt: timestamp,
      updatedByUserId: store.currentUserId,
    };
  }

  return {
    primaryFiopUserId: null,
    primaryFibdUserId: null,
    fiopCollaboratorUserIds: [],
    fibdCollaboratorUserIds: [],
    updatedAt: timestamp,
    updatedByUserId: store.currentUserId,
  };
};

const onFinish = () => {
  const { pocMethod, pocDetail, otherPocDetail, ...rest } = formState;
  const contactDetail = pocMethod === 'Other' ? otherPocDetail : pocDetail;
  if (showTextLimitWarning(message.warning, [
    { label: 'Corridor Name', value: formState.channelName, max: INPUT_LIMITS.name },
    { label: 'General Contact Name', value: formState.pocName, max: INPUT_LIMITS.contactName },
    { label: 'General Contact Detail', value: contactDetail, max: INPUT_LIMITS.contactValue },
  ])) return;

  loading.value = true;

  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');

  setTimeout(() => {
    const newChannel = {
      ...rest,
      id: Date.now(),
      channelId: `COR-${dayjs().year()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      status: 'Ongoing',
      createdAt: timestamp,
      lastModifiedAt: timestamp,
      assignment: buildCreatorAssignment(timestamp),
      pocMethod: pocMethod === 'Other' ? contactDetail : pocMethod,
      pocDetail: contactDetail,
      companyName: '',
      registrationGeo: '',
      registrationContinent: undefined,
      fiopOwner: '',
      merchantGeo: [],
      merchantGeoAllowed: [],
      merchantPolicyLink: '',
      merchantPolicyRemark: '',
      merchantMidDetails: '',
      fiopTrackingEntries: [],
      fiopTrackingLatest: '',
      fiopTrackingLatestTime: '',
      supportedCurrencies: [],
      paymentMethods: [],
      complianceStatus: 'Not Started',
      ndaStatus: 'Not Started',
      contractStatus: 'Not Started',
      pricingProposalStatus: 'Not Started',
      techStatus: 'Not Started',
      globalProgress: { kyc: 'Not Started', nda: 'Not Started', pricing: 'Not Started', contract: 'Not Started', tech: 'Not Started' },
      submissionHistory: {},
      techStepsData: createTechStepsData('notStarted'),
      pricingProposals: [],
      auditLogs: [],
    };
    
    const createdChannel = store.createChannel(newChannel);
    loading.value = false;
    store.setSelectedChannel(createdChannel);
    store.setView('detail');
    Modal.success({
      title: 'New corridor created successfully!',
      okText: 'Continue',
      centered: true,
      maskClosable: false,
      content: () => h('div', { style: { lineHeight: '1.7', color: '#475569' } }, [
        h('p', { style: { margin: '0 0 8px', color: '#0f172a', fontWeight: 600 } }, createdChannel.channelName || 'New corridor'),
        h('p', { style: { margin: '0 0 4px' } }, `Corridor ID: ${createdChannel.channelId}`),
        h('p', { style: { margin: 0 } }, 'The corridor has been created. You can now continue completing its profile and workflow setup on this page.'),
      ]),
    });
  }, 1000);
};

const handleBack = () => {
  store.setView('dashboard');
};
</script>

<style scoped>
.onboarding-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, #ffffff 100%) !important;
  border: 1px solid rgba(191, 219, 254, 0.65) !important;
  border-radius: 28px !important;
  box-shadow: 0 28px 80px -52px rgba(14, 116, 144, 0.3) !important;
  backdrop-filter: blur(12px);
}

.form-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hero-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px 10px;
  border-bottom: 1px solid #e2e8f0;
}

.label-style {
  color: #0f172a;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
}

.section-description {
  display: block;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.poc-grid {
  display: grid;
  grid-template-columns: 1.05fr 0.85fr 1.2fr;
  gap: 8px;
}

.choice-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.compact-choice {
  border: 1px solid #dbe5f1;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 16px;
  min-height: 52px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.compact-choice.selected {
  border: 1px solid #0ea5e9;
  background: linear-gradient(180deg, rgba(240, 249, 255, 0.98) 0%, rgba(224, 242, 254, 0.95) 100%);
  box-shadow: 0 18px 36px -28px rgba(2, 132, 199, 0.72);
}

.compact-choice.disabled {
  border-color: #e2e8f0;
  background: #f8fafc;
  color: #94a3b8;
  box-shadow: none;
  cursor: not-allowed;
  pointer-events: none;
}

.compact-choice :deep(.ant-checkbox-wrapper) {
  width: 100%;
  color: inherit;
  font-weight: 600;
}

.compact-choice :deep(.ant-checkbox + span) {
  color: inherit;
}

.choice-option-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.choice-info-trigger {
  display: inline-flex;
  align-items: center;
  color: #94a3b8;
}

.choice-info-icon {
  font-size: 13px;
}

.action-row {
  display: flex;
  justify-content: center;
  padding-top: 2px;
}

.submit-btn {
  height: 46px;
  min-width: 216px;
  background: #0284c7 !important;
  border-color: #0284c7 !important;
  font-weight: 700 !important;
  border-radius: 8px !important;
}

@media (max-width: 1024px) {
  .choice-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .onboarding-card {
    border-radius: 22px !important;
  }

  .poc-grid {
    grid-template-columns: 1fr;
  }
  .choice-grid {
    grid-template-columns: 1fr;
  }
}
</style>
