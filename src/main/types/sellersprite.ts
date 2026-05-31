export interface SellerSpriteBusinessSignature {
  stringToSign: string
  tk: string
}

export interface SellerSpriteLoginSuccess {
  success: true
  message: string
  token?: string
  data?: unknown
}

export interface SellerSpriteLoginCredentialError {
  success: 1
  message: string
}

export interface SellerSpriteLoginNetworkError {
  success: 2
  message: string
}

export type SellerSpriteLoginResult =
  | SellerSpriteLoginSuccess
  | SellerSpriteLoginCredentialError
  | SellerSpriteLoginNetworkError

export interface SellerSpriteQuickViewResult<TData = SellerSpriteQuickViewResponse> {
  success: boolean
  data?: TData
  error?: string
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
