import { useState, useEffect } from 'react';
import { useOptionalAuth } from './optionalAuth';

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
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  useEffect(() => {
    // If auth is not enabled or user is not authenticated, they're not admin
    if (!enabled || !isAuthenticated) {
      setIsAdmin(false);
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
        const token = await getAccessTokenSilently();
        const apiUrl = globalThis.window?.location.origin.replace(':5173', ':3000') ?? 'http://localhost:3000';
        console.log('[useAdminStatus] Fetching admin status from:', `${apiUrl}/api/auth/me`);
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log('[useAdminStatus] Response status:', response.status);
        if (response.ok) {
          const data: AdminStatusResponse = await response.json();
          console.log('[useAdminStatus] Admin status data:', data);
          setIsAdmin(data.isAdmin);
        } else {
          const errorText = await response.text();
          console.error('[useAdminStatus] Failed to fetch admin status:', response.status, errorText);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('[useAdminStatus] Error fetching admin status:', error);
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    fetchAdminStatus();
  }, [enabled, isAuthenticated, isLoading, getAccessTokenSilently]);

  return { isAdmin, checkingAdmin };
}
