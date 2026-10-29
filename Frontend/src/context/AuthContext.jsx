import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getAccessToken, setAccessToken } from "../services/api";
import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
} from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getAccessToken());
  const [loading, setLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setAccessToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Clear local auth state even if the network call fails
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  // Restore session on initial app load by calling POST /api/auth/refresh
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const data = await refreshSession();
        const refreshedToken = data?.access_token;
        if (!refreshedToken) {
          throw new Error("Missing access token");
        }
        setAccessToken(refreshedToken);
        const profile = data?.user || (await fetchCurrentUser());
        if (isMounted) {
          setToken(refreshedToken);
          setUser(profile);
        }
      } catch {
        setAccessToken(null);
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    restoreSession();

    const handleUnauthorized = () => {
      if (isMounted) {
        clearAuthState();
      }
    };

    const handleTokenRefreshed = (event) => {
      if (!isMounted) return;
      const newToken = event?.detail?.access_token;
      if (newToken) {
        setToken(newToken);
      }
      if (event?.detail?.user) {
        setUser(event.detail.user);
      }
    };

    window.addEventListener("agrolens:unauthorized", handleUnauthorized);
    window.addEventListener("agrolens:token-refreshed", handleTokenRefreshed);
    return () => {
      isMounted = false;
      window.removeEventListener("agrolens:unauthorized", handleUnauthorized);
      window.removeEventListener("agrolens:token-refreshed", handleTokenRefreshed);
    };
  }, [clearAuthState]);

  const login = useCallback(async ({ email, password }) => {
    const data = await loginUser({ email, password });
    setAccessToken(data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const createdUser = await registerUser(payload);
    return createdUser;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout,
    }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
