// UI 模块 — 首页视图与编辑页视图管理

import { getState, resetState } from './state';
import { runBackgroundRemoval } from './engine';
import { composite } from './composite';
import { exportImage } from './export';
import type { BackgroundMode, ExportFormat } from './types';

// === DOM 元素引用 ===
let homeView: HTMLElement;
let editorView: HTMLElement;
let dropZone: HTMLElement;
let fileInput: HTMLInputElement;
let displayCanvas: HTMLCanvasElement;
let displayCtx: CanvasRenderingContext2D;
let canvasContainer: HTMLElement;
let processingOverlay: HTMLElement;
let progressBar: HTMLElement;
let progressText: HTMLElement;
let editorFilename: HTMLElement;
let originalThumb: HTMLImageElement;

// 缩放/平移状态
let fitScale = 1;
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

let currentFileName = '';

// === 初始化 ===
export function initUI(): void {
  homeView = document.getElementById('home-view')!;
  editorView = document.getElementById('editor-view')!;
  dropZone = document.getElementById('drop-zone')!;
  fileInput = document.getElementById('file-input') as HTMLInputElement;
  displayCanvas = document.getElementById('display-canvas') as HTMLCanvasElement;
  displayCtx = displayCanvas.getContext('2d')!;
  canvasContainer = document.getElementById('canvas-container')!;
  processingOverlay = document.getElementById('processing-overlay')!;
  progressBar = document.getElementById('progress-bar')!;
  progressText = document.getElementById('progress-text')!;
  editorFilename = document.getElementById('editor-filename')!;
  originalThumb = document.getElementById('original-thumb') as HTMLImageElement;

  initHomeView();
  initEditorView();
  initTheme();

  window.addEventListener('resize', () => {
    if (editorView.style.display !== 'none') {
      computeFitScale();
      renderCanvas();
    }
  });
}

// === 首页 ===
function initHomeView(): void {
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) handleFile(files[0]);
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer?.files.length) handleFile(e.dataTransfer.files[0]);
  });

  document.addEventListener('paste', (e) => {
    if (editorView.style.display !== 'none') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  });
}

function handleFile(file: File): void {
  if (!file.type.startsWith('image/')) return;
  currentFileName = file.name;
  loadImage(file);
}

function loadImage(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const state = getState();
      state.original = img;
      state.originalWidth = img.naturalWidth;
      state.originalHeight = img.naturalHeight;

      // 设置原图缩略图
      originalThumb.src = reader.result as string;
      originalThumb.style.display = 'block';

      // 提取原始图像数据（供抠图后背景模糊用）
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const cx = c.getContext('2d')!;
      cx.drawImage(img, 0, 0);
      state.originalData = cx.getImageData(0, 0, c.width, c.height);

      showEditor();
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}

