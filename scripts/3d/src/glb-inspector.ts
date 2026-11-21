import { NodeIO, Primitive, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import type { GlbInspector, GlbStats, TextureStats } from './pipeline.ts';

function primitiveTriangles(primitive: Primitive): number {
  const vertexCount =
    primitive.getIndices()?.getCount() ??
    primitive.getAttribute('POSITION')?.getCount() ??
    0;
  switch (primitive.getMode()) {
    case Primitive.Mode.TRIANGLES:
      return Math.floor(vertexCount / 3);
    case Primitive.Mode.TRIANGLE_STRIP:
    case Primitive.Mode.TRIANGLE_FAN:
      return Math.max(vertexCount - 2, 0);
    default:
      return 0;
  }
}

export function documentStats(document: Document): GlbStats {
  const root = document.getRoot();
  const triangles = root
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((total, primitive) => total + primitiveTriangles(primitive), 0);
  const textures = root.listTextures().map((texture): TextureStats => {
    const size = texture.getSize();
    return {
      mimeType: texture.getMimeType(),
      width: size?.[0] ?? null,
      height: size?.[1] ?? null,
      bytes: texture.getImage()?.byteLength ?? 0,
    };
  });
  return { triangles, textures };
}

export async function createGlbInspector(): Promise<GlbInspector> {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });
  return async (glbPath) => documentStats(await io.read(glbPath));
}
