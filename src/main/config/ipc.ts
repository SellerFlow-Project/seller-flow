export const IPC_CHANNEL = {
  PING: 'ping',
  CRAWLER: {
    START_TASK: 'crawler:start-task',
    STOP_TASK: 'crawler:stop-task',
    GET_STATUS: 'crawler:get-status',
    GET_RANKING_CONFIG: 'crawler:get-ranking-config',
    SAVE_RANKING_CONFIG: 'crawler:save-ranking-config',
    GET_AMAZON_COOKIES: 'crawler:get-amazon-cookies'
  },
  AMAZON_SEARCH: {
    GET_LOCAL_STATE: 'amazon-search:get-local-state',
    SAVE_CONFIG: 'amazon-search:save-config',
    REQUEST_LOGIN_CODE: 'amazon-search:request-login-code',
    POLL_LOGIN_STATUS: 'amazon-search:poll-login-status',
    LOGOUT: 'amazon-search:logout',
    START_TASK: 'amazon-search:start-task',
    STOP_TASK: 'amazon-search:stop-task',
    GET_STATUS: 'amazon-search:get-status'
  },
  DATABASE: {
    INIT: 'db:init',
    GET_TASKS: 'db:get-tasks',
    GET_CATEGORIES: 'db:get-categories',
    GET_SELLER_TYPES: 'db:get-seller-types',
    DELETE_TASK: 'db:delete-task',
    QUERY_PRODUCTS: 'db:query-products',
    GET_PRODUCT_BSR_RANKS: 'db:get-product-bsr-ranks',
    QUERY_SEARCH_KEYWORDS: 'db:query-search-keywords',
    GET_SEARCH_KEYWORD_PRODUCTS: 'db:get-search-keyword-products',
    MARK_SEARCH_KEYWORD_READ: 'db:mark-search-keyword-read',
    MARK_PRODUCT_READ: 'db:mark-product-read',
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
  },
  SETTINGS: {
    GET: 'settings:get',
    SAVE: 'settings:save',
    UPDATE_APPLICATION: 'settings:update-application'
  },
  MIHOMO: {
    GET_STATUS: 'mihomo:get-status',
    GET_CORE_INFO: 'mihomo:get-core-info',
    DOWNLOAD_CORE: 'mihomo:download-core',
    REFRESH_SUBSCRIPTION: 'mihomo:refresh-subscription',
    LIST_NODES: 'mihomo:list-nodes',
    TEST_NODE: 'mihomo:test-node'
  },
  DATA_SHARING: {
    GET_STATUS: 'data-sharing:get-status',
    DISCOVER_SOURCES: 'data-sharing:discover-sources',
    CONNECT_MANUAL_SOURCE: 'data-sharing:connect-manual-source',
    GET_REMOTE_TASKS: 'data-sharing:get-remote-tasks',
    GET_REMOTE_CATEGORIES: 'data-sharing:get-remote-categories',
    GET_REMOTE_SELLER_TYPES: 'data-sharing:get-remote-seller-types',
    QUERY_REMOTE_PRODUCTS: 'data-sharing:query-remote-products',
    QUERY_REMOTE_SEARCH_KEYWORDS: 'data-sharing:query-remote-search-keywords',
    GET_REMOTE_SEARCH_KEYWORD_PRODUCTS: 'data-sharing:get-remote-search-keyword-products',
    GET_REMOTE_PRODUCT_BSR_RANKS: 'data-sharing:get-remote-product-bsr-ranks',
    MARK_REMOTE_SEARCH_KEYWORD_READ: 'data-sharing:mark-remote-search-keyword-read',
    MARK_REMOTE_PRODUCT_READ: 'data-sharing:mark-remote-product-read'
  },
  ACCOUNT: {
    CHECK_SESSION: 'account:check-session',
    GET_CURRENT_USER: 'account:get-current-user',
    LOGIN: 'account:login',
    REGISTER: 'account:register',
    LOGOUT: 'account:logout',
    CHANGE_PASSWORD: 'account:change-password',
    LIST_REGISTRATION_CODES: 'account:list-registration-codes',
    CREATE_REGISTRATION_CODE: 'account:create-registration-code',
    REVOKE_REGISTRATION_CODE: 'account:revoke-registration-code',
    LIST_USERS: 'account:list-users',
    UPDATE_USER_STATUS: 'account:update-user-status',
    UPDATE_USER_ROLES: 'account:update-user-roles',
    REVOKE_USER_SESSIONS: 'account:revoke-user-sessions',
    LIST_AUDIT_LOGS: 'account:list-audit-logs'
  },
  UPDATE: {
    GET_STATE: 'update:get-state',
    CHECK: 'update:check',
    DOWNLOAD: 'update:download',
    QUIT_AND_INSTALL: 'update:quit-and-install'
  }
} as const

export const WINDOW_CHANNEL = {
  CRAWLER_LOG_PROGRESS: 'crawler:log-progress',
  CRAWLER_STATE_UPDATE: 'crawler:state-update',
  AMAZON_SEARCH_LOG_PROGRESS: 'amazon-search:log-progress',
  AMAZON_SEARCH_STATE_UPDATE: 'amazon-search:state-update',
  UPDATE_STATE: 'update:state'
} as const
