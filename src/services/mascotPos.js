// src/services/mascotPos.js
// 看板郎实时位置共享：拖拽时由 YiliMascot 上报，AgentBot 据此定位对话框。

let current = null;
const listeners = new Set();

export function setMascotPos(pos) {
  current = pos;
  listeners.forEach((fn) => fn(pos));
}

export function getMascotPos() {
  return current;
}

export function subscribeMascotPos(fn) {
  listeners.add(fn);
  if (current) fn(current);
  return () => {
    listeners.delete(fn);
  };
}
