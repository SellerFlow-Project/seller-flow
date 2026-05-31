export const IPC_CHANNEL = {
  PING: 'ping',
  CRAWLER: {
    START_TASK: 'crawler:start-task',
    STOP_TASK: 'crawler:stop-task',
    GET_STATUS: 'crawler:get-status',
    GET_AMAZON_COOKIES: 'crawler:get-amazon-cookies'
  },
  DATABASE: {
    INIT: 'db:init',
    GET_TASKS: 'db:get-tasks',
    GET_CATEGORIES: 'db:get-categories',
    GET_SELLER_TYPES: 'db:get-seller-types',
    DELETE_TASK: 'db:delete-task',
    QUERY_PRODUCTS: 'db:query-products',
    GET_PRODUCT_BSR_RANKS: 'db:get-product-bsr-ranks',
    DELETE_PRODUCTS: 'db:delete-products',
    GET_STATISTICS: 'db:get-statistics',
    GET_SPRITE_ACCOUNTS: 'db:get-sprite-accounts',
    ADD_SPRITE_ACCOUNT: 'db:add-sprite-account',
    DELETE_SPRITE_ACCOUNT: 'db:delete-sprite-account',
    CLEAR_SPRITE_ACCOUNTS: 'db:clear-sprite-accounts',
    UPDATE_SPRITE_ACCOUNT_STATUS: 'db:update-sprite-account-status',
    CLEAR_CACHE: 'db:clear-cache'
  },
  SELLERSPRITE: {
    CALCULATE_TK: 'sellersprite:calculate-tk',
    CALCULATE_BUSINESS_TK: 'sellersprite:calculate-business-tk',
    LOGIN: 'sellersprite:login',
    GET_QUICK_VIEW: 'sellersprite:get-quick-view'
  }
} as const

export const WINDOW_CHANNEL = {
  CRAWLER_LOG_PROGRESS: 'crawler:log-progress',
  CRAWLER_STATE_UPDATE: 'crawler:state-update'
} as const
