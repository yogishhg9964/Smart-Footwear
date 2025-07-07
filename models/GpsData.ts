// src/models/GpsData.ts

export interface GpsData {
  createdAt: string;
  entryId: number;
  latitude: number;
  longitude: number;
  distance: number;
  status: string;
  pressure?: number;
  temperature?: number;
  address?: string;
}

export const parseGpsData = (json: any): GpsData => {
  return {
    createdAt: json.created_at,
    entryId: json.entry_id,
    latitude: parseFloat(json.field1) || 0,
    longitude: parseFloat(json.field2) || 0,
    distance: 0, // Will be calculated based on danger zones
    temperature: json.field3 ? parseFloat(json.field3) : undefined,
    pressure: json.field4 ? parseFloat(json.field4) : undefined,
    status: json.field5 === "1" ? "outside" : "inside", // Object detected = outside safe zone
  };
};
