import { describe, expect, it } from 'vitest';
import { checkSourceImage, dataUriBytes, fitWithin } from './image-data-uri';

describe('photo preparation', () => {
  it('fits a large photo within the upload size, keeping its ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: 1280 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('measures the decoded size of a data URI', () => {
    const bytes = Buffer.from('hello world!');
    expect(
      dataUriBytes(`data:image/jpeg;base64,${bytes.toString('base64')}`),
    ).toBe(bytes.length);
    expect(dataUriBytes('data:image/jpeg;base64,aGk=')).toBe(2);
  });

  it('accepts JPEG, PNG and WebP photos only', () => {
    const photo = (type: string, size = 10) =>
      new File([new Uint8Array(size)], 'photo', { type });
    expect(checkSourceImage(photo('image/jpeg'))).toBeNull();
    expect(checkSourceImage(photo('image/webp'))).toBeNull();
    expect(checkSourceImage(photo('image/gif'))).toMatch(/JPEG, PNG ou WebP/);
  });
});
