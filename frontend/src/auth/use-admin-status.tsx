import { useState, useEffect } from 'react';
import { useOptionalAuth } from './optional-auth';

const isDebugAuth0 = import.meta.env.VITE_DEBUG_AUTH0 === 'true';
const debugLog = (...arguments_: unknown[]) => {
  if (isDebugAuth0) {
    console.log(...arguments_);
  }
};
const debugError = (...arguments_: unknown[]) => {
  if (isDebugAuth0) {
    console.error(...arguments_);
  }
};

export interface AdminStatusResponse {
  user: {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  isAdmin: boolean;
}

export function useAdminStatus() {
  const { enabled, isAuthenticated, isLoading, getAccessTokenSilently } = useOptionalAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminStatusResponse['user'] | undefined>();
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  useEffect(() => {
    const screenParam = globalThis.window
      ? new URLSearchParams(globalThis.window.location.search).get('screen')
      : undefined;
    const isScreenMode = screenParam === '1' || screenParam === 'true' || screenParam === 'screen';
    if (isScreenMode) {
      setIsAdmin(false);
      setAdminUser(undefined);
      return;
    }

    // Don't check while auth is still loading
    if (isLoading) {
      return;
    }

    // Fetch admin status from backend
    const fetchAdminStatus = async () => {
      setCheckingAdmin(true);
      try {
        const apiUrl = globalThis.window?.location.origin.replace(':5173', ':3000') ?? 'http://localhost:3000';
        debugLog('[useAdminStatus] Fetching admin status from:', `${apiUrl}/api/auth/me`);

        const headers: HeadersInit = {};
        if (enabled && isAuthenticated) {
          const token = await getAccessTokenSilently();
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers,
        });

        debugLog('[useAdminStatus] Response status:', response.status);
        if (response.ok) {
          const data: AdminStatusResponse = await response.json();
          debugLog('[useAdminStatus] Admin status data:', data);
          setIsAdmin(data.isAdmin);
          setAdminUser(data.user);
        } else {
          const errorText = await response.text();
          debugError('[useAdminStatus] Failed to fetch admin status:', response.status, errorText);
          setIsAdmin(false);
          setAdminUser(undefined);
        }
      } catch (error) {
        debugError('[useAdminStatus] Error fetching admin status:', error);
        setIsAdmin(false);
        setAdminUser(undefined);
      } finally {
        setCheckingAdmin(false);
      }
    };

    fetchAdminStatus();
  }, [enabled, isAuthenticated, isLoading, getAccessTokenSilently]);

  return { isAdmin, checkingAdmin, adminUser };
}
