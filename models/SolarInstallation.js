const mongoose = require('mongoose');

const solarInstallationSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  meter_id: { type: String },
  inverter_id: { type: String },
  substation_id: { type: Number, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  capacity_kw: { type: Number },
  api_key: { type: String, select: false }
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v;
      delete ret.api_key;
      return ret;
    }
  }
});

module.exports = mongoose.models.SolarInstallation || mongoose.model('SolarInstallation', solarInstallationSchema);
