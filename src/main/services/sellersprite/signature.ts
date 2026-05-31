import { SELLERSPRITE_TKK } from '../../config/sellersprite'
import type { SellerSpriteBusinessSignature } from '../../types/sellersprite'

function shiftAndMix(value: number, salt: string): number {
  let result = value

  for (let index = 0; index < salt.length - 2; index += 3) {
    const rawShift = salt.charAt(index + 2)
    const shift = rawShift >= 'a' ? rawShift.charCodeAt(0) - 87 : Number(rawShift)
    const shifted = salt.charAt(index + 1) === '+' ? result >>> shift : result << shift
    result = salt.charAt(index) === '+' ? (result + shifted) & 4294967295 : result ^ shifted
  }

  return result
}

function utf8Bytes(input: string): number[] {
  const bytes: number[] = []

  for (let index = 0; index < input.length; index++) {
    let codePoint = input.charCodeAt(index)

    if (codePoint < 128) {
      bytes.push(codePoint)
      continue
    }

    if (codePoint < 2048) {
      bytes.push((codePoint >> 6) | 192)
    } else {
      if (
        (codePoint & 64512) === 55296 &&
        index + 1 < input.length &&
        (input.charCodeAt(index + 1) & 64512) === 56320
      ) {
        codePoint = 65536 + ((codePoint & 1023) << 10) + (input.charCodeAt(++index) & 1023)
        bytes.push((codePoint >> 18) | 240)
        bytes.push(((codePoint >> 12) & 63) | 128)
      } else {
        bytes.push((codePoint >> 12) | 224)
      }

      bytes.push(((codePoint >> 6) & 63) | 128)
    }

    bytes.push((codePoint & 63) | 128)
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
    accumulator = shiftAndMix(accumulator, '+-a^+6')
  }

  accumulator = shiftAndMix(accumulator, '+-3^+b+-f')
  accumulator ^= xorValue

  if (accumulator < 0) {
    accumulator = 2147483648 + (accumulator & 2147483647)
  }

  const result = accumulator % 1e6
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
