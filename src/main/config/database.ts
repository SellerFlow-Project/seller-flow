export const DATABASE_FILE_NAME = 'seller-flow.db'

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
  'crawled_at'
])

export const DATABASE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS crawl_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_name TEXT NOT NULL UNIQUE,
    task_type TEXT NOT NULL,
    marketplace TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
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
    has_sellersprite_data INTEGER NOT NULL DEFAULT 0 CHECK(has_sellersprite_data IN (0, 1)),
    crawled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (task_id) REFERENCES crawl_tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, asin)
  );

  CREATE INDEX IF NOT EXISTS idx_products_task_id ON crawled_products(task_id);
  CREATE INDEX IF NOT EXISTS idx_products_asin ON crawled_products(asin);
  CREATE INDEX IF NOT EXISTS idx_products_price_rank ON crawled_products(price_amount, rank);
  CREATE INDEX IF NOT EXISTS idx_products_sellersprite_flag ON crawled_products(has_sellersprite_data);

  CREATE TABLE IF NOT EXISTS product_bsr_ranks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    asin TEXT NOT NULL,
    rank INTEGER NOT NULL,
    is_main INTEGER NOT NULL DEFAULT 0 CHECK(is_main IN (0, 1)),
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
    status TEXT NOT NULL CHECK(status IN ('normal', 'invalid')) DEFAULT 'normal',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`
