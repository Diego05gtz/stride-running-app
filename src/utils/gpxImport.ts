import { GeoPoint, RunActivity } from '../types/run';
import { calculateHaversineDistance, computeSplitsFromPath } from './geoMath';
import { calculateMetabolicCalories } from './storage';

/**
 * Parsea un archivo .gpx externo (de Strava, Garmin, etc.) y construye un objeto RunActivity completo
 * con su polilínea, distancia acumulada Haversine, ritmo promedio, calorías y splits por kilómetro.
 */
export async function parseGpxFileToActivity(
  file: File,
  weightKg: number = 70
): Promise<RunActivity> {
  const xmlText = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const trkpts = Array.from(xmlDoc.getElementsByTagName('trkpt'));
  if (trkpts.length < 2) {
    throw new Error('El archivo GPX no contiene suficientes puntos de ruta.');
  }

  // Extraer título desde <trk><name> o <metadata><name> o nombre del archivo
  const nameNode =
    xmlDoc.querySelector('trk > name') ||
    xmlDoc.querySelector('metadata > name');
  const rawTitle =
    nameNode?.textContent?.trim() ||
    file.name.replace(/\.gpx$/i, '').replace(/[-_]/g, ' ');

  const path: GeoPoint[] = [];
  let cumulativeDistKm = 0;
  const fallbackBaseTime = Date.now() - trkpts.length * 3000;

  for (let i = 0; i < trkpts.length; i++) {
    const ptNode = trkpts[i];
    const lat = parseFloat(ptNode.getAttribute('lat') || '');
    const lng = parseFloat(ptNode.getAttribute('lon') || '');
    if (isNaN(lat) || isNaN(lng)) continue;

    const timeNode = ptNode.querySelector('time');
    let timestamp = fallbackBaseTime + i * 3000;
    if (timeNode?.textContent) {
      const parsedTime = Date.parse(timeNode.textContent.trim());
      if (!isNaN(parsedTime)) {
        timestamp = parsedTime;
      }
    }

    if (path.length === 0) {
      path.push({
        lat,
        lng,
        timestamp,
        accuracy: 5,
        speed: 3.3,
        cumulativeDistanceKm: 0,
      });
    } else {
      const prev = path[path.length - 1];
      const stepDistKm = calculateHaversineDistance(
        prev.lat,
        prev.lng,
        lat,
        lng
      );
      cumulativeDistKm += stepDistKm;

      // Si el GPX no tenía timestamps válidos o eran idénticos, estimar avance a ~3.4 m/s
      if (timestamp <= prev.timestamp) {
        const estimatedSec = Math.max(1, (stepDistKm * 1000) / 3.4);
        timestamp = prev.timestamp + Math.round(estimatedSec * 1000);
      }

      const deltaSec = Math.max(0.5, (timestamp - prev.timestamp) / 1000);
      const speedMs = (stepDistKm * 1000) / deltaSec;

      path.push({
        lat,
        lng,
        timestamp,
        accuracy: 5,
        speed: Math.min(Math.max(speedMs, 0.5), 11),
        cumulativeDistanceKm: cumulativeDistKm,
      });
    }
  }

  if (path.length < 2) {
    throw new Error('No se pudieron extraer coordenadas válidas del GPX.');
  }

  const startTime = path[0].timestamp;
  const endTime = path[path.length - 1].timestamp;
  const durationSeconds = Math.max(
    1,
    Math.round((endTime - startTime) / 1000)
  );
  const distanceKm = Number(cumulativeDistKm.toFixed(2));
  const avgPaceSecondsPerKm =
    distanceKm > 0.01 ? Math.round(durationSeconds / distanceKm) : 0;

  const splits = computeSplitsFromPath(path);

  return {
    id: `gpx-${Date.now()}`,
    title: rawTitle || 'Ruta GPX Importada',
    dateIso: new Date(startTime).toISOString(),
    durationSeconds,
    distanceKm,
    avgPaceSecondsPerKm,
    calories: calculateMetabolicCalories(distanceKm, weightKg),
    path,
    splits,
    isSimulated: false,
    badge: distanceKm >= 10 ? '10K GPX' : distanceKm >= 5 ? '5K GPX' : 'Ruta GPX',
  };
}
