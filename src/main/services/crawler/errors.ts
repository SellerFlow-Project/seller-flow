import { CRAWLER_ERROR_CODE } from '../../config/crawler'

export class SellerSpriteAuthenticationError extends Error {
  public readonly code = CRAWLER_ERROR_CODE.SELLERSPRITE_AUTHENTICATION_FAILED

  public constructor(message: string) {
    super(message)
    this.name = 'SellerSpriteAuthenticationError'
  }
}

export class SellerSpriteRetryExhaustedError extends Error {
  public readonly code = CRAWLER_ERROR_CODE.SELLERSPRITE_RETRY_EXHAUSTED

  public constructor(message: string) {
    super(message)
    this.name = 'SellerSpriteRetryExhaustedError'
  }
}