// === 编辑页 ===
function initEditorView(): void {
  document.getElementById('btn-back')!.addEventListener('click', showHome);

  // 背景模式
  document.querySelectorAll('.bg-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = (btn as HTMLElement).dataset.bg as BackgroundMode;
      setBackgroundMode(mode);
    });
  });

  // 颜色选择器
  const colorPicker = document.getElementById('bg-color') as HTMLInputElement;
  colorPicker.addEventListener('input', () => {
    getState().backgroundColor = colorPicker.value;
    document.getElementById('color-hex')!.textContent = colorPicker.value;
    renderCanvas();
  });

  // 预设色板
  document.querySelectorAll('.color-preset').forEach((el) => {
    el.addEventListener('click', () => {
      const color = (el as HTMLElement).dataset.color!;
      getState().backgroundColor = color;
      colorPicker.value = color;
      document.getElementById('color-hex')!.textContent = color;
      document.querySelectorAll('.color-preset').forEach((p) => p.classList.remove('selected'));
      el.classList.add('selected');
      renderCanvas();
    });
  });

  // 模糊强度
  const blurSlider = document.getElementById('blur-strength') as HTMLInputElement;
  blurSlider.addEventListener('input', () => {
    getState().blurStrength = parseInt(blurSlider.value);
    document.getElementById('blur-val')!.textContent = `${blurSlider.value}px`;
    renderCanvas();
  });

  // 自动抠图
  document.getElementById('btn-auto-matting')!.addEventListener('click', runAutoMatting);

  // 导出
  document.getElementById('btn-export')!.addEventListener('click', handleExport);
  document.getElementById('export-format')!.addEventListener('change', (e) => {
    getState().exportFormat = (e.target as HTMLSelectElement).value as ExportFormat;
  });
  const scaleInput = document.getElementById('export-scale') as HTMLInputElement;
  scaleInput.addEventListener('input', () => {
    getState().exportScale = parseInt(scaleInput.value) || 100;
    updateExportRes();
  });

  // 画布交互（仅平移/缩放）
  const canvasArea = document.getElementById('canvas-area')!;
  canvasArea.addEventListener('mousedown', onCanvasMouseDown);
  canvasArea.addEventListener('mousemove', onCanvasMouseMove);
  canvasArea.addEventListener('mouseup', onCanvasMouseUp);
  canvasArea.addEventListener('mouseleave', onCanvasMouseUp);
  canvasArea.addEventListener('wheel', onCanvasWheel, { passive: false });
  canvasArea.addEventListener('touchstart', onTouchStart, { passive: false });
  canvasArea.addEventListener('touchmove', onTouchMove, { passive: false });
  canvasArea.addEventListener('touchend', onTouchEnd);
}

// === 视图切换 ===
function showEditor(): void {
  homeView.style.display = 'none';
  editorView.style.display = 'flex';
  editorFilename.textContent = currentFileName;
  zoomLevel = 1;
  panX = 0;
  panY = 0;
  updateExportRes();
  // 等浏览器完成布局后再计算适配比例并渲染
  requestAnimationFrame(() => {
    computeFitScale();
    renderCanvas();
  });
}

function showHome(): void {
  editorView.style.display = 'none';
  homeView.style.display = 'flex';
  resetState();
  zoomLevel = 1;
  panX = 0;
  panY = 0;
  fitScale = 1;
  canvasContainer.style.transform = '';
  originalThumb.style.display = 'none';
}

// === 自动抠图 ===
async function runAutoMatting(): Promise<void> {
  const state = getState();
  if (!state.original) return;

  state.isProcessing = true;
  state.modelStatus = '正在加载 AI 模型...';
  showProcessing(true);

  try {
    const result = await runBackgroundRemoval(state.original, (key, current, total) => {
      state.modelProgress = Math.round((current / total) * 100);
      state.modelStatus = '正在加载 AI 模型...';
      updateProgress();
    });

    state.resultData = result;
    renderCanvas();
  } catch (err) {
    console.error('抠图失败:', err);
    alert('抠图处理失败，请重试。');
  } finally {
    state.isProcessing = false;
    showProcessing(false);
  }
}

// === 画布渲染 ===
export function renderCanvas(): void {
  const state = getState();
  if (!state.original) return;

  const scale = fitScale * zoomLevel;
  const displayW = Math.round(state.originalWidth * scale);
  const displayH = Math.round(state.originalHeight * scale);

  displayCanvas.style.width = `${displayW}px`;
  displayCanvas.style.height = `${displayH}px`;
  displayCanvas.width = state.originalWidth;
  displayCanvas.height = state.originalHeight;

  displayCtx.clearRect(0, 0, state.originalWidth, state.originalHeight);

  if (state.resultData) {
    const displayData = composite(
      state.resultData,
      state.backgroundMode,
      state.backgroundColor,
      state.blurStrength,
      state.original
    );
    displayCtx.putImageData(displayData, 0, 0);
  } else {
    displayCtx.drawImage(state.original, 0, 0);
  }

  canvasContainer.style.transform = `translate(${panX}px, ${panY}px)`;
  updateExportRes();
}

// === 自适应缩放 ===
function computeFitScale(): void {
  const state = getState();
  if (!state.original) return;

  const area = document.getElementById('canvas-area')!;
  const rect = area.getBoundingClientRect();
  const availW = rect.width - 20;
  const availH = rect.height - 20;

  if (availW <= 0 || availH <= 0) { fitScale = 1; return; }
  fitScale = Math.min(availW / state.originalWidth, availH / state.originalHeight);
}

