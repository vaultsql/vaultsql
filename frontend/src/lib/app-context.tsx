import { useQuery, useQueryClient } from '@tanstack/react-query'
import createClient, { type Client } from 'openapi-fetch'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AUTH_TOKEN_STORAGE_KEY, clearAuthToken } from '@/lib/auth'
import { subscribeAuthTokenChanged } from '@/lib/auth-events'
import type { paths } from '@/lib/openapi'
import { clearVaultData, getVaultData, setVaultData, type VaultData } from '@/lib/vault'
import {
  buildUserQueryOptions,
  getApiErrorStatus,
  toApiError,
  userQueryKey,
} from '@/queries/user-query'

type GetToken = () => Promise<string | null> | string | null

export interface AppConfig {
  baseUrl: string
  fetch: typeof globalThis.fetch
  getToken: GetToken
}

interface AppContextValue {
  baseUrl: string
  authFetch: typeof globalThis.fetch
  client: Client<paths>
  noAuthClient: Client<paths>
  getToken: GetToken
  vault: VaultData
  setVault: (data: VaultData) => Promise<void>
  clearVault: () => Promise<void>
  isLoading: boolean
  isAuthLoading: boolean
  workspaceMode: string | null
  sessionType: 'none' | 'identity' | 'workspace'
}

const AppContext = createContext<AppContextValue | null>(null)

interface AppProviderProps {
  config: AppConfig
  children: ReactNode
}

const identityQueryKey = ['identity-me'] as const

