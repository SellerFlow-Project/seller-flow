import { join } from 'path'
import * as fs from 'fs'
import { app } from 'electron'
import Database from 'better-sqlite3'
import {
  CRAWL_TASK_STATUS,
  DATABASE_STATISTICS_DECIMAL_PLACES,
  DATABASE_FILE_NAME,
  DATABASE_SCHEMA_SQL,
  PRODUCT_QUERY_DEFAULT,
  PRODUCT_SORT_COLUMNS,
  PRODUCT_SORT_ORDER,
  SELLERSPRITE_ACCOUNT_STATUS,
  SPRITE_ACCOUNT_CLEAR_SCOPE,
  SQLITE_BOOLEAN
} from '../config/database'
import type { CrawlTaskType } from '../types/crawler'
import type {
  AmazonSearchKeywordProductRow,
  AmazonSearchKeywordRow,
  CrawledProductRow,
  CrawlTaskRow,
  CrawlTaskStatus,
  DatabaseStatistics,
  IncomingAmazonSearchKeywordProduct,
  IncomingAmazonSearchKeywordResult,
  IncomingCrawledProduct,
  PendingDeliveryDetailProduct,
  ProductBsrRankRow,
  ProductDeliveryDetailUpdate,
  ProductQueryFilter,
  SearchKeywordQueryFilter,
  SellerSpriteAccountRow,
  SellerSpriteAccountStatus,
  SpriteAccountClearScope
} from '../types/database'
import { getErrorMessage } from '../utils/error'
import { parsePriceField } from '../utils/price'

export { parsePriceField } from '../utils/price'
export type {
  CrawledProductRow,
  CrawlTaskRow,
  CrawlTaskStatus,
  DatabaseStatistics,
  IncomingAmazonSearchKeywordProduct,
  AmazonSearchKeywordProductRow,
  AmazonSearchKeywordRow,
  IncomingAmazonSearchKeywordResult,
  IncomingCrawledProduct,
  ParsedPrice,
  ProductQueryFilter,
  SearchKeywordQueryFilter,
  ProductBsrRankRow,
  SellerSpriteAccountRow,
  SellerSpriteAccountStatus,
  SpriteAccountClearScope
} from '../types/database'

/**
 * 核心数据库服务模块 (Main 进程 - Thread safe & Synchronous SQL Execution)
 * 采用 better-sqlite3 驱动，支持事务、高频批量写入、索引加速和级联删除
 */
class DatabaseService {
  private db: Database.Database | null = null
  private dbPath: string = ''
  private readonly recoveredDbPaths = new Set<string>()

  /**
   * 初始化数据库并设置物理路径，创建表及索引
   * @param customPath 自定义物理存储路径 (供单元测试或物理迁移预留)
   */
  public initDatabase(customPath?: string): void {
    try {
      this.dbPath = customPath || join(app.getPath('userData'), DATABASE_FILE_NAME)
      console.log(`[DatabaseService] 开始初始化 SQLite 数据库, 物理路径: ${this.dbPath}`)

      // 创建并连接 SQLite 数据库
      this.db = new Database(this.dbPath)

      // 开启外键关联约束 (SQLite 默认关闭外键约束，开启后支持 ON DELETE CASCADE)
      this.db.pragma('foreign_keys = ON')
      // 开启 WAL 写入预留日志，大幅提升高频写入速度
      this.db.pragma('journal_mode = WAL')

      // 执行建表与索引事务脚本 (按用户要求删除了 max_pages 字段)
      this.db.exec(DATABASE_SCHEMA_SQL)
      this.ensureRuntimeSchemaCompatibility(this.db)
      this.recoverInterruptedTasks(this.db)

      console.log('[DatabaseService] SQLite 数据库建表与性能索引初始化成功！')
    } catch (error) {
      console.error('[DatabaseService] SQLite 初始化异常失败:', getErrorMessage(error))
      try {
        this.db?.close()
      } catch (closeError) {
        console.error('[DatabaseService] SQLite 异常连接关闭失败:', getErrorMessage(closeError))
      }
      this.db = null
      throw error
    }
  }

  /**
   * 确保数据库已正常打开的校验断言
   */
  private assertDb(): Database.Database {
    if (!this.db) {
      this.initDatabase()
    }
    if (!this.db) {
      throw new Error('SQLite 数据库初始化就绪失败！')
    }
    return this.db
  }

