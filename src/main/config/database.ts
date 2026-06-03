export const DATABASE_FILE_NAME = 'seller-flow.db'

export const CRAWL_TASK_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const

export const SELLERSPRITE_ACCOUNT_STATUS = {
  NORMAL: 'normal',
  INVALID: 'invalid'
} as const

export const SQLITE_BOOLEAN = {
  FALSE: 0,
  TRUE: 1
} as const

export const PRODUCT_QUERY_DEFAULT = {
  SORT_BY: 'crawled_at',
  SORT_ORDER: 'DESC',
  LIMIT: 40,
  OFFSET: 0
} as const

export const PRODUCT_SORT_ORDER = {
  ASC: 'ASC',
  DESC: 'DESC'
} as const

export const DATABASE_STATISTICS_DECIMAL_PLACES = 2

export const DATABASE_AFFECTED_ROWS = {
  NONE: 0,
  SINGLE: 1
} as const

export const SPRITE_ACCOUNT_CLEAR_SCOPE = {
  ALL: 'all',
  INVALID: SELLERSPRITE_ACCOUNT_STATUS.INVALID
} as const

function toSqlTextList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ')
}

const CRAWL_TASK_STATUS_SQL = toSqlTextList(Object.values(CRAWL_TASK_STATUS))
const SELLERSPRITE_ACCOUNT_STATUS_SQL = toSqlTextList(Object.values(SELLERSPRITE_ACCOUNT_STATUS))

export const PRODUCT_SORT_COLUMNS = new Set([
  'id',
  'task_id',
  'asin',
  'rank',
  'title',
  'currency',
  'price_amount',
  'original_price',
  'image_url',
  'product_url',
  'category_name',
  'seller_type',
  'sellersprite_units',
  'sellersprite_available',
  'has_sellersprite_data',
  'delivery_days',
  'has_delivery_detail',
  'is_read',
  'crawled_at'
])

export const DATABASE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS crawl_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_name TEXT NOT NULL UNIQUE,
    task_type TEXT NOT NULL,
    marketplace TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN (${CRAWL_TASK_STATUS_SQL})),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS crawled_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    asin TEXT NOT NULL,
    rank INTEGER NOT NULL,
    title TEXT NOT NULL,
    currency TEXT NOT NULL,
    price_amount REAL NOT NULL,
    original_price TEXT,
    image_url TEXT NOT NULL,
    product_url TEXT NOT NULL,
    category_name TEXT NOT NULL,
    seller_type TEXT,
    sellersprite_units INTEGER,
    sellersprite_available INTEGER,
    has_sellersprite_data INTEGER NOT NULL DEFAULT ${SQLITE_BOOLEAN.FALSE} CHECK(has_sellersprite_data IN (${SQLITE_BOOLEAN.FALSE}, ${SQLITE_BOOLEAN.TRUE})),
    delivery_days TEXT,
    has_delivery_detail INTEGER NOT NULL DEFAULT ${SQLITE_BOOLEAN.FALSE} CHECK(has_delivery_detail IN (${SQLITE_BOOLEAN.FALSE}, ${SQLITE_BOOLEAN.TRUE})),
    is_read INTEGER NOT NULL DEFAULT ${SQLITE_BOOLEAN.FALSE} CHECK(is_read IN (${SQLITE_BOOLEAN.FALSE}, ${SQLITE_BOOLEAN.TRUE})),
    crawled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (task_id) REFERENCES crawl_tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, asin)
  );

  CREATE INDEX IF NOT EXISTS idx_products_task_id ON crawled_products(task_id);
  CREATE INDEX IF NOT EXISTS idx_products_asin ON crawled_products(asin);
  CREATE INDEX IF NOT EXISTS idx_products_price_rank ON crawled_products(price_amount, rank);

  CREATE TABLE IF NOT EXISTS product_bsr_ranks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    asin TEXT NOT NULL,
    rank INTEGER NOT NULL,
    is_main INTEGER NOT NULL DEFAULT ${SQLITE_BOOLEAN.FALSE} CHECK(is_main IN (${SQLITE_BOOLEAN.FALSE}, ${SQLITE_BOOLEAN.TRUE})),
    bsr_id TEXT NOT NULL,
    label TEXT NOT NULL,
    text TEXT NOT NULL,
    href TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (product_id) REFERENCES crawled_products(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES crawl_tasks(id) ON DELETE CASCADE,
    UNIQUE(product_id, bsr_id, rank, is_main)
  );

  CREATE INDEX IF NOT EXISTS idx_bsr_product_id ON product_bsr_ranks(product_id);
  CREATE INDEX IF NOT EXISTS idx_bsr_task_id ON product_bsr_ranks(task_id);
  CREATE INDEX IF NOT EXISTS idx_bsr_id_rank ON product_bsr_ranks(bsr_id, rank);
  CREATE INDEX IF NOT EXISTS idx_bsr_is_main ON product_bsr_ranks(is_main);

  CREATE TABLE IF NOT EXISTS sellersprite_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN (${SELLERSPRITE_ACCOUNT_STATUS_SQL})) DEFAULT '${SELLERSPRITE_ACCOUNT_STATUS.NORMAL}',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`
