export default defineStore(
  "setting",
  () => {
    const showSetting = ref(false);
    const isElectron = ref(false);
    const canvasWheelEvent = ref("scroll");
    const activeMenu = ref("ui");

    const baseUrl = ref<string>("/api");

    const needUpdate = ref(false);

    const otherSetting = ref({
      axiosTimeOut: 60 * 10 * 1000,
      assetsBatchGenereateSize: 5,
      chapterReg: "/第\\s*([0-9０-９零一二三四五六七八九十百千万]+)\\s*[章回节]\\s*([^\\n\\r]*)/g",
      interacting: true,
      scriptEpisodeLength: 5000,
      taskAutoRefresh: true, // 任务列表自动刷新开关
      taskRefreshInterval: 5, // 任务列表自动刷新间隔（秒）
    });

    const themeSetting = ref<{
      mode: "auto" | "light" | "dark";
      primaryColor: string;
      fontSize: number;
      fontFamily: string;
    }>({
      mode: "auto",
      primaryColor: "#0052D9",
      fontSize: 16,
      fontFamily: "harmonyos",
    });

    const language = ref<string>("zh-CN");

    // GPU 加速配置：hardwareAccelerate 桌面端渲染硬件加速（1/0）；canvasComposite 工作台画布 GPU 合成加速（1/0）；modelDevice 与记忆配置共用的推理设备
    const gpuSetting = ref<{
      hardwareAccelerate: "1" | "0";
      canvasComposite: "1" | "0";
      modelDevice: string;
    }>({
      hardwareAccelerate: "1",
      canvasComposite: "1",
      modelDevice: "cpu",
    });

    return { showSetting, baseUrl, otherSetting, themeSetting, language, activeMenu, isElectron, canvasWheelEvent, needUpdate, gpuSetting };
  },
  { persist: { pick: ["baseUrl", "otherSetting", "themeSetting", "language", "gpuSetting"] } },
);
