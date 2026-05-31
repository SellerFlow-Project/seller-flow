/**
 * 动态 User-Agent 生成器
 *
 * 每次调用 generateUserAgent() 都会返回一个随机的、真实感的 UA 字符串，
 * 覆盖不同操作系统、浏览器和版本号组合。
 */

interface PlatformInfo {
  /** 平台标识 (e.g. "Windows NT 10.0; Win64; x64") */
  oscpu: string
  /** 对应该平台的 Safari/AppleWebKit 尾部标识 */
  platformSuffix: string
}

// ---------------------------------------------------------------------------
//  数据池：操作系统 / 浏览器 / 版本号
// ---------------------------------------------------------------------------

const PLATFORMS: PlatformInfo[] = [
  // Windows 10 / 11
  { oscpu: 'Windows NT 10.0; Win64; x64', platformSuffix: 'Safari/537.36' },
  { oscpu: 'Windows NT 10.0; WOW64', platformSuffix: 'Safari/537.36' },
  // macOS
  { oscpu: 'Macintosh; Intel Mac OS X 10_15_7', platformSuffix: 'Safari/537.36' },
  { oscpu: 'Macintosh; Intel Mac OS X 11_6_0', platformSuffix: 'Safari/605.1.15' },
  { oscpu: 'Macintosh; Intel Mac OS X 12_3_1', platformSuffix: 'Safari/605.1.15' },
  { oscpu: 'Macintosh; Intel Mac OS X 13_4_1', platformSuffix: 'Safari/605.1.15' },
  { oscpu: 'Macintosh; Intel Mac OS X 14_0', platformSuffix: 'Safari/605.1.15' },
  // Linux
  { oscpu: 'X11; Linux x86_64', platformSuffix: 'Safari/537.36' },
  { oscpu: 'X11; Ubuntu; Linux x86_64', platformSuffix: 'Safari/537.36' }
]

/** Chrome 主版本范围 */
const CHROME_VERSION_RANGE = { min: 112, max: 130 } as const
/** Firefox 主版本范围 */
const FIREFOX_VERSION_RANGE = { min: 110, max: 132 } as const
/** Edge 主版本范围 */
const EDGE_VERSION_RANGE = { min: 112, max: 130 } as const

// ---------------------------------------------------------------------------
//  工具函数
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomBuildVersion(): string {
  return `${randomInt(0, 9999)}.${randomInt(0, 999)}`
}

// ---------------------------------------------------------------------------
//  各浏览器 UA 模板
// ---------------------------------------------------------------------------

function buildChromeUA(platform: PlatformInfo): string {
  const major = randomInt(CHROME_VERSION_RANGE.min, CHROME_VERSION_RANGE.max)
  const build = randomBuildVersion()
  return `Mozilla/5.0 (${platform.oscpu}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.${build} ${platform.platformSuffix}`
}

function buildFirefoxUA(platform: PlatformInfo): string {
  const major = randomInt(FIREFOX_VERSION_RANGE.min, FIREFOX_VERSION_RANGE.max)
  // Firefox 不使用 AppleWebKit 尾缀
  return `Mozilla/5.0 (${platform.oscpu}; rv:${major}.0) Gecko/20100101 Firefox/${major}.0`
}

function buildEdgeUA(platform: PlatformInfo): string {
  const chromeMajor = randomInt(CHROME_VERSION_RANGE.min, CHROME_VERSION_RANGE.max)
  const edgeMajor = randomInt(EDGE_VERSION_RANGE.min, EDGE_VERSION_RANGE.max)
  const chromeBuild = randomBuildVersion()
  const edgeBuild = randomBuildVersion()
  return `Mozilla/5.0 (${platform.oscpu}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.${chromeBuild} ${platform.platformSuffix} Edg/${edgeMajor}.0.${edgeBuild}`
}

type UABuilder = (platform: PlatformInfo) => string

const BROWSER_BUILDERS: UABuilder[] = [
  buildChromeUA,
  buildChromeUA, // Chrome 权重更高
  buildChromeUA,
  buildFirefoxUA,
  buildEdgeUA
]

// ---------------------------------------------------------------------------
//  对外接口
// ---------------------------------------------------------------------------

/**
 * 生成一个随机的 User-Agent 字符串。
 *
 * 每次调用都会返回不同的平台 + 浏览器 + 版本号组合。
 */
export function generateUserAgent(): string {
  const platform = pickRandom(PLATFORMS)
  const builder = pickRandom(BROWSER_BUILDERS)
  return builder(platform)
}
