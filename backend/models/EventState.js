import mongoose from 'mongoose';

const EventStateSchema = new mongoose.Schema({
  id: { type: String, default: 'global_event_state', unique: true },
  phase: String,
  status: String,
  startedAt: Number,
  endAt: Number,
  durationMs: Number,
  cinematicStartedAt: Number // For global cinematic sync
}, { timestamps: true });

export default mongoose.model('EventState', EventStateSchema);
