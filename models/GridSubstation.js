const mongoose = require('mongoose');

const gridSubstationSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  capacity_mva: { type: Number },
  district_id: { type: Number, required: true }
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.models.GridSubstation || mongoose.model('GridSubstation', gridSubstationSchema);
