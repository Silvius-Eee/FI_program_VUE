<script setup lang="ts">
import { ref, computed, onMounted, watch, defineAsyncComponent } from 'vue';
import { useAppStore } from './stores/app';
import { appFontFamily, buildCorridorStatusTagStyle, colors, titleFontFamily } from './styles/colors';
import { APP_HEADER_HEIGHT, DEFAULT_DETAIL_TOOLBAR_HEIGHT } from './constants/initialData';
import {
  UserOutlined,
  SafetyCertificateOutlined,
  ReadOutlined,
  CodeOutlined,
  ArrowLeftOutlined,
  ShareAltOutlined,
  RocketOutlined,
  EllipsisOutlined,
} from '@ant-design/icons-vue';

const ChannelDashboard = defineAsyncComponent(() => import('./components/ChannelDashboard.vue'));
const ChannelDetail = defineAsyncComponent(() => import('./components/ChannelDetail.vue'));
const PricingManagementPage = defineAsyncComponent(() => import('./components/PricingManagementPage.vue'));
const ChannelOnboarding = defineAsyncComponent(() => import('./components/ChannelOnboarding.vue'));
const KycHubPage = defineAsyncComponent(() => import('./components/KycHubPage.vue'));
const KycReviewWorkspace = defineAsyncComponent(() => import('./components/KycReviewWorkspace.vue'));
const KycReviewDetailPage = defineAsyncComponent(() => import('./components/KycReviewDetailPage.vue'));
const LegalApprovalWorkspace = defineAsyncComponent(() => import('./components/LegalApprovalWorkspace.vue'));
const TechWorkspace = defineAsyncComponent(() => import('./components/TechWorkspace.vue'));

const store = useAppStore();

const detailToolbarRef = ref<HTMLElement | null>(null);
const detailToolbarHeight = ref(DEFAULT_DETAIL_TOOLBAR_HEIGHT);

const hasFixedDetailToolbar = computed(() => {
  return (store.view === 'detail' || store.view === 'pricing') && store.role === 'FI' && !!detailToolbar.value;
});

const contentTopOffset = computed(() => {
  return hasFixedDetailToolbar.value ? APP_HEADER_HEIGHT + detailToolbarHeight.value : APP_HEADER_HEIGHT;
});

const detailToolbar = ref<any>(null);

const setDetailToolbar = (toolbar: any) => {
  detailToolbar.value = toolbar;
};

onMounted(() => {
  const syncToolbarHeight = () => {
    if (detailToolbarRef.value) {
      const nextHeight = Math.max(detailToolbarRef.value.offsetHeight || 0, DEFAULT_DETAIL_TOOLBAR_HEIGHT);
      detailToolbarHeight.value = nextHeight;
    }
  };

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(syncToolbarHeight);
    watch(detailToolbarRef, (el) => {
      if (el) observer.observe(el);
    }, { immediate: true });
  } else {
    window.addEventListener('resize', syncToolbarHeight);
  }
});

const handleRoleChange = (val: string) => {
  store.setRole(val);
};

</script>

