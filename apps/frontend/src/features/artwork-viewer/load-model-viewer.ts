interface ModelViewerGlobalConfig {
  dracoDecoderLocation?: string;
}

declare global {
  interface Window {
    ModelViewerElement?: ModelViewerGlobalConfig;
  }
}

const dracoDecoderLocation = `${import.meta.env.BASE_URL}draco/`;

let definition: Promise<void> | undefined;

async function defineModelViewer(): Promise<void> {
  // model-viewer reads this global config instead of its www.gstatic.com default.
  window.ModelViewerElement = {
    ...window.ModelViewerElement,
    dracoDecoderLocation,
  };
  await import('@google/model-viewer');
}

export function loadModelViewer(): Promise<void> {
  definition ??= defineModelViewer().catch((error: unknown) => {
    definition = undefined;
    throw error;
  });
  return definition;
}
