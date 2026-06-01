import { useCallback, useEffect, useState } from 'react'
import type { AppUpdateActionResult, AppUpdateState } from '../../../shared/update'

const INITIAL_STATE: AppUpdateState = {
  currentVersion: '-',
  isSupported: false,
  revision: 0,
  status: 'idle'
}

interface UseAppUpdaterResult {
  state: AppUpdateState
  checkForUpdates: () => Promise<AppUpdateActionResult>
  downloadUpdate: () => Promise<AppUpdateActionResult>
  quitAndInstall: () => Promise<AppUpdateActionResult>
}

export function useAppUpdater(): UseAppUpdaterResult {
  const [state, setState] = useState<AppUpdateState>(INITIAL_STATE)

  useEffect(() => {
    let active = true

    void window.api.updates.getState().then((nextState) => {
      if (active) {
        setState(nextState)
      }
    })

    const removeListener = window.api.updates.onStateChange((nextState) => {
      setState(nextState)
    })

    return () => {
      active = false
      removeListener()
    }
  }, [])

  const checkForUpdates = useCallback(
    (): Promise<AppUpdateActionResult> => window.api.updates.checkForUpdates(),
    []
  )

  const downloadUpdate = useCallback(
    (): Promise<AppUpdateActionResult> => window.api.updates.downloadUpdate(),
    []
  )

  const quitAndInstall = useCallback(
    (): Promise<AppUpdateActionResult> => window.api.updates.quitAndInstall(),
    []
  )

  return {
    state,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall
  }
}
