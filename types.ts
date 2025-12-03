export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Stop {
  id: string;
  name: string; // The location name/address
  present: string; // What gift is being delivered
  coordinates: Coordinates;
  isDelivered: boolean;
  isNext: boolean;
}

export interface SantaState {
  currentPosition: Coordinates;
  targetStopId: string | null;
  isPlaying: boolean;
  speed: number; // movement speed multiplier
  isDelivering: boolean; // Visual state for delivery animation
}

export enum GameStatus {
  PLANNING = 'PLANNING',
  DELIVERING = 'DELIVERING',
  FINISHED = 'FINISHED'
}