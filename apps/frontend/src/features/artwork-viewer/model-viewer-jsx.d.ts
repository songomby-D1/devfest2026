import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { ModelViewerHandle } from './model-viewer-element';

type ModelViewerAttributes = DetailedHTMLProps<
  HTMLAttributes<ModelViewerHandle>,
  ModelViewerHandle
> & {
  src: string;
  alt: string;
  poster?: string;
  'camera-controls'?: boolean;
  'tone-mapping'?: 'neutral' | 'aces' | 'agx';
  'max-camera-orbit'?: string;
  'auto-rotate'?: boolean;
  'rotation-speed'?: string;
  'shadow-intensity'?: string;
  exposure?: string;
  ar?: boolean;
  'ar-modes'?: string;
  'interaction-prompt'?: 'auto' | 'none';
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerAttributes;
    }
  }
}
