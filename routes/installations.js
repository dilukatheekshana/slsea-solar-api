const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { SolarInstallation, GenerationReading } = require('../models');

// Reusable helper function to get the latest reading for an installation
async function getLatestReading(installationId) {
  const reading = await GenerationReading.findOne(
    { installation_id: installationId },
    { _id: 0, __v: 0 }
  )
    .sort({ timestamp: -1 })
    .lean();
  return reading || null;
}

// 1. GET /installations
router.get('/installations', async (req, res) => {
  try {
    const installations = await SolarInstallation.find({}, { _id: 0, __v: 0, api_key: 0 }).lean();
    res.status(200).json(installations);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      }
    });
  }
});

// 2. GET /installations/:id (Composite Resource)
router.get('/installations/:id', async (req, res) => {
  try {
    const numericId = Number(req.params.id);
    const installation = await SolarInstallation.findOne(
      { id: numericId },
      { _id: 0, __v: 0, api_key: 0 }
    ).lean();

    if (!installation) {
      return res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Solar installation not found'
        }
      });
    }

    const lastReading = await getLatestReading(numericId);

    const composite = {
      ...installation,
      last_reading: lastReading
    };

    res.status(200).json(composite);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      }
    });
  }
});

// 3. GET /installations/:id/readings/latest (Derived Operational View)
router.get('/installations/:id/readings/latest', async (req, res) => {
  try {
    const numericId = Number(req.params.id);
    const installation = await SolarInstallation.findOne({ id: numericId });

    if (!installation) {
      return res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Solar installation not found'
        }
      });
    }

    const latestReading = await getLatestReading(numericId);

    if (!latestReading) {
      return res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'No generation readings found for this installation'
        }
      });
    }

    res.status(200).json(latestReading);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      }
    });
  }
});

// 4. GET /installations/:id/readings (Historical Analytical Endpoint with Pagination, Filtering, ETag)
router.get('/installations/:id/readings', async (req, res) => {
  try {
    const numericId = Number(req.params.id);
    const installation = await SolarInstallation.findOne({ id: numericId });

    if (!installation) {
      return res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Solar installation not found'
        }
      });
    }

    // Filter Support (Date Range)
    const filter = { installation_id: numericId };
    const { from, to } = req.query;

    if (from || to) {
      filter.timestamp = {};
      if (from) {
        filter.timestamp.$gte = new Date(from);
      }
      if (to) {
        filter.timestamp.$lte = new Date(to);
      }
    }

    // Sorting Support
    const sortField = req.query.sort || 'timestamp';
    const order = (req.query.order || 'desc').toLowerCase();
    const sortObj = { [sortField]: order === 'asc' ? 1 : -1 };

    // Pagination Support
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    let limit = parseInt(req.query.limit, 10) || 50;
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 50;

    const totalCount = await GenerationReading.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    const readings = await GenerationReading.find(filter, { _id: 0, __v: 0 })
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Construct pagination links
    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
    function getPageUrl(targetPage) {
      const queryParams = new URLSearchParams(req.query);
      queryParams.set('page', targetPage);
      queryParams.set('limit', limit);
      return `${baseUrl}?${queryParams.toString()}`;
    }

    const nextUrl = (page < totalPages && totalCount > 0) ? getPageUrl(page + 1) : null;
    const prevUrl = (page > 1 && totalPages > 0) ? getPageUrl(page - 1) : null;

    // Response payload
    const payload = {
      count: totalCount,
      next: nextUrl,
      previous: prevUrl,
      data: readings
    };

    // ETag Generation & Conditional GET
    const etag = `"${crypto.createHash('md5').update(JSON.stringify(payload)).digest('hex')}"`;
    const ifNoneMatch = req.headers['if-none-match'];

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.setHeader('ETag', etag);
      return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      }
    });
  }
});

// 5. POST /installations/:id/readings (Meter Telemetry Ingestion Write Endpoint)
router.post('/installations/:id/readings', async (req, res) => {
  try {
    // 1. Authentication (Device Ingestion Layer)
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({
        error: {
          code: 'MISSING_API_KEY',
          message: 'X-API-Key header is required for device ingestion'
        }
      });
    }

    // 2. Installation Lookup & Key Verification
    const numericId = Number(req.params.id);
    const installation = await SolarInstallation.findOne({ id: numericId }).select('+api_key');

    if (!installation) {
      return res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Solar installation not found'
        }
      });
    }

    const targetApiKey = installation.api_key || `SLKEY-${String(numericId).padStart(5, '0')}`;
    if (apiKey !== targetApiKey) {
      return res.status(403).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'Provided API key does not match this installation'
        }
      });
    }

    // 3. Payload Validation
    const { timestamp, power_kw, cumulative_energy_kwh, voltage } = req.body || {};

    if (timestamp === undefined || power_kw === undefined || cumulative_energy_kwh === undefined || voltage === undefined) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid reading payload fields'
        }
      });
    }

    const powerNum = Number(power_kw);
    const energyNum = Number(cumulative_energy_kwh);
    const voltNum = Number(voltage);

    if (isNaN(powerNum) || powerNum < 0 ||
        isNaN(energyNum) || energyNum < 0 ||
        isNaN(voltNum) || voltNum < 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid reading payload fields'
        }
      });
    }

    const dateObj = new Date(timestamp);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid reading payload fields'
        }
      });
    }

    // 4. Monotonic ID Assignment & Append Operation
    const highestReading = await GenerationReading.findOne().sort({ id: -1 }).select('id').lean();
    const nextId = (highestReading && typeof highestReading.id === 'number') ? highestReading.id + 1 : 1;

    const newReading = new GenerationReading({
      id: nextId,
      installation_id: numericId,
      timestamp: dateObj,
      power_kw: powerNum,
      cumulative_energy_kwh: energyNum,
      voltage: voltNum
    });

    await newReading.save();

    const createdReading = newReading.toJSON();

    // 5. REST Response Compliance
    const etag = `"${crypto.createHash('md5').update(JSON.stringify(createdReading)).digest('hex')}"`;

    res.setHeader('Location', `/installations/${numericId}/readings/${nextId}`);
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', new Date().toUTCString());

    res.status(201).json(createdReading);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      }
    });
  }
});

module.exports = router;
