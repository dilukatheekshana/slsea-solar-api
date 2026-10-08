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
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date, default: null },
  api_key: {
    type: String,
    default: function() {
      return `key_inst_${this.id}`;
    },
    select: false
  }
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v;
      delete ret.api_key;
      delete ret.is_deleted;
      delete ret.deleted_at;
      return ret;
    }
  }
});

module.exports = mongoose.models.SolarInstallation || mongoose.model('SolarInstallation', solarInstallationSchema);
