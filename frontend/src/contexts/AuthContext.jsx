import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('access_token'));
  const [profile, setProfile] = useState(() => {
    const cached = localStorage.getItem('taskpulse_profile');
    return cached ? JSON.parse(cached) : null;
  });
  const [isProfileComplete, setIsProfileComplete] = useState(() => {
    const cached = localStorage.getItem('taskpulse_profile_complete');
    return cached ? JSON.parse(cached) : false;
  });
  const [loading, setLoading] = useState(!localStorage.getItem('taskpulse_profile'));

  const fetchProfile = useCallback(async (currentToken) => {
    const t = currentToken || token;
    if (!t) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/profile/me`, {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        const { is_complete, ...profileData } = data;
        setProfile(profileData);
        setIsProfileComplete(is_complete);
        localStorage.setItem('taskpulse_profile', JSON.stringify(profileData));
        localStorage.setItem('taskpulse_profile_complete', JSON.stringify(is_complete));
      } else {
        // Token invalid / expired — log out
        logout();
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken) => {
    localStorage.setItem('access_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('taskpulse_profile');
    localStorage.removeItem('taskpulse_profile_complete');
    setToken(null);
    setProfile(null);
    setIsProfileComplete(false);
  };

  // Compute readiness score based on which settings are configured
  const readinessScore = (() => {
    if (!profile) return 0;
    let score = 0;

    // Step 1: Personal Info
    if (profile.age && profile.profession && profile.work_style) score += 33;

    // Step 2: Work Hours
    if (profile.timezone && profile.work_start && profile.work_end) score += 33;

    // Step 3: Tags
    if (profile.categories?.length > 0) score += 34;

    return Math.min(score, 100);
  })();

  return (
    <AuthContext.Provider value={{
      token,
      profile,
      isProfileComplete,
      loading,
      readinessScore,
      login,
      logout,
      fetchProfile,
      API_BASE,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
