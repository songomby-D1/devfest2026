export function isWebGLAvailable(
  createCanvas: () => HTMLCanvasElement = () =>
    document.createElement('canvas'),
): boolean {
  try {
    const canvas = createCanvas();
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return context !== null;
  } catch {
    return false;
  }
}
