import Store from 'electron-store'
import {
  DEFAULT_AMAZON_RANKING_CONFIG,
  normalizeAmazonRankingConfig,
  type AmazonRankingConfig
} from '../../shared/amazon-ranking'

interface AmazonRankingStore {
  config: AmazonRankingConfig
}

let store: Store<AmazonRankingStore> | undefined

function getStore(): Store<AmazonRankingStore> {
  store ??= new Store<AmazonRankingStore>({
    name: 'amazon-ranking',
    defaults: {
      config: DEFAULT_AMAZON_RANKING_CONFIG
    }
  })

  return store
}

export function getAmazonRankingConfig(): AmazonRankingConfig {
  const config = normalizeAmazonRankingConfig(getStore().get('config'))
  getStore().set('config', config)
  return config
}

export function saveAmazonRankingConfig(config: AmazonRankingConfig): AmazonRankingConfig {
  const normalizedConfig = normalizeAmazonRankingConfig(config)
  getStore().set('config', normalizedConfig)
  return normalizedConfig
}
