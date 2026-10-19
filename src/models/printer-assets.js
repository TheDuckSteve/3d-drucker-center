// Fertige 3D-Modelle (glTF) für Drucker. Werden beim Spielstart einmal geladen; danach baut printer-model.js
// daraus Kopien. Fehlt eine Datei oder lädt sie nicht, bleibt es beim selbst gebauten Modell.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Stil (wie in catalog.js) → Datei. Pfade relativ zu dieser Datei, damit es auch auf GitHub Pages klappt.
// ?v= nach jeder Änderung an einer Modelldatei erhöhen, sonst zeigt der Browser die alte aus dem Cache.
const VERSION = 4;
const FILES = {
  'a1-mini': `${new URL('../../assets/models/a1-mini.glb', import.meta.url).href}?v=${VERSION}`,
};

const loaded = new Map(); // Stil → Szene aus der glTF-Datei

export async function preloadPrinterAssets() {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(FILES).map(async ([style, url]) => {
    try {
      loaded.set(style, (await loader.loadAsync(url)).scene);
    } catch (error) {
      console.warn(`Druckermodell ${style} konnte nicht geladen werden – nehme das eingebaute`, error);
    }
  }));
}

// Geladene Szene für einen Stil oder null
export function printerAsset(style) {
  return loaded.get(style) ?? null;
}
