import type {
  SELLERSPRITE_LOGIN_RESULT_CODE,
  SELLERSPRITE_LOGIN_STATUS,
  SELLERSPRITE_QUICK_VIEW_STATUS
} from '../config/sellersprite'

export interface SellerSpriteBusinessSignature {
  stringToSign: string
  tk: string
}

export interface SellerSpriteLoginSuccess {
  status: typeof SELLERSPRITE_LOGIN_STATUS.SUCCESS
  success: true
  message: string
  token: string
  data?: unknown
}

export interface SellerSpriteLoginCredentialError {
  status: typeof SELLERSPRITE_LOGIN_STATUS.CREDENTIAL_ERROR
  success: typeof SELLERSPRITE_LOGIN_RESULT_CODE.CREDENTIAL_ERROR
  message: string
}

export interface SellerSpriteLoginNetworkError {
  status: typeof SELLERSPRITE_LOGIN_STATUS.NETWORK_ERROR
  success: typeof SELLERSPRITE_LOGIN_RESULT_CODE.NETWORK_ERROR
  message: string
}

export type SellerSpriteLoginResult =
  | SellerSpriteLoginSuccess
  | SellerSpriteLoginCredentialError
  | SellerSpriteLoginNetworkError

export type SellerSpriteQuickViewResult<TData = SellerSpriteQuickViewResponse> =
  | {
      status: typeof SELLERSPRITE_QUICK_VIEW_STATUS.RESPONSE
      success: boolean
      data: TData
    }
  | {
      status: typeof SELLERSPRITE_QUICK_VIEW_STATUS.NETWORK_ERROR
      success: false
      error: string
    }

export interface SellerSpriteQuickViewResponse {
  code?: string
  status?: string
  success?: boolean
  message?: string
  data?: {
    items?: SellerSpriteQuickViewItem[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface SellerSpriteBsrItem {
  rank?: unknown
  main?: unknown
  id?: unknown
  label?: unknown
  text?: unknown
  href?: unknown
}

export interface SellerSpriteQuickViewItem {
  asin?: unknown
  seller_type?: unknown
  bsrList?: unknown
  units?: unknown
  available?: unknown
  [key: string]: unknown
}
