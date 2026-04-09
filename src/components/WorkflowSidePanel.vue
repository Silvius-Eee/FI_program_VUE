<script setup lang="ts">
import { CloseOutlined } from '@ant-design/icons-vue';

defineProps<{
  title: string;
}>();

const emit = defineEmits(['close']);
</script>

<template>
  <aside class="workflow-side-panel h-full rounded-[30px] border border-slate-200/80 bg-white shadow-[0_28px_60px_-32px_rgba(15,23,42,0.38)] overflow-hidden flex flex-col">
    <div class="workflow-side-panel__header px-7 pt-6 pb-5 border-b border-slate-100/90 flex items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.24em] mb-1.5">Right-side Panel</div>
        <h3 class="text-[20px] font-black text-slate-900 m-0 leading-[1.15] tracking-[-0.01em]">{{ title }}</h3>
      </div>
      <button
        type="button"
        @click="emit('close')"
        class="workflow-side-panel__close w-10 h-10 rounded-[16px] border border-slate-200/80 bg-slate-50/70 text-slate-400 hover:text-slate-700 hover:border-slate-300 hover:bg-white transition-all duration-200 flex items-center justify-center shrink-0"
      >
        <close-outlined class="text-[16px]" />
      </button>
    </div>

    <div class="workflow-side-panel__body flex-1 min-h-0">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.workflow-side-panel {
  backdrop-filter: blur(18px);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 255, 0.96) 100%);
}

.workflow-side-panel__header {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 251, 255, 0.82) 100%);
}

.workflow-side-panel__body {
  background: linear-gradient(180deg, rgba(248, 251, 255, 0.58) 0%, rgba(255, 255, 255, 0.96) 22%, #ffffff 100%);
}

.workflow-side-panel__close {
  box-shadow: 0 14px 32px -26px rgba(15, 23, 42, 0.35);
}

.workflow-side-panel__close:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 34px -24px rgba(15, 23, 42, 0.32);
}
</style>
