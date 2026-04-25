import { createContext, useState, useEffect, useCallback } from "react";
import { getApiBaseUrl } from '../utils/apiBase';

const API_BASE_URL = getApiBaseUrl();

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);

  // Fetch user profile
  const fetchUser = useCallback(async () => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      setUser(null);
      return;
    }

    setUserLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/me`, {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else if (res.status === 401) {
        // Token invalid, clear it
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      }
    } catch (e) {
      console.error("Failed to fetch user:", e);
    } finally {
      setUserLoading(false);
    }
  }, []);

  // Fetch user on mount if token exists
  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token, fetchUser]);

  const login = (newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    // User will be fetched by the useEffect
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  // Update user after profile edit
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{
      token,
      user,
      userLoading,
      login,
      logout,
      fetchUser,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}
