# Fix: 看板郎 Idle 轮播 i→vi 失效

## Summary

`Live2dMascot.jsx` 的 idle 轮播逻辑引用了未定义的常量 `IDLE_FRAMES`（第 126、129 行），导致轮播完全不工作。应改为已定义的 `IDLE_COUNT = 6`。

## Root Cause

代码从独立帧图片重构为雪碧图（sprite）时，第 16 行定义了 `const IDLE_COUNT = 6`，但轮播逻辑仍引用旧的 `IDLE_FRAMES.length`。

## Changes

- **File**: `src/components/Live2dMascot.jsx`
  - Line 126: `IDLE_FRAMES.length` → `IDLE_COUNT`
  - Line 129: `IDLE_FRAMES.length - 1` → `IDLE_COUNT - 1`

## Todos

- [x] 1. Fix `IDLE_FRAMES` → `IDLE_COUNT` in Live2dMascot.jsx

## Final Verification Wave

- [x] F1. Build passes: `npm run build`
