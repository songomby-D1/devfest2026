export interface ViewPreset {
  id: string;
  label: string;
  orbit: string;
}

const SIDE_VIEWS: readonly ViewPreset[] = [
  { id: 'front', label: 'Face', orbit: '0deg 75deg auto' },
  { id: 'back', label: 'Dos', orbit: '180deg 75deg auto' },
  { id: 'left', label: 'Gauche', orbit: '-90deg 75deg auto' },
  { id: 'right', label: 'Droite', orbit: '90deg 75deg auto' },
  { id: 'top', label: 'Dessus', orbit: '0deg 0deg auto' },
];

const BOTTOM_VIEW: ViewPreset = {
  id: 'bottom',
  label: 'Dessous',
  orbit: '0deg 180deg auto',
};

export const HIDDEN_BOTTOM_MAX_ORBIT = 'auto 90deg auto';

export function viewPresets(bottomScanned: boolean): readonly ViewPreset[] {
  return bottomScanned ? [...SIDE_VIEWS, BOTTOM_VIEW] : SIDE_VIEWS;
}
