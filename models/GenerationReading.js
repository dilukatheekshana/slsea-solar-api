const mongoose = require('mongoose');

const generationReadingSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  installation_id: { type: Number, required: true },
  timestamp: { type: Date, required: true },
  power_kw: { type: Number },
  cumulative_energy_kwh: { type: Number },
  voltage: { type: Number }
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.models.GenerationReading || mongoose.model('GenerationReading', generationReadingSchema);
