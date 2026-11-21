import { crc32, deflateSync } from 'node:zlib';

const CUBE_USDA = `#usda 1.0
(
    defaultPrim = "Cube"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Cube"
{
    def Mesh "Mesh"
    {
        int[] faceVertexCounts = [4, 4, 4, 4, 4, 4]
        int[] faceVertexIndices = [0, 2, 3, 1, 4, 5, 7, 6, 0, 1, 5, 4, 2, 6, 7, 3, 0, 4, 6, 2, 1, 3, 7, 5]
        point3f[] points = [(-0.5, -0.5, -0.5), (0.5, -0.5, -0.5), (-0.5, 0.5, -0.5), (0.5, 0.5, -0.5), (-0.5, -0.5, 0.5), (0.5, -0.5, 0.5), (-0.5, 0.5, 0.5), (0.5, 0.5, 0.5)]
        texCoord2f[] primvars:st = [(0, 0), (1, 0), (1, 1), (0, 1), (0, 0), (1, 0), (1, 1), (0, 1), (0, 0), (1, 0), (1, 1), (0, 1), (0, 0), (1, 0), (1, 1), (0, 1), (0, 0), (1, 0), (1, 1), (0, 1), (0, 0), (1, 0), (1, 1), (0, 1)] (
            interpolation = "faceVarying"
        )
        rel material:binding = </Cube/Material>
    }

    def Material "Material"
    {
        token outputs:surface.connect = </Cube/Material/Surface.outputs:surface>

        def Shader "Surface"
        {
            uniform token info:id = "UsdPreviewSurface"
            color3f inputs:diffuseColor.connect = </Cube/Material/Texture.outputs:rgb>
            float inputs:roughness = 0.5
            token outputs:surface
        }

        def Shader "Texture"
        {
            uniform token info:id = "UsdUVTexture"
            asset inputs:file = @texture.png@
            float2 inputs:st.connect = </Cube/Material/StReader.outputs:result>
            float3 outputs:rgb
        }

        def Shader "StReader"
        {
            uniform token info:id = "UsdPrimvarReader_float2"
            token inputs:varname = "st"
            float2 outputs:result
        }
    }
}
`;

export const CUBE_TRIANGLES = 12;
export const CUBE_TEXTURE_SIZE = 16;

function pngChunk(type: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

const QUADRANT_COLORS = [
  [255, 0, 0],
  [0, 0, 255],
  [0, 255, 0],
  [255, 255, 255],
] as const;

function quadrantRows(): Buffer {
  const half = CUBE_TEXTURE_SIZE / 2;
  const rows: number[] = [];
  for (let y = 0; y < CUBE_TEXTURE_SIZE; y++) {
    rows.push(0);
    for (let x = 0; x < CUBE_TEXTURE_SIZE; x++) {
      const quadrant = (y < half ? 0 : 2) + (x < half ? 0 : 1);
      rows.push(...(QUADRANT_COLORS[quadrant] ?? [0, 0, 0]));
    }
  }
  return Buffer.from(rows);
}

function quadrantPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(CUBE_TEXTURE_SIZE, 0);
  header.writeUInt32BE(CUBE_TEXTURE_SIZE, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = quadrantRows();
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

interface ZipEntry {
  readonly name: string;
  readonly data: Buffer;
}

const DOS_DATE_1980_01_01 = 0x21;

function zipEntryFields(entry: ZipEntry): Buffer {
  const fields = Buffer.alloc(22);
  fields.writeUInt16LE(0, 0);
  fields.writeUInt16LE(0, 2);
  fields.writeUInt16LE(0, 4);
  fields.writeUInt16LE(DOS_DATE_1980_01_01, 6);
  fields.writeUInt32LE(crc32(entry.data), 8);
  fields.writeUInt32LE(entry.data.length, 12);
  fields.writeUInt32LE(entry.data.length, 16);
  fields.writeUInt16LE(Buffer.byteLength(entry.name), 20);
  return fields;
}

function storedZip(entries: readonly ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const fields = zipEntryFields(entry);
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04, 20, 0]),
      fields,
      Buffer.alloc(2),
      name,
      entry.data,
    ]);
    const centralTail = Buffer.alloc(16);
    centralTail.writeUInt32LE(offset, 12);
    centralParts.push(
      Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0]),
        fields,
        centralTail,
        name,
      ]),
    );
    localParts.push(local);
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]);
}

export function texturedCubeUsdz(): Buffer {
  return storedZip([
    { name: 'cube.usda', data: Buffer.from(CUBE_USDA) },
    { name: 'texture.png', data: quadrantPng() },
  ]);
}
