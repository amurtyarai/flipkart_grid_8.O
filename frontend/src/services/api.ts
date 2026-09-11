import axios from 'axios';
import type { LoggedEvent } from '../store/useStore';

// Dynamic API base URL: relative path in production deployment, localhost:8000 in local dev
const API_BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://127.0.0.1:8000');

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  /**
   * Log behavioral events history to the backend database.
   */
  logEvents: async (events: LoggedEvent[]): Promise<any> => {
    try {
      const response = await client.post('/log-events', { events });
      return response.data;
    } catch (error) {
      console.warn("Failed to log events to backend database:", error);
      throw error;
    }
  },

  /**
   * Post session behavioral context to calculate real-time predictions.
   *
   * Input payload structure:
   * {
   *   "session_data": { ... },
   *   "product_metadata": { ... },
   *   "user_metadata": { ... },
   *   "language": "Hindi"
   * }
   */
  predictAbandonment: async (payload: {
    session_data: Record<string, any>;
    product_metadata?: Record<string, any> | null;
    user_metadata?: Record<string, any> | null;
    language?: string;
  }): Promise<any> => {
    try {
      const response = await client.post('/predict', payload);
      return response.data;
    } catch (error) {
      console.warn("Failed to retrieve real-time prediction from API backend:", error);
      throw error;
    }
  }
};
