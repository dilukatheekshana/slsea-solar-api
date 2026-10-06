const express = require('express');
const router = express.Router();
const { Province, District, GridSubstation, SolarInstallation, GenerationReading } = require('../models');
const { authorizeJurisdiction } = require('../middleware/auth');

// Standard error helper
const notFoundError = (message) => ({
  error: {
    code: 'RESOURCE_NOT_FOUND',
    message
  }
});

// 1. GET /provinces
router.get('/provinces', authorizeJurisdiction('province'), async (req, res) => {
  try {
    const provinces = await Province.find({}, { _id: 0, __v: 0 });
    res.status(200).json(provinces);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
  }
});

// 2. GET /provinces/:id
router.get('/provinces/:id', authorizeJurisdiction('province'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const province = await Province.findOne({ id }, { _id: 0, __v: 0 });
    if (!province) {
      return res.status(404).json(notFoundError('Province not found'));
    }
    res.status(200).json(province);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
  }
});

// 3. GET /provinces/:id/districts (Scoped sub-collection)
router.get('/provinces/:id/districts', authorizeJurisdiction('province'), async (req, res) => {
  try {
    const provinceId = Number(req.params.id);
    const province = await Province.findOne({ id: provinceId });
    if (!province) {
      return res.status(404).json(notFoundError('Province not found'));
    }
    const districts = await District.find({ province_id: provinceId }, { _id: 0, __v: 0 });
    res.status(200).json(districts);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
  }
});

// 4. GET /districts
router.get('/districts', authorizeJurisdiction('district'), async (req, res) => {
  try {
    const districts = await District.find({}, { _id: 0, __v: 0 });
    res.status(200).json(districts);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
  }
});

// 5. GET /districts/:id
router.get('/districts/:id', authorizeJurisdiction('district'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const district = await District.findOne({ id }, { _id: 0, __v: 0 });
    if (!district) {
      return res.status(404).json(notFoundError('District not found'));
    }
    res.status(200).json(district);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
  }
});

// 6. GET /districts/:id/substations (Scoped sub-collection)
router.get('/districts/:id/substations', authorizeJurisdiction('district'), async (req, res) => {
  try {
    const districtId = Number(req.params.id);
    const district = await District.findOne({ id: districtId });
    if (!district) {
      return res.status(404).json(notFoundError('District not found'));
    }
    const substations = await GridSubstation.find({ district_id: districtId }, { _id: 0, __v: 0 });
    res.status(200).json(substations);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
  }
});

// 7. GET /districts/:id/summary (Upper-band analytical stretch endpoint)
router.get('/districts/:id/summary', authorizeJurisdiction('district'), async (req, res) => {
  try {
    const districtId = Number(req.params.id);
    const district = await District.findOne({ id: districtId });

    if (!district) {
      return res.status(404).json(notFoundError('District not found'));
    }

    // Find all substations in this district
    const substations = await GridSubstation.find({ district_id: districtId }, { id: 1 }).lean();
    const substationIds = substations.map(s => s.id);

    // Find all solar installations under these substations
    const installations = await SolarInstallation.find({ substation_id: { $in: substationIds } }, { id: 1 }).lean();
    const installationIds = installations.map(i => i.id);
    const total_installations = installationIds.length;

    if (total_installations === 0) {
      return res.status(200).json({
        district_id: districtId,
        district_name: district.name,
        total_installations: 0,
        current_power_kw: 0,
        total_energy_kwh: 0,
        peak_power_kw: 0
      });
    }

    // Aggregate latest power & energy per site, and overall peak power
    const [latestAgg, peakAgg] = await Promise.all([
      GenerationReading.aggregate([
        { $match: { installation_id: { $in: installationIds } } },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$installation_id',
            latestPower: { $first: '$power_kw' },
            latestEnergy: { $first: '$cumulative_energy_kwh' }
          }
        },
        {
          $group: {
            _id: null,
            current_power_kw: { $sum: '$latestPower' },
            total_energy_kwh: { $sum: '$latestEnergy' }
          }
        }
      ]),
      GenerationReading.aggregate([
        { $match: { installation_id: { $in: installationIds } } },
        {
          $group: {
            _id: null,
            peak_power_kw: { $max: '$power_kw' }
          }
        }
      ])
    ]);

    const rawCurrentPower = latestAgg[0]?.current_power_kw || 0;
    const rawTotalEnergy = latestAgg[0]?.total_energy_kwh || 0;
    const rawPeakPower = peakAgg[0]?.peak_power_kw || 0;

    res.status(200).json({
      district_id: districtId,
      district_name: district.name,
      total_installations,
      current_power_kw: Number(rawCurrentPower.toFixed(2)),
      total_energy_kwh: Number(rawTotalEnergy.toFixed(2)),
      peak_power_kw: Number(rawPeakPower.toFixed(2))
    });
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
  }
});

// 8. GET /substations/:id/installations (Scoped sub-collection)
router.get('/substations/:id/installations', authorizeJurisdiction('substation'), async (req, res) => {
  try {
    const substationId = Number(req.params.id);
    const substation = await GridSubstation.findOne({ id: substationId });
    if (!substation) {
      return res.status(404).json(notFoundError('Substation not found'));
    }
    const installations = await SolarInstallation.find({ substation_id: substationId }, { _id: 0, __v: 0, api_key: 0 });
    res.status(200).json(installations);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
  }
});

module.exports = router;
