import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed, Layers } from 'lucide-react';
import { AccentTheme, GeoPoint } from '../types/run';
import { ACCENT_PALETTES } from '../utils/theme';

export type MapProviderId = 'nocturno-hd' | 'satelite-hibrido';

const MAP_PROVIDER_STORAGE_KEY = 'stride_map_provider_v2';

const PROVIDER_META: Record<
  MapProviderId,
  { shortLabel: string; next: MapProviderId }
> = {
  'nocturno-hd': {
    shortLabel: 'Nocturno HD',
    next: 'satelite-hibrido',
  },
  'satelite-hibrido': {
    shortLabel: 'Satélite Híbrido',
    next: 'nocturno-hd',
  },
};

interface LiveMapProps {
  currentPosition: [number, number];
  path: GeoPoint[];
  accent: AccentTheme;
  fitBoundsMode?: boolean;
  paceHeatmap?: boolean;
  interactive?: boolean;
  canCalibrate?: boolean;
  isCalibrated?: boolean;
  centerTrigger?: number;
  onRequestCenter?: () => void;
  onCalibratePosition?: (lat: number, lng: number) => void;
  onResetCalibration?: () => void;
}

interface PaceSegment {
  coords: [number, number][];
  color: string;
}

interface KmPinMarker {
  km: number;
  position: [number, number];
}

/**
 * Calcula la coordenada desplazada verticalmente (+150px hacia el sur en el plano proyectado)
 * para que el marcador del corredor quede en la mitad superior de la pantalla, libre del HUD inferior.
 */
const VERTICAL_HUD_OFFSET_PX = 150;

function getUpperHalfCenterLatLng(
  map: L.Map,
  lat: number,
  lng: number,
  zoom: number
): L.LatLng {
  const projected = map.project([lat, lng], zoom);
  const offsetPoint = projected.add([0, VERTICAL_HUD_OFFSET_PX]);
  return map.unproject(offsetPoint, zoom);
}

/**
 * Subcomponente dedicado exclusivamente a responder al primer clic en "Centrar"
 * escuchando los incrementos de centerTrigger (prev => prev + 1) y ubicando el marcador en la mitad superior.
 */
function MapCenterTriggerController({
  centerTrigger,
  lat,
  lng,
  lastPannedRef,
}: {
  centerTrigger: number;
  lat: number;
  lng: number;
  lastPannedRef: React.MutableRefObject<[number, number]>;
}) {
  const map = useMap();
  const prevTriggerRef = useRef<number>(centerTrigger);

  useEffect(() => {
    if (centerTrigger === prevTriggerRef.current || centerTrigger === 0) return;
    prevTriggerRef.current = centerTrigger;
    lastPannedRef.current = [lat, lng];

    map.stop();
    const targetZoom = Math.max(map.getZoom(), 18);
    const offsetCenter = getUpperHalfCenterLatLng(map, lat, lng, targetZoom);
    map.flyTo(offsetCenter, targetZoom, {
      animate: true,
      duration: 0.5,
    });
  }, [centerTrigger, lat, lng, map, lastPannedRef]);

  return null;
}

/**
 * Controlador interno de cámara automática (con offset superior) y eventos de clic para calibración manual.
 */
