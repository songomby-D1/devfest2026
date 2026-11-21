import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GalleryExperience } from './features/gallery-3d';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('The #root element is missing from index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <GalleryExperience />
  </StrictMode>,
);
