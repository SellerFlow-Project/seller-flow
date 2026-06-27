export type MihomoCoreArchiveType = 'gzip' | 'zip'

export interface MihomoCoreReleaseAsset {
  archiveType: MihomoCoreArchiveType
  downloadUrl: string
  mirrorDownloadUrl: string
  executableName: string
}

export const MIHOMO_CORE_VERSION = 'v1.19.26'
const MIHOMO_CNB_RELEASE_BASE_URL = `https://cnb.cool/feassh/seller-flow/-/releases/download/mihomo-${MIHOMO_CORE_VERSION}`
const MIHOMO_GITHUB_RELEASE_BASE_URL = `https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_CORE_VERSION}`

export const MIHOMO_CORE_RELEASE_ASSETS = {
  'win32-x64': {
    archiveType: 'zip',
    mirrorDownloadUrl: `${MIHOMO_CNB_RELEASE_BASE_URL}/mihomo-windows-amd64-${MIHOMO_CORE_VERSION}.zip`,
    downloadUrl: `${MIHOMO_GITHUB_RELEASE_BASE_URL}/mihomo-windows-amd64-${MIHOMO_CORE_VERSION}.zip`,
    executableName: 'mihomo.exe'
  },
  'darwin-arm64': {
    archiveType: 'gzip',
    mirrorDownloadUrl: `${MIHOMO_CNB_RELEASE_BASE_URL}/mihomo-darwin-arm64-${MIHOMO_CORE_VERSION}.gz`,
    downloadUrl: `${MIHOMO_GITHUB_RELEASE_BASE_URL}/mihomo-darwin-arm64-${MIHOMO_CORE_VERSION}.gz`,
    executableName: 'mihomo'
  }
} as const satisfies Record<string, MihomoCoreReleaseAsset>

export type MihomoSupportedPlatformArch = keyof typeof MIHOMO_CORE_RELEASE_ASSETS

export function getMihomoPlatformArch(platform = process.platform, arch = process.arch): string {
  return `${platform}-${arch}`
}

export function getMihomoCoreReleaseAsset(
  platformArch = getMihomoPlatformArch()
): MihomoCoreReleaseAsset | null {
  return platformArch in MIHOMO_CORE_RELEASE_ASSETS
    ? MIHOMO_CORE_RELEASE_ASSETS[platformArch as MihomoSupportedPlatformArch]
    : null
}

export function getMihomoCoreDownloadUrls(asset: MihomoCoreReleaseAsset): string[] {
  return Array.from(new Set([asset.mirrorDownloadUrl, asset.downloadUrl]))
}
