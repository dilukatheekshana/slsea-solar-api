const express = require('express');
const router = express.Router();
const { Province, District, GridSubstation, SolarInstallation } = require('../models');

// Standard error helper
const notFoundError = (message) => ({
  error: {
    code: 'RESOURCE_NOT_FOUND',
    message
  }
});

// 1. GET /provinces
router.get('/provinces', async (req, res) => {
  try {
    const provinces = await Province.find({}, { _id: 0, __v: 0 });
    res.status(200).json(provinces);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
  }
});

// 2. GET /provinces/:id
router.get('/provinces/:id', async (req, res) => {
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
router.get('/provinces/:id/districts', async (req, res) => {
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
router.get('/districts', async (req, res) => {
  try {
    const districts = await District.find({}, { _id: 0, __v: 0 });
    res.status(200).json(districts);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
  }
});

// 5. GET /districts/:id
router.get('/districts/:id', async (req, res) => {
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
router.get('/districts/:id/substations', async (req, res) => {
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

// 7. GET /substations/:id/installations (Scoped sub-collection)
router.get('/substations/:id/installations', async (req, res) => {
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
