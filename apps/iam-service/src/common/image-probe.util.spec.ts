import { probeImage, stripImageMetadata } from './image-probe.util';

/** 26/10/2026: magic bytes + kich thuoc avatar (Technical_Spec.md muc 27.10). */
describe('probeImage', () => {
  it('JPEG: bo qua APP0/APPn, doc kich thuoc tu SOF2 (progressive)', () => {
    const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]);
    const sof2 = Buffer.from([0xff, 0xc2, 0x00, 0x11, 0x08, 0x01, 0x40, 0x02, 0x00, 0x03]);
    const buf = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof2, Buffer.alloc(16)]);
    expect(probeImage(buf)).toEqual({ mimeType: 'image/jpeg', extension: 'jpg', width: 512, height: 320 });
  });

  it('PNG: doc IHDR', () => {
    const buf = Buffer.alloc(32);
    Buffer.from('89504e470d0a1a0a', 'hex').copy(buf, 0);
    buf.write('IHDR', 12, 'ascii');
    buf.writeUInt32BE(640, 16);
    buf.writeUInt32BE(480, 20);
    expect(probeImage(buf)).toMatchObject({ mimeType: 'image/png', width: 640, height: 480 });
  });

  it('WebP: VP8X / VP8 / VP8L', () => {
    const base = (chunk: string) => {
      const buf = Buffer.alloc(32);
      buf.write('RIFF', 0, 'ascii');
      buf.write('WEBP', 8, 'ascii');
      buf.write(chunk, 12, 'ascii');
      return buf;
    };
    const vp8x = base('VP8X');
    vp8x.writeUIntLE(511, 24, 3);
    vp8x.writeUIntLE(255, 27, 3);
    expect(probeImage(vp8x)).toMatchObject({ mimeType: 'image/webp', width: 512, height: 256 });
    const vp8 = base('VP8 ');
    vp8.writeUInt16LE(300, 26);
    vp8.writeUInt16LE(200, 28);
    expect(probeImage(vp8)).toMatchObject({ width: 300, height: 200 });
    const vp8l = base('VP8L');
    // width-1 = 199 (14 bit), height-1 = 99 (14 bit) dong goi lien tiep tu byte 21.
    const bits = 199 | (99 << 14);
    vp8l.writeUInt32LE(bits, 21);
    expect(probeImage(vp8l)).toMatchObject({ width: 200, height: 100 });
  });

  it('dinh dang khac / du lieu hong -> null', () => {
    expect(probeImage(Buffer.from('GIF89a'))).toBeNull();
    expect(probeImage(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))).toBeNull();
    expect(probeImage(Buffer.alloc(0))).toBeNull();
  });
});

/** 26/10/2026: avatar khong bao gio mang Exif/GPS (xoa metadata o server). */
describe('stripImageMetadata', () => {
  const seg = (marker: number, data: Buffer) => Buffer.concat([Buffer.from([0xff, marker]), Buffer.from([(data.length + 2) >> 8, (data.length + 2) & 0xff]), data]);
  const sof = seg(0xc0, Buffer.from([0x08, 0x02, 0x00, 0x02, 0x00, 0x03, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]));
  const sosAndData = Buffer.concat([seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])), Buffer.from([0x12, 0x34, 0x56]), Buffer.from([0xff, 0xd9])]);

  it('JPEG: bo APP1 (Exif/GPS), APP2, COM; giu APP0, APP14 va du lieu anh', () => {
    const app0 = seg(0xe0, Buffer.from('JFIF\0'));
    const app1 = seg(0xe1, Buffer.from('Exif\0\0GPS-21.0285-105.8048'));
    const app2 = seg(0xe2, Buffer.from('ICC_PROFILE'));
    const app14 = seg(0xee, Buffer.from('Adobe'));
    const com = seg(0xfe, Buffer.from('ghi chu'));
    const input = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, app1, app2, app14, com, sof, sosAndData]);
    const out = stripImageMetadata(input, 'image/jpeg') as Buffer;
    expect(out.includes(Buffer.from('GPS'))).toBe(false);
    expect(out.includes(Buffer.from('Exif'))).toBe(false);
    expect(out.includes(Buffer.from('ICC_PROFILE'))).toBe(false);
    expect(out.includes(Buffer.from('ghi chu'))).toBe(false);
    expect(out).toEqual(Buffer.concat([Buffer.from([0xff, 0xd8]), app0, app14, sof, sosAndData]));
    expect(probeImage(out)).toMatchObject({ width: 512, height: 512 });
  });

  it('JPEG hong (khong co SOS / do dai vuot file) -> null', () => {
    expect(stripImageMetadata(Buffer.concat([Buffer.from([0xff, 0xd8]), sof]), 'image/jpeg')).toBeNull();
    expect(stripImageMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00]), 'image/jpeg')).toBeNull();
  });

  it('PNG: bo eXIf/tEXt/iTXt/zTXt/tIME, giu IHDR/IDAT/IEND', () => {
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
    };
    const ihdr = chunk('IHDR', Buffer.alloc(13));
    const idat = chunk('IDAT', Buffer.from('pixels'));
    const iend = chunk('IEND', Buffer.alloc(0));
    const input = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), ihdr, chunk('eXIf', Buffer.from('GPS')), chunk('tEXt', Buffer.from('Author')), idat, chunk('tIME', Buffer.alloc(7)), iend]);
    expect(stripImageMetadata(input, 'image/png')).toEqual(Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), ihdr, idat, iend]));
  });

  it('WebP: bo chunk EXIF/XMP, xoa co trong VP8X, tinh lai kich thuoc RIFF', () => {
    const chunk = (type: string, data: Buffer) => {
      const size = Buffer.alloc(4);
      size.writeUInt32LE(data.length);
      return Buffer.concat([Buffer.from(type, 'ascii'), size, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
    };
    const vp8x = chunk('VP8X', Buffer.from([0x0c, 0, 0, 0, 0xff, 0x01, 0, 0xff, 0x01, 0]));
    const image = chunk('VP8 ', Buffer.from('frame-data'));
    const body = Buffer.concat([vp8x, image, chunk('EXIF', Buffer.from('GPS')), chunk('XMP ', Buffer.from('<xmp/>'))]);
    const header = Buffer.from('RIFF0000WEBP', 'ascii');
    header.writeUInt32LE(4 + body.length, 4);
    const out = stripImageMetadata(Buffer.concat([header, body]), 'image/webp') as Buffer;
    expect(out.includes(Buffer.from('GPS'))).toBe(false);
    expect(out.includes(Buffer.from('<xmp/>'))).toBe(false);
    expect(out.readUInt32LE(4)).toBe(out.length - 8);
    expect(out[20] & 0x0c).toBe(0);
    expect(probeImage(out)).toMatchObject({ mimeType: 'image/webp', width: 512, height: 512 });
  });
});
