require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const hierarchyRoutes = require('../routes/hierarchy');

app.use(cors());
app.use(express.json());

// Global connection state caching for serverless environments (Vercel)
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      return null;
    }
    cached.promise = mongoose.connect(mongoUri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('MongoDB connection error:', e);
  }

  return cached.conn;
}

// Middleware to ensure DB connectivity before handling requests
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
  } catch (error) {
    console.error('Database connection middleware error:', error);
  }
  next();
});

// Root route
app.get('/', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'operational',
    authority: 'Sri Lanka Sustainable Energy Authority',
    version: '1.0.0',
    database: isConnected ? 'connected' : 'disconnected'
  });
});

// Hierarchy routes
app.use('/', hierarchyRoutes);

// Local listener fallback
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
