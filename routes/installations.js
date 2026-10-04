const express = require('express');
const router = express.Router();
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

module.exports = router;
