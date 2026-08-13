// src/services/auth.js
import { supabase } from './supabase.js';

// 辅助：将用户输入的用户名转换为合法邮箱
const normalizeEmail = (username) => {
  if (!username || username.trim() === '') return '';
  const trimmed = username.trim();
  // 如果已经包含 @，视为完整邮箱，直接返回
  if (trimmed.includes('@')) return trimmed;
  // 否则自动补全域名
  return `${trimmed}@nav.local`;
};

// ═══════════════════════════════════════════════════════════
// 登录防护层（前端节流/锁定）
// 目的：在客户端追加一道「登录前限制访问操作」的防线，
//       阻止快速重试、暴力破解与接口被脚本刷。
// 说明：这层是用户体验友好的软限制（可被改脚本绕过），
//       真正的强防护是 Supabase Auth 自带的服务端限流
//       （Auth → Rate limits / Bot and Abuse protection），
//       两者叠加使用。详见 docs 注释与部署说明。
// ═══════════════════════════════════════════════════════════
const LOGIN_GUARD_KEY = 'ym_login_guard_v1';
const LOGIN_MAX_FAILED = 5; // 单账号连续失败上限
const LOGIN_LOCKOUT_MS = 10 * 60 * 1000; // 触发后锁定 10 分钟
const LOGIN_MIN_INTERVAL_MS = 1200; // 任意两次登录最小间隔

const readGuard = () => {
  try {
    return JSON.parse(localStorage.getItem(LOGIN_GUARD_KEY)) || {};
  } catch {
    return {};
  }
};

const writeGuard = (g) => {
  try {
    localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(g));
  } catch {
    /* localStorage 不可用时静默降级为不节流 */
  }
};

const guardKey = (account) => (account || '').trim().toLowerCase();

// 登录前检查：返回是否放行；不放行时给出还需等待的秒数
export const getLoginGuard = (account) => {
  const key = guardKey(account);
  const now = Date.now();
  const g = readGuard();
  const rec = g[key];

  if (rec && rec.lockUntil > now) {
    return { allowed: false, waitSeconds: Math.ceil((rec.lockUntil - now) / 1000) };
  }
  if (rec && rec.lockUntil && rec.lockUntil <= now) {
    delete g[key];
  }

  const last = g.lastAt || 0;
  if (now - last < LOGIN_MIN_INTERVAL_MS) {
    return {
      allowed: false,
      waitSeconds: Math.ceil((LOGIN_MIN_INTERVAL_MS - (now - last)) / 1000),
    };
  }
  return { allowed: true, waitSeconds: 0 };
};

// 登录结果回填：成功清零该账号失败数；失败累计，超限锁定
export const reportLoginResult = (account, ok) => {
  const key = guardKey(account);
  const g = readGuard();
  const now = Date.now();

  if (ok) {
    delete g[key];
  } else {
    const rec = g[key] || { fails: 0, lockUntil: 0 };
    rec.fails = (rec.fails || 0) + 1;
    if (rec.fails >= LOGIN_MAX_FAILED) {
      rec.lockUntil = now + LOGIN_LOCKOUT_MS;
      rec.fails = 0;
    }
    g[key] = rec;
  }
  g.lastAt = now;
  writeGuard(g);
};

export const register = async (username, password) => {
  const email = normalizeEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const login = async (username, password) => {
  const email = normalizeEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};