import mongoose from 'mongoose';
import EventState from '../models/EventState.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_FILE = path.join(__dirname, '../../../countdown-state.json');

// Get the one authoritative global event state
export const getCountdownState = async () => {
  if (mongoose.connection.readyState === 1) {
    try {
      const state = await EventState.findOne({ id: 'global_event_state' });
      if (state) return state.toObject();
    } catch (error) {
      console.error('MongoDB fetch failed, using local fallback.');
    }
  }
  
  // Fallback
  try {
    if (fs.existsSync(FALLBACK_FILE)) {
      return JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf8'));
    }
  } catch (e) {}
  return null;
};

// Update or insert the global event state
export const setCountdownState = async (stateData) => {
  if (mongoose.connection.readyState === 1) {
    try {
      await EventState.findOneAndUpdate(
        { id: 'global_event_state' },
        { ...stateData, id: 'global_event_state' },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('MongoDB save failed, saving to local fallback.');
    }
  }
  
  // Fallback
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(stateData, null, 2), 'utf8');
  } catch (e) {}
};
