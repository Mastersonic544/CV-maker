import { useState, useEffect, useCallback } from 'react';
import { usersClient } from '../api/client';

const USER_KEY = 'cvmaker_active_user';

export function useUser() {
  const [userId, setUserId] = useState(() => localStorage.getItem(USER_KEY));
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (id) => {
    if (!id) { setUser(null); setLoading(false); return; }
    try {
      const res = await usersClient.getActiveUser();
      if (res.user) setUser(res.user);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { loadUser(userId); }, [userId, loadUser]);

  const switchUser = useCallback(async (id) => {
    await usersClient.switchUser(id);
    localStorage.setItem(USER_KEY, id);
    setUserId(id);
    const res = await usersClient.getActiveUser();
    if (res.user) setUser(res.user);
  }, []);

  const clearUser = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    setUserId(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!userId) return;
    const res = await usersClient.getActiveUser();
    if (res.user) setUser(res.user);
  }, [userId]);

  return { userId, user, loading, switchUser, clearUser, refreshUser };
}
