import { Coordinates } from "./types";

// Start at the North Pole (approximate)
export const NORTH_POLE: Coordinates = {
  lat: 84.0,
  lng: -40.0 // Slightly off true north for better visual starting point on Mercator maps
};

export const DEFAULT_ZOOM = 2;
