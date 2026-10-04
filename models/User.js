const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  username: { type: String },
  name: { type: String },
  email: { type: String },
  role: { type: String, enum: ['national', 'provincial', 'district'], required: true },
  jurisdiction_id: { type: Number, default: null }
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
