export const CRAWL_TASK_TYPE = {
  BEST_SELLERS: 'best_sellers'
} as const

export const CRAWL_STRATEGY = {
  STRATEGY_1: 'strategy1',
  STRATEGY_2: 'strategy2'
} as const

export const CRAWLER_INITIAL_DEPTH = 1
export const CRAWLER_FIRST_LEVEL_DEPTH = 1
export const CRAWLER_INITIAL_PAGE = 1
export const CRAWLER_DEPTH_STEP = 1
export const CRAWLER_PAGE_STEP = 1
export const CRAWLER_CATEGORY_PATH_SEPARATOR = ' > '
export const CRAWLER_DEPTH_INDENT = '  '
export const CRAWLER_HTML_SNIPPET_LENGTH = 500
export const CRAWLER_HTML_SNIPPET_SUFFIX = '\n... [HTML 数据流已截止] ...'
export const DELIVERY_DETAIL_BATCH_SIZE = 100
export const DELIVERY_DETAIL_CONCURRENCY = 5
export const DELIVERY_DETAIL_POLL_INTERVAL_MS = 1000

export const DELIVERY_DETAIL_PHASE = {
  IDLE: 'idle',
  WAITING: 'waiting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  COMPLETED: 'completed'
} as const

export const DELIVERY_DETAIL_ITEM_STATUS = {
  PENDING: 'pending',
  FETCHING: 'fetching',
  SUCCESS: 'success',
  FAILED: 'failed'
} as const

export const CRAWLER_ERROR_CODE = {
  SELLERSPRITE_AUTHENTICATION_FAILED: 'SELLERSPRITE_AUTHENTICATION_FAILED',
  SELLERSPRITE_RETRY_EXHAUSTED: 'SELLERSPRITE_RETRY_EXHAUSTED'
} as const

export const CRAWLER_RUN_STATE = {
  IDLE: 'idle',
  RUNNING: 'running',
  STOPPING: 'stopping'
} as const
