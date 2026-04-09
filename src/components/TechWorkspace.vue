<script setup lang="ts">
import { ref } from 'vue';
import {
  CodeOutlined,
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleFilled
} from '@ant-design/icons-vue';
import { useAppStore } from '../stores/app';
import { createTechStepsData } from '../constants/initialData';

const store = useAppStore();
const canonicalTechSteps = createTechStepsData('notStarted');
const phaseOneTitle = `Phase 1: ${canonicalTechSteps[0].title} and ${canonicalTechSteps[1].title}`;
const phaseTwoTitle = `Phase 2: ${canonicalTechSteps[2].title} and ${canonicalTechSteps[3].title}`;

interface TechTask {
  id: number;
  channelName: string;
  integrationType: string;
  status: string;
  priority: string;
}

// --- Mock Data ---
const pendingTechTasks: TechTask[] = [
  { id: 301, channelName: 'Stripe Global', integrationType: 'API & Webhook', status: 'In process', priority: 'High' },
  { id: 302, channelName: 'Adyen APAC', integrationType: 'Hosted Checkout', status: 'Not Started', priority: 'Medium' }
];

// --- 状态定义 ---
const currentView = ref('list');
const activeTask = ref<TechTask | null>(null);

// --- 逻辑处理 ---
const tasksColumns = [
  { title: 'Corridor Name', dataIndex: 'channelName', key: 'channelName' },
  { title: 'Integration Type', dataIndex: 'integrationType', key: 'integrationType' },
  { title: 'Priority', dataIndex: 'priority', key: 'priority' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Action', key: 'action' }
];

const handleTaskCheck = (stepIndex: number, taskIndex: number, checked: boolean) => {
  const steps = JSON.parse(JSON.stringify(store.techStepsData));
  steps[stepIndex].tasks[taskIndex].checked = checked;
  
  // 更新逻辑与原项目保持一致
  const allChecked = steps[stepIndex].tasks.every((t: any) => t.checked);
  if (allChecked) {
    steps[stepIndex].status = 'finish';
    if (stepIndex + 1 < steps.length) steps[stepIndex + 1].status = 'process';
  } else {
    steps[stepIndex].status = 'process';
  }
  
  // 持久化到选中的渠道
  if (store.selectedChannel) {
    const updatedChannel = { ...store.selectedChannel, techStepsData: steps };
    store.updateChannel(updatedChannel);
  }
};

const handleStartIntegration = (task: TechTask) => {
  activeTask.value = task;
  currentView.value = 'detail';
};

const handleBackToList = () => {
  currentView.value = 'list';
  activeTask.value = null;
};

</script>

<template>
  <div class="py-6 min-h-screen bg-transparent px-6">
    <!-- 列表视图 -->
    <div v-if="currentView === 'list'">
      <div class="mb-4 px-1">
        <h3 class="text-[20px] font-black text-slate-900 m-0">Tech Department - Integration Task Board</h3>
      </div>
      <a-card class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden" :body-style="{ padding: '0' }">
        <a-table :data-source="pendingTechTasks" :columns="tasksColumns" :row-key="(record: TechTask) => record.id" :pagination="false">
          <template #bodyCell="{ column, record, text }">
            <template v-if="column.key === 'channelName'">
              <div class="flex items-center gap-2 p-4">
                <div class="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
                  <code-outlined />
                </div>
                <span class="font-black text-slate-900">{{ text }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'priority'">
              <span :class="['font-black uppercase text-[11px] tracking-widest px-2 py-0.5 rounded-full', text === 'High' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600']">{{ text }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="text === 'In Progress' ? 'blue' : 'default'" class="rounded-full px-3 py-0.5 font-bold border-none">{{ text }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="primary" @click="handleStartIntegration(record)" class="rounded-lg px-6 font-bold">Start Integration</a-button>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 详情视图 -->
    <div v-else>
      <div class="mb-6 flex justify-between items-center px-1">
        <a-button type="text" @click="handleBackToList" :style="{ color: '#64748b', padding: 0 }" class="flex items-center font-bold hover:text-slate-800 transition-colors">
          <template #icon><arrow-left-outlined /></template>
          Return to Task List
        </a-button>
        <div class="flex items-center gap-3">
          <div class="text-[14px] text-slate-500 font-bold uppercase tracking-widest">Corridor:</div>
          <div class="text-[18px] font-black text-slate-900 uppercase tracking-tight">{{ activeTask?.channelName }}</div>
        </div>
      </div>

      <header class="mb-8 p-6 rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-200 flex items-center justify-between">
        <div>
          <h3 class="text-[24px] font-black m-0 tracking-tight">Integration Workspace</h3>
          <p class="text-slate-400 m-0 mt-1 font-medium">Coordinate development and verification for the selected corridor.</p>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-right">
            <div class="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Priority</div>
            <div class="text-[14px] font-black text-red-400">{{ activeTask?.priority }}</div>
          </div>
          <div class="w-[1px] h-8 bg-slate-800 mx-2"></div>
          <div class="text-right">
            <div class="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Type</div>
            <div class="text-[14px] font-black text-sky-400">{{ activeTask?.integrationType }}</div>
          </div>
        </div>
      </header>

      <!-- 阶段卡片渲染 -->
      <div class="space-y-8">
        <!-- 阶段 1 -->
        <div class="group">
          <div class="mb-4 flex items-center justify-between px-1">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 shadow-sm transition-transform group-hover:scale-110">
                <code-outlined style="font-size: 20px;" />
              </div>
              <h4 class="text-[18px] font-black text-slate-900 m-0">{{ phaseOneTitle }}</h4>
            </div>
            <a-tag :color="store.techStepsData[1]?.status === 'finish' ? 'success' : (store.techStepsData[1]?.status !== 'wait' ? 'processing' : 'default')" class="rounded-full px-4 py-1 font-black uppercase tracking-widest border-none">
              {{ store.techStepsData[1]?.status === 'finish' ? 'Phase Completed' : (store.techStepsData[1]?.status !== 'wait' ? 'In Progress' : 'Locked') }}
            </a-tag>
          </div>
          <a-card 
            class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden"
            :style="{ opacity: store.techStepsData[1]?.status !== 'wait' ? 1 : 0.6 }"
            :body-style="{ padding: '32px' }"
          >
            <a-row :gutter="48">
              <a-col :span="12" class="border-r border-slate-100 border-dashed">
                <h5 class="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-6">Parameters from FI</h5>
                <a-descriptions v-if="store.techStepsData[0]?.status === 'finish'" :column="1" size="small" bordered class="fitrem-descriptions">
                  <a-descriptions-item label="API Doc">
                    <a :href="store.techStepsData[0].data.apiDoc" target="_blank" class="text-sky-600 font-bold hover:underline">{{ store.techStepsData[0].data.apiDoc }}</a>
                  </a-descriptions-item>
                  <a-descriptions-item label="API Key"><span class="font-mono text-slate-400">****************</span></a-descriptions-item>
                  <a-descriptions-item label="Backend Info">{{ store.techStepsData[0].data.backendAccount || 'N/A' }}</a-descriptions-item>
                  <a-descriptions-item label="Payment Methods">{{ store.techStepsData[0].data.paymentMethods ? store.techStepsData[0].data.paymentMethods.join(', ') : 'N/A' }}</a-descriptions-item>
                </a-descriptions>
                <div v-else class="h-32 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 gap-3">
                  <clock-circle-filled class="text-slate-300 text-xl" />
                  <div class="text-slate-400 font-bold text-[13px]">Waiting for FI submission...</div>
                </div>
              </a-col>
              <a-col :span="12">
                <h5 class="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-6">Development Tasks</h5>
                <div class="flex flex-col gap-4">
                  <div 
                    v-for="(task, idx) in store.techStepsData[1]?.tasks" 
                    :key="idx"
                    class="flex items-center gap-3 p-4 rounded-2xl border border-slate-50 transition-all hover:bg-slate-50"
                    :class="{ 'bg-emerald-50/30 border-emerald-100': task.checked }"
                  >
                    <a-checkbox 
                      :checked="task.checked"
                      :disabled="store.techStepsData[1]?.status === 'wait'"
                      @change="(e: any) => handleTaskCheck(1, Number(idx), e.target.checked)"
                    />
                    <span :class="['text-[15px] font-bold transition-all', task.checked ? 'text-slate-400 line-through' : 'text-slate-700']">
                      {{ task.label }}
                    </span>
                  </div>
                </div>
              </a-col>
            </a-row>
          </a-card>
        </div>

        <!-- 阶段 2 -->
        <div class="group">
          <div class="mb-4 flex items-center justify-between px-1">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 shadow-sm transition-transform group-hover:scale-110">
                <check-circle-filled style="font-size: 20px;" />
              </div>
              <h4 class="text-[18px] font-black text-slate-900 m-0">{{ phaseTwoTitle }}</h4>
            </div>
            <a-tag :color="store.techStepsData[3]?.status === 'finish' ? 'success' : (store.techStepsData[3]?.status !== 'wait' ? 'processing' : 'default')" class="rounded-full px-4 py-1 font-black uppercase tracking-widest border-none">
              {{ store.techStepsData[3]?.status === 'finish' ? 'Phase Completed' : (store.techStepsData[3]?.status !== 'wait' ? 'In Progress' : 'Locked') }}
            </a-tag>
          </div>
          <a-card 
            class="clean-card shadow-sm border border-slate-100 rounded-3xl overflow-hidden"
            :style="{ opacity: store.techStepsData[3]?.status !== 'wait' ? 1 : 0.6 }"
            :body-style="{ padding: '32px' }"
          >
            <a-row :gutter="48">
              <a-col :span="12" class="border-r border-slate-100 border-dashed">
                <h5 class="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-6">Parameters from FI</h5>
                <a-descriptions v-if="store.techStepsData[2]?.status === 'finish'" :column="1" size="small" bordered class="fitrem-descriptions">
                  <a-descriptions-item label="Production API">
                    <a :href="store.techStepsData[2].data.apiDoc" target="_blank" class="text-sky-600 font-bold hover:underline">{{ store.techStepsData[2].data.apiDoc }}</a>
                  </a-descriptions-item>
                  <a-descriptions-item label="Production Key"><span class="font-mono text-slate-400">****************</span></a-descriptions-item>
                </a-descriptions>
                <div v-else class="h-32 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 gap-3">
                  <clock-circle-filled class="text-slate-300 text-xl" />
                  <div class="text-slate-400 font-bold text-[13px]">Waiting for FI production keys...</div>
                </div>
              </a-col>
              <a-col :span="12">
                <h5 class="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-6">Verification Tasks</h5>
                <div class="flex flex-col gap-4">
                  <div 
                    v-for="(task, idx) in store.techStepsData[3]?.tasks" 
                    :key="idx"
                    class="flex items-center gap-3 p-4 rounded-2xl border border-slate-50 transition-all hover:bg-slate-50"
                    :class="{ 'bg-emerald-50/30 border-emerald-100': task.checked }"
                  >
                    <a-checkbox 
                      :checked="task.checked"
                      :disabled="store.techStepsData[3]?.status === 'wait'"
                      @change="(e: any) => handleTaskCheck(3, Number(idx), e.target.checked)"
                    />
                    <span :class="['text-[15px] font-bold transition-all', task.checked ? 'text-slate-400 line-through' : 'text-slate-700']">
                      {{ task.label }}
                    </span>
                  </div>
                </div>
              </a-col>
            </a-row>
          </a-card>
        </div>
      </div>
    </div>
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
</style>
