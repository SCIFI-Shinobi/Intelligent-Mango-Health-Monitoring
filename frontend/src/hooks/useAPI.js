import { useState, useEffect, useMemo } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';

const API_BASE_URL = getApiBaseUrl();

export function useAPI(endpoint, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoize options dependencies to prevent unnecessary refetches
  const optionsMethod = options.method || 'GET';
  const optionsBody = useMemo(() => JSON.stringify(options.body), [options.body]);
  const optionsHeaders = useMemo(() => JSON.stringify(options.headers || {}), [options.headers]);

  useEffect(() => {
    let isMounted = true;
    const parsedHeaders = optionsHeaders ? JSON.parse(optionsHeaders) : {};
    const parsedBody = optionsBody ? JSON.parse(optionsBody) : undefined;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...parsedHeaders
        };

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: optionsMethod,
          headers,
          body: parsedBody ? JSON.stringify(parsedBody) : undefined,
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/';
          return;
        }

        if (!response.ok) {
          throw new Error(`API Error: ${response.statusText}`);
        }

        const result = await response.json();

        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          console.error('API Error:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [endpoint, optionsMethod, optionsBody, optionsHeaders]);

  return { data, loading, error };
}

export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/';
    return;
  }

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}