<template>
  <a-config-provider :theme="{
    token: {
      colorPrimary: colors.primary,
      colorError: colors.danger,
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorInfo: colors.primary,
      colorBgBase: colors.background,
      colorBgContainer: colors.surface,
      colorBorder: colors.border,
      colorBorderSecondary: colors.borderLight,
      borderRadius: 8,
      fontFamily: appFontFamily,
    },
    components: {
      Layout: {
        headerBg: colors.surface,
        bodyBg: colors.background,
        headerHeight: 64,
        headerPadding: '0 24px',
      },
      Button: {
        borderRadius: 6,
        controlHeight: 36,
      },
    }
  }">
    <a-layout :style="{ minHeight: '100vh', background: colors.background, fontFamily: appFontFamily, '--fitrem-title-font-family': titleFontFamily }">
      <a-layout-header
        :style="{
          background: '#ffffff',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          height: '64px'
        }"
      >
        <div :style="{ display: 'flex', alignItems: 'center', gap: '10px' }">
          <span :style="{ fontSize: '18px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.025em' }">
            FI System
          </span>
        </div>
        <div class="flex items-center">
          <a-select
            :value="store.role"
            @change="handleRoleChange"
            :bordered="false"
            class="fitrem-role-selector"
            :dropdown-match-select-width="true"
            placement="bottomRight"
            popup-class-name="fitrem-role-dropdown"
          >
            <template #suffixIcon>
              <div class="text-[10px] text-slate-300">▼</div>
            </template>

            <a-select-option value="FI">
              <div class="flex items-center gap-2.5 px-1 py-1">
                <user-outlined :style="{ color: store.role === 'FI' ? '#0f172a' : '#94a3b8' }" class="text-[15px]" />
                <span class="text-[13px] font-bold" :style="{ color: store.role === 'FI' ? '#0f172a' : '#475569' }">FI</span>
              </div>
            </a-select-option>
            <a-select-option value="Fund">
              <div class="flex items-center gap-2.5 px-1 py-1">
                <user-outlined :style="{ color: store.role === 'Fund' ? '#0f172a' : '#94a3b8' }" class="text-[15px]" />
                <span class="text-[13px] font-bold" :style="{ color: store.role === 'Fund' ? '#0f172a' : '#475569' }">Fund</span>
              </div>
            </a-select-option>
            <a-select-option value="Risk Control">
              <div class="flex items-center gap-2.5 px-1 py-1">
                <safety-certificate-outlined :style="{ color: store.role === 'Risk Control' ? '#0f172a' : '#94a3b8' }" class="text-[15px]" />
                <span class="text-[13px] font-bold" :style="{ color: store.role === 'Risk Control' ? '#0f172a' : '#475569' }">Risk Control</span>
              </div>
            </a-select-option>
            <a-select-option value="Compliance">
              <div class="flex items-center gap-2.5 px-1 py-1">
                <safety-certificate-outlined :style="{ color: store.role === 'Compliance' ? '#0f172a' : '#94a3b8' }" class="text-[15px]" />
                <span class="text-[13px] font-bold" :style="{ color: store.role === 'Compliance' ? '#0f172a' : '#475569' }">Compliance</span>
              </div>
            </a-select-option>
            <a-select-option value="Legal">
              <div class="flex items-center gap-2.5 px-1 py-1">
                <read-outlined :style="{ color: store.role === 'Legal' ? '#0f172a' : '#94a3b8' }" class="text-[15px]" />
                <span class="text-[13px] font-bold" :style="{ color: store.role === 'Legal' ? '#0f172a' : '#475569' }">Legal Hub</span>
              </div>
            </a-select-option>
            <a-select-option value="Tech">
              <div class="flex items-center gap-2.5 px-1 py-1">
                <code-outlined :style="{ color: store.role === 'Tech' ? '#0f172a' : '#94a3b8' }" class="text-[15px]" />
                <span class="text-[13px] font-bold" :style="{ color: store.role === 'Tech' ? '#0f172a' : '#475569' }">Tech Portal</span>
              </div>
            </a-select-option>
          </a-select>
        </div>
      </a-layout-header>

      <div
        v-if="hasFixedDetailToolbar"
        ref="detailToolbarRef"
        :style="{
          position: 'fixed',
          top: `${APP_HEADER_HEIGHT}px`,
          left: 0,
          right: 0,
          zIndex: 999,
          background: '#ffffff',
          borderBottom: `1px solid ${colors.border}`,
        }"
      >
        <div
          :style="{
            minHeight: '64px',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }"
        >
          <div :style="{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }">
            <a-button
              type="text"
              @click="detailToolbar.onBack"
              :style="{ color: colors.textSecondary, paddingInline: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }"
            >
              <template #icon><arrow-left-outlined :style="{ fontSize: '14px' }" /></template>
              {{ detailToolbar.backLabel || 'Return to Dashboard' }}
            </a-button>
          </div>
          
          <div :style="{ flex: 1.2, minWidth: 0, textAlign: 'center' }">
            <a-space size="8" align="center">
              <span :style="{ fontSize: '18px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', fontFamily: titleFontFamily }">
                {{ detailToolbar.title }}
              </span>
              <a-tag
                v-if="detailToolbar.status"
                :style="buildCorridorStatusTagStyle(detailToolbar.status)"
              >
                {{ detailToolbar.status }}
              </a-tag>
            </a-space>
          </div>

          <div :style="{ flex: 1, display: 'flex', justifyContent: 'flex-end', minWidth: 0 }">
            <a-space v-if="detailToolbar.onSave || detailToolbar.onShare || detailToolbar.showLaunch || detailToolbar.onSuspend" size="12">
              <a-button
                v-if="detailToolbar.onSave"
                @click="detailToolbar.onSave"
                :disabled="detailToolbar.saveDisabled"
                :style="{ borderRadius: '8px', fontWeight: 700 }"
              >
                {{ detailToolbar.saveText || 'Save' }}
              </a-button>
              <a-button 
                v-if="detailToolbar.onShare" 
                @click="detailToolbar.onShare"
                :style="{ borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }"
              >
                <template #icon><share-alt-outlined /></template>
                Share
              </a-button>
              <a-button
                v-if="detailToolbar.showLaunch"
                type="primary"
                @click="detailToolbar.onLaunch"
                :style="{ background: '#0284c7', borderColor: '#0284c7', borderRadius: '8px', fontWeight: 700 }"
              >
                <template #icon><rocket-outlined /></template>
                Initiate Launch
              </a-button>
              <a-dropdown v-if="detailToolbar.onSuspend" placement="bottomRight">
                <a-button :style="{ borderRadius: '8px', fontWeight: 700 }">
                  <template #icon><ellipsis-outlined /></template>
                  More
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="lost" @click="detailToolbar.onSuspend">Lost</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </a-space>
          </div>
        </div>
      </div>

      <a-layout-content :style="{ padding: '0', paddingTop: `${contentTopOffset}px` }">
        <div v-if="store.view === 'kycSubmit'">
          <KycHubPage />
        </div>
        <div v-else-if="store.view === 'kycReviewDetail'">
          <KycReviewDetailPage />
        </div>
        <div v-else-if="store.role === 'Compliance'" class="py-8 px-4">
          <KycReviewWorkspace :isStandalone="true" />
        </div>
        <div v-else-if="store.role === 'Legal'" class="py-8 px-4">
          <LegalApprovalWorkspace :isStandalone="true" />
        </div>
        <div v-else-if="store.role === 'Tech'" class="py-8 px-4">
          <TechWorkspace />
        </div>
        <div v-else-if="store.view === 'detail'">
          <ChannelDetail @registerToolbar="setDetailToolbar" :topOffset="contentTopOffset" />
        </div>
        <div v-else-if="store.view === 'pricing'">
          <PricingManagementPage @registerToolbar="setDetailToolbar" :topOffset="contentTopOffset" />
        </div>
        <div v-else-if="store.view === 'form'">
          <ChannelOnboarding />
        </div>
        <div v-else-if="store.view === 'dashboard'">
          <ChannelDashboard />
        </div>
      </a-layout-content>
    </a-layout>
  </a-config-provider>
