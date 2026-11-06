import { GeoPoint, RunActivity } from '../types/run';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convierte un arreglo de coordenadas GeoPoint[] en un documento XML estándar GPX 1.1
 * compatible con Strava, Garmin Connect, TrainingPeaks y Komoot.
 */
export function buildGpxXml(
  path: GeoPoint[],
  title = 'Carrera STRIDE',
  dateIso: string = new Date().toISOString()
): string {
  const safeTitle = escapeXml(title);
  const metadataTime = new Date(dateIso).toISOString();

  const trkpts = path
    .map((pt) => {
      const pointTimeIso = new Date(pt.timestamp).toISOString();
      const lat = pt.lat.toFixed(6);
      const lon = pt.lng.toFixed(6);
      return `      <trkpt lat="${lat}" lon="${lon}">
        <time>${pointTimeIso}</time>
      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="STRIDE Running App - https://stride.app" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${safeTitle}</name>
    <time>${metadataTime}</time>
  </metadata>
  <trk>
    <name>${safeTitle}</name>
    <type>running</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Genera y descarga automáticamente el archivo .gpx en el navegador.
 */
export function exportActivityToGpx(activity: RunActivity): void {
  const xmlContent = buildGpxXml(activity.path, activity.title, activity.dateIso);
  const blob = new Blob([xmlContent], {
    type: 'application/gpx+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);

  const dateSlug = activity.dateIso.slice(0, 10);
  const titleSlug = activity.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const link = document.createElement('a');
  link.href = url;
  link.download = `stride-${titleSlug || 'carrera'}-${dateSlug}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
