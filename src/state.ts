// 状态管理

import { createInitialState, type EditorState } from './types';

let state: EditorState = createInitialState();

export function getState(): EditorState {
  return state;
}

export function resetState(): void {
  state = createInitialState();
}
