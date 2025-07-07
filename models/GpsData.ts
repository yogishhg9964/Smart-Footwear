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
    latitude: parseFloat(json.field1),
    longitude: parseFloat(json.field2),
    distance: parseFloat(json.field3),
    pressure: json.field6 ? parseFloat(json.field6) : undefined,
    temperature: json.field5 ? parseFloat(json.field5) : undefined,
    status: json.field4,

  };
};
