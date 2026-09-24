import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { TDesignResolver } from "@tdesign-vue-next/auto-import-resolver";
import postcsspxtoviewport from "postcss-px-to-viewport";

export default defineConfig({
  base: "./",
  optimizeDeps: {
    exclude: ["monaco-editor"],
  },
  build: {
    // 去掉单文件/全量内联：恢复路由级代码分割，减小首屏解析体积
    minify: "esbuild",
    // monaco(懒加载)约 4.2MB，调高告警阈值避免误报
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor")) return "monaco";
          if (id.includes("node_modules/@webav")) return "av-cliper";
          // chat 组件库仅懒加载页面使用，拆独立 chunk，避免被打进首屏 tdesign chunk
          if (id.includes("@tdesign-vue-next/chat")) return "tdesign-chat";
          if (id.includes("md-editor-v3")) return "md-editor";
          if (id.includes("@icon-park")) return "icon-park";
          if (
            id.includes("node_modules/vue") ||
            id.includes("node_modules/@vue") ||
            id.includes("node_modules/vue-router") ||
            id.includes("node_modules/pinia") ||
            id.includes("node_modules/vue-i18n")
          ) {
            return "vue-vendor";
          }
        },
      },
    },
  },
  plugins: [
    vue(),
    AutoImport({
      dts: "src/types/auto-imports.d.ts",
      imports: ["vue", "pinia", "vue-router"],
      resolvers: [
        TDesignResolver({
          library: "vue-next",
        }),
        TDesignResolver({
          library: "chat",
        }),
      ],
    }),
    Components({
      dts: "src/types/components.d.ts",
      resolvers: [
        TDesignResolver({
          library: "vue-next",
        }),
        TDesignResolver({
          library: "chat",
        }),
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
    postcss: {
      plugins: [
        postcsspxtoviewport({
          // 要转化的单位
          unitToConvert: "px",
          // UI设计稿的大小
          viewportWidth: 1600,
          // 转换后的精度
          unitPrecision: 4,
          // 转换后的单位
          viewportUnit: "rem",
          // 字体转换后的单位
          fontViewportUnit: "rem",
          // 能转换的属性，*表示所有属性，!border表示border不转
          propList: ["*"],
          // 指定不转换为视窗单位的类名，
          selectorBlackList: ["ignore"],
          // 最小转换的值，小于等于1不转
          minPixelValue: 1,
          // 是否在媒体查询的css代码中也进行转换，默认false
          mediaQuery: true,
          // 是否转换后直接更换属性值
          replace: true,
          // 忽略某些文件夹下的文件或特定文件，例如 'node_modules' 下的文件
          exclude: [],
          // 包含那些文件或者特定文件
          include: [],
          // 是否处理横屏情况
          landscape: false,
        }),
      ],
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:10588",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
