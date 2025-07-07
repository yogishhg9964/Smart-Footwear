// src/services/ThingSpeakService.ts

import axios from 'axios';
import { GpsData, parseGpsData } from '../models/GpsData';

const CHANNEL_ID = '2986447';
const READ_API_KEY = 'RM4ER3837YMFACRX';

const BASE_URL = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json?api_key=${READ_API_KEY}`;

export const fetchGpsData = async (): Promise<GpsData> => {
  try {
    const response = await axios.get(BASE_URL);
    const data = parseGpsData(response.data);
    console.log("Fetched GPS Data:", data);
    return data;
  } catch (error) {
    console.error("Error fetching data from ThingSpeak:", error);
    throw error;
  }
};