export function AppProvider({ config, children }: AppProviderProps) {
  const value = useMemo(() => {
    const { baseUrl, fetch: customFetch, getToken } = config

    // Create a fetch wrapper that auto-injects auth headers and handles auth errors
    const authFetch: typeof globalThis.fetch = async (input, init) => {
      const token = await getToken()
      const headers = new Headers(init?.headers)

      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }

      const response = await customFetch(input, { ...init, headers })

      return response
    }

    const client = createClient<paths>({
      baseUrl,
      fetch: authFetch,
    })

    const noAuthClient = createClient<paths>({
      baseUrl,
      fetch: customFetch,
    })

    return { client, noAuthClient, getToken, baseUrl, authFetch }
  }, [config])

  const queryClient = useQueryClient()
  const isLoggingOutRef = useRef(false)
  const hasInitializedRef = useRef(false)
  const lastTokenRef = useRef<string | null>(null)

  const [vault, setVaultInternal] = useState<VaultData>({})
  const [vaultLoaded, setVaultLoaded] = useState(false)
  const [authRefreshIndex, setAuthRefreshIndex] = useState(0)
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [identitySessionDetected, setIdentitySessionDetected] = useState(false)

  useEffect(() => {
    async function loadVault() {
      const data = await getVaultData()
      setVaultInternal(data)
      setVaultLoaded(true)
    }
    loadVault()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleAuthChange = () => setAuthRefreshIndex((prev) => prev + 1)
    const unsubscribe = subscribeAuthTokenChanged(handleAuthChange)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_STORAGE_KEY) {
        handleAuthChange()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      unsubscribe()
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function refreshToken() {
      setHasToken(null)
      const token = await value.getToken()
      if (!active) return
      const tokenValue = token ?? null
      const tokenPresent = Boolean(tokenValue)
      const tokenChanged = tokenValue !== lastTokenRef.current
      const isInitialLoad = !hasInitializedRef.current
      hasInitializedRef.current = true
      lastTokenRef.current = tokenValue
      setHasToken(tokenPresent)
      if (tokenChanged) {
        setIdentitySessionDetected(false)
      }
      if (!tokenPresent) {
        if (tokenChanged) {
          queryClient.removeQueries({ queryKey: userQueryKey })
          queryClient.removeQueries({ queryKey: identityQueryKey })
        }
        return
      }
      if (tokenChanged && !isInitialLoad) {
        queryClient.invalidateQueries({ queryKey: userQueryKey })
        queryClient.removeQueries({ queryKey: identityQueryKey })
      }
    }

    refreshToken()
    return () => {
      active = false
    }
  }, [value, authRefreshIndex, queryClient])

  const userQuery = useQuery({
    ...buildUserQueryOptions(value.client),
    enabled: hasToken === true && !identitySessionDetected,
  })
  const userErrorStatus = getApiErrorStatus(userQuery.error)
  const shouldCheckIdentity =
    hasToken === true && (userErrorStatus === 401 || userErrorStatus === 403)

  const identityClient = value.client as unknown as {
    GET: (
      path: string,
      init?: { signal?: AbortSignal },
    ) => Promise<{ data?: { identity?: unknown }; error?: unknown; response: Response }>
  }

  const identityQuery = useQuery({
    queryKey: identityQueryKey,
    enabled: shouldCheckIdentity,
    retry: false,
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const { data, error, response } = await identityClient.GET('/api/identity/me', { signal })
      if (data?.identity) return data.identity
      throw toApiError(error, response)
    },
  })
  const identityErrorStatus = getApiErrorStatus(identityQuery.error)

  useEffect(() => {
    setIdentitySessionDetected(Boolean(identityQuery.data))
  }, [identityQuery.data])

  const handleAuthFailure = useCallback(async () => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true
    try {
      await clearVaultData()
      setHasToken(false)
      setIdentitySessionDetected(false)
      lastTokenRef.current = null
      queryClient.removeQueries({ queryKey: userQueryKey })
      queryClient.removeQueries({ queryKey: identityQueryKey })
      
      const isOnLogin =
        typeof window !== 'undefined' &&
        (window.location.pathname.includes('/login') || window.location.hash.includes('/login'))
      clearAuthToken()
      if (!isOnLogin) {
        window.location.assign('/login')
      }
    } catch (error) {
      console.error('Failed to clear auth data:', error)
    } finally {
      setTimeout(() => {
        isLoggingOutRef.current = false
      }, 500)
    }
  }, [queryClient])

  useEffect(() => {
    if (!userQuery.error || userErrorStatus === 401 || userErrorStatus === 403) return
    console.log('Error fetching user data:', userQuery.error)
  }, [userQuery.error, userErrorStatus])

  useEffect(() => {
    if (!shouldCheckIdentity || !identityQuery.error) return
    if (identityErrorStatus === 401 || identityErrorStatus === 403) {
      void handleAuthFailure()
      return
    }
    console.log('Error fetching identity data:', identityQuery.error)
  }, [shouldCheckIdentity, identityQuery.error, identityErrorStatus, handleAuthFailure])

  const workspaceMode = userQuery.data?.workspace?.mode ?? null
  const sessionType = useMemo(() => {
    if (hasToken !== true) return 'none'
    if (workspaceMode) return 'workspace'
    if (shouldCheckIdentity && identityQuery.data) return 'identity'
    return 'none'
  }, [hasToken, identityQuery.data, shouldCheckIdentity, workspaceMode])

  const isAuthLoading =
    hasToken === null || userQuery.isLoading || (shouldCheckIdentity && identityQuery.isLoading)

  const setVault = async (data: VaultData) => {
    await setVaultData(data)
    setVaultInternal((prev) => ({ ...prev, ...data }))
  }

  const clearVault = async () => {
    await clearVaultData()
    setVaultInternal({})
  }

  const contextValue = useMemo(
    () => ({
      ...value,
      vault,
      setVault,
      clearVault,
      workspaceMode,
      sessionType,
      isAuthLoading,
      isLoading: !vaultLoaded || isAuthLoading,
    }),
    [value, vault, vaultLoaded, isAuthLoading, workspaceMode, sessionType],
  )

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

export function useAppClient(): Client<paths> {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppClient must be used within an AppProvider')
  }
  return context.client
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