  private ensureRuntimeSchemaCompatibility(db: Database.Database): void {
    const productColumns = new Set(
      (
        db.prepare('PRAGMA table_info(crawled_products)').all() as Array<{
          name: string
        }>
      ).map((column) => column.name)
    )

    const searchKeywordColumns = new Set(
      (
        db.prepare('PRAGMA table_info(amazon_search_keywords)').all() as Array<{
          name: string
        }>
      ).map((column) => column.name)
    )

    const missingColumns: Array<{ name: string; sql: string }> = [
      { name: 'seller_type', sql: 'ALTER TABLE crawled_products ADD COLUMN seller_type TEXT' },
      {
        name: 'sellersprite_units',
        sql: 'ALTER TABLE crawled_products ADD COLUMN sellersprite_units INTEGER'
      },
      {
        name: 'sellersprite_available',
        sql: 'ALTER TABLE crawled_products ADD COLUMN sellersprite_available INTEGER'
      },
      {
        name: 'has_sellersprite_data',
        sql: `ALTER TABLE crawled_products ADD COLUMN has_sellersprite_data INTEGER NOT NULL DEFAULT ${SQLITE_BOOLEAN.FALSE}`
      },
      { name: 'delivery_days', sql: 'ALTER TABLE crawled_products ADD COLUMN delivery_days TEXT' },
      {
        name: 'has_delivery_detail',
        sql: `ALTER TABLE crawled_products ADD COLUMN has_delivery_detail INTEGER NOT NULL DEFAULT ${SQLITE_BOOLEAN.FALSE}`
      },
      {
        name: 'is_read',
        sql: `ALTER TABLE crawled_products ADD COLUMN is_read INTEGER NOT NULL DEFAULT ${SQLITE_BOOLEAN.FALSE}`
      }
    ]

    for (const column of missingColumns) {
      if (!productColumns.has(column.name)) {
        db.exec(column.sql)
      }
    }

    if (!searchKeywordColumns.has('is_read')) {
      db.exec(
        `ALTER TABLE amazon_search_keywords ADD COLUMN is_read INTEGER NOT NULL DEFAULT ${SQLITE_BOOLEAN.FALSE}`
      )
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_sellersprite_flag ON crawled_products(has_sellersprite_data);
      CREATE INDEX IF NOT EXISTS idx_products_delivery_detail_flag ON crawled_products(task_id, has_delivery_detail);
      CREATE INDEX IF NOT EXISTS idx_products_read_flag ON crawled_products(task_id, is_read);

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

      CREATE TABLE IF NOT EXISTS amazon_search_keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        keyword TEXT NOT NULL,
        keyword_image_url TEXT,
        filter_criteria TEXT NOT NULL,
        matched_product_count INTEGER NOT NULL DEFAULT 0,
        total_product_count INTEGER NOT NULL DEFAULT 0,
        ranking_range TEXT NOT NULL,
        fluctuation_range TEXT NOT NULL,
        sellersprite_units_total INTEGER,
        sellersprite_available_total INTEGER,
        sellersprite_enriched_product_count INTEGER NOT NULL DEFAULT 0,
        has_sellersprite_data INTEGER NOT NULL DEFAULT ${SQLITE_BOOLEAN.FALSE} CHECK(has_sellersprite_data IN (${SQLITE_BOOLEAN.FALSE}, ${SQLITE_BOOLEAN.TRUE})),
        is_read INTEGER NOT NULL DEFAULT ${SQLITE_BOOLEAN.FALSE} CHECK(is_read IN (${SQLITE_BOOLEAN.FALSE}, ${SQLITE_BOOLEAN.TRUE})),
        amz123_raw TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        FOREIGN KEY (task_id) REFERENCES crawl_tasks(id) ON DELETE CASCADE,
        UNIQUE(task_id, keyword)
      );

      CREATE INDEX IF NOT EXISTS idx_search_keywords_task_id ON amazon_search_keywords(task_id);
      CREATE INDEX IF NOT EXISTS idx_search_keywords_keyword ON amazon_search_keywords(keyword);

      CREATE TABLE IF NOT EXISTS amazon_search_keyword_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        asin TEXT NOT NULL,
        delivery_days INTEGER,
        delivery_text TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        FOREIGN KEY (keyword_id) REFERENCES amazon_search_keywords(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES crawled_products(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES crawl_tasks(id) ON DELETE CASCADE,
        UNIQUE(keyword_id, product_id)
      );

      CREATE INDEX IF NOT EXISTS idx_search_keyword_products_keyword_id ON amazon_search_keyword_products(keyword_id);
      CREATE INDEX IF NOT EXISTS idx_search_keyword_products_product_id ON amazon_search_keyword_products(product_id);
      CREATE INDEX IF NOT EXISTS idx_search_keyword_products_task_id ON amazon_search_keyword_products(task_id);
    `)
  }

  private recoverInterruptedTasks(db: Database.Database): void {
    if (this.recoveredDbPaths.has(this.dbPath)) return

    db.prepare(
      `
      UPDATE crawl_tasks
      SET status = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE status = ?
    `
    ).run(CRAWL_TASK_STATUS.FAILED, CRAWL_TASK_STATUS.RUNNING)
    this.recoveredDbPaths.add(this.dbPath)
  }

  /**
   * 新建一个采集任务日志
   * @returns 自动插入的自增 ID (作为主键)
   */
  public createTask(taskName: string, taskType: CrawlTaskType | string, marketplace: string): number {
    const db = this.assertDb()
    const stmt = db.prepare(`
      INSERT INTO crawl_tasks (task_name, task_type, marketplace, status)
      VALUES (?, ?, ?, ?)
    `)
    const result = stmt.run(taskName, taskType, marketplace, CRAWL_TASK_STATUS.RUNNING)
    return result.lastInsertRowid as number
  }

  /**
   * 更新采集任务状态和结束时间
   */
  public updateTaskStatus(
    taskId: number,
    status: Exclude<CrawlTaskStatus, typeof CRAWL_TASK_STATUS.RUNNING>
  ): boolean {
    const db = this.assertDb()
    const stmt = db.prepare(`
      UPDATE crawl_tasks
      SET status = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ? AND status = ?
    `)
    const result = stmt.run(status, taskId, CRAWL_TASK_STATUS.RUNNING)
    return result.changes > 0
  }

  /**
   * 批量高效插入采集到的商品明细 (利用 better-sqlite3 Transaction 特性提速)
   */
  public insertProducts(
    taskId: number,
    products: IncomingCrawledProduct[],
    categoryName: string
  ): void {
    const db = this.assertDb()
    const insertStmt = db.prepare(`
      INSERT INTO crawled_products (
        task_id,
        asin,
        rank,
        title,
        currency,
        price_amount,
        original_price,
        image_url,
        product_url,
        category_name,
        seller_type,
        sellersprite_units,
        sellersprite_available,
        has_sellersprite_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id, asin) DO UPDATE SET
        rank = excluded.rank,
        title = excluded.title,
        currency = excluded.currency,
        price_amount = excluded.price_amount,
        original_price = excluded.original_price,
        image_url = excluded.image_url,
        product_url = excluded.product_url,
        category_name = CASE
          WHEN crawled_products.category_name LIKE '%' || excluded.category_name || '%' THEN crawled_products.category_name
          ELSE category_name || ' | ' || excluded.category_name
        END,
        seller_type = CASE
          WHEN excluded.has_sellersprite_data = ${SQLITE_BOOLEAN.TRUE} THEN excluded.seller_type
          ELSE crawled_products.seller_type
        END,
        sellersprite_units = CASE
          WHEN excluded.has_sellersprite_data = ${SQLITE_BOOLEAN.TRUE} THEN excluded.sellersprite_units
          ELSE crawled_products.sellersprite_units
        END,
        sellersprite_available = CASE
          WHEN excluded.has_sellersprite_data = ${SQLITE_BOOLEAN.TRUE} THEN excluded.sellersprite_available
          ELSE crawled_products.sellersprite_available
        END,
        has_sellersprite_data = CASE
          WHEN excluded.has_sellersprite_data = ${SQLITE_BOOLEAN.TRUE} THEN ${SQLITE_BOOLEAN.TRUE}
          ELSE crawled_products.has_sellersprite_data
        END
    `)
    const selectProductIdStmt = db.prepare(`
      SELECT id FROM crawled_products WHERE task_id = ? AND asin = ?
    `)
    const deleteBsrStmt = db.prepare('DELETE FROM product_bsr_ranks WHERE product_id = ?')
    const insertBsrStmt = db.prepare(`
      INSERT INTO product_bsr_ranks (
        product_id, task_id, asin, rank, is_main, bsr_id, label, text, href
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(product_id, bsr_id, rank, is_main) DO UPDATE SET
        label = excluded.label,
        text = excluded.text,
        href = excluded.href
    `)

    // 利用更好性能的 SQLite 事务锁批量入库
    const transaction = db.transaction((items) => {
      for (const item of items) {
        // 解耦货币类型和数字价格
        const rawPrice = item.price || ''
        const { currency, amount } = parsePriceField(rawPrice)
        const sellerSprite = item.sellerSprite
        const hasSellerSpriteData = sellerSprite ? SQLITE_BOOLEAN.TRUE : SQLITE_BOOLEAN.FALSE

        insertStmt.run(
          taskId,
          item.asin || '',
          item.rank || 0,
          item.title || '',
          currency,
          amount,
          rawPrice,
          item.image || '',
          item.productUrl || '',
          categoryName,
          sellerSprite?.sellerType || null,
          sellerSprite?.units ?? null,
          sellerSprite?.available ?? null,
          hasSellerSpriteData
        )

        const productIdRow = selectProductIdStmt.get(taskId, item.asin || '') as
          | { id: number }
          | undefined

        if (!productIdRow || !sellerSprite) continue

        deleteBsrStmt.run(productIdRow.id)
        for (const bsr of sellerSprite.bsrList) {
          insertBsrStmt.run(
            productIdRow.id,
            taskId,
            item.asin || '',
            bsr.rank,
            bsr.main ? SQLITE_BOOLEAN.TRUE : SQLITE_BOOLEAN.FALSE,
            bsr.id,
            bsr.label,
            bsr.text,
            bsr.href
          )
        }
      }
    })

    transaction(products)
  }

  private resolveSearchKeywordProductCategory(
    product: IncomingAmazonSearchKeywordProduct,
    fallbackCategoryName: string
  ): string {
    const primaryBsr =
      product.sellerSprite?.bsrList?.find((bsr) => bsr.main && (bsr.text || bsr.label)) ||
      product.sellerSprite?.bsrList?.find((bsr) => bsr.text || bsr.label)

    return primaryBsr?.text || primaryBsr?.label || fallbackCategoryName
  }

  public insertAmazonSearchKeywordResult(
    taskId: number,
    result: IncomingAmazonSearchKeywordResult
  ): void {
    const db = this.assertDb()
    const categoryName = `搜索词 > ${result.keyword}`
    const sellerspriteItems = result.products
      .map((product) => product.sellerSprite)
      .filter((sellerSprite): sellerSprite is NonNullable<typeof sellerSprite> =>
        Boolean(sellerSprite)
      )
    const sellerspriteUnitsTotal = sellerspriteItems.reduce(
      (sum, item) => sum + (item.units ?? 0),
      0
    )
    const sellerspriteAvailableTotal = sellerspriteItems.reduce(
      (sum, item) => sum + (item.available ?? 0),
      0
    )

    for (const product of result.products) {
      this.insertProducts(
        taskId,
        [product],
        this.resolveSearchKeywordProductCategory(product, categoryName)
      )
    }

    const upsertKeywordStmt = db.prepare(`
      INSERT INTO amazon_search_keywords (
        task_id,
        keyword,
        keyword_image_url,
        filter_criteria,
        matched_product_count,
        total_product_count,
        ranking_range,
        fluctuation_range,
        sellersprite_units_total,
        sellersprite_available_total,
        sellersprite_enriched_product_count,
        has_sellersprite_data,
        amz123_raw
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id, keyword) DO UPDATE SET
        keyword_image_url = excluded.keyword_image_url,
        filter_criteria = excluded.filter_criteria,
        matched_product_count = excluded.matched_product_count,
        total_product_count = excluded.total_product_count,
        ranking_range = excluded.ranking_range,
        fluctuation_range = excluded.fluctuation_range,
        sellersprite_units_total = excluded.sellersprite_units_total,
        sellersprite_available_total = excluded.sellersprite_available_total,
        sellersprite_enriched_product_count = excluded.sellersprite_enriched_product_count,
        has_sellersprite_data = excluded.has_sellersprite_data,
        amz123_raw = excluded.amz123_raw
    `)
    const selectKeywordIdStmt = db.prepare(`
      SELECT id FROM amazon_search_keywords WHERE task_id = ? AND keyword = ?
    `)
    const selectProductIdStmt = db.prepare(`
      SELECT id FROM crawled_products WHERE task_id = ? AND asin = ?
    `)
    const updateDeliveryStmt = db.prepare(`
      UPDATE crawled_products
      SET delivery_days = ?, has_delivery_detail = ?
      WHERE id = ?
    `)
    const insertLinkStmt = db.prepare(`
      INSERT INTO amazon_search_keyword_products (
        keyword_id, product_id, task_id, asin, delivery_days, delivery_text
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(keyword_id, product_id) DO UPDATE SET
        delivery_days = excluded.delivery_days,
        delivery_text = excluded.delivery_text
    `)

    const transaction = db.transaction(() => {
      upsertKeywordStmt.run(
        taskId,
        result.keyword,
        result.keywordImage || '',
        result.filterCriteria,
        result.matchedProductCount,
        result.totalProductCount,
        result.rankingRange,
        result.fluctuationRange,
        sellerspriteItems.length > 0 ? sellerspriteUnitsTotal : null,
        sellerspriteItems.length > 0 ? sellerspriteAvailableTotal : null,
        sellerspriteItems.length,
        sellerspriteItems.length > 0 ? SQLITE_BOOLEAN.TRUE : SQLITE_BOOLEAN.FALSE,
        result.amz123Raw || null
      )

      const keywordRow = selectKeywordIdStmt.get(taskId, result.keyword) as
        | { id: number }
        | undefined

      if (!keywordRow) {
        throw new Error(`搜索词入库后未能找到记录: ${result.keyword}`)
      }

      for (const product of result.products) {
        const asin = product.asin || ''
        if (!asin) continue

        const productRow = selectProductIdStmt.get(taskId, asin) as { id: number } | undefined
        if (!productRow) continue

        if (product.deliveryDays !== undefined && product.deliveryDays !== null) {
          updateDeliveryStmt.run(String(product.deliveryDays), SQLITE_BOOLEAN.TRUE, productRow.id)
        }

        insertLinkStmt.run(
          keywordRow.id,
          productRow.id,
          taskId,
          asin,
          product.deliveryDays ?? null,
          product.deliveryText || null
        )
      }
    })

    transaction()
  }

  public queryPendingDeliveryDetails(
    taskId: number,
    limit: number,
    excludedProductIds: ReadonlySet<number> = new Set()
  ): PendingDeliveryDetailProduct[] {
    const db = this.assertDb()
    const excludedIds = Array.from(excludedProductIds)
    const exclusionSql =
      excludedIds.length > 0 ? `AND id NOT IN (${excludedIds.map(() => '?').join(', ')})` : ''
    const stmt = db.prepare(`
      SELECT id, task_id, asin, title
      FROM crawled_products
      WHERE task_id = ?
        AND has_delivery_detail = ?
        ${exclusionSql}
      ORDER BY id ASC
      LIMIT ?
    `)

    return stmt.all(
      taskId,
      SQLITE_BOOLEAN.FALSE,
      ...excludedIds,
      limit
    ) as PendingDeliveryDetailProduct[]
  }

  public updateProductDeliveryDetails(updates: ProductDeliveryDetailUpdate[]): number {
    if (updates.length === 0) return 0

    const db = this.assertDb()
    const stmt = db.prepare(`
      UPDATE crawled_products
      SET delivery_days = ?, has_delivery_detail = ?
      WHERE id = ? AND has_delivery_detail = ?
    `)
    const transaction = db.transaction((items: ProductDeliveryDetailUpdate[]) => {
      let affectedRows = 0
      for (const item of items) {
        affectedRows += stmt.run(
          item.deliveryDays,
          SQLITE_BOOLEAN.TRUE,
          item.productId,
          SQLITE_BOOLEAN.FALSE
        ).changes
      }
      return affectedRows
    })

    return transaction(updates)
  }

  public markProductAsRead(productId: number): boolean {
    const db = this.assertDb()
    const stmt = db.prepare(`
      UPDATE crawled_products
      SET is_read = ?
      WHERE id = ?
    `)
    const result = stmt.run(SQLITE_BOOLEAN.TRUE, productId)
    return result.changes > 0
  }

  public markAmazonSearchKeywordAsRead(keywordId: number): boolean {
    const db = this.assertDb()
    const stmt = db.prepare(`
      UPDATE amazon_search_keywords
      SET is_read = ?
      WHERE id = ?
    `)
    const result = stmt.run(SQLITE_BOOLEAN.TRUE, keywordId)
    return result.changes > 0
  }

  /**
   * 获取所有采集任务列表 (排序以最新创建的优先)
   */
  public queryTasks(): CrawlTaskRow[] {
    const db = this.assertDb()
    const stmt = db.prepare(`
      SELECT t.*, (SELECT COUNT(*) FROM crawled_products WHERE task_id = t.id) as skuCount
      FROM crawl_tasks t 
      ORDER BY created_at DESC
    `)
    return stmt.all() as CrawlTaskRow[]
  }

  /**
   * 获取指定任务下的所有去重分类路径
   */
  public queryCategories(taskId: number): string[] {
    const db = this.assertDb()
    const stmt = db.prepare('SELECT DISTINCT category_name FROM crawled_products WHERE task_id = ?')
    const rows = stmt.all(taskId) as { category_name: string }[]
    return rows.map((r) => r.category_name)
  }

  public querySellerTypes(taskId: number): string[] {
    const db = this.assertDb()
    const stmt = db.prepare(`
      SELECT DISTINCT seller_type 
      FROM crawled_products 
      WHERE task_id = ? 
        AND seller_type IS NOT NULL 
        AND seller_type != '' 
        AND UPPER(seller_type) != 'NA' 
        AND UPPER(seller_type) != 'N/A'
    `)
    const rows = stmt.all(taskId) as { seller_type: string }[]
    return rows.map((r) => r.seller_type)
  }

  /**
   * 删除采集任务。
   * 💡 由于开启了 ON DELETE CASCADE，删除该任务会自动级联物理清理所有关联商品！
   */
  public deleteTask(taskId: number): void {
    const db = this.assertDb()
    const stmt = db.prepare('DELETE FROM crawl_tasks WHERE id = ?')
    stmt.run(taskId)
  }

  /**
   * 多维模糊搜索、类目过滤与高响应价格排序商品网格查询
   */
  public queryProducts(filter?: ProductQueryFilter): { total: number; list: CrawledProductRow[] } {
    const db = this.assertDb()
    const params: Array<string | number> = []
    const whereClauses: string[] = []

    if (filter?.taskId) {
      whereClauses.push('task_id = ?')
      params.push(filter.taskId)
    }

    if (filter?.query) {
      whereClauses.push('(asin LIKE ? OR title LIKE ?)')
      const likeQuery = `%${filter.query}%`
      params.push(likeQuery, likeQuery)
    }

    if (filter?.category) {
      // 💡 支持层级分类与复合分类匹配：精确匹配、作为父分类前缀匹配、或者在合流分类(A | B)中匹配
      whereClauses.push(
        '(category_name = ? OR category_name LIKE ? OR category_name LIKE ? OR category_name LIKE ?)'
      )
      params.push(
        filter.category,
        `${filter.category} > %`,
        `%| ${filter.category}`,
        `%| ${filter.category} > %`
      )
    }

    if (filter?.minPrice !== undefined) {
      whereClauses.push('price_amount >= ?')
      params.push(filter.minPrice)
    }

    if (filter?.maxPrice !== undefined) {
      whereClauses.push('price_amount <= ?')
      params.push(filter.maxPrice)
    }

    if (filter?.hasSellerSpriteData !== undefined) {
      whereClauses.push('has_sellersprite_data = ?')
      params.push(filter.hasSellerSpriteData ? SQLITE_BOOLEAN.TRUE : SQLITE_BOOLEAN.FALSE)
    }

    if (filter?.sellerType) {
      whereClauses.push('seller_type = ?')
      params.push(filter.sellerType)
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    // 1. 获取总条数
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM crawled_products ${whereStr}`)
    const totalResult = countStmt.get(...params) as { total: number }
    const total = totalResult ? totalResult.total : 0

    // 2. 拼接排序与分页 SQL 语句
    const requestedSortBy = filter?.sortBy || PRODUCT_QUERY_DEFAULT.SORT_BY
    const sortBy = PRODUCT_SORT_COLUMNS.has(requestedSortBy)
      ? requestedSortBy
      : PRODUCT_QUERY_DEFAULT.SORT_BY
    const sortOrder =
      filter?.sortOrder === PRODUCT_SORT_ORDER.ASC || filter?.sortOrder === PRODUCT_SORT_ORDER.DESC
        ? filter.sortOrder
        : PRODUCT_QUERY_DEFAULT.SORT_ORDER
    const limit = filter?.limit ?? PRODUCT_QUERY_DEFAULT.LIMIT
    const offset = filter?.offset ?? PRODUCT_QUERY_DEFAULT.OFFSET
    const orderBy =
      sortBy === 'sellersprite_available'
        ? `CASE
            WHEN sellersprite_available IS NULL OR sellersprite_available < 1000000000000 THEN 1
            ELSE 0
          END ASC,
          sellersprite_available ${sortOrder}`
        : `${sortBy} ${sortOrder}`

    // better-sqlite3 预编译参数防 SQL 注入
    const querySql = `
      SELECT * FROM crawled_products
      ${whereStr}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `
    const listParams = [...params, limit, offset]
    const listStmt = db.prepare(querySql)
    const list = listStmt.all(...listParams) as CrawledProductRow[]

    return { total, list }
  }

  public queryAmazonSearchKeywords(
    filter?: SearchKeywordQueryFilter
  ): { total: number; list: AmazonSearchKeywordRow[] } {
    const db = this.assertDb()
    const params: Array<string | number> = []
    const whereClauses: string[] = []

    if (filter?.taskId) {
      whereClauses.push('k.task_id = ?')
      params.push(filter.taskId)
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const productCountSql = `
      SELECT COUNT(DISTINCT scoped_kp.product_id)
      FROM amazon_search_keyword_products scoped_kp
      WHERE scoped_kp.keyword_id = k.id
    `
    const firstImageSql = `
      SELECT scoped_p.image_url
      FROM amazon_search_keyword_products scoped_kp
      JOIN crawled_products scoped_p ON scoped_p.id = scoped_kp.product_id
      WHERE scoped_kp.keyword_id = k.id
        AND scoped_p.image_url IS NOT NULL
        AND scoped_p.image_url != ''
      ORDER BY scoped_kp.id ASC
      LIMIT 1
    `
    const total = (
      db
        .prepare(
          `
          SELECT COUNT(*) AS total
          FROM amazon_search_keywords k
          ${whereStr}
        `
        )
        .get(...params) as { total: number }
    ).total
    const sortOrder =
      filter?.sortOrder === PRODUCT_SORT_ORDER.ASC || filter?.sortOrder === PRODUCT_SORT_ORDER.DESC
        ? filter.sortOrder
        : PRODUCT_SORT_ORDER.DESC
    const limit = filter?.limit ?? PRODUCT_QUERY_DEFAULT.LIMIT
    const offset = filter?.offset ?? PRODUCT_QUERY_DEFAULT.OFFSET
    const list = db
      .prepare(
        `
        SELECT
          k.id,
          k.task_id,
          k.keyword,
          k.keyword_image_url,
          COALESCE(NULLIF(k.keyword_image_url, ''), (${firstImageSql})) AS first_product_image_url,
          k.matched_product_count,
          (${productCountSql}) AS linked_product_count,
          k.is_read,
          k.created_at,
          t.marketplace
        FROM amazon_search_keywords k
        JOIN crawl_tasks t ON t.id = k.task_id
        ${whereStr}
        ORDER BY k.created_at ${sortOrder}
        LIMIT ? OFFSET ?
      `
      )
      .all(...params, limit, offset) as AmazonSearchKeywordRow[]

    return { total, list }
  }

  public queryAmazonSearchKeywordProducts(keywordId: number): AmazonSearchKeywordProductRow[] {
    const db = this.assertDb()
    const stmt = db.prepare(`
      SELECT
        p.*,
        kp.keyword_id,
        k.keyword,
        kp.delivery_text,
        kp.delivery_days AS keyword_delivery_days
      FROM amazon_search_keyword_products kp
      JOIN amazon_search_keywords k ON k.id = kp.keyword_id
      JOIN crawled_products p ON p.id = kp.product_id
      WHERE kp.keyword_id = ?
      ORDER BY p.crawled_at DESC, p.id DESC
    `)

    return stmt.all(keywordId) as AmazonSearchKeywordProductRow[]
  }

  /**
   * 获取全局仪表盘统计数据 (任务数、SKU总数、多站点汇总等)
   */
  public getStatistics(): DatabaseStatistics {
    const db = this.assertDb()
    const totalTasksResult = db.prepare('SELECT COUNT(*) as cnt FROM crawl_tasks').get() as {
      cnt: number
    }
    const totalProductsResult = db
      .prepare('SELECT COUNT(*) as cnt FROM crawled_products')
      .get() as { cnt: number }

    // 额外统计平均价格
    const avgPriceResult = db
      .prepare('SELECT AVG(price_amount) as avgPrice FROM crawled_products WHERE price_amount > 0')
      .get() as { avgPrice: number }

    let dbSizeBytes = 0
    let dbSizeMB = '0.0 MB'
    try {
      if (fs.existsSync(this.dbPath)) {
        const stat = fs.statSync(this.dbPath)
        dbSizeBytes = stat.size
        dbSizeMB = (dbSizeBytes / (1024 * 1024)).toFixed(1) + ' MB'
      }
    } catch (e) {
      console.warn('[DatabaseService] Failed to get db size:', e)
    }

    return {
      totalTasks: totalTasksResult ? totalTasksResult.cnt : 0,
      totalSKUs: totalProductsResult ? totalProductsResult.cnt : 0,
      avgPrice:
        avgPriceResult && avgPriceResult.avgPrice
          ? parseFloat(avgPriceResult.avgPrice.toFixed(DATABASE_STATISTICS_DECIMAL_PLACES))
          : 0,
      dbSizeBytes,
      dbSizeMB
    }
  }

  /**
   * 获取所有卖家精灵账号列表
   */
  public querySpriteAccounts(): SellerSpriteAccountRow[] {
    const db = this.assertDb()
    const stmt = db.prepare('SELECT * FROM sellersprite_accounts ORDER BY created_at DESC')
    return stmt.all() as SellerSpriteAccountRow[]
  }

  public queryProductBsrRanks(productId: number): ProductBsrRankRow[] {
    const db = this.assertDb()
    const stmt = db.prepare(`
      SELECT * FROM product_bsr_ranks
      WHERE product_id = ?
      ORDER BY is_main DESC, rank ASC
    `)
    return stmt.all(productId) as ProductBsrRankRow[]
  }

  /**
   * 新增一个卖家精灵账号
   */
  public createSpriteAccount(username: string, password: string): number {
    const db = this.assertDb()
    const stmt = db.prepare(`
      INSERT INTO sellersprite_accounts (username, password, status)
      VALUES (?, ?, ?)
    `)
    const result = stmt.run(username, password, SELLERSPRITE_ACCOUNT_STATUS.NORMAL)
    return result.lastInsertRowid as number
  }

  /**
   * 删除指定卖家精灵账号
   */
  public deleteSpriteAccount(id: number): void {
    const db = this.assertDb()
    const stmt = db.prepare('DELETE FROM sellersprite_accounts WHERE id = ?')
    stmt.run(id)
  }

  /**
   * 一键清理卖家精灵账号
   */
  public clearSpriteAccounts(scope: SpriteAccountClearScope): void {
    const db = this.assertDb()
    if (scope === SPRITE_ACCOUNT_CLEAR_SCOPE.ALL) {
      const stmt = db.prepare('DELETE FROM sellersprite_accounts')
      stmt.run()
    } else {
      const stmt = db.prepare('DELETE FROM sellersprite_accounts WHERE status = ?')
      stmt.run(SELLERSPRITE_ACCOUNT_STATUS.INVALID)
    }
  }

  /**
   * 更新卖家精灵账号状态
   */
  public updateSpriteAccountStatus(id: number, status: SellerSpriteAccountStatus): void {
    const db = this.assertDb()
    const stmt = db.prepare(`
      UPDATE sellersprite_accounts
      SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `)
    stmt.run(status, id)
  }

  /**
   * 清空商品数据缓存与执行 SQLite 清理回收
   */
  public clearCache(): void {
    const db = this.assertDb()
    console.log('[DatabaseService] 开始执行 SQLite 系统减肥物理吸尘真空回收...')
    // 物理清理历史游离数据并执行数据库真空整理，缩减 sellerflow.db 的物理磁盘体积
    db.exec('VACUUM')
    console.log('[DatabaseService] SQLite VACUUM 释放物理空间完毕！')
  }
}

export const databaseService = new DatabaseService()
