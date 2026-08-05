// src/hooks/useAuth.js
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase.js';

/**
 * 自定义 Hook：管理用户认证状态
 * @returns {object} { user, loading }
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 获取初始会话状态
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Failed to get initial session:', error.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // 2. 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // 3. 清理订阅
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}