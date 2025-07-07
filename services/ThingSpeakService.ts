// src/services/ThingSpeakService.ts

import axios from 'axios';
import { GpsData, parseGpsData } from '../models/GpsData';

const CHANNEL_ID = '2986447';
const READ_API_KEY = 'RM4ER3837YMFACRX';

const BASE_URL = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json?api_key=${READ_API_KEY}`;
const FEEDS_URL = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}`;

// Cache management for API calls
let lastApiCall = 0;
let cachedData: GpsData | null = null;
let isApiCallInProgress = false;
const MIN_API_INTERVAL = 3000; // Minimum 3 seconds between API calls
const CACHE_DURATION = 30000; // Cache data for 30 seconds

export const fetchGpsData = async (forceRefresh: boolean = false): Promise<GpsData> => {
  const now = Date.now();

  // Return cached data if it's fresh and we're not forcing a refresh
  if (!forceRefresh && cachedData && (now - lastApiCall) < CACHE_DURATION) {
    console.log('Returning cached ThingSpeak data');
    return cachedData;
  }

  // Prevent rapid successive API calls
  if (isApiCallInProgress) {
    console.log('ThingSpeak API call already in progress, waiting...');
    // Wait for the current call to complete and return cached data
    while (isApiCallInProgress && (Date.now() - now) < 5000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (cachedData) return cachedData;
  }

  // Enforce minimum interval between API calls
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < MIN_API_INTERVAL) {
    const waitTime = MIN_API_INTERVAL - timeSinceLastCall;
    console.log(`Waiting ${waitTime}ms before next ThingSpeak API call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  isApiCallInProgress = true;

  try {
    console.log('Making ThingSpeak API call...');
    const response = await axios.get(BASE_URL, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Cache-Control': 'no-cache',
      }
    });

    const data = parseGpsData(response.data);

    // Cache the successful response
    cachedData = data;
    lastApiCall = Date.now();

    console.log('ThingSpeak API call successful, data cached:', data);
    return data;

  } catch (error) {
    console.error("Error fetching data from ThingSpeak:", error);

    // Return cached data if available, otherwise throw error
    if (cachedData) {
      console.log('API call failed, returning cached data');
      return cachedData;
    }

    throw error;
  } finally {
    isApiCallInProgress = false;
  }
};

export const fetchHistoricalData = async (results: number = 100): Promise<GpsData[]> => {
  try {
    const response = await axios.get(`${FEEDS_URL}&results=${results}`, {
      timeout: 15000, // 15 second timeout for historical data
    });
    const feeds = response.data.feeds || [];
    const historicalData = feeds.map((feed: any) => parseGpsData(feed));
    console.log(`Fetched ${historicalData.length} historical data points`);
    return historicalData;
  } catch (error) {
    console.error("Error fetching historical data from ThingSpeak:", error);
    throw error;
  }
};

// Clear cache function for manual refresh
export const clearThingSpeakCache = () => {
  cachedData = null;
  lastApiCall = 0;
  console.log('ThingSpeak cache cleared');
};

// Get cache status
export const getCacheStatus = () => {
  const now = Date.now();
  return {
    hasCachedData: !!cachedData,
    cacheAge: cachedData ? now - lastApiCall : 0,
    isCallInProgress: isApiCallInProgress,
  };
};
