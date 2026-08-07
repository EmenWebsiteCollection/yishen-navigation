// src/services/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 环境变量缺失时立即抛出错误，避免运行时静默失败
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials are not defined. Please check your .env.local file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

// 创建并导出 Supabase 客户端实例
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 默认导出，方便部分场景下直接引入
export default supabase;
