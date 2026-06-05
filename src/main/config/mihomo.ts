export type MihomoCoreArchiveType = 'gzip' | 'zip'

export interface MihomoCoreReleaseAsset {
  archiveType: MihomoCoreArchiveType
  downloadUrl: string
  executableName: string
}

export const MIHOMO_CORE_VERSION = 'v1.19.26'

export const MIHOMO_CORE_RELEASE_ASSETS = {
  'win32-x64': {
    archiveType: 'zip',
    downloadUrl:
      'https://github.com/MetaCubeX/mihomo/releases/download/v1.19.26/mihomo-windows-amd64-v1.19.26.zip',
    executableName: 'mihomo.exe'
  },
  'darwin-arm64': {
    archiveType: 'gzip',
    downloadUrl:
      'https://github.com/MetaCubeX/mihomo/releases/download/v1.19.26/mihomo-darwin-arm64-v1.19.26.gz',
    executableName: 'mihomo'
  }
} as const satisfies Record<string, MihomoCoreReleaseAsset>

export type MihomoSupportedPlatformArch = keyof typeof MIHOMO_CORE_RELEASE_ASSETS

export function getMihomoPlatformArch(
  platform = process.platform,
  arch = process.arch
): string {
  return `${platform}-${arch}`
}

export function getMihomoCoreReleaseAsset(
  platformArch = getMihomoPlatformArch()
): MihomoCoreReleaseAsset | null {
  return platformArch in MIHOMO_CORE_RELEASE_ASSETS
    ? MIHOMO_CORE_RELEASE_ASSETS[platformArch as MihomoSupportedPlatformArch]
    : null
}
