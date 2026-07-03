// 抠图引擎 — 封装 @imgly/background-removal

import { removeBackground } from '@imgly/background-removal';

/**
 * 将图片转为 Blob，再传入库（库只接受 Blob/URL/String/ArrayBuffer/ImageData）
 */
function imageToBlob(img: HTMLImageElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('图片转换失败'));
      },
      'image/png',
      1
    );
  });
}

function blobToImageData(blob: Blob): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法解析抠图结果'));
    };
    img.src = url;
  });
}

/**
 * 执行背景移除。
 * 将 HTMLImageElement 转为 Blob 再传入 removeBackground。
 */
export async function runBackgroundRemoval(
  image: HTMLImageElement,
  onProgress?: (key: string, current: number, total: number) => void
): Promise<ImageData> {
  const blob = await imageToBlob(image);

  const resultBlob = await removeBackground(blob, {
    model: 'isnet',
    output: { format: 'image/png', quality: 1 },
    progress: (key, current, total) => {
      try {
        onProgress?.(key, current, total);
      } catch {
        // 忽略进度回调中的错误
      }
    },
  });

  return blobToImageData(resultBlob);
}
