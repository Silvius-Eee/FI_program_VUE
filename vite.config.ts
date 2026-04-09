import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('ant-design-vue')) {
            if (/ant-design-vue[\\/](es|lib)[\\/](table)/.test(id)) {
              return 'antdv-table'
            }

            if (/ant-design-vue[\\/](es|lib)[\\/](form|input|input-number|select|cascader|checkbox|radio|upload)/.test(id)) {
              return 'antdv-forms'
            }

            if (/ant-design-vue[\\/](es|lib)[\\/](modal|drawer|tabs|dropdown|menu|popover|tooltip|breadcrumb|steps|spin)/.test(id)) {
              return 'antdv-overlays'
            }

            if (/ant-design-vue[\\/](es|lib)[\\/](layout|grid|card|descriptions|timeline|tag|avatar|empty|segmented|space|config-provider|locale)/.test(id)) {
              return 'antdv-layout'
            }

            if (/ant-design-vue[\\/](es|lib)[\\/](button|icon|divider)/.test(id)) {
              return 'antdv-basics'
            }

            if (/ant-design-vue[\\/](es|lib)[\\/](message|notification|app)/.test(id)) {
              return 'antdv-feedback'
            }

            if (/ant-design-vue[\\/](es|lib)[\\/](vc-|_util|style|theme|locale-provider|version)/.test(id)) {
              return 'antdv-utils'
            }

            return 'antdv-core'
          }

          if (id.includes('@ant-design/icons-vue')) {
            return 'ant-design-icons'
          }

          if (id.includes('vue') || id.includes('pinia')) {
            return 'vue-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
})
