// scripts/optimize-images.js
// 用法: node scripts/optimize-images.js
// 依赖: sharp（已安装）
// 功能:
//   1. 重压缩 7 个 PNG（含 hero + 6 logos），strip 元数据，自动 .bak 备份，可重复运行
//   2. 为 hero + wechat + 6 logos + 22 photos 生成 WebP 副本（不删原文件）

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// PNG 重压缩列表（覆盖原文件，自动备份）
const PNG_RECOMPRESS = [
  'hero_cat.png',
  'rotating-logos/uestc.png',
  'rotating-logos/SPORTFIVE.png',
  'rotating-logos/cuhksz.png',
  'rotating-logos/heroesports.png',
  'rotating-logos/tencent.png',
  'rotating-logos/tjsports.png',
];

// WebP 生成列表（不删原文件）
const WEBP_TARGETS = [
  // hero（透明 PNG → 用 lossless WebP 保留透明度锐利）
  { src: 'hero_cat.png', lossless: true },
  // wechat 二维码（小图，画质高）
  { src: 'contact/wechat.jpg', q: 85 },
  // 6 个 logo（透明 PNG → lossless WebP）
  { src: 'rotating-logos/uestc.png',       lossless: true },
  { src: 'rotating-logos/SPORTFIVE.png',   lossless: true },
  { src: 'rotating-logos/cuhksz.png',      lossless: true },
  { src: 'rotating-logos/heroesports.png', lossless: true },
  { src: 'rotating-logos/tencent.png',     lossless: true },
  { src: 'rotating-logos/tjsports.png',    lossless: true },
];

// 22 张 photos 自动扫描
const PHOTO_DIRS = [
  'photos/tournaments',
  'photos/marketing-events',
  'photos/content-social',
];
PHOTO_DIRS.forEach(dir => {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return;
  fs.readdirSync(abs)
    .filter(f => /\.(jpe?g)$/i.test(f))
    .forEach(f => WEBP_TARGETS.push({ src: path.posix.join(dir, f), q: 80 }));
});

const fmt = n => (n / 1024).toFixed(1) + 'KB';

(async () => {
  console.log('━━━ Step 1: Recompress PNGs (overwrite, backup to .bak) ━━━');
  let pngBefore = 0, pngAfter = 0;
  for (const rel of PNG_RECOMPRESS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      console.warn('  SKIP (missing):', rel);
      continue;
    }
    const before = fs.statSync(abs).size;
    const bak = abs + '.bak';
    if (!fs.existsSync(bak)) fs.copyFileSync(abs, bak);
    let buf;
    try {
      buf = await sharp(bak)
        .png({ compressionLevel: 9, palette: true, effort: 10 })
        .toBuffer();
    } catch (err) {
      // palette 模式偶尔会失败，回退到非 palette
      buf = await sharp(bak)
        .png({ compressionLevel: 9, effort: 10 })
        .toBuffer();
    }
    fs.writeFileSync(abs, buf);
    const after = fs.statSync(abs).size;
    pngBefore += before;
    pngAfter += after;
    console.log(`  ${rel}: ${fmt(before)} → ${fmt(after)} (${((1-after/before)*100).toFixed(0)}% smaller)`);
  }
  console.log(`  ────  PNG total: ${fmt(pngBefore)} → ${fmt(pngAfter)} (saved ${fmt(pngBefore - pngAfter)})`);

  console.log('\n━━━ Step 2: Generate WebP (keep originals) ━━━');
  let webpBefore = 0, webpAfter = 0, webpCount = 0;
  for (const item of WEBP_TARGETS) {
    const abs = path.join(ROOT, item.src);
    if (!fs.existsSync(abs)) {
      console.warn('  SKIP (missing):', item.src);
      continue;
    }
    const out = abs.replace(/\.(png|jpe?g)$/i, '.webp');
    const before = fs.statSync(abs).size;
    const pipeline = sharp(abs);
    if (item.lossless) {
      await pipeline.webp({ lossless: true, effort: 6 }).toFile(out);
    } else {
      await pipeline.webp({ quality: item.q || 80, effort: 6 }).toFile(out);
    }
    const after = fs.statSync(out).size;
    webpBefore += before;
    webpAfter += after;
    webpCount++;
    console.log(`  ${item.src} → ${path.basename(out)}: ${fmt(before)} → ${fmt(after)}`);
  }
  console.log(`  ────  WebP generated: ${webpCount} files, original ${fmt(webpBefore)} → webp ${fmt(webpAfter)}`);

  console.log('\n✅ Done.');
  console.log('   Originals untouched (PNG/JPG kept). .bak files backup recompressed PNGs.');
  console.log('   Add *.bak to .gitignore to avoid uploading backups.');
})().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
