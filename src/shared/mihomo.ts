export type MihomoProxyMode = 'disabled' | 'node-pool'
export type MihomoNodeStrategy = 'round-robin' | 'random' | 'lowest-latency'

export interface MihomoProxyNode {
  id: string
  name: string
  type: string
  localPort: number
  alive: boolean
  latency?: number | null
  lastError?: string
  failCount: number
  cooldownUntil?: string | null
  categoryCooldownUntil?: string | null
  detailCooldownUntil?: string | null
}

export interface MihomoRuntimeStatus {
  enabled: boolean
  running: boolean
  mode: MihomoProxyMode
  controllerUrl: string
  nodeCount: number
  activeNodeId?: string | null
  error?: string
}

export interface MihomoApi {
  getStatus: () => Promise<MihomoRuntimeStatus>
  refreshSubscription: () => Promise<MihomoRuntimeStatus>
  listNodes: () => Promise<MihomoProxyNode[]>
  testNode: (nodeId: string) => Promise<MihomoProxyNode>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isMihomoProxyNode(value: unknown): value is MihomoProxyNode {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    typeof value.localPort === 'number' &&
    typeof value.alive === 'boolean' &&
    typeof value.failCount === 'number'
  )
}

export function isMihomoRuntimeStatus(value: unknown): value is MihomoRuntimeStatus {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    typeof value.running === 'boolean' &&
    (value.mode === 'disabled' || value.mode === 'node-pool') &&
    typeof value.controllerUrl === 'string' &&
    typeof value.nodeCount === 'number'
  )
}
