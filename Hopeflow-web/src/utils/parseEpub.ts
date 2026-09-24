import JSZip from "jszip";

/**
 * 解析 epub 文件，提取纯文本内容
 * 按 spine 阅读顺序拼接所有 XHTML 章节的文本
 */
export async function parseEpub(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. 读取 container.xml 获取 OPF 文件路径
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    throw new Error("Invalid EPUB: container.xml not found");
  }
  const containerContent = await containerFile.async("string");
  const containerDoc = new DOMParser().parseFromString(containerContent, "application/xml");
  const rootfileElement = containerDoc.querySelector("rootfile");
  const opfPath = rootfileElement?.getAttribute("full-path");
  if (!opfPath) {
    throw new Error("Invalid EPUB: OPF path not found in container.xml");
  }

  // 2. 读取 OPF 文件
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
  }
  const opfContent = await opfFile.async("string");
  const opfDoc = new DOMParser().parseFromString(opfContent, "application/xml");

  // 3. 解析 manifest，建立 id -> href 映射
  const manifest = new Map<string, string>();
  opfDoc.querySelectorAll("manifest > item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) {
      manifest.set(id, decodeURIComponent(href));
    }
  });

  // 4. 解析 spine，获取阅读顺序
  const spineItemIds: string[] = [];
  opfDoc.querySelectorAll("spine > itemref").forEach((itemref) => {
    const idref = itemref.getAttribute("idref");
    if (idref) {
      spineItemIds.push(idref);
    }
  });

  // 5. OPF 文件所在目录（用于解析相对路径）
  const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";

  // 6. 按 spine 顺序读取每个 XHTML 文件并提取文本
  const textParts: string[] = [];
  for (const id of spineItemIds) {
    const href = manifest.get(id);
    if (!href) continue;

    const fullPath = opfDir + href;
    const xhtmlFile = zip.file(fullPath);
    if (!xhtmlFile) continue;

    const xhtmlContent = await xhtmlFile.async("string");
    const doc = new DOMParser().parseFromString(xhtmlContent, "application/xhtml+xml");

    // 提取 body 中的文本，保留段落结构
    const body = doc.querySelector("body");
    if (body) {
      // 在块级元素末尾插入换行符，保留段落结构
      const blocks = body.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, br, li");
      blocks.forEach((block) => {
        block.appendChild(doc.createTextNode("\n"));
      });
      const text = body.textContent || "";
      textParts.push(text.trim());
    }
  }

  return textParts.filter((t) => t.length > 0).join("\n\n");
}
