<template>
  <div class="textareaWrapper">
    <div
      ref="editorRef"
      class="promptEditor"
      contenteditable="true"
      :data-placeholder="editorContent.length === 0 ? props.placeholder : ''"
      @input="handleInput"
      @keydown="handleKeydown"
      @paste="handlePaste"
      @blur="handleBlur"
      @mousedown.stop></div>
    <Teleport to="body">
      <div
        v-if="showReferences"
        class="referencesPopup"
        :style="{ left: popupPosition.left + 'px', top: popupPosition.top + 'px', position: 'fixed' }">
        <div class="referencesList">
          <div
            v-for="(item, index) in references"
            :key="index"
            class="reference-item"
            :class="{ active: activeIndex === index }"
            @mousedown.prevent="selectReference(index)">
            <t-image v-if="item.type === 'image'" :src="item.src" fit="cover" class="ref-popup-img" />
            <i-video v-else-if="item.type === 'video'" class="ref-popup-icon" />
            <i-volume-mute v-else-if="item.type === 'audio'" class="ref-popup-icon" />
            <span v-else class="ref-popup-text">文</span>
            <!-- 按类型分别计数 -->
            <span class="reference-label">{{ getRefLabel(index) }}</span>
            <span class="ref-index-badge">#{{ getTypeIndex(index) }}</span>
          </div>
          <div v-if="!references?.length" class="no-references">
            {{ $t("workbench.production.editImage.noReferences") }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { h, render } from "vue";
import { Popup } from "tdesign-vue-next";
import { Video, VolumeMute } from "@icon-park/vue-next";
const props = defineProps<{
  references?: { type: "image" | "video" | "audio" | "text"; src: string }[];
  placeholder?: String;
}>();
const prompt = defineModel<string>({ default: "" });
const editorRef = ref<HTMLDivElement | null>(null);
const showReferences = ref(false);
const activeIndex = ref(0);
const popupPosition = ref({ left: 0, top: 0 });
const editorContent = ref("");
let savedRange: Range | null = null;
let internalUpdate = false;
// 类型对应的中文前缀，用于序列化标识符
const TYPE_PREFIX: Record<string, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
  text: "文本",
};
/**
 * 获取某个 index 在其同类型中的序号（从 1 开始）
 */
function getTypeIndex(targetIndex: number): number {
  const refs = props.references ?? [];
  const targetType = refs[targetIndex]?.type;
  let count = 0;
  for (let i = 0; i <= targetIndex; i++) {
    if (refs[i]?.type === targetType) count++;
  }
  return count;
}
/**
 * 获取弹窗列表中的显示标签
 */
function getRefLabel(index: number): string {
  const ref = props.references?.[index];
  if (!ref) return "";
  const typeIndex = getTypeIndex(index);
  switch (ref.type) {
    case "image":
      return $t("workbench.production.editImage.imageRef", { index: typeIndex });
    case "video":
      return $t("workbench.production.editImage.videoRef", { index: typeIndex });
    case "audio":
      return $t("workbench.production.editImage.audioRef", { index: typeIndex });
    default:
      return $t("workbench.production.editImage.textRef", { index: typeIndex });
  }
}
/**
 * 根据类型前缀 + 类型序号，反查全局 index
 * 用于 renderPromptToEditor 解析序列化字符串
 */
function findRefIndexByTypeAndOrder(typePrefix: string, order: number): number {
  const refs = props.references ?? [];
  // 将 "图" 归一化为 "图片"，兼容用户手动输入的 @图N 格式
  const normalizedPrefix = typePrefix === "图" ? "图片" : typePrefix;
  let count = 0;
  for (let i = 0; i < refs.length; i++) {
    if (TYPE_PREFIX[refs[i].type] === normalizedPrefix) {
      count++;
      if (count === order) return i;
    }
  }
  return -1;
}
// 创建引用标签元素
function createRefTag(index: number): HTMLSpanElement {
  const ref = props.references?.[index];
  const refType = ref?.type ?? "image";
  const refSrc = ref?.src ?? "";
  const typeIndex = getTypeIndex(index); // 该类型下的序号
  const container = document.createElement("span");
  container.contentEditable = "false";
  container.dataset.refIndex = String(index);
  container.dataset.imgSrc = refSrc;
  const popupContent = () => {
    if (refType === "image") {
      return h("img", {
        src: refSrc,
        style: { width: "200px", borderRadius: "8px", display: "block" },
        alt: "",
      });
    }
    if (refType === "text") {
      return h("span", { style: { padding: "8px", display: "block", fontSize: "14px" } }, "文本参考");
    }
    return h("span", { style: { padding: "8px", display: "block" } }, refSrc);
  };
  const tagContent = () => {
    if (refType === "image") return h("img", { src: refSrc, alt: "" });
    if (refType === "video") return h(Video);
    if (refType === "audio") return h(VolumeMute);
    return h("span", { class: "tag-text-icon" }, "文");
  };
  // 标签文字按类型分别计数
  const labelText = getRefLabel(index);
  const vnode = h(
    Popup,
    { content: popupContent, placement: "top" },
    {
      default: () => [h("div", { class: "tag" }, [tagContent(), h("span", null, labelText)])],
    },
  );
  render(vnode, container);
  return container;
}
/**
 * 将 prompt 文本渲染到编辑器
 * 序列化格式：@图1、@视频1、@音频1、@文本1
 */
