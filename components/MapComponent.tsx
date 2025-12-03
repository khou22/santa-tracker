import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Stop, Coordinates, SantaState } from '../types';
import { NORTH_POLE } from '../constants';

// Helper to prevent Leaflet crashes
const isValidCoordinate = (coord: Coordinates | null | undefined): boolean => {
    return !!coord && typeof coord.lat === 'number' && !isNaN(coord.lat) && typeof coord.lng === 'number' && !isNaN(coord.lng);
};

// Custom Icons
const createCustomIcon = (type: 'santa' | 'house' | 'delivered' | 'pole', rotation: number = 0, isDelivering: boolean = false) => {
  let html = '';
  let className = '';
  let iconSize: [number, number] = [32, 32];
  let iconAnchor: [number, number] = [16, 16];

  switch(type) {
    case 'santa':
      // SVG pointing UP (North) by default.
      // Rotation: 0 deg = North, 90 deg = East, 180 = South
      // Added wrapper div for jump animation that is independent of rotation
      const jumpClass = isDelivering ? 'animate-santa-jump' : '';
      html = `
        <div style="transform: rotate(${rotation}deg); transition: transform 0.2s linear;" class="relative w-16 h-16 flex items-center justify-center filter drop-shadow-xl z-[1000]">
           <div class="${jumpClass} w-full h-full">
               <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
                  <!-- Runners -->
                  <path d="M30 20 L30 80 Q30 90 40 90" stroke="#8B4513" stroke-width="4" stroke-linecap="round" />
                  <path d="M70 20 L70 80 Q70 90 60 90" stroke="#8B4513" stroke-width="4" stroke-linecap="round" />
                  <!-- Sleigh Body -->
                  <path d="M35 40 H65 V80 C65 85 60 85 50 85 C40 85 35 85 35 80 V40 Z" fill="#D32F2F" stroke="#B71C1C" stroke-width="2"/>
                  <!-- Seat/Present Bag -->
                  <rect x="38" y="45" width="24" height="20" rx="2" fill="#8E24AA" />
                  <path d="M38 45 L62 65 M62 45 L38 65" stroke="#BA68C8" stroke-width="2" />
                  <!-- Front Reindeer Connection lines (Pointing UP/North) -->
                  <line x1="30" y1="20" x2="30" y2="5" stroke="#D7CCC8" stroke-width="2" stroke-dasharray="4 2"/>
                  <line x1="70" y1="20" x2="70" y2="5" stroke="#D7CCC8" stroke-width="2" stroke-dasharray="4 2"/>
               </svg>
           </div>
        </div>
      `;
      className = 'santa-icon';
      iconSize = [64, 64];
      iconAnchor = [32, 32];
      break;
    case 'house':
      html = `<div class="bg-red-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white transform hover:scale-110 transition-transform"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`;
      className = 'house-icon';
      break;
    case 'delivered':
      // Added gift-drop-anim and sparkle-burst classes
      html = `
        <div class="relative gift-drop-anim sparkle-burst">
            <div class="bg-green-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white relative z-10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
        </div>
      `;
      className = 'delivered-icon';
      break;
    case 'pole':
      html = `<div class="bg-blue-600 text-white p-2 rounded-full shadow-xl border-2 border-blue-200 text-xs font-bold w-10 h-10 flex items-center justify-center z-20">N</div>`;
      className = 'pole-icon';
      iconSize = [40, 40];
      iconAnchor = [20, 20];
      break;
  }

  return L.divIcon({
    html,
    className,
    iconSize,
    iconAnchor,
    popupAnchor: [0, -iconSize[1]/2]
  });
};

interface MapComponentProps {
  stops: Stop[];
  santa: SantaState;
}

// Component to handle map centering logic
const MapController: React.FC<{ center: Coordinates, isPlaying: boolean }> = ({ center, isPlaying }) => {
  const map = useMap();
  useEffect(() => {
    // Safety check to prevent crash if center is invalid
    if (!isValidCoordinate(center)) return;

    // Use panTo for smoother frame-by-frame updates during playback, flyTo for longer jumps
    if (isPlaying) {
        map.setView([center.lat, center.lng], map.getZoom(), { animate: false });
    } else {
        // When stopping (arriving), we fly to the location to center it nicely
        map.flyTo([center.lat, center.lng], map.getZoom(), { animate: true, duration: 1.0 });
    }
  }, [center, map, isPlaying]);
  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ stops, santa }) => {
  
  // Filter valid stops for the route line
  const routePositions = [
    [NORTH_POLE.lat, NORTH_POLE.lng],
    ...stops
      .filter(s => isValidCoordinate(s.coordinates))
      .map(s => [s.coordinates.lat, s.coordinates.lng])
  ] as [number, number][];

  // Calculate Santa's bearing for rotation
  const prevPosRef = useRef<Coordinates>(santa.currentPosition);
  const rotationRef = useRef(0);

  // Validate current position before calculation
  if (isValidCoordinate(santa.currentPosition) && isValidCoordinate(prevPosRef.current)) {
      const latDiff = santa.currentPosition.lat - prevPosRef.current.lat;
      const lngDiff = santa.currentPosition.lng - prevPosRef.current.lng;
      
      // Calculate rotation only if moving.
      if (Math.abs(latDiff) > 0.000001 || Math.abs(lngDiff) > 0.000001) {
          const angle = Math.atan2(lngDiff, latDiff) * (180 / Math.PI); 
          rotationRef.current = angle;
      }
  }
  
  // Update ref for next frame comparison
  useEffect(() => {
    if (isValidCoordinate(santa.currentPosition)) {
        prevPosRef.current = santa.currentPosition;
    }
  }, [santa.currentPosition]);


  return (
    <MapContainer 
      center={[NORTH_POLE.lat, NORTH_POLE.lng]} 
      zoom={3} 
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      
      {/* Route Line */}
      <Polyline 
        positions={routePositions} 
        pathOptions={{ color: '#ef4444', weight: 3, dashArray: '10, 10', opacity: 0.5, lineCap: 'round' }} 
      />

      {/* North Pole */}
      <Marker position={[NORTH_POLE.lat, NORTH_POLE.lng]} icon={createCustomIcon('pole')}>
        <Popup>North Pole (Santa's Workshop)</Popup>
      </Marker>

      {/* Stops */}
      {stops
        .filter(stop => isValidCoordinate(stop.coordinates))
        .map(stop => (
            <Marker 
            key={stop.id} 
            position={[stop.coordinates.lat, stop.coordinates.lng]}
            icon={createCustomIcon(stop.isDelivered ? 'delivered' : 'house')}
            >
            <Popup>
                <div className="text-center p-2">
                <p className="font-bold text-gray-800 text-lg">{stop.name}</p>
                <div className="flex items-center justify-center gap-1 text-gray-600 mt-1">
                    <span>🎁</span> <span className="text-sm">{stop.present}</span>
                </div>
                {stop.isDelivered && (
                    <div className="mt-2 text-xs text-white bg-green-500 px-2 py-1 rounded-full font-bold uppercase tracking-wider shadow-sm">
                    Delivered!
                    </div>
                )}
                </div>
            </Popup>
            </Marker>
      ))}

      {/* Santa - Only render if valid */}
      {isValidCoordinate(santa.currentPosition) && (
        <>
            <Marker 
                position={[santa.currentPosition.lat, santa.currentPosition.lng]} 
                icon={createCustomIcon('santa', rotationRef.current, santa.isDelivering)}
                zIndexOffset={1000}
            />
            <MapController center={santa.currentPosition} isPlaying={santa.isPlaying} />
        </>
      )}
    </MapContainer>
  );
};

export default MapComponent;