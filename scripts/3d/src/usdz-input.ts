import { open } from 'node:fs/promises';
import { InvalidInputError } from './errors.ts';

const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

async function readHeader(path: string): Promise<Buffer> {
  let file;
  try {
    file = await open(path, 'r');
  } catch {
    throw new InvalidInputError(`Cannot read input file ${path}.`);
  }
  try {
    if (!(await file.stat()).isFile()) {
      throw new InvalidInputError(`Input ${path} is not a file.`);
    }
    const header = Buffer.alloc(ZIP_LOCAL_HEADER.length);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    return header.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

export async function assertUsdzArchive(path: string): Promise<void> {
  if (!path.toLowerCase().endsWith('.usdz')) {
    throw new InvalidInputError(`Input ${path} must have a .usdz extension.`);
  }
  if (!(await readHeader(path)).equals(ZIP_LOCAL_HEADER)) {
    throw new InvalidInputError(
      `Input ${path} is not a USDZ archive: it does not start with a ZIP header.`,
    );
  }
}