function renderPromptToEditor(text: string) {
  if (!editorRef.value) return;
  editorRef.value.innerHTML = "";
  // 匹配 @图N、@视频N、@音频N、@文本N 或换行
  const regex = /@(图|图片|视频|音频|文本)(\d+)|\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      editorRef.value.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
    }
    if (match[0] === "\n") {
      editorRef.value.appendChild(document.createElement("br"));
    } else {
      const typePrefix = match[1];
      const order = Number(match[2]);
      const globalIndex = findRefIndexByTypeAndOrder(typePrefix, order);
      if (globalIndex !== -1) {
        editorRef.value.appendChild(createRefTag(globalIndex));
        editorRef.value.appendChild(document.createTextNode("\u200B"));
        editorRef.value.appendChild(document.createTextNode(" "));
      } else {
        // 找不到对应引用时，保留原文本
        editorRef.value.appendChild(document.createTextNode(match[0]));
      }
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    editorRef.value.appendChild(document.createTextNode(text.substring(lastIndex)));
  }
  editorContent.value = editorRef.value.textContent || "";
}
// 初始化编辑器内容
onMounted(() => {
  if (editorRef.value && prompt.value) {
    renderPromptToEditor(prompt.value);
  }
});
let pendingRender = false;
function scheduleRender() {
  if (pendingRender) return;
  pendingRender = true;
  nextTick(() => {
    pendingRender = false;
    if (!editorRef.value || prompt.value === undefined) return;
    renderPromptToEditor(prompt.value);
  });
}
watch(
  () => props.references,
  () => {
    if (editorRef.value && prompt.value) {
      scheduleRender();
    }
  },
);
watch(prompt, (newVal) => {
  if (internalUpdate) {
    internalUpdate = false;
    return;
  }
  if (!editorRef.value) return;
  const currentText = editorRef.value.textContent?.replace(/\u200B/g, "") || "";
  if (newVal !== undefined && newVal !== currentText) {
    scheduleRender();
  }
});
function getTextBeforeCursor(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    return (node as Text).textContent?.substring(0, range.startOffset) ?? "";
  }
  return "";
}
function getCursorPopupPosition(): { left: number; top: number } {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { left: 0, top: 24 };
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rect = range.getBoundingClientRect();
  return { left: Math.max(0, rect.left), top: rect.bottom + 4 };
}
function handleInput() {
  editorContent.value = editorRef.value?.textContent || "";
  syncPrompt();
  const text = getTextBeforeCursor();
  const lastAt = text.lastIndexOf("@");
  if (lastAt !== -1 && !text.substring(lastAt + 1).includes(" ")) {
    showReferences.value = true;
    activeIndex.value = 0;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
    nextTick(() => {
      popupPosition.value = getCursorPopupPosition();
    });
    return;
  }
  showReferences.value = false;
  savedRange = null;
}
function handleKeydown(e: KeyboardEvent) {
  if (showReferences.value && props.references?.length) {
    const maxIndex = props.references.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        activeIndex.value = Math.min(activeIndex.value + 1, maxIndex);
        return;
      case "ArrowUp":
        e.preventDefault();
        activeIndex.value = Math.max(activeIndex.value - 1, 0);
        return;
      case "Enter":
      case "Tab":
        e.preventDefault();
        selectReference(activeIndex.value);
        return;
      case "Escape":
        showReferences.value = false;
        return;
    }
  }
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);
    if (!br.nextSibling || (br.nextSibling.nodeType === Node.TEXT_NODE && br.nextSibling.textContent === "")) {
      br.after(document.createElement("br"));
    }
    const newRange = document.createRange();
    newRange.setStartAfter(br);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    editorContent.value = editorRef.value?.textContent || "";
    syncPrompt();
  }
}
function selectReference(index: number) {
  if (!editorRef.value || !savedRange) return;
  const sel = window.getSelection();
  if (!sel) return;
  const range = savedRange.cloneRange();
  const textNode = range.startContainer as Text;
  const cursorOffset = range.startOffset;
  const fullText = textNode.textContent || "";
  const lastAt = fullText.lastIndexOf("@", cursorOffset - 1);
  if (lastAt === -1) return;
  const container = createRefTag(index);
  const afterNode = textNode.splitText(lastAt);
  afterNode.deleteData(0, cursorOffset - lastAt);
  textNode.parentNode!.insertBefore(container, afterNode);
  const space = document.createTextNode("\u200B");
  container.after(space);
  const normalSpace = document.createTextNode(" ");
  space.after(normalSpace);
  const newRange = document.createRange();
  newRange.setStartAfter(normalSpace);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
  showReferences.value = false;
  savedRange = null;
  editorContent.value = editorRef.value?.textContent || "";
  syncPrompt();
}
/**
 * 提取编辑器内容为序列化字符串
 * 引用标签序列化为 @图1、@视频1、@音频1 等（按类型分别计数）
 */
