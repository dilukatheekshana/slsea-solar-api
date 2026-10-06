require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../docs/openapi.json');

const app = express();
const authRoutes = require('../routes/auth');
const hierarchyRoutes = require('../routes/hierarchy');
const installationRoutes = require('../routes/installations');

app.use(cors());
app.use(express.json());

// Swagger UI Options configured for Vercel Serverless (using CDN assets)
const swaggerUiOptions = {
  customCssUrl: "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css",
  customJs: [
    "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js",
    "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js"
  ]
};

// Global connection state caching for serverless environments (Vercel)
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise || mongoose.connection.readyState === 0) {
    let mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.warn('MONGO_URI environment variable is missing.');
      return null;
    }
    // Auto-fix unencoded '#' in password if present in environment variable
    if (mongoUri.includes('#') && !mongoUri.includes('%23')) {
      mongoUri = mongoUri.replace('#', '%23');
    }

    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose.connect(mongoUri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    }).catch(err => {
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('MongoDB connection error:', e.message);
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

// Documentation Endpoints
app.get('/docs-json', (req, res) => res.json(swaggerDocument));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));

// Auth routes
app.use('/', authRoutes);

// Hierarchy routes
app.use('/', hierarchyRoutes);

// Installation routes
app.use('/', installationRoutes);

// Local listener fallback
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
