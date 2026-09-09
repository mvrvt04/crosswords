import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createLocalApi } from './localApi';
import { createRemoteApi, detectServer } from './remoteApi';
import type { Api } from './types';

/**
 * Picks the storage adapter once at startup: the bundled server when it is
 * reachable, otherwise the offline localStorage store. Components only ever
 * see the `Api` interface.
 */

const ApiContext = createContext<Api | null>(null);

export function ApiProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [api, setApi] = useState<Api | null>(null);

  useEffect(() => {
    let cancelled = false;
    detectServer().then((hasServer) => {
      if (!cancelled) setApi(hasServer ? createRemoteApi() : createLocalApi());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!api) return <>{fallback}</>;
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside ApiProvider');
  return api;
}
