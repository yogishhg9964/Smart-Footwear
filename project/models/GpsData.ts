// src/models/GpsData.ts

export interface GpsData {
  createdAt: string;
  entryId: number;
  latitude: number;
  longitude: number;
  distance: number;
  status: string;
}

export const parseGpsData = (json: any): GpsData => {
  return {
    createdAt: json.created_at,
    entryId: json.entry_id,
    latitude: parseFloat(json.field1),
    longitude: parseFloat(json.field2),
    distance: parseFloat(json.field3),
    status: json.field6
  };
};