function MapCameraAndEventsController({
  lat,
  lng,
  coords,
  fitBoundsMode,
  autoFollow,
  isCalibratingClick,
  lastPannedRef,
  onUserDrag,
  onMapClickCalibrate,
}: {
  lat: number;
  lng: number;
  coords: [number, number][];
  fitBoundsMode?: boolean;
  autoFollow: boolean;
  isCalibratingClick: boolean;
  lastPannedRef: React.MutableRefObject<[number, number]>;
  onUserDrag: () => void;
  onMapClickCalibrate: (clickedLat: number, clickedLng: number) => void;
}) {
  const map = useMap();
  const lastPanTimeRef = useRef<number>(0);
  const hasFittedRef = useRef<boolean>(false);
  const hasInitialOffsetRef = useRef<boolean>(false);

  useMapEvents({
    dragstart: () => {
      if (!fitBoundsMode) {
        onUserDrag();
      }
    },
    click: (e) => {
      if (isCalibratingClick && !fitBoundsMode) {
        onMapClickCalibrate(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  // Aplicar el offset superior desde el montaje inicial para que el HUD inferior no tape el marcador
  useEffect(() => {
    if (fitBoundsMode || hasInitialOffsetRef.current) return;
    hasInitialOffsetRef.current = true;
    const offsetCenter = getUpperHalfCenterLatLng(
      map,
      lat,
      lng,
      map.getZoom()
    );
    map.setView(offsetCenter, map.getZoom(), { animate: false });
  }, [fitBoundsMode, lat, lng, map]);

  // Efecto exclusivo para modo Póster (fitBounds estático una sola vez por ruta)
  useEffect(() => {
    if (!fitBoundsMode || coords.length <= 1) return;
    if (hasFittedRef.current) return;
    hasFittedRef.current = true;

    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [38, 38], animate: false });
  }, [fitBoundsMode, coords, map]);

  // Efecto con throttling de 1s para centrar cámara en la mitad superior solo cuando lat/lng cambian realmente
  useEffect(() => {
    if (fitBoundsMode || !autoFollow) return;

    const [prevLat, prevLng] = lastPannedRef.current;
    const hasMoved =
      Math.abs(lat - prevLat) > 0.000003 ||
      Math.abs(lng - prevLng) > 0.000003;

    if (!hasMoved) return;

    const now = Date.now();
    if (now - lastPanTimeRef.current < 950) return;

    lastPannedRef.current = [lat, lng];
    lastPanTimeRef.current = now;
    const offsetCenter = getUpperHalfCenterLatLng(
      map,
      lat,
      lng,
      map.getZoom()
    );
    map.panTo(offsetCenter, { animate: true, duration: 0.5 });
  }, [lat, lng, autoFollow, fitBoundsMode, map, lastPannedRef]);

  return null;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  currentPosition,
  path,
  accent,
  fitBoundsMode = false,
  paceHeatmap = false,
  interactive = true,
  canCalibrate = false,
  isCalibrated = false,
  centerTrigger = 0,
  onRequestCenter,
  onCalibratePosition,
  onResetCalibration,
}) => {
  const [autoFollow, setAutoFollow] = useState(true);
  const [internalCenterTrigger, setInternalCenterTrigger] = useState(0);
  const [isCalibratingClick, setIsCalibratingClick] = useState(false);
  const [provider, setProvider] = useState<MapProviderId>(() => {
    try {
      const saved = localStorage.getItem(
        MAP_PROVIDER_STORAGE_KEY
      ) as MapProviderId | null;
      if (saved && PROVIDER_META[saved]) return saved;
    } catch {
      // ignore
    }
    return 'nocturno-hd';
  });

  const [lat, lng] = currentPosition;
  const lastPannedRef = useRef<[number, number]>([lat, lng]);
  const palette = ACCENT_PALETTES[accent];

  useEffect(() => {
    if (!canCalibrate && isCalibratingClick) {
      setIsCalibratingClick(false);
    }
  }, [canCalibrate, isCalibratingClick]);

  const handleCycleProvider = () => {
    const nextProvider = PROVIDER_META[provider].next;
    setProvider(nextProvider);
    try {
      localStorage.setItem(MAP_PROVIDER_STORAGE_KEY, nextProvider);
    } catch {
      // ignore
    }
  };

  const handleCenterClick = () => {
    setAutoFollow(true);
    setInternalCenterTrigger((prev) => prev + 1);
    if (onRequestCenter) {
      onRequestCenter();
    }
  };

  const effectiveCenterTrigger = centerTrigger + internalCenterTrigger;

  const polylineCoords = useMemo<[number, number][]>(
    () => path.map((pt) => [pt.lat, pt.lng]),
    [path]
  );

  // Calcular Pines de Kilómetro (1K, 2K, 3K...) sobre la coordenada exacta donde se cumplió cada km
  const kmMarkers = useMemo<KmPinMarker[]>(() => {
    if (path.length < 2) return [];
    const pins: KmPinMarker[] = [];
    let targetKm = 1;
    for (let i = 1; i < path.length; i++) {
      if (path[i].cumulativeDistanceKm >= targetKm) {
        pins.push({
          km: targetKm,
          position: [path[i].lat, path[i].lng],
        });
        targetKm += 1;
      }
    }
    return pins;
  }, [path]);

  // Calcular segmentos coloreados por velocidad relativa (Pace Heatmap: Cian -> Verde Neón -> Naranja Eléctrico)
  const heatmapSegments = useMemo<PaceSegment[]>(() => {
    if (!paceHeatmap || path.length < 2) return [];

    const speeds = path
      .slice(1)
      .map((p) => p.speed ?? 3.4)
      .filter((s) => s > 0);
    const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 2.8;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 4.2;
    const span = Math.max(maxSpeed - minSpeed, 0.35);

    const getColorForSpeed = (spd: number): string => {
      const ratio = (spd - minSpeed) / span;
      if (ratio < 0.35) return '#00D9F5'; // Recuperación / Suave (Cian)
      if (ratio <= 0.72) return '#00F5A0'; // Ritmo Medio Crucero (Verde Neón)
      return '#FF5E3A'; // Sprint / Rápido (Naranja Eléctrico)
    };

    const segments: PaceSegment[] = [];
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const color = getColorForSpeed(curr.speed ?? 3.4);
      const lastSeg = segments[segments.length - 1];

      if (lastSeg && lastSeg.color === color) {
        lastSeg.coords.push([curr.lat, curr.lng]);
      } else {
        segments.push({
          coords: [
            [prev.lat, prev.lng],
            [curr.lat, curr.lng],
          ],
          color,
        });
      }
    }
    return segments;
  }, [paceHeatmap, path]);

  const startCoord = polylineCoords.length > 0 ? polylineCoords[0] : null;
  const endCoord =
    polylineCoords.length > 0
      ? polylineCoords[polylineCoords.length - 1]
      : currentPosition;

  // Icono personalizado neón para el marcador arrastrable (cuando está en idle o paused)
  const draggableRunnerIcon = useMemo(() => {
    return L.divIcon({
      className: 'stride-runner-div-icon',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `
        <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:grab;">
          <div style="position:absolute;width:32px;height:32px;border-radius:9999px;background:${palette.hex};opacity:0.24;border:1.5px solid ${palette.hex};"></div>
          <div style="position:relative;width:15px;height:15px;border-radius:9999px;background:${palette.hex};border:3px solid #090A0F;box-shadow:0 0 12px ${palette.hex};"></div>
        </div>
      `,
    });
  }, [palette.hex]);

  return (
    <div
      className={`relative isolate z-0 w-full h-full bg-[#090A0F] select-none ${
        provider === 'nocturno-hd' ? 'map-theme-dark' : ''
      } ${isCalibratingClick ? 'cursor-calibrate' : ''}`}
    >
      <MapContainer
        center={currentPosition}
        zoom={17}
        zoomControl={false}
        attributionControl={false}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        className="w-full h-full z-0"
      >
        {/* 1. MODO NOCTURNO HD (Predeterminado: OpenStreetMap Nítido hasta Zoom 19 + .map-theme-dark en contenedor padre) */}
        {provider === 'nocturno-hd' && (
          <TileLayer
            key="nocturno-hd"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
            maxZoom={19}
          />
        )}

        {/* 2. MODO SATÉLITE HÍBRIDO (Esri World Imagery + Capa Superior de Calles World Transportation) */}
        {provider === 'satelite-hibrido' && (
          <>
            <TileLayer
              key="satelite-base"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={18}
              maxZoom={19}
            />
            <TileLayer
              key="satelite-calles"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={18}
              maxZoom={19}
              opacity={0.85}
            />
          </>
        )}

        <MapCenterTriggerController
          centerTrigger={effectiveCenterTrigger}
          lat={lat}
          lng={lng}
          lastPannedRef={lastPannedRef}
        />

        <MapCameraAndEventsController
          lat={lat}
          lng={lng}
          coords={polylineCoords}
          fitBoundsMode={fitBoundsMode}
          autoFollow={autoFollow}
          isCalibratingClick={isCalibratingClick}
          lastPannedRef={lastPannedRef}
          onUserDrag={() => setAutoFollow(false)}
          onMapClickCalibrate={(clickedLat, clickedLng) => {
            if (onCalibratePosition) {
              onCalibratePosition(clickedLat, clickedLng);
            }
            setIsCalibratingClick(false);
            setAutoFollow(true);
            setInternalCenterTrigger((prev) => prev + 1);
          }}
        />

        {/* Polilínea con efecto Glow Neón o Mapa de Calor por Ritmo (Pace Heatmap) */}
        {polylineCoords.length > 1 && (
          <>
            {/* Halo exterior continuo */}
            <Polyline
              positions={polylineCoords}
              pathOptions={{
                color: palette.hex,
                weight: 14,
                opacity: 0.22,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />

            {paceHeatmap && heatmapSegments.length > 0 ? (
              heatmapSegments.map((seg, idx) => (
                <Polyline
                  key={`heat-${idx}`}
                  positions={seg.coords}
                  pathOptions={{
                    color: seg.color,
                    weight: 5,
                    opacity: 0.96,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              ))
            ) : (
              <Polyline
                positions={polylineCoords}
                pathOptions={{
                  color: palette.hex,
                  weight: 5,
                  opacity: 0.96,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            )}
          </>
        )}

        {/* Pines Minimalistas de Kilómetro (1K, 2K, 3K...) */}
        {kmMarkers.map((item) => {
          const kmDivIcon = L.divIcon({
            className: 'stride-runner-div-icon',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            html: `
              <div style="width:24px;height:24px;border-radius:9999px;background:#10121A;border:1.5px solid ${palette.hex};color:#FFFFFF;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.75);">
                ${item.km}K
              </div>
            `,
          });
          return (
            <Marker
              key={`km-pin-${item.km}`}
              position={item.position}
              icon={kmDivIcon}
              interactive={false}
            />
          );
        })}

        {/* Punto de inicio discreto cuando hay ruta */}
        {startCoord && polylineCoords.length > 2 && (
          <CircleMarker
            center={startCoord}
            radius={5}
            pathOptions={{
              color: '#090A0F',
              weight: 2,
              fillColor: '#FFFFFF',
              fillOpacity: 0.9,
            }}
          />
        )}

        {/* Marcador del Corredor: Arrastrable cuando canCalibrate=true (idle/paused), o CircleMarker en carrera/póster */}
        {!fitBoundsMode && canCalibrate && onCalibratePosition ? (
          <Marker
            position={currentPosition}
            draggable={true}
            icon={draggableRunnerIcon}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target as L.Marker;
                const newPos = marker.getLatLng();
                onCalibratePosition(newPos.lat, newPos.lng);
              },
            }}
          />
        ) : (
          <>
            <CircleMarker
              center={fitBoundsMode ? endCoord : currentPosition}
              radius={15}
              pathOptions={{
                color: palette.hex,
                weight: 1,
                fillColor: palette.hex,
                fillOpacity: 0.2,
              }}
            />
            <CircleMarker
              center={fitBoundsMode ? endCoord : currentPosition}
              radius={6.5}
              pathOptions={{
                color: '#090A0F',
                weight: 2.5,
                fillColor: palette.hex,
                fillOpacity: 1,
              }}
            />
          </>
        )}
      </MapContainer>

      {/* Viñeta sutil superior e inferior para integrar el mapa con la UI oscura */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#090A0F]/90 via-[#090A0F]/40 to-transparent z-[400]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#090A0F] via-[#090A0F]/60 to-transparent z-[400]" />

      {/* Controles flotantes laterales limpios: únicamente Centrar + Selector de Capas HD */}
      <div className="absolute right-4 top-16 z-[450] flex flex-col items-end gap-2">
        {!fitBoundsMode && (
          <button
            onClick={handleCenterClick}
            className={`flex items-center gap-2 rounded-full bg-[#10121A]/90 hover:bg-[#10121A] backdrop-blur-md border px-3.5 py-1.5 text-xs font-medium text-white shadow-lg active:scale-95 transition ${
              !autoFollow ? 'border-white/25' : 'border-white/10'
            }`}
            title="Centrar mapa inmediatamente en tu ubicación"
          >
            <LocateFixed className={`w-3.5 h-3.5 ${palette.textClass}`} />
            <span>Centrar</span>
          </button>
        )}

        <button
          onClick={handleCycleProvider}
          className="flex items-center gap-2 rounded-full bg-[#10121A]/85 hover:bg-[#10121A] backdrop-blur-md border border-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-white shadow-lg active:scale-95 transition"
          title="Alternar entre Mapa Nocturno HD (Zoom 19) y Satélite Híbrido"
        >
          <Layers className={`w-3.5 h-3.5 ${palette.textClass}`} />
          <span>{PROVIDER_META[provider].shortLabel}</span>
        </button>
      </div>
    </div>
  );
};
