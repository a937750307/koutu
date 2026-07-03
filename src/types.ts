// 背景模式
export type BackgroundMode = 'transparent' | 'color' | 'blur';

// 导出格式
export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';

// 编辑器状态
export interface EditorState {
  // 原始图片
  original: HTMLImageElement | null;
  originalData: ImageData | null;
  originalWidth: number;
  originalHeight: number;

  // AI 抠图结果（含透明通道的 ImageData）
  resultData: ImageData | null;

  // 背景设置
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  blurStrength: number;

  // 导出设置
  exportFormat: ExportFormat;
  exportScale: number;

  // UI 状态
  isProcessing: boolean;
  modelProgress: number;
  modelStatus: string;
}

// 创建初始状态
export function createInitialState(): EditorState {
  return {
    original: null,
    originalData: null,
    originalWidth: 0,
    originalHeight: 0,
    resultData: null,
    backgroundMode: 'transparent',
    backgroundColor: '#ffffff',
    blurStrength: 10,
    exportFormat: 'image/png',
    exportScale: 100,
    isProcessing: false,
    modelProgress: 0,
    modelStatus: '',
  };
}
