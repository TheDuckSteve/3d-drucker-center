// Bambu Lab A1 mini aus dem fertigen glTF-Modell („3D Printer - Bambu Lab A1 Mini“ von neilvfx, CC-BY-4.0,
// siehe README). Das Modell wird auf echte Größe gebracht, so gedreht, dass die Vorderseite nach +z zeigt,
// und in bewegliche Gruppen zerlegt, damit es druckt wie das selbst gebaute Modell:
//   bed   – Heizbett mit Druckplatte, fährt vor/zurück (z)
//   zAxis – X-Arm samt Druckkopf, fährt hoch/runter (y)
//   head  – Druckkopf, fährt auf dem Arm links/rechts (x)
import * as THREE from 'three';
import { createMaterials, createSpoolHolder } from './printer-parts.js';

const REAL_HEIGHT = 0.365;      // m, echter A1 mini bis Oberkante Säule
const ARM_MAX_Y = 0.45;         // Teile der Motor-Gruppe unterhalb davon (im Originalmodell) gehören zum Arm
const box = new THREE.Box3();

function boundsOf(object) {
  return box.setFromObject(object).clone();
}

// source: Szene aus der glTF-Datei (wird kopiert, Geometrie und Materialien teilen sich alle Drucker)
export function buildA1MiniFromAsset(g, source) {
  const model = source.clone(true);

  // Vorderseite im Modell ist +x → nach +z drehen, auf echte Höhe skalieren, mittig auf den Boden stellen
  model.rotation.y = -Math.PI / 2;
  model.updateMatrixWorld(true);
  const raw = boundsOf(model);
  const scale = REAL_HEIGHT / raw.max.y;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const sized = boundsOf(model.getObjectByName('BodyUV') ?? model);
  model.position.set(-(sized.min.x + sized.max.x) / 2, -sized.min.y, -(sized.min.z + sized.max.z) / 2);
  g.add(model);
  g.updateMatrixWorld(true);

  // Teile auswählen, solange noch alles an seinem Platz hängt
  const toolhead = model.getObjectByName('Toolhead');
  const bedNode = model.getObjectByName('Heatbed_2');
  const motor = model.getObjectByName('Motor');
  const armParts = [];
  motor?.traverse((o) => {
    if (!o.isMesh) return;
    const b = boundsOf(o);
    if ((b.min.y + b.max.y) / 2 / scale < ARM_MAX_Y) armParts.push(o); // Säulenkopf und Spulenhalter bleiben stehen
  });

  // Bewegliche Gruppen im Koordinatensystem des Druckers; attach() behält die Lage der Teile bei
  const bed = new THREE.Group();
  const zAxis = new THREE.Group();
  const head = new THREE.Group();
  g.add(bed, zAxis);
  zAxis.add(head);
  if (bedNode) bed.attach(bedNode);
  for (const part of armParts) zAxis.attach(part);
  if (toolhead) head.attach(toolhead);
  g.updateMatrixWorld(true);

  // Düsenspitze und Druckplatte vermessen
  const nozzle = boundsOf(model.getObjectByName('Nozzle_Toolhead_0') ?? head);
  const tip = new THREE.Vector3((nozzle.min.x + nozzle.max.x) / 2, nozzle.min.y, (nozzle.min.z + nozzle.max.z) / 2);
  const plate = boundsOf(model.getObjectByName('PEI_Plate_Heatbed_0') ?? bed);
  const plateCenter = new THREE.Vector3((plate.min.x + plate.max.x) / 2, plate.max.y, (plate.min.z + plate.max.z) / 2);
  const gap = tip.y - plateCenter.y; // Abstand Düse–Platte in Ruhestellung

  g.userData.printRig = {
    partParent: bed, // gedruckte Teile liegen auf dem Bett und fahren mit
    head,
    plateCenter,
    pose: ({ mode, x, z, layerY, partHeight }) => {
      if (mode === 'printing') {
        zAxis.position.y = layerY - gap + 0.0005;        // Düse sitzt auf der aktuellen Schicht
        head.position.x = plateCenter.x + x - tip.x;      // Kopf fährt über die gewünschte Stelle
        bed.position.z = tip.z - (plateCenter.z + z);     // Bett fährt entgegen
      } else {
        zAxis.position.y = mode === 'done' ? Math.max(0, partHeight - gap + 0.02) : 0; // geparkt über dem Teil
        head.position.x = 0;
        bed.position.z = 0;
      }
    },
  };

  // Spulenhalter oben auf der Säule, Spule hängt links daneben (wie beim echten A1 mini).
  // Zur Z-Achse gehören auch Teile unten am Sockel – die Säulenspitze sind nur die obersten Teile.
  const column = boundsOf(model.getObjectByName('Z_Axis') ?? model);
  const cap = new THREE.Box3();
  model.getObjectByName('Z_Axis')?.traverse((o) => {
    if (!o.isMesh) return;
    const b = boundsOf(o);
    if (b.max.y > column.max.y - 0.03) cap.union(b);
  });
  const peak = cap.isEmpty() ? column : cap;
  const top = new THREE.Vector3((peak.min.x + peak.max.x) / 2, column.max.y, (peak.min.z + peak.max.z) / 2);
  const holder = createSpoolHolder(0.09, createMaterials());
  holder.rotation.y = Math.PI;
  holder.position.copy(top);
  g.add(holder);
  g.userData.spoolSlots = [{ position: new THREE.Vector3(top.x - 0.06, top.y + 0.022, top.z), axis: 'x' }];
}
