// src/hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const checkIsAnonymous = (user) => {
    if (!user) return false;
    return user.is_anonymous === true || user.app_metadata?.provider === 'anonymous';
  };

  const signInAnonymously = useCallback(async () => {
    console.log('🔐 尝试匿名登录...');
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.warn('匿名登录失败:', error.message);
        return null;
      }
      console.log('✅ 匿名登录成功，用户ID:', data.user?.id);
      return data.user;
    } catch (err) {
      console.warn('匿名登录异常:', err.message);
      return null;
    }
  }, []);

  const initAuth = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 初始化认证...');

      const { data: sessionData } = await supabase.auth.getSession();
      let currentUser = sessionData?.session?.user || null;

      if (!currentUser) {
        console.log('👤 无会话，执行匿名登录');
        currentUser = await signInAnonymously();
      } else {
        console.log('👤 已有会话，用户ID:', currentUser.id);
      }

      if (currentUser) {
        setUser(currentUser);
        setIsAnonymous(checkIsAnonymous(currentUser));
        console.log('✅ 用户已设置:', currentUser.id, '匿名:', checkIsAnonymous(currentUser));
      } else {
        console.warn('⚠️ 无法获取用户，设置 user 为 null');
        setUser(null);
        setIsAnonymous(false);
      }
    } catch (error) {
      console.error('Auth 初始化失败:', error.message);
      setUser(null);
      setIsAnonymous(false);
    } finally {
      setLoading(false);
      console.log('🏁 认证初始化完成，loading = false');
    }
  }, [signInAnonymously]);

  useEffect(() => {
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('📢 Auth 状态变化:', event);
        const newUser = session?.user || null;
        setUser(newUser);
        setIsAnonymous(newUser ? checkIsAnonymous(newUser) : false);
        setLoading(false);

        if (!newUser && event === 'SIGNED_OUT') {
          console.log('🚪 退出登录，重新匿名登录');
          const anonymousUser = await signInAnonymously();
          if (anonymousUser) {
            setUser(anonymousUser);
            setIsAnonymous(true);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initAuth, signInAnonymously]);

  const refreshAnonymous = useCallback(async () => {
    console.log('🔄 刷新匿名身份...');
    const { data } = await supabase.auth.getSession();
    const currentUser = data?.session?.user || null;
    if (!currentUser) {
      const anonymousUser = await signInAnonymously();
      if (anonymousUser) {
        setUser(anonymousUser);
        setIsAnonymous(true);
      }
    } else {
      setUser(currentUser);
      setIsAnonymous(checkIsAnonymous(currentUser));
    }
  }, [signInAnonymously]);

  return {
    user,
    loading,
    isAnonymous,
    refreshAnonymous,
    signInAnonymously,
  };
}