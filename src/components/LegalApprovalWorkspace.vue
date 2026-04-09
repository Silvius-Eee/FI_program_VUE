<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

interface LegalTask {
  id: number;
  channelName: string;
  docType: string;
  status: string;
  submittedBy: string;
  date: string;
}

const props = defineProps<{
  isStandalone?: boolean;
  reviewType?: string;
  channelData?: any;
}>();

const emit = defineEmits(['finishReview']);

// --- Mock Data ---
const pendingTasks: LegalTask[] = [
  { id: 101, channelName: 'Stripe Global', docType: 'NDA', status: 'Pending our signature', submittedBy: 'Alice (FI)', date: '2026-03-10' },
  { id: 102, channelName: 'Adyen APAC', docType: 'Master Agreement', status: 'Under corridor review', submittedBy: 'Bob (FI)', date: '2026-03-11' }
];

// --- 状态定义 ---
const currentView = ref('list');
const activeTask = ref<LegalTask | null>(null);
const activeDoc = ref('NDA');
const isModalVisible = ref(false);

// 保持 selectedKeys 与 activeDoc 同步
const selectedKeys = computed({
  get: () => [activeDoc.value],
  set: (val: any) => {
    if (val && val.length > 0) {
      activeDoc.value = val[0];
    }
  }
});

const reasonForm = reactive({ reason: '' });

