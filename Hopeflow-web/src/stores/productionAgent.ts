import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import settingStore from "@/stores/setting";
import { useChat } from "@/utils/useChat";
import type { FlowData, Storyboard } from "@/views/production/utils/flowBuilder";
import type { ChatMessagesData } from "@tdesign-vue-next/chat";
import { useThrottleFn } from "@vueuse/core";

function makeProductionAgentStore(projectId: string) {
  return defineStore(`productionAgent-${projectId}`, () => {
    const defMsg: ChatMessagesData[] = [
      {
        id: "welcome",
        role: "assistant",
        content: [
          { type: "text", status: "complete", data: $t("workbench.production.chatBox.welcomeMessage") },
          {
            type: "suggestion",
            status: "complete",
            data: [{ title: $t("workbench.production.chatBox.startMakingVideo"), prompt: $t("workbench.production.chatBox.startMakingVideoPrompt") }],
          },
        ],
      },
    ];
    onMounted(() => {
      if (messages.value.length <= 0) messages.value = [...defMsg, ...messages.value];
    });

    const flowData = ref<FlowData>({
      script: "", // 剧本
      scriptPlan: "", //导演计划
      storyboardTable: "", //分镜表
      assets: [], // 衍生资产
      storyboard: [], //分镜面板
      workbench: {
        videoList: [],
      }, // 工作台数据
    });

    const episodesId = ref<number>();

    const { connected, messages, chat, stopGenerate, regenerate, socket, status, reconnect, connect, disconnect } = useChat({
      url: `${settingStore().baseUrl}/socket/productionAgent`,
      auth: () => ({
        isolationKey: `${projectId}:productionAgent:${episodesId.value}`,
        projectId: projectId,
        scriptId: episodesId.value,
      }),
      manageLifecycle: false,
      autoConnect: false,
      xmlTags: [
        { tag: "script", keepInMessage: false },
        { tag: "scriptPlan", keepInMessage: false },
        { tag: "storyboardTable", keepInMessage: false },
        { tag: "storyboardItem", keepInMessage: false },
      ],
      onXmlTag: async (data) => {
        const { tag, value, children, attrs, status } = data;
        if (tag === "script") {
          flowData.value.script = value ?? "";
        } else if (tag === "scriptPlan") {
          flowData.value.scriptPlan = value ?? "";
        } else if (tag === "storyboardTable") {
          flowData.value.storyboardTable = value ?? "";
        }
        // else if (tag === "storyboardItem") {
        //   if (status === "complete") {
        //     const prompt = attrs.prompt ?? "";
        //     const duration = Number(attrs.duration) || 0;
        //     const track = attrs.track || "";
        //     const shouldGenerateImage =
        //       (typeof attrs.shouldGenerateImage == "boolean" && attrs.shouldGenerateImage) ||
        //       String(attrs.shouldGenerateImage).toLowerCase() == "true"
        //         ? 1
        //         : 0;

        //     const videoDesc = attrs?.videoDesc ?? "";
        //     const existingIndex = flowData.value.storyboard.findIndex(
        //       (s) => s.prompt == prompt && s.duration == duration && videoDesc == s.videoDesc,
        //     );
        //     if (existingIndex !== -1) {
        //       // 已存在则更新 content，保留 id
        //       flowData.value.storyboard[existingIndex].prompt = prompt;
        //     } else {
        //       // 不存在则追加新条目
        //       flowData.value.storyboard.push({
        //         prompt: prompt || "",
        //         duration: Number(duration) || 0,
        //         state: "未生成" as "未生成" | "生成中" | "已完成" | "生成失败",
        //         src: null,
        //         associateAssetsIds: JSON.parse(attrs.associateAssetsIds) || [],
        //         videoDesc: videoDesc,
        //         shouldGenerateImage: shouldGenerateImage,
        //       });
        //       await addStoryboardInfo([
        //         {
        //           prompt: prompt || "",
        //           duration: Number(duration) || 0,
        //           track: track || "",
        //           state: "未生成" as "未生成" | "生成中" | "已完成" | "生成失败",
        //           src: null,
        //           videoDesc,
        //           shouldGenerateImage,
        //           associateAssetsIds: JSON.parse(attrs.associateAssetsIds) || [],
        //         },
        //       ]);
        //     }
        //   }
        // }
        if (status == "complete") {
          throttledFn();
        }
      },
    });

    // 实际的节流方法
    const throttledFn = useThrottleFn(
      () => {
        setFlowData(episodesId.value);
      },
      500,
      true,
      true,
    );
    // 注册 getPlanData 事件（无需依赖组件生命周期）
    watch(
      socket,
      (s) => {
        if (s) {
          s.on("connect", () => {
            getHistory();
            // 重连后重新下发全自动模式状态，保持开关一致
            if (autoMode.value) {
              s.emit("updateAutoConfig", { auto: true, maxRetries: 2 });
            }
          });
          s.on("getFlowData", (data, callback) => {
            try {
              const returnData = JSON.parse(JSON.stringify(flowData.value));
              (returnData.assets || []).forEach((item: any) => {
                delete item.prompt;
                delete item.flowId;
                delete item.src;
                if (item.derive && item.derive.length) {
                  item.derive.forEach((deriveItem: any) => {
                    delete deriveItem.prompt;
                    delete deriveItem.flowId;
                    delete deriveItem.src;
                  });
                }
              });
              (returnData.storyboard || []).forEach((item: any) => {
                delete item.prompt;
                delete item.src;
                delete item.flowId;
              });
              // 按请求的 key 只回传对应字段，避免每次全量传输导致数据包超限断开
              callback(data?.key ? { [data.key]: returnData[data.key] } : returnData);
            } catch (e) {
              console.error("[getFlowData] error", e);
              callback({ error: true, message: "获取工作区数据失败" });
            }
          });
          s.on("addDeriveAsset", async (data, callback) => {
            try {
              const assets = flowData.value.assets.find((a) => a.id === data.assetsId);
              if (!assets) return callback({ success: false, message: $t("storyboard.assets.notExist") });
              const deriveAssetList = assets.derive || [];
              const item = deriveAssetList.find((d) => d.id === data.id);
              if (item) {
                item.name = data.name;
                item.type = assets.type;
                callback({ success: true, message: $t("storyboard.assets.derivativeUpdateSuccess") });
              } else {
                deriveAssetList.push({
                  assetsId: data.assetsId,
                  id: data.id,
                  name: data.name,
                  type: assets.type,
                  desc: data.describe,
                  prompt: "",
                  state: "未生成" as "未生成" | "生成中" | "已完成" | "生成失败",
                  src: "",
                });
                callback({ success: true, message: $t("storyboard.assets.derivativeAddSuccess") });
              }
            } catch (e) {
              console.error("[addDeriveAsset] error", e);
              callback({ success: false, message: "操作衍生资产失败" });
            }
          });
          s.on("delDeriveAsset", async (data, callback) => {
            try {
              const assets = flowData.value.assets.find((a) => a.id === data.assetsId);
              if (!assets) return callback({ success: false, message: $t("storyboard.assets.notExist") });
              const deriveAssetList = assets.derive || [];
              const index = deriveAssetList.findIndex((d) => d.id === data.id);
              if (index === -1) return callback({ success: false, message: $t("storyboard.assets.notDerivativeExist") });
              deriveAssetList.splice(index, 1);
              callback({ success: true, message: $t("storyboard.assets.derivativeDelSuccess") });
            } catch (e) {
              console.error("[delDeriveAsset] error", e);
              callback({ success: false, message: "删除衍生资产失败" });
            }
          });
          s.on("generateDeriveAsset", async (data, callback) => {
            try {
              const assetsData = await batchGenerateAssets(data.ids);
              callback({ success: true, message: assetsData });
            } catch (e) {
              console.error("[generateDeriveAsset] error", e);
              callback({ success: false, message: "生成衍生资产失败" });
            }
          });
          s.on("generateStoryboard", async (data, callback) => {
            try {
              const storyData = await batchGenerateStoryboard(data.ids);
              callback({ success: true, message: storyData });
            } catch (e) {
              console.error("[generateStoryboard] error", e);
              callback({ success: false, message: "生成分镜失败" });
            }
          });
          s.on("addStoryboard", async (data, callback) => {
            try {
              const insertVal = {
                prompt: data.prompt || "",
                duration: Number(data.duration) || 0,
                track: data.track || "",
                state: "未生成" as "未生成" | "生成中" | "已完成" | "生成失败",
                src: null,
                videoDesc: data.videoDesc,
                shouldGenerateImage:
                  (typeof data.shouldGenerateImage == "boolean" && data.shouldGenerateImage) || String(data.shouldGenerateImage).toLowerCase() == "true"
                    ? 1
                    : 0,
                associateAssetsIds: data.associateAssetsIds || [],
              };
              flowData.value.storyboard.push(insertVal);
              await addStoryboardInfo([insertVal]);
              throttledFn();
              callback({ success: true, message: $t("storyboard.assets.derivativeAddSuccess") });
            } catch (e) {
              console.error("[addStoryboard] error", e);
              callback({ success: false, message: "新增分镜失败" });
            }
          });
          s.on("updateStoryboard", async (data, callback) => {
            try {
              const updateVal: Record<string, any> = { id: data.id };
              if (data.videoDesc !== undefined) updateVal.videoDesc = data.videoDesc;
              if (data.prompt !== undefined) updateVal.prompt = data.prompt;
              if (data.duration !== undefined) updateVal.duration = Number(data.duration) || 0;
              if (data.track !== undefined) updateVal.track = data.track;
              if (data.associateAssetsIds !== undefined) updateVal.associateAssetsIds = data.associateAssetsIds || [];
              if (data.shouldGenerateImage !== undefined) {
                updateVal.shouldGenerateImage =
                  (typeof data.shouldGenerateImage == "boolean" && data.shouldGenerateImage) || String(data.shouldGenerateImage).toLowerCase() == "true"
                    ? 1
                    : 0;
              }

              const { data: updated } = await axios.post("/production/storyboard/updateStoryboardInfo", updateVal);

              const item = flowData.value.storyboard.find((s) => s.id === data.id);
              if (item && updated) {
                if (updated.videoDesc !== undefined) item.videoDesc = updated.videoDesc;
                if (updated.prompt !== undefined) item.prompt = updated.prompt;
                if (updated.duration !== undefined) item.duration = updated.duration;
                if (updated.trackId !== undefined) item.trackId = updated.trackId;
                if (updated.shouldGenerateImage !== undefined) item.shouldGenerateImage = updated.shouldGenerateImage;
                if (updated.associateAssetsIds !== undefined) item.associateAssetsIds = updated.associateAssetsIds;
                if (updated.src !== undefined) item.src = updated.src;
                if (updated.state !== undefined) item.state = updated.state;
              }

              throttledFn();
              callback({ success: true, message: "更新分镜成功" });
            } catch (e) {
              console.error("[updateStoryboard] error", e);
              callback({ success: false, message: "更新分镜失败" });
            }
          });
          s.on("delStoryboard", async (data, callback) => {
            try {
              await axios.post("/production/storyboard/removeFrame", { id: data.id });
              const index = flowData.value.storyboard.findIndex((s) => s.id === data.id);
              if (index !== -1) flowData.value.storyboard.splice(index, 1);
              throttledFn();
              callback({ success: true, message: "删除分镜成功" });
            } catch (e) {
              console.error("[delStoryboard] error", e);
              callback({ success: false, message: "删除分镜失败" });
            }
          });
        }
      },
      { immediate: true },
    );

    async function setFlowData(scriptId?: number) {
      await axios.post("/production/saveFlowData", {
        projectId: projectId,
        data: flowData.value,
        episodesId: scriptId || episodesId.value,
      });
    }

    async function getFlowData() {
      const { data } = await axios.post("/production/getFlowData", {
        projectId: projectId,
        episodesId: episodesId.value,
      });
      flowData.value = data;
    }
    async function batchGenerateStoryboard(
      allIds: number[],
      compulsory: boolean = false,
      model?: string,
      options: { onlyFailed?: boolean; acknowledgeMissingAssets?: boolean } = {},
    ) {
      try {
        const { data } = await axios.post("/production/storyboard/batchGenerateImage", {
          scriptId: episodesId.value,
          projectId: projectId,
          storyboardIds: allIds,
          concurrentCount: settingStore().otherSetting.assetsBatchGenereateSize,
          compulsory,
          model,
          onlyFailed: options.onlyFailed ?? false,
          acknowledgeMissingAssets: options.acknowledgeMissingAssets ?? false,
        });
        if (Array.isArray(data)) {
          if (flowData.value.storyboard.length === 0) {
            flowData.value.storyboard = data;
            return data;
          } else {
            flowData.value.storyboard.forEach((item) => {
              const findData = data.find((i: any) => i.id == item.id);
              if (findData) {
                item.state = findData.state;
                // 响应 src 为空时不覆盖旧图，避免重新生成失败后历史图片丢失展示
                if (findData.src) item.src = findData.src;
              }
            });
          }
        } else if (data?.message) {
          // 例如「没有需要补跑的分镜」这类提示
          window.$message.info(data.message);
        }
        return data;
      } catch (e) {
        window.$message.error((e as any)?.message);
        // 抛出给调用方：门禁类错误（画风没解析、资产没出图）需要调用方决定是否引导去补上一步
        throw e;
      }
    }
    async function batchGenerateAssets(allIds: number[]) {
      flowData.value.assets.forEach((asset) => {
        if (asset.derive) {
          asset.derive.forEach((derive) => {
            if (allIds.includes(derive.id)) {
              derive.state = "生成中" as "未生成" | "生成中" | "已完成" | "生成失败";
            }
          });
        }
      });
      try {
        const { data } = await axios.post("/production/assets/batchGenerateAssetsImage", {
          assetIds: allIds,
          projectId: projectId,
          scriptId: episodesId.value,
          concurrentCount: settingStore().otherSetting.assetsBatchGenereateSize,
        });
        if (data) {
          data.forEach((record: { id: number; state: "未生成" | "生成中" | "已完成" | "生成失败"; src: string }) => {
            flowData.value.assets.forEach((asset) => {
              if (asset.derive) {
                asset.derive.forEach((derive) => {
                  if (derive.id === record.id) {
                    derive.state = record.state;
                    derive.src = record.src;
                  }
                });
              }
            });
          });
        }
        return data;
      } catch (e) {}
    }
    const assetsNotStateImageIds = computed(() => {
      const ids: number[] = [];
      flowData.value.assets.forEach((asset) => {
        if (asset.derive) {
          asset.derive.forEach((derive) => {
            if (derive.state == ("生成中" as "未生成" | "生成中" | "已完成" | "生成失败")) {
              ids.push(derive.id);
            }
          });
        }
      });
      return ids;
    });
    const storyboardNotStateImageIds = computed(() => {
      const ids: number[] = [];
      flowData.value.storyboard.forEach((asset) => {
        if (asset.state == "生成中" && asset.id) {
          ids.push(asset.id);
        }
      });
      return ids;
    });
    // ---- 资产图片轮询 ----
    let assetsPollingTimer: number | null = null;
    let assetsPollingInFlight = false;

    async function pollAssetsImages() {
      const ids = assetsNotStateImageIds.value;
      if (ids.length === 0 || assetsPollingInFlight) return;
      assetsPollingInFlight = true;
      try {
        const { data } = await axios.post("/production/assets/pollingImage", {
          ids: ids,
        });
        if (!data || data.length === 0) return;
        const records = data as Array<{ id: number; state: string; src?: string; errorReason?: string; prompt?: string }>;
        records.forEach((record) => {
          flowData.value.assets.forEach((asset) => {
            if (!asset.derive) return;
            asset.derive.forEach((derive) => {
              if (derive.id === record.id) {
                derive.state = record.state as "未生成" | "生成中" | "已完成" | "生成失败";
                if (record.src) derive.src = record.src;
                derive.errorReason = record?.errorReason ?? "";
                derive.prompt = record?.prompt ?? "";
              }
            });
          });
        });
      } catch (e) {
        console.error("[assetsPolling] error", e);
      } finally {
        assetsPollingInFlight = false;
      }
    }

    function startAssetsPolling() {
      if (assetsPollingTimer) return;
      assetsPollingTimer = window.setInterval(async () => {
        if (assetsNotStateImageIds.value.length === 0) {
          stopAssetsPolling();
          return;
        }
        await pollAssetsImages();
      }, 5000);
      // 立即执行一次
      pollAssetsImages();
    }

    function stopAssetsPolling() {
      if (assetsPollingTimer) {
        clearInterval(assetsPollingTimer);
        assetsPollingTimer = null;
      }
    }

    watch(
      () => assetsNotStateImageIds.value,
      (ids) => {
        if (ids.length > 0) {
          startAssetsPolling();
        } else {
          stopAssetsPolling();
        }
      },
    );

    // ---- 分镜图片轮询 ----
    let storyboardPollingTimer: number | null = null;
    let storyboardPollingInFlight = false;

    async function pollStoryboardImages() {
      const ids = storyboardNotStateImageIds.value;
      if (ids.length === 0 || storyboardPollingInFlight) return;
      storyboardPollingInFlight = true;
      try {
        const { data } = await axios.post("/production/storyboard/pollingImage", {
          ids: ids,
        });
        if (!data || data.length === 0) return;
        const records = data as Array<{ id: number; state: string; src?: string; reason?: string }>;
        records.forEach((record) => {
          const item = flowData.value.storyboard.find((s) => s.id === record.id);
          if (item) {
            item.state = record.state as "未生成" | "生成中" | "已完成" | "生成失败";
            if (record.src) item.src = record.src;
            item.reason = record?.reason ?? "";
          }
        });
      } catch (e) {
        console.error("[storyboardPolling] error", e);
      } finally {
        storyboardPollingInFlight = false;
      }
    }

    function startStoryboardPolling() {
      if (storyboardPollingTimer) return;
      storyboardPollingTimer = window.setInterval(async () => {
        if (storyboardNotStateImageIds.value.length === 0) {
          stopStoryboardPolling();
          return;
        }
        await pollStoryboardImages();
      }, 5000);
      // 立即执行一次
      pollStoryboardImages();
    }

    function stopStoryboardPolling() {
      if (storyboardPollingTimer) {
        clearInterval(storyboardPollingTimer);
        storyboardPollingTimer = null;
      }
    }

    watch(
      () => storyboardNotStateImageIds.value,
      (ids) => {
        if (ids.length > 0) {
          startStoryboardPolling();
        } else {
          stopStoryboardPolling();
        }
      },
    );

    function updateContext() {
      if (episodesId.value! < 0) return;
      const ctx = {
        isolationKey: `${projectId}:productionAgent:${episodesId.value}`,
        projectId: projectId,
        scriptId: episodesId.value,
      };
      if (!connected.value) connect();
      socket.value!.emit("updateContext", ctx);
    }
    async function addStoryboardInfo(items: any[]) {
      const { data } = await axios.post("/production/storyboard/batchAddStoryboardInfo", {
        scriptId: episodesId.value,
        data: items,
        projectId: projectId,
      });

      // 已经被占用的 id 集合，防止多张卡片指向同一条数据库记录
      const taken = new Set<number>(
        flowData.value.storyboard.map((s) => s.id).filter((id): id is number => typeof id === "number"),
      );

      flowData.value.storyboard.forEach((item) => {
        // 已经有 id 的卡片：按 id 精确对齐，只同步状态
        if (typeof item.id === "number") {
          const exact = data.find((d: Storyboard) => d.id === item.id);
          if (!exact) return;
          item.trackId = exact.trackId;
          if (exact.src) item.src = exact.src;
          item.state = exact.state;
          item.associateAssetsIds = exact.associateAssetsIds;
          return;
        }

        // 还没有 id 的卡片（agent 新增的）：按内容匹配一个「尚未被占用」的 id。
        // 分镜的 prompt 常常重复甚至为空（现场就有一集 10 条分镜只有 1 个不同 prompt），
        // 只用内容匹配会让多张卡片拿到同一个 id、有的卡片永远拿不到 id，
        // 那正是「全选点了没反应、生成按钮一直 disabled」的根因。
        const updated = data.find(
          (d: Storyboard) =>
            typeof d.id === "number" &&
            !taken.has(d.id) &&
            d.prompt == item.prompt &&
            d.duration == item.duration &&
            d.videoDesc == item.videoDesc,
        );
        if (updated) {
          item.id = updated.id;
          taken.add(updated.id as number);
          item.trackId = updated.trackId;
          if (updated.src) item.src = updated.src;
          item.state = updated.state;
          item.associateAssetsIds = updated.associateAssetsIds;
        }
      });
    }

    const loadingHistory = ref(false);
    async function getHistory() {
      loadingHistory.value = true;
      const { data } = await axios.post(`/agents/getMemory`, {
        projectId: projectId,
        episodesId: episodesId.value,
        agentType: "productionAgent",
      });
      messages.value = [];
      messages.value = [...defMsg, ...data];
      loadingHistory.value = false;
    }

    const thinkLevel = ref(0);

    function updateThinkConfig(value: number) {
      thinkLevel.value = value;
      if (socket.value) {
        socket.value.emit("updateThinkConfig", { think: value > 0, thinlLevel: value });
      }
    }

    // 全自动模式（临时开关，仅当前浏览器会话有效）
    const autoMode = ref(false);

    function updateAutoConfig(auto: boolean) {
      autoMode.value = auto;
      if (socket.value) {
        socket.value.emit("updateAutoConfig", { auto, maxRetries: 2 });
      }
    }

    return {
      connected,
      messages,
      chat,
      stopGenerate,
      regenerate,
      socket,
      status,
      flowData,
      setFlowData,
      getFlowData,
      episodesId,
      stopAssetsPolling,
      stopStoryboardPolling,
      updateContext,
      getHistory,
      loadingHistory,
      batchGenerateStoryboard,
      reconnect,
      thinkLevel,
      updateThinkConfig,
      autoMode,
      updateAutoConfig,
    };
  });
}

const storeMap = new Map<string, ReturnType<typeof makeProductionAgentStore>>();

function createProductionAgentStore(projectId: string) {
  if (!storeMap.has(projectId)) {
    storeMap.set(projectId, makeProductionAgentStore(projectId));
  }
  return storeMap.get(projectId)!;
}

export default function useProductionAgentStore() {
  const id = projectStore().project?.id;
  if (!id) throw new Error("No project selected");
  return createProductionAgentStore(id)();
}
