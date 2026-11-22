/** Minimal byte sequences that pass the media signature checks. */

function filled(size: number, head: Buffer): Buffer {
  const data = Buffer.alloc(Math.max(size, head.length), 7);
  head.copy(data, 0);
  return data;
}

export function jpegBytes(size = 256): Buffer {
  return filled(size, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
}

export function pngBytes(size = 256): Buffer {
  return filled(
    size,
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
}

export function webpBytes(size = 256): Buffer {
  const data = filled(size, Buffer.from('RIFF'));
  data.write('WEBP', 8, 'latin1');
  return data;
}

export function mp4Bytes(size = 256, brand = 'isom'): Buffer {
  const data = filled(size, Buffer.from([0, 0, 0, 0x20]));
  data.write('ftyp', 4, 'latin1');
  data.write(brand, 8, 'latin1');
  return data;
}

export function webmBytes(size = 256): Buffer {
  const data = filled(size, Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f]));
  data.write('B\u0082\u0084webm', 5, 'latin1');
  return data;
}
