// src/services/ThingSpeakService.ts

import axios from 'axios';
import { GpsData, parseGpsData } from '../models/GpsData';

const CHANNEL_ID = '2986447';
const READ_API_KEY = 'RM4ER3837YMFACRX';

const BASE_URL = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json?api_key=${READ_API_KEY}`;
const FEEDS_URL = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}`;

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

export const fetchHistoricalData = async (results: number = 100): Promise<GpsData[]> => {
  try {
    const response = await axios.get(`${FEEDS_URL}&results=${results}`);
    const feeds = response.data.feeds || [];
    const historicalData = feeds.map((feed: any) => parseGpsData(feed));
    console.log(`Fetched ${historicalData.length} historical data points`);
    return historicalData;
  } catch (error) {
    console.error("Error fetching historical data from ThingSpeak:", error);
    throw error;
  }
};