// --- 逻辑处理 ---
const tasksColumns = [
  { title: 'Corridor Name', dataIndex: 'channelName', key: 'channelName' },
  { title: 'Document Type', dataIndex: 'docType', key: 'docType' },
  { title: 'Submitted By', dataIndex: 'submittedBy', key: 'submittedBy' },
  { title: 'Date', dataIndex: 'date', key: 'date' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Action', key: 'action' }
];

const menuItems = [
  { key: 'NDA', label: 'NDA' },
  { key: 'Master Agreement', label: 'Master Agreement' },
  { key: 'Others', label: 'Others' }
];

const handleReviewClick = (task: LegalTask) => {
  activeTask.value = task;
  activeDoc.value = task.docType === 'NDA' ? 'NDA' : 'Master Agreement';
  currentView.value = 'detail';
};

const handleReturnToList = () => {
  currentView.value = 'list';
  activeTask.value = null;
};

const handleOk = () => {
  if (!reasonForm.reason) {
    message.error('Please enter the reason for revision');
    return;
  }
  console.log('Revision Reason:', reasonForm.reason);
  message.success('Change request sent');
  isModalVisible.value = false;
  reasonForm.reason = '';
};

onMounted(() => {
  activeDoc.value = props.reviewType === 'NDA' ? 'NDA' : 'Master Agreement';
});

</script>

<template>
  <div :class="['min-h-screen bg-transparent', isStandalone ? 'p-0' : 'p-6']">
    <!-- 列表视图 -->
    <div v-if="currentView === 'list'">
      <div class="mb-4 px-1">
        <h3 class="text-[20px] font-black text-slate-900 m-0">Legal Department - Pending Tasks</h3>
      </div>
      <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '0' }">
        <a-table :data-source="pendingTasks" :columns="tasksColumns" :row-key="(record: LegalTask) => record.id" :pagination="false">
          <template #bodyCell="{ column, record, text }">
            <template v-if="column.key === 'channelName'">
              <div class="flex items-center gap-2 p-4">
                <div class="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
                  <file-text-outlined />
                </div>
                <span class="font-black text-slate-900">{{ text }}</span>
              </div>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag color="orange" class="rounded-full px-3 py-0.5 font-bold border-none">{{ text }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="primary" @click="handleReviewClick(record)" class="rounded-lg px-6 font-bold">Review Document</a-button>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 详情视图 -->
    <div v-else>
      <div class="mb-6 flex justify-between items-center px-1">
        <a-button type="text" @click="handleReturnToList" :style="{ color: '#64748b', padding: 0 }" class="flex items-center font-bold hover:text-slate-800 transition-colors">
          <template #icon><arrow-left-outlined /></template>
          Return to Task List
        </a-button>
        <div class="flex items-center gap-3">
          <div class="text-[14px] text-slate-500 font-bold uppercase tracking-widest">Corridor:</div>
          <div class="text-[18px] font-black text-slate-900 uppercase tracking-tight">{{ activeTask?.channelName }}</div>
        </div>
      </div>

      <a-layout style="background: transparent;">
        <!-- 左侧文档预览 -->
        <a-layout-sider width="55%" style="background: transparent; padding-right: 16px;">
          <div class="mb-4 flex items-center justify-between px-1">
            <h4 class="text-[18px] font-black text-slate-900 m-0">Document Viewer</h4>
            <a-tag color="blue" class="m-0 font-black rounded-full px-3 py-0.5 border-none bg-sky-100 text-sky-700 text-[11px] uppercase tracking-wider">{{ activeDoc }}</a-tag>
          </div>
          <a-card 
            class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden flex flex-col" 
            :body-style="{ height: 'calc(100vh - 350px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }"
          >
            <div class="text-center">
              <div class="w-24 h-24 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-6">
                <file-text-outlined :style="{ fontSize: '48px', color: '#cbd5e1' }" />
              </div>
              <h4 class="text-[#475569] text-[18px] font-black tracking-tight mb-2">{{ activeDoc }} Preview</h4>
              <p class="text-[14px] text-slate-400 font-medium">Digital Copy for Review</p>
            </div>
          </a-card>
          <div class="mt-6 bg-slate-100/50 p-1 rounded-2xl border border-slate-200">
            <a-menu
              v-model:selectedKeys="selectedKeys"
              mode="horizontal"
              class="bg-transparent flex justify-center border-none fitrem-menu"
            >
              <a-menu-item v-for="item in menuItems" :key="item.key" class="rounded-xl px-8 font-bold">{{ item.label }}</a-menu-item>
            </a-menu>
          </div>
        </a-layout-sider>

        <!-- 右侧审批操作 -->
        <a-layout-content style="padding-left: 16px;">
          <a-space direction="vertical" size="large" class="w-full">
            <div>
              <div class="mb-4 px-1">
                <h4 class="text-[18px] font-black text-slate-900 m-0">Basic Information</h4>
              </div>
              <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
                <div v-if="activeDoc === 'NDA'">
                  <a-descriptions bordered :column="1" size="small" class="fitrem-descriptions">
                    <a-descriptions-item label="Corridor Name">{{ activeTask?.channelName }}</a-descriptions-item>
                    <a-descriptions-item label="Point of Contact (POC)">{{ channelData?.pointOfContact || 'N/A' }}</a-descriptions-item>
                    <a-descriptions-item label="Cooperation Model">{{ channelData?.cooperationModel || 'N/A' }}</a-descriptions-item>
                    <a-descriptions-item label="Supported Products">
                      {{ Array.isArray(channelData?.supportedProducts) ? channelData.supportedProducts.join(', ') : 'N/A' }}
                    </a-descriptions-item>
                  </a-descriptions>
                </div>
                <div v-else class="space-y-4">
                  <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Corridor Name</div>
                    <div class="text-[16px] font-black text-slate-900">{{ activeTask?.channelName }}</div>
                  </div>
                  <div class="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-500 shadow-sm">
                      <check-circle-outlined style="font-size: 20px;" />
                    </div>
                    <div>
                      <div class="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Prerequisite Check</div>
                      <div class="text-[14px] font-bold text-emerald-700">NDA Signed & Executed</div>
                    </div>
                  </div>
                </div>
              </a-card>
            </div>

            <template v-if="activeDoc === 'Master Agreement'">
              <div>
                <div class="mb-4 px-1">
                  <h4 class="text-[18px] font-black text-slate-900 m-0">Assign Reviewers</h4>
                </div>
                <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
                  <a-input-group compact class="w-full flex h-12">
                    <a-select default-value="disabled" class="flex-1 custom-select-height">
                      <a-select-option value="disabled" disabled>Invite other departments for joint review</a-select-option>
                      <a-select-option value="risk">Risk Management</a-select-option>
                      <a-select-option value="finance">Finance</a-select-option>
                      <a-select-option value="vp">Business VP</a-select-option>
                    </a-select>
                    <a-button type="primary" class="h-full px-8 rounded-r-xl font-bold bg-sky-600 border-none"><template #icon><send-outlined /></template>Send Invite</a-button>
                  </a-input-group>
                </a-card>
              </div>

              <div>
                <div class="mb-4 px-1">
                  <h4 class="text-[18px] font-black text-slate-900 m-0">Contract ID & Archiving</h4>
                </div>
                <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '32px' }">
                  <a-form layout="vertical">
                    <a-form-item label="Contract ID Prefix">
                      <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Contract ID Prefix</span></template>
                      <a-input disabled :value="`[CN-${activeTask?.channelName?.split(' ')[0].toUpperCase()}-2023001]`" class="h-12 rounded-xl bg-slate-50 border-slate-200 font-mono font-bold text-slate-500" />
                    </a-form-item>
                    <a-form-item class="mb-0">
                      <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Signing & Archiving Method</span></template>
                      <a-radio-group default-value="docusign" class="flex gap-8 mt-2">
                        <a-radio value="docusign" class="font-bold text-slate-600">Online (DocuSign)</a-radio>
                        <a-radio value="offline" class="font-bold text-slate-600">Offline Scan</a-radio>
                      </a-radio-group>
                    </a-form-item>
                  </a-form>
                </a-card>
              </div>
            </template>

            <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '24px' }">
              <div class="flex gap-4">
                <a-button danger block size="large" @click="isModalVisible = true" class="h-14 rounded-2xl font-black text-[15px] shadow-sm"><template #icon><close-circle-outlined /></template>Request Changes</a-button>
                <a-button type="primary" block size="large" @click="() => message.success('Action successful')" class="h-14 rounded-2xl font-black text-[15px] bg-sky-600 border-none shadow-lg shadow-sky-100"><template #icon><check-circle-outlined /></template>{{ activeDoc === 'NDA' ? 'Approve NDA' : 'Approve & Archive' }}</a-button>
              </div>
            </a-card>
          </a-space>
        </a-layout-content>
      </a-layout>
    </div>

    <!-- 弹窗 -->
    <a-modal v-model:open="isModalVisible" title="Request Changes" @ok="handleOk" :ok-button-props="{ class: 'bg-sky-600 border-none rounded-lg font-bold h-10 px-6' }" :cancel-button-props="{ class: 'rounded-lg font-bold h-10 px-6' }">
      <a-form layout="vertical" class="mt-4">
        <a-form-item required>
          <template #label><span class="text-[13px] font-black text-slate-700 uppercase tracking-widest">Reason for Revision</span></template>
          <a-textarea v-model:value="reasonForm.reason" :rows="4" class="rounded-xl border-slate-200 p-4" placeholder="Provide actionable feedback for the FI department..." />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.clean-card {
  background: #ffffff !important;
  border-radius: 24px !important;
}

:deep(.ant-table) { background: transparent !important; }
:deep(.ant-table-thead > tr > th) {
  background: #f8fafc !important;
  color: #64748b !important;
  font-weight: 700 !important;
  font-size: 12px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  border-bottom: 1px solid #f1f5f9 !important;
}

:deep(.fitrem-descriptions .ant-descriptions-item-label) {
  background: #f8fafc !important;
  color: #64748b !important;
  font-weight: 700 !important;
  font-size: 12px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  width: 180px;
}

:deep(.fitrem-menu) {
  line-height: 48px;
}

:deep(.fitrem-menu .ant-menu-item-selected) {
  background: #ffffff !important;
  color: #0284c7 !important;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.12);
}

:deep(.custom-select-height .ant-select-selector) {
  height: 48px !important;
  border-radius: 12px 0 0 12px !important;
  display: flex !important;
  align-items: center !important;
}
</style>
