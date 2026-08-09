// src/hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase.js';

// 匿名登录未启用（Anonymous sign-ins disabled）时，游客每次初始化都会尝试
// 匿名登录并失败——这是预期路径而非异常。首次 warn 一次便于诊断，之后静默防刷屏。
let anonymousLoginWarned = false;

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const checkIsAnonymous = (user) => {
    if (!user) return false;
    return user.is_anonymous === true || user.app_metadata?.provider === 'anonymous';
  };

  const signInAnonymously = useCallback(async () => {

    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        if (!anonymousLoginWarned) {
          console.warn('匿名登录失败:', error.message);
          anonymousLoginWarned = true;
        }
        return null;
      }

      return data.user;
    } catch (err) {
      if (!anonymousLoginWarned) {
        console.warn('匿名登录异常:', err.message);
        anonymousLoginWarned = true;
      }
      return null;
    }
  }, []);

  const initAuth = useCallback(async () => {
    try {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      let currentUser = sessionData?.session?.user || null;

      if (!currentUser) {

        currentUser = await signInAnonymously();
      } else {

      }

      if (currentUser) {
        setUser(currentUser);
        setIsAnonymous(checkIsAnonymous(currentUser));

      } else {
        // 匿名登录失败时 user 为 null 是预期路径（signInAnonymously 已报过诊断）
        setUser(null);
        setIsAnonymous(false);
      }
    } catch (error) {
      console.error('Auth 初始化失败:', error.message);
      setUser(null);
      setIsAnonymous(false);
    } finally {
      setLoading(false);

    }
  }, [signInAnonymously]);

  useEffect(() => {
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        const newUser = session?.user || null;
        setUser(newUser);
        setIsAnonymous(newUser ? checkIsAnonymous(newUser) : false);
        setLoading(false);

        if (!newUser && event === 'SIGNED_OUT') {

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