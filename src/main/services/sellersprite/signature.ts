import { SELLERSPRITE_TKK } from '../../config/sellersprite'
import type { SellerSpriteBusinessSignature } from '../../types/sellersprite'

const SHIFT_EXPRESSION_CHUNK_LENGTH = 3
const SHIFT_OPERATOR_OFFSET = 1
const SHIFT_EXPRESSION_OFFSET = 2
const NEXT_CODE_UNIT_OFFSET = 1
const LOWERCASE_SHIFT_CHAR_CODE_OFFSET = 87
const UINT32_MASK = 0xffffffff
const SIGNED_INT_MASK = 0x7fffffff
const UNSIGNED_INT_OFFSET = 0x80000000
const SIGNATURE_MODULO = 1e6
const ACCUMULATOR_SALT = '+-a^+6'
const FINAL_SALT = '+-3^+b+-f'
const ASCII_MAX_CODE_POINT = 128
const TWO_BYTE_UTF8_MAX_CODE_POINT = 2048
const UTF8_CONTINUATION_SHIFT = 6
const UTF8_THREE_BYTE_SHIFT = 12
const UTF8_FOUR_BYTE_SHIFT = 18
const UTF8_CONTINUATION_MASK = 63
const UTF8_CONTINUATION_PREFIX = 128
const UTF8_TWO_BYTE_PREFIX = 192
const UTF8_THREE_BYTE_PREFIX = 224
const UTF8_FOUR_BYTE_PREFIX = 240
const SURROGATE_MASK = 64512
const HIGH_SURROGATE_PREFIX = 55296
const LOW_SURROGATE_PREFIX = 56320
const SURROGATE_VALUE_MASK = 1023
const HIGH_SURROGATE_SHIFT = 10
const SUPPLEMENTARY_CODE_POINT_OFFSET = 65536

function shiftAndMix(value: number, salt: string): number {
  let result = value

  for (
    let index = 0;
    index < salt.length - SHIFT_EXPRESSION_OFFSET;
    index += SHIFT_EXPRESSION_CHUNK_LENGTH
  ) {
    const rawShift = salt.charAt(index + SHIFT_EXPRESSION_OFFSET)
    const shift =
      rawShift >= 'a' ? rawShift.charCodeAt(0) - LOWERCASE_SHIFT_CHAR_CODE_OFFSET : Number(rawShift)
    const shifted =
      salt.charAt(index + SHIFT_OPERATOR_OFFSET) === '+' ? result >>> shift : result << shift
    result = salt.charAt(index) === '+' ? (result + shifted) & UINT32_MASK : result ^ shifted
  }

  return result
}

function utf8Bytes(input: string): number[] {
  const bytes: number[] = []

  for (let index = 0; index < input.length; index++) {
    let codePoint = input.charCodeAt(index)

    if (codePoint < ASCII_MAX_CODE_POINT) {
      bytes.push(codePoint)
      continue
    }

    if (codePoint < TWO_BYTE_UTF8_MAX_CODE_POINT) {
      bytes.push((codePoint >> UTF8_CONTINUATION_SHIFT) | UTF8_TWO_BYTE_PREFIX)
    } else {
      if (
        (codePoint & SURROGATE_MASK) === HIGH_SURROGATE_PREFIX &&
        index + NEXT_CODE_UNIT_OFFSET < input.length &&
        (input.charCodeAt(index + NEXT_CODE_UNIT_OFFSET) & SURROGATE_MASK) === LOW_SURROGATE_PREFIX
      ) {
        codePoint =
          SUPPLEMENTARY_CODE_POINT_OFFSET +
          ((codePoint & SURROGATE_VALUE_MASK) << HIGH_SURROGATE_SHIFT) +
          (input.charCodeAt(++index) & SURROGATE_VALUE_MASK)
        bytes.push((codePoint >> UTF8_FOUR_BYTE_SHIFT) | UTF8_FOUR_BYTE_PREFIX)
        bytes.push(
          ((codePoint >> UTF8_THREE_BYTE_SHIFT) & UTF8_CONTINUATION_MASK) | UTF8_CONTINUATION_PREFIX
        )
      } else {
        bytes.push((codePoint >> UTF8_THREE_BYTE_SHIFT) | UTF8_THREE_BYTE_PREFIX)
      }

      bytes.push(
        ((codePoint >> UTF8_CONTINUATION_SHIFT) & UTF8_CONTINUATION_MASK) | UTF8_CONTINUATION_PREFIX
      )
    }

    bytes.push((codePoint & UTF8_CONTINUATION_MASK) | UTF8_CONTINUATION_PREFIX)
  }

  return bytes
}

export function calculateSellerSpriteTk(stringToSign: string, tkk = SELLERSPRITE_TKK): string {
  const [seedText, xorText] = tkk.split('.')
  const seed = Number(seedText) || 0
  const xorValue = Number(xorText) || 0

  let accumulator = seed
  for (const byte of utf8Bytes(stringToSign)) {
    accumulator += byte
    accumulator = shiftAndMix(accumulator, ACCUMULATOR_SALT)
  }

  accumulator = shiftAndMix(accumulator, FINAL_SALT)
  accumulator ^= xorValue

  if (accumulator < 0) {
    accumulator = UNSIGNED_INT_OFFSET + (accumulator & SIGNED_INT_MASK)
  }

  const result = accumulator % SIGNATURE_MODULO
  return `${result}.${result ^ seed}`
}

export function calculateBusinessTk(
  urlPath: string,
  params: Record<string, string>
): SellerSpriteBusinessSignature {
  let stringToSign = ''

  if (params.asins) {
    stringToSign = decodeURIComponent(params.asins)
  } else if (params.asin) {
    stringToSign = params.asin
  } else if (params.q) {
    stringToSign = params.q
  } else {
    stringToSign = urlPath
  }

  return {
    stringToSign,
    tk: calculateSellerSpriteTk(stringToSign)
  }
}
