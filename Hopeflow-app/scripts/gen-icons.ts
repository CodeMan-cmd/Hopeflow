import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const root = process.cwd();
const svgPath = join(root, "docs/logo-new.svg");
const svgBuffer = readFileSync(svgPath);

// 目标文件列表
const targets = {
  // 前端
  webLogoPng: join(root, "../Hopeflow-web/src/assets/logo.png"),
  webFavicon: join(root, "../Hopeflow-web/public/favicon.ico"),
  webDocsLogo: join(root, "../Hopeflow-web/docs/logo.png"),
  // 后端
  appDocsLogo: join(root, "docs/logo.png"),
  appScriptsLogoPng: join(root, "scripts/logo.png"),
  appScriptsLogoIco: join(root, "scripts/logo.ico"),
  appScriptsLogoIcns: join(root, "scripts/logo.icns"),
  appDataWebFavicon: join(root, "data/web/favicon.ico"),
};

async function main() {
  console.log("开始生成图标...");

  // 1. 生成 1024x1024 PNG（用于 logo.png）
  const png1024 = await sharp(svgBuffer).resize(1024, 1024).png().toBuffer();

  // 2. 生成多尺寸 PNG（用于 ICO）
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers: Buffer[] = [];
  for (const size of sizes) {
    const buf = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    pngBuffers.push(buf);
  }

  // 3. 生成 ICO
  const icoBuffer = await pngToIco(pngBuffers);

  // 4. 写入 PNG 文件
  writeFileSync(targets.webLogoPng, png1024);
  console.log(`✓ ${targets.webLogoPng}`);
  writeFileSync(targets.webDocsLogo, png1024);
  console.log(`✓ ${targets.webDocsLogo}`);
  writeFileSync(targets.appDocsLogo, png1024);
  console.log(`✓ ${targets.appDocsLogo}`);
  writeFileSync(targets.appScriptsLogoPng, png1024);
  console.log(`✓ ${targets.appScriptsLogoPng}`);

  // 5. 写入 ICO 文件
  writeFileSync(targets.webFavicon, icoBuffer);
  console.log(`✓ ${targets.webFavicon}`);
  writeFileSync(targets.appScriptsLogoIco, icoBuffer);
  console.log(`✓ ${targets.appScriptsLogoIco}`);
  writeFileSync(targets.appDataWebFavicon, icoBuffer);
  console.log(`✓ ${targets.appDataWebFavicon}`);

  // 6. 生成 macOS ICNS（使用 iconutil）
  const iconsetDir = join(root, "scripts/temp.iconset");
  if (existsSync(iconsetDir)) rmSync(iconsetDir, { recursive: true });
  mkdirSync(iconsetDir, { recursive: true });

  const icnsSizes = [
    { name: "icon_16x16.png", size: 16 },
    { name: "icon_16x16@2x.png", size: 32 },
    { name: "icon_32x32.png", size: 32 },
    { name: "icon_32x32@2x.png", size: 64 },
    { name: "icon_128x128.png", size: 128 },
    { name: "icon_128x128@2x.png", size: 256 },
    { name: "icon_256x256.png", size: 256 },
    { name: "icon_256x256@2x.png", size: 512 },
    { name: "icon_512x512.png", size: 512 },
    { name: "icon_512x512@2x.png", size: 1024 },
  ];

  for (const { name, size } of icnsSizes) {
    const buf = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    writeFileSync(join(iconsetDir, name), buf);
  }

  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${targets.appScriptsLogoIcns}"`);
    console.log(`✓ ${targets.appScriptsLogoIcns}`);
  } catch (e) {
    console.log("⚠ ICNS 生成跳过（需要 macOS 环境）");
  }

  // 清理临时目录
  rmSync(iconsetDir, { recursive: true });

  console.log("\n所有图标生成完成！");
}

main().catch(console.error);