function extractContent(parent: Node): string {
  let result = "";
  parent.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += (node.textContent || "").replace(/\u200B/g, "");
    } else if (node.nodeName === "BR") {
      result += "\n";
    } else if ((node as HTMLElement).dataset?.refIndex !== undefined) {
      const globalIndex = Number((node as HTMLElement).dataset.refIndex);
      const typePrefix = TYPE_PREFIX[props.references?.[globalIndex]?.type ?? "image"];
      const typeIndex = getTypeIndex(globalIndex);
      result += ` @${typePrefix}${typeIndex} `;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const inner = extractContent(node);
      if (result.length > 0 && !result.endsWith("\n")) result += "\n";
      result += inner;
    }
  });
  return result;
}
function syncPrompt() {
  if (!editorRef.value) return;
  let result = extractContent(editorRef.value);
  result = result.replace(/\n$/, "");
  internalUpdate = true;
  prompt.value = result;
}
function handleBlur() {
  setTimeout(() => {
    showReferences.value = false;
  }, 150);
}
function handlePaste(e: ClipboardEvent) {
  e.preventDefault();
  const text = e.clipboardData?.getData("text/plain") ?? "";
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  editorContent.value = editorRef.value?.textContent || "";
  syncPrompt();
}
</script>

<style lang="scss" scoped>
.textareaWrapper {
  width: 100%;
  height: 100%;
  position: relative;
}
.promptEditor {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: none;
  outline: none;
  padding: 10px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
  color: var(--td-text-color-primary);
  white-space: pre-wrap;
  word-break: break-all;
  cursor: text;

  &:empty::before {
    content: attr(data-placeholder);
    color: var(--td-text-color-placeholder);
    pointer-events: none;
  }
}

.referencesPopup {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 10px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 2px 6px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(4px);

  .referencesList {
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .reference-item {
    display: flex;
    align-items: center;
    padding: 6px 8px;
    cursor: pointer;
    border-radius: 7px;
    transition: background-color 0.15s ease;
    gap: 8px;

    &:hover {
      background-color: var(--td-bg-color-secondarycontainer);
    }

    &.active {
      background-color: var(--td-brand-color-light);
      box-shadow: inset 0 0 0 1px rgba(91, 204, 179, 0.3);
    }

    .ref-popup-img {
      width: 38px;
      height: 38px;
      border-radius: 6px;
      flex-shrink: 0;
      border: 1px solid var(--td-border-level-1-color);
    }

    .ref-popup-icon {
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      flex-shrink: 0;
      background: var(--td-bg-color-secondarycontainer);
      font-size: 18px;
      color: var(--td-text-color-secondary);
    }

    .ref-popup-text {
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      flex-shrink: 0;
      background: var(--td-bg-color-secondarycontainer);
      font-size: 16px;
      font-weight: 500;
      color: var(--td-text-color-secondary);
    }

    .reference-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--td-text-color-primary);
      flex: 1;
    }

    .ref-index-badge {
      font-size: 12px;
      color: var(--td-text-color-placeholder);
      background: var(--td-bg-color-component);
      border-radius: 4px;
      padding: 1px 5px;
    }
  }

  .no-references {
    padding: 16px 12px;
    text-align: center;
    color: var(--td-text-color-placeholder);
    font-size: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
}
:deep(.tag) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 5px;
  border: 1px solid rgba(91, 204, 179, 0.5);
  background: linear-gradient(135deg, #edfaf7 0%, #f0fdfb 100%);
  padding: 1px 6px 1px 3px;
  cursor: pointer;
  vertical-align: middle;
  line-height: 1;
  transition:
    border-color 0.15s,
    background 0.15s;
  font-size: 12px;
  font-weight: 500;
  color: #2da68a;
  user-select: none;
  position: relative;
  top: -1px;
  margin-left: 5px;

  &:hover {
    border-color: #5bccb3;
    background: linear-gradient(135deg, #d8f5ef 0%, #e5faf6 100%);
  }

  img {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid rgba(91, 204, 179, 0.2);
  }

  i {
    font-size: 14px;
    flex-shrink: 0;
  }

  .tag-text-icon {
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }
}
</style>
