export type UsdzConverter = (
  usdzPath: string,
  glbPath: string,
) => Promise<void>;

export interface OptimizeOptions {
  readonly maxTextureSize?: number;
}

export type GlbOptimizer = (
  inputPath: string,
  outputPath: string,
  options: OptimizeOptions,
) => Promise<void>;

export type PosterRenderer = (
  glbPath: string,
  posterPath: string,
) => Promise<void>;

export interface TextureStats {
  readonly mimeType: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly bytes: number;
}

export interface GlbStats {
  readonly triangles: number;
  readonly textures: readonly TextureStats[];
}

export type GlbInspector = (glbPath: string) => Promise<GlbStats>;