// === 处理中 ===
function showProcessing(show: boolean): void {
  processingOverlay.style.display = show ? 'flex' : 'none';
}

function updateProgress(): void {
  const state = getState();
  if (progressBar) progressBar.style.width = `${state.modelProgress}%`;
  if (progressText) progressText.textContent = `${state.modelStatus} ${state.modelProgress}%`;
}

// === 背景 ===
function setBackgroundMode(mode: BackgroundMode): void {
  getState().backgroundMode = mode;
  document.querySelectorAll('.bg-mode-btn').forEach((b) => b.classList.remove('active'));
  document.querySelector(`.bg-mode-btn[data-bg="${mode}"]`)?.classList.add('active');

  document.getElementById('color-controls')!.style.display = mode === 'color' ? 'block' : 'none';
  document.getElementById('blur-controls')!.style.display = mode === 'blur' ? 'block' : 'none';
  renderCanvas();
}

// === 导出 ===
function handleExport(): void {
  const state = getState();
  if (!state.resultData && !state.original) return;

  let exportData: ImageData;
  if (state.resultData) {
    if (state.exportFormat === 'image/png' || state.exportFormat === 'image/webp') {
      exportData = composite(state.resultData, 'transparent', '#ffffff', 0, null);
    } else {
      exportData = composite(state.resultData, 'color', '#ffffff', 0, null);
    }
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = state.originalWidth;
    canvas.height = state.originalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(state.original!, 0, 0);
    exportData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  exportImage(exportData, state.exportFormat, state.exportScale);
}

function updateExportRes(): void {
  const state = getState();
  const w = Math.round(state.originalWidth * (state.exportScale / 100));
  const h = Math.round(state.originalHeight * (state.exportScale / 100));
  document.getElementById('export-res')!.textContent = `输出尺寸: ${w} x ${h}`;
}

// === 平移/缩放交互 ===
function onCanvasMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return;
  isPanning = true;
  panStartX = e.clientX - panX;
  panStartY = e.clientY - panY;
}

function onCanvasMouseMove(e: MouseEvent): void {
  if (!isPanning) return;
  panX = e.clientX - panStartX;
  panY = e.clientY - panStartY;
  canvasContainer.style.transform = `translate(${panX}px, ${panY}px)`;
}

function onCanvasMouseUp(): void {
  isPanning = false;
}

function onCanvasWheel(e: WheelEvent): void {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  zoomLevel = Math.max(0.1, Math.min(5, zoomLevel + delta));
  renderCanvas();
}

// 触摸
let lastTouchDist = 0;
function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 2) {
    e.preventDefault();
    lastTouchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  } else if (e.touches.length === 1) {
    const t = e.touches[0];
    panStartX = t.clientX - panX;
    panStartY = t.clientY - panY;
    isPanning = true;
  }
}

function onTouchMove(e: TouchEvent): void {
  if (e.touches.length === 2) {
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    if (lastTouchDist > 0) {
      zoomLevel = Math.max(0.1, Math.min(5, zoomLevel * (dist / lastTouchDist)));
      renderCanvas();
    }
    lastTouchDist = dist;
  } else if (e.touches.length === 1 && isPanning) {
    const t = e.touches[0];
    panX = t.clientX - panStartX;
    panY = t.clientY - panStartY;
    canvasContainer.style.transform = `translate(${panX}px, ${panY}px)`;
  }
}

function onTouchEnd(): void {
  isPanning = false;
}

// === 主题 ===
function initTheme(): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const saved = localStorage.getItem('theme');
  const isDark = saved ? saved === 'dark' : prefersDark;
  applyTheme(isDark);

  document.getElementById('theme-toggle')!.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current !== 'dark');
    localStorage.setItem('theme', current !== 'dark' ? 'dark' : 'light');
  });
}

function applyTheme(isDark: boolean): void {
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('theme-icon')!.textContent = '☀';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('theme-icon')!.textContent = '☾';
  }
}
