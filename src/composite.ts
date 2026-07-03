// 画布合成模块

import type { EditorState } from './types';

/**
 * 将手动修正烘焙到 resultData 的 alpha 通道中
 * - 添加画笔：恢复该区域原始图像的 RGB 色值 + 不透明遮罩
 * - 擦除画笔：该区域变为透明
 * 烘焙后应清除 addData / removeData
 */
export function bakeCorrections(
  resultData: ImageData,
  addData: ImageData,
  removeData: ImageData,
  featherRadius: number,
  originalData?: ImageData
): ImageData {
  const { width, height } = resultData;
  const baked = new ImageData(
    new Uint8ClampedArray(resultData.data),
    width,
    height
  );

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;

    const addVal = addData.data[idx];
    const removeVal = removeData.data[idx];

    if (addVal > 0) {
      // 添加画笔：用原始图像的 RGB 恢复该区域
      if (originalData) {
        baked.data[idx] = originalData.data[idx];
        baked.data[idx + 1] = originalData.data[idx + 1];
        baked.data[idx + 2] = originalData.data[idx + 2];
      }
      baked.data[idx + 3] = Math.min(255, addVal);
    } else if (removeVal > 0) {
      // 擦除画笔：降低透明度
      const alpha = Math.max(0, baked.data[idx + 3] - removeVal);
      baked.data[idx + 3] = Math.round(alpha);
    }
  }

  // 羽化
  if (featherRadius > 0) {
    return applyFeatherToAlpha(baked, featherRadius);
  }

  return baked;
}

function applyFeatherToAlpha(imageData: ImageData, radius: number): ImageData {
  const { width, height, data } = imageData;
  const result = new Uint8ClampedArray(data);
  const boxSize = Math.round(radius);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -boxSize; dy <= boxSize; dy++) {
        for (let dx = -boxSize; dx <= boxSize; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          sum += data[(ny * width + nx) * 4 + 3];
          count++;
        }
      }
      if (count > 0) {
        result[(y * width + x) * 4 + 3] = Math.round(sum / count);
      }
    }
  }

  return new ImageData(result, width, height);
}

/**
 * 合成最终显示图像：resultData(含前景透明度) + 背景
 */
export function composite(
  resultData: ImageData,
  backgroundMode: string,
  backgroundColor: string,
  blurStrength: number,
  originalImage: HTMLImageElement | null
): ImageData {
  const { width, height } = resultData;
  const output = new ImageData(width, height);

  const bgR = parseInt(backgroundColor.slice(1, 3), 16);
  const bgG = parseInt(backgroundColor.slice(3, 5), 16);
  const bgB = parseInt(backgroundColor.slice(5, 7), 16);

  // 模糊背景
  let blurBgData: ImageData | null = null;
  if (backgroundMode === 'blur' && originalImage) {
    blurBgData = createBlurredBackground(originalImage, width, height, blurStrength);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      const fgR = resultData.data[idx];
      const fgG = resultData.data[idx + 1];
      const fgB = resultData.data[idx + 2];
      const fgA = resultData.data[idx + 3] / 255;

      if (backgroundMode === 'transparent') {
        output.data[idx] = fgR;
        output.data[idx + 1] = fgG;
        output.data[idx + 2] = fgB;
        output.data[idx + 3] = resultData.data[idx + 3];
      } else if (backgroundMode === 'blur' && blurBgData) {
        const blurR = blurBgData.data[idx];
        const blurG = blurBgData.data[idx + 1];
        const blurB = blurBgData.data[idx + 2];
        output.data[idx] = Math.round(fgR * fgA + blurR * (1 - fgA));
        output.data[idx + 1] = Math.round(fgG * fgA + blurG * (1 - fgA));
        output.data[idx + 2] = Math.round(fgB * fgA + blurB * (1 - fgA));
        output.data[idx + 3] = 255;
      } else {
        output.data[idx] = Math.round(fgR * fgA + bgR * (1 - fgA));
        output.data[idx + 1] = Math.round(fgG * fgA + bgG * (1 - fgA));
        output.data[idx + 2] = Math.round(fgB * fgA + bgB * (1 - fgA));
        output.data[idx + 3] = 255;
      }
    }
  }

  return output;
}

function createBlurredBackground(
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
  blurStrength: number
): ImageData {
  const scale = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  const sx = (sw - targetW) / 2;
  const sy = (sh - targetH) / 2;

  ctx.filter = `blur(${blurStrength}px)`;
  ctx.drawImage(img, -sx, -sy, sw, sh);
  ctx.filter = 'none';

  return ctx.getImageData(0, 0, targetW, targetH);
}
