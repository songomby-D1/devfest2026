import type { RefObject } from 'react';
import { useLayoutEffect } from 'react';

/*
 * Figma places the wall photo at (-329, -56), 1830x1011, on the 1440x900
 * stage, and the artwork centre at (507, 428). The photo keeps that alignment
 * on any screen and scales up around the artwork until it covers the viewport.
 */
const STAGE = { width: 1440, height: 900 };
const SCENE = { x: -329, y: -56, width: 1830, height: 1011 };
const ANCHOR = { x: 507, y: 428 };

export function computeScenePlacement(
  viewportWidth: number,
  viewportHeight: number,
) {
  const u = Math.min(
    viewportWidth / STAGE.width,
    viewportHeight / STAGE.height,
  );
  const stageX = (viewportWidth - STAGE.width * u) / 2;
  const stageY = (viewportHeight - STAGE.height * u) / 2;
  const left = stageX + SCENE.x * u;
  const top = stageY + SCENE.y * u;
  const width = SCENE.width * u;
  const height = SCENE.height * u;
  const anchorX = stageX + ANCHOR.x * u;
  const anchorY = stageY + ANCHOR.y * u;
  const scale = Math.max(
    1,
    anchorX / (anchorX - left),
    (viewportWidth - anchorX) / (left + width - anchorX),
    anchorY / (anchorY - top),
    (viewportHeight - anchorY) / (top + height - anchorY),
  );
  return {
    left: anchorX + (left - anchorX) * scale,
    top: anchorY + (top - anchorY) * scale,
    width: width * scale,
    height: height * scale,
  };
}

/** Writes the placement to CSS variables. Mobile CSS ignores them and covers instead. */
export function useScenePlacement(
  targetRef: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const target = targetRef.current;
    if (target === null) {
      return;
    }
    const update = (): void => {
      const placement = computeScenePlacement(
        window.innerWidth,
        window.innerHeight,
      );
      target.style.setProperty('--scene-left', `${String(placement.left)}px`);
      target.style.setProperty('--scene-top', `${String(placement.top)}px`);
      target.style.setProperty('--scene-width', `${String(placement.width)}px`);
      target.style.setProperty(
        '--scene-height',
        `${String(placement.height)}px`,
      );
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
  }, [targetRef]);
}
