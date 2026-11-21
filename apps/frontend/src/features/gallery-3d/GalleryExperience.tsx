import { useEffect, useMemo, useState } from 'react';
import { ArtworkFocus } from './ArtworkFocus';
import { GalleryEntrance } from './GalleryEntrance';
import styles from './GalleryExperience.module.css';
import { GalleryFallback } from './GalleryFallback';
import { GalleryOverlay } from './GalleryOverlay';
import { GalleryScene } from './GalleryScene';
import { detectDevice } from './device';
import type { RendererSupport } from './device';
import { artworks } from './gallery-content';
import { placeArtworks, railBounds } from './gallery-layout';
import { galleryStore, rail, setRailBounds, useGallery } from './gallery-store';

/**
 * The immersive visit: entrance, travelling into the room, walk along the
 * wall, focus on a work, inspect a sculpture, and back. The 3D canvas is
 * the environment; every word and button is HTML above it.
 */
export function GalleryExperience() {
  const [device] = useState(() => detectDevice());
  const [renderer, setRenderer] = useState<RendererSupport>(device.renderer);
  const state = useGallery();
  const placed = useMemo(() => placeArtworks(artworks), []);

  useEffect(() => {
    const bounds = railBounds(placed);
    setRailBounds(bounds.min, bounds.max);
    rail.target = bounds.min;
    rail.current = bounds.min;
  }, [placed]);

  useEffect(
    () => () => {
      galleryStore.leave();
    },
    [],
  );

  const atEntrance = state.phase === 'entrance' || state.phase === 'entering';

  return (
    <div className={styles.experience} data-phase={state.phase}>
      <main className={styles.stage} aria-label="Salle du musée">
        {renderer === 'webgl' ? (
          <GalleryScene
            device={device}
            placed={placed}
            onFailure={() => {
              setRenderer('none');
            }}
          />
        ) : (
          <GalleryFallback placed={placed} />
        )}
      </main>
      <GalleryOverlay placed={placed} />
      <ArtworkFocus />
      {atEntrance ? (
        <GalleryEntrance leaving={state.phase === 'entering'} />
      ) : null}
    </div>
  );
}
