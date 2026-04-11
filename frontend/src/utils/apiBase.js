const ENV_API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

function trimTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

function isLoopbackHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function normalizeEnvApiBase(windowLocation) {
  if (!ENV_API_BASE_URL || !ENV_API_BASE_URL.trim()) {
    return null;
  }

  const raw = trimTrailingSlash(ENV_API_BASE_URL.trim());

  if (!windowLocation) {
    return raw;
  }

  try {
    const envUrl = new URL(raw);
    const browserHost = windowLocation.hostname;

    // If frontend is opened from another machine but env points to localhost,
    // use the current host and keep the backend port.
    if (isLoopbackHost(envUrl.hostname) && !isLoopbackHost(browserHost)) {
      if (windowLocation.protocol === 'https:' && envUrl.protocol === 'http:') {
        return trimTrailingSlash(windowLocation.origin);
      }
      envUrl.hostname = browserHost;
      return trimTrailingSlash(envUrl.toString());
    }

    return trimTrailingSlash(envUrl.toString());
  } catch {
    return raw;
  }
}

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const normalizedEnvUrl = normalizeEnvApiBase(window.location);
    if (normalizedEnvUrl) {
      return normalizedEnvUrl;
    }
  } else {
    const normalizedEnvUrl = normalizeEnvApiBase(null);
    if (normalizedEnvUrl) {
      return normalizedEnvUrl;
    }
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8000';
  }

  const { protocol, hostname, port, origin } = window.location;

  // In CRA local development, frontend runs on 3000 and backend on 8000.
  if (port === '3000') {
    return `${protocol}//${hostname}:8000`;
  }

  // In deployed environments, default to same-origin backend.
  return trimTrailingSlash(origin);
}

export function getWsBaseUrl() {
  const apiBase = getApiBaseUrl();
  const wsProtocol = apiBase.startsWith('https://') ? 'wss://' : 'ws://';
  return `${wsProtocol}${apiBase.replace(/^https?:\/\//, '')}`;
}