</template>

<style>
.fitrem-role-selector {
  width: 180px;
}

.fitrem-role-selector .ant-select-selector {
  background: #f1f5f9 !important;
  border-radius: 999px !important;
  border: 1px solid #e2e8f0 !important;
  height: 34px !important;
  padding: 0 12px !important;
  transition: all 0.2s ease !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  box-shadow: none !important;
}

.fitrem-role-selector:hover .ant-select-selector {
  border-color: #cbd5e1 !important;
  background: #e2e8f0 !important;
}

.fitrem-role-selector.ant-select-open .ant-select-selector {
  border-color: #4096ff !important;
  background: #ffffff !important;
  box-shadow: 0 0 0 2px rgba(5, 145, 255, 0.1) !important;
}

.fitrem-role-selector .ant-select-selection-item {
  padding-inline-end: 0 !important;
  display: flex !important;
  align-items: center !important;
  flex: 1 !important;
  height: 30px !important;
  line-height: 30px !important;
}

.fitrem-role-selector .ant-select-selection-search {
  display: none !important;
}

/* Dropdown styling */
.fitrem-role-dropdown {
  padding: 8px !important;
  border-radius: 16px !important;
  box-shadow: 0 10px 40px -10px rgba(15, 23, 42, 0.15) !important;
  border: 1px solid #f1f5f9 !important;
}

.fitrem-role-dropdown .ant-select-item-option {
  border-radius: 8px !important;
  margin-bottom: 2px !important;
  padding: 4px 8px !important;
  transition: all 0.2s ease !important;
}

.fitrem-role-dropdown .ant-select-item-option-active {
  background: #f8fafc !important;
}

.fitrem-role-dropdown .ant-select-item-option-selected {
  background: #f0f7ff !important;
}

.fitrem-role-dropdown .ant-select-item-option-selected .font-bold {
  color: #0f172a !important;
}

.fitrem-role-dropdown .ant-select-item-option-selected .text-slate-400 {
  color: #0f172a !important;
}
</style>
