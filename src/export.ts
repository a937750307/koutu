// 导出功能模块

import type { ExportFormat } from './types';

/**
 * 导出 ImageData 为可下载的文件
 */
export function exportImage(
  imageData: ImageData,
  format: ExportFormat,
  scale: number
): void {
  const { width, height } = imageData;

  // 目标尺寸
  const targetW = Math.round(width * (scale / 100));
  const targetH = Math.round(height * (scale / 100));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  // 创建源画布
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.putImageData(imageData, 0, 0);

  // 如果需要非透明格式，先填充白底
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
  }

  // 缩放绘制
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);

  // 导出
  const quality = format === 'image/png' ? 1 : 0.92;
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const ext = format.split('/')[1];
      download(url, `matting-result.${ext === 'jpeg' ? 'jpg' : ext}`);
      URL.revokeObjectURL(url);
    },
    format,
    quality
  );
}

function download(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
