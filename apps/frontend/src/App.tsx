import './App.css';
import { ArtworkViewer } from './features/artwork-viewer';

const DEMO_ASSETS = '/demo/';

export function App() {
  return (
    <main className="app">
      <h1 className="app__title">Chargeur scanné</h1>
      <ArtworkViewer
        poster={`${DEMO_ASSETS}chargeur-poster.webp`}
        model1k={`${DEMO_ASSETS}c1k.glb`}
        model2k={`${DEMO_ASSETS}c2k.glb`}
        alt="Chargeur secteur blanc à deux broches, scanné en 3D"
        bottomScanned={false}
      />
    </main>
  );
}
