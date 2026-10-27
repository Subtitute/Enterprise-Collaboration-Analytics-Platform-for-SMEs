/**
 * 26/10/2026: kiem tra avatar bang MAGIC BYTES (khong tin Content-Type/ten tep client gui) va doc
 * kich thuoc anh tu header - Technical_Spec.md muc 27.10 (JPEG/PNG/WebP, >= 128px). Chi doc header,
 * khong giai ma anh (iam-service khong co thu vien xu ly anh, client da cat vuong 512px JPEG).
 */
export interface ImageProbe {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
}

// Cac marker SOF (Start Of Frame) mang kich thuoc anh; C4/C8/CC la DHT/JPG/DAC, khong phai SOF.
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function probeJpeg(buf: Buffer): ImageProbe | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1; // byte dem (fill)
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2; // marker khong co do dai
      continue;
    }
    const length = buf.readUInt16BE(i + 2);
    if (JPEG_SOF_MARKERS.has(marker)) {
      return { mimeType: 'image/jpeg', extension: 'jpg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

function probeWebp(buf: Buffer): ImageProbe | null {
  const chunk = buf.toString('ascii', 12, 16);
  const base = { mimeType: 'image/webp' as const, extension: 'webp' as const };
  if (chunk === 'VP8 ' && buf.length >= 30) {
    return { ...base, width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    const [b0, b1, b2, b3] = [buf[21], buf[22], buf[23], buf[24]];
    return { ...base, width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
  }
  if (chunk === 'VP8X' && buf.length >= 30) {
    return { ...base, width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  return null;
}

export function probeImage(buf: Buffer): ImageProbe | null {
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return probeJpeg(buf);
  if (buf.length >= 24 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a' && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { mimeType: 'image/png', extension: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 16 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return probeWebp(buf);
  return null;
}

/**
 * 26/10/2026: XOA METADATA anh dai dien o server (phat hien qua kiem thu: goi thang API voi JPEG co
 * APP1 GPS -> object trong iam-avatars giu nguyen toa do, ca to chuc tai duoc qua presigned URL). Web da
 * ve lai qua canvas nhung server khong duoc tin client. Khong giai ma lai anh (iam khong co thu vien xu
 * ly anh) - chi bo cac khoi metadata theo cau truc file:
 *  - JPEG: bo APP1..APP13, APP15 (Exif/XMP/ICC/IPTC/Photoshop...) va COM; GIU APP0 (JFIF) va APP14
 *    (Adobe - co chuyen doi mau can de giai ma dung). Phan sau SOS (du lieu anh) chep nguyen.
 *  - PNG: bo eXIf, tEXt, zTXt, iTXt, tIME.
 *  - WebP: bo chunk EXIF, XMP va xoa 2 co tuong ung trong VP8X, tinh lai kich thuoc RIFF.
 * Tra ve null neu cau truc hong (goi noi tu choi AVATAR_INVALID).
 */
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function stripJpeg(buf: Buffer): Buffer | null {
  const parts: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xda) {
      parts.push(buf.subarray(i)); // SOS: du lieu anh + EOI chep nguyen
      return Buffer.concat(parts);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      parts.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > buf.length) return null;
    const end = i + 2 + buf.readUInt16BE(i + 2);
    if (end > buf.length) return null;
    const isMetadata = (marker >= 0xe1 && marker <= 0xef && marker !== 0xee) || marker === 0xfe;
    if (!isMetadata) parts.push(buf.subarray(i, end));
    i = end;
  }
  return null;
}

function stripPng(buf: Buffer): Buffer | null {
  const parts: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const length = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const end = i + 12 + length;
    if (end > buf.length) return null;
    if (!PNG_METADATA_CHUNKS.has(type)) parts.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') return Buffer.concat(parts);
  }
  return null;
}

function stripWebp(buf: Buffer): Buffer | null {
  const chunks: Buffer[] = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = buf.toString('ascii', i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > buf.length) return null;
    const chunk = Buffer.from(buf.subarray(i, Math.min(end, buf.length)));
    if (type === 'VP8X' && size >= 1) chunk[8] &= ~(0x08 | 0x04); // co EXIF (bit 3) + XMP (bit 2)
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(chunk);
    i = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + body.length, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, body]);
}

export function stripImageMetadata(buf: Buffer, mimeType: ImageProbe['mimeType']): Buffer | null {
  if (mimeType === 'image/jpeg') return stripJpeg(buf);
  if (mimeType === 'image/png') return stripPng(buf);
  return stripWebp(buf);
}
