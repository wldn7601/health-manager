/**
 * 헬스 매니저 앱 아이콘 PNG 생성 (외부 의존성 없음).
 * 실행: node scripts/generate_icons.mjs
 */

import zlib from 'zlib'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'backend', 'staticfiles_src')

function uint32BE(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n, 0)
  return b
}

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = uint32BE(data.length)
  const crcBuf = Buffer.concat([typeBytes, data])
  const crc = uint32BE(crc32(crcBuf))
  return Buffer.concat([len, typeBytes, data, crc])
}

function createPNG(size) {
  // 배경색 #2563eb (파란색)
  const BG = [0x25, 0x63, 0xeb]
  // 아이콘 요소색 (흰색)
  const FG = [0xff, 0xff, 0xff]

  // 픽셀 데이터 생성: 파란 배경 + 흰색 덤벨 심플 아이콘
  const pixels = []
  for (let y = 0; y < size; y++) {
    const row = [0] // filter byte = None
    for (let x = 0; x < size; x++) {
      const nx = x / size  // 0~1 정규화
      const ny = y / size

      // 라운드 모서리 마스크 (0.15 반지름)
      const r = 0.18
      const inCorner =
        (nx < r && ny < r && Math.hypot(nx - r, ny - r) > r) ||
        (nx > 1 - r && ny < r && Math.hypot(nx - (1 - r), ny - r) > r) ||
        (nx < r && ny > 1 - r && Math.hypot(nx - r, ny - (1 - r)) > r) ||
        (nx > 1 - r && ny > 1 - r && Math.hypot(nx - (1 - r), ny - (1 - r)) > r)

      if (inCorner) {
        row.push(0xf8, 0xfa, 0xfc) // 배경색 (밖은 흰색 배경)
        continue
      }

      // 덤벨 바 (가로 중앙)
      const barTop = 0.44, barBot = 0.56, barLeft = 0.28, barRight = 0.72
      // 왼쪽 원판
      const lpLeft = 0.18, lpRight = 0.28, lpTop = 0.32, lpBot = 0.68
      // 오른쪽 원판
      const rpLeft = 0.72, rpRight = 0.82, rpTop = 0.32, rpBot = 0.68

      const inBar = nx >= barLeft && nx <= barRight && ny >= barTop && ny <= barBot
      const inLP = nx >= lpLeft && nx <= lpRight && ny >= lpTop && ny <= lpBot
      const inRP = nx >= rpLeft && nx <= rpRight && ny >= rpTop && ny <= rpBot

      if (inBar || inLP || inRP) {
        row.push(...FG)
      } else {
        row.push(...BG)
      }
    }
    pixels.push(...row)
  }

  const rawData = Buffer.from(pixels)
  const compressed = zlib.deflateSync(rawData)

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdrData = Buffer.concat([
    uint32BE(size), uint32BE(size),
    Buffer.from([8, 2, 0, 0, 0]), // 8-bit, RGB, no interlace
  ])
  const ihdr = makeChunk('IHDR', ihdrData)
  const idat = makeChunk('IDAT', compressed)
  const iend = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, ihdr, idat, iend])
}

for (const [size, filename] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  const buf = createPNG(size)
  fs.writeFileSync(path.join(OUT_DIR, filename), buf)
  console.log(`생성됨: ${filename} (${size}x${size})`)
}
