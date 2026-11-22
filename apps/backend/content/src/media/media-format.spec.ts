import {
  jpegBytes,
  mp4Bytes,
  pngBytes,
  webmBytes,
  webpBytes,
} from '../../test/support/media-bytes';
import {
  MEDIA_TYPES,
  type MediaType,
  isMediaType,
  kindOf,
  matchesSignature,
  normalizeType,
} from './media-format';

const SAMPLES: Readonly<Record<MediaType, Buffer>> = {
  'image/jpeg': jpegBytes(),
  'image/png': pngBytes(),
  'image/webp': webpBytes(),
  'video/mp4': mp4Bytes(),
  'video/webm': webmBytes(),
};

describe('media formats', () => {
  it.each(MEDIA_TYPES)('accepts the signature of %s', (type) => {
    expect(matchesSignature(type, SAMPLES[type])).toBe(true);
  });

  it.each(MEDIA_TYPES)('refuses other files declared as %s', (type) => {
    for (const [other, bytes] of Object.entries(SAMPLES)) {
      if (other !== type) expect(matchesSignature(type, bytes)).toBe(false);
    }
    expect(matchesSignature(type, Buffer.from('<svg onload=alert(1)>'))).toBe(
      false,
    );
    expect(matchesSignature(type, Buffer.alloc(0))).toBe(false);
  });

  it.each(['qt  ', 'heic', 'mif1', 'avif'])(
    'refuses the %s brand in an MP4 container',
    (brand) => {
      expect(matchesSignature('video/mp4', mp4Bytes(64, brand))).toBe(false);
    },
  );

  it('accepts other MP4 brands', () => {
    expect(matchesSignature('video/mp4', mp4Bytes(64, 'mp42'))).toBe(true);
    expect(matchesSignature('video/mp4', mp4Bytes(64, 'M4V '))).toBe(true);
  });

  it('refuses a Matroska file that is not WebM', () => {
    const mkv = webmBytes();
    mkv.write('mkvx', 8, 'latin1');
    expect(matchesSignature('video/webm', mkv)).toBe(false);
  });

  it('normalizes declared types and maps kinds', () => {
    expect(normalizeType(' Image/PNG; charset=binary')).toBe('image/png');
    expect(normalizeType(undefined)).toBe('');
    expect(isMediaType('image/png')).toBe(true);
    expect(isMediaType('image/svg+xml')).toBe(false);
    expect(isMediaType('image/gif')).toBe(false);
    expect(kindOf('image/webp')).toBe('image');
    expect(kindOf('video/webm')).toBe('video');
  });
});
