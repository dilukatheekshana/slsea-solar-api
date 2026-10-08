const { User, Province, District, GridSubstation, SolarInstallation, GenerationReading } = require('../models');

function authorizeJurisdiction(resourceType) {
  return async (req, res, next) => {
    try {
      let rawToken = req.headers['x-user-id'] || req.headers['x-user-id'.toLowerCase()];

      // Check Authorization header (e.g. Bearer 1 or Bearer national_admin)
      const authHeader = req.headers['authorization'] || req.headers['authorization'.toLowerCase()];
      if (!rawToken && authHeader) {
        if (authHeader.startsWith('Bearer ')) {
          rawToken = authHeader.substring(7).trim();
        } else {
          rawToken = authHeader.trim();
        }
      }

      // Check Query Parameter fallback (e.g. ?user_id=1 or ?username=national_admin)
      if (!rawToken && req.query) {
        rawToken = req.query.user_id || req.query.userId || req.query.username;
      }

      // Require authentication
      if (!rawToken) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please provide X-User-ID or Authorization: Bearer header.'
          }
        });
      }

      // Identify user by numeric id OR string username
      const numericId = Number(rawToken);
      const userQuery = !isNaN(numericId)
        ? { $or: [{ id: numericId }, { username: String(rawToken) }] }
        : { username: String(rawToken) };

      const user = await User.findOne(userQuery);
      if (!user) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: `Invalid user identification: '${rawToken}'`
          }
        });
      }

      // 1. National role has unrestricted access
      if (user.role === 'national') {
        return next();
      }

      // If endpoint doesn't target a specific resource ID (e.g. GET /provinces, GET /districts, GET /installations)
      if (!req.params.id) {
        if (user.role === 'district' && resourceType === 'province') {
          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Access denied: resource outside district jurisdiction'
            }
          });
        }
        return next();
      }

      const targetId = Number(req.params.id);

      // 2. Provincial role evaluation
      if (user.role === 'provincial') {
        const forbiddenMsg = 'Access denied: resource outside provincial jurisdiction';

        if (resourceType === 'province') {
          if (targetId !== user.jurisdiction_id) {
            return res.status(403).json({
              error: {
                code: 'FORBIDDEN',
                message: forbiddenMsg
              }
            });
          }
        } else if (resourceType === 'district') {
          const district = await District.findOne({ id: targetId });
          if (district && district.province_id !== user.jurisdiction_id) {
            return res.status(403).json({
              error: {
                code: 'FORBIDDEN',
                message: forbiddenMsg
              }
            });
          }
        } else if (resourceType === 'substation') {
          const substation = await GridSubstation.findOne({ id: targetId });
          if (substation) {
            const district = await District.findOne({ id: substation.district_id });
            if (district && district.province_id !== user.jurisdiction_id) {
              return res.status(403).json({
                error: {
                  code: 'FORBIDDEN',
                  message: forbiddenMsg
                }
              });
            }
          }
        } else if (resourceType === 'installation') {
          const installation = await SolarInstallation.findOne({ id: targetId, is_deleted: { $ne: true } });
          if (installation) {
            const substation = await GridSubstation.findOne({ id: installation.substation_id });
            if (substation) {
              const district = await District.findOne({ id: substation.district_id });
              if (district && district.province_id !== user.jurisdiction_id) {
                return res.status(403).json({
                  error: {
                    code: 'FORBIDDEN',
                    message: forbiddenMsg
                  }
                });
              }
            }
          }
        } else if (resourceType === 'reading') {
          const reading = await GenerationReading.findOne({ id: targetId });
          if (reading) {
            const installation = await SolarInstallation.findOne({ id: reading.installation_id, is_deleted: { $ne: true } });
            if (installation) {
              const substation = await GridSubstation.findOne({ id: installation.substation_id });
              if (substation) {
                const district = await District.findOne({ id: substation.district_id });
                if (district && district.province_id !== user.jurisdiction_id) {
                  return res.status(403).json({
                    error: {
                      code: 'FORBIDDEN',
                      message: forbiddenMsg
                    }
                  });
                }
              }
            }
          }
        }
        return next();
      }

      // 3. District role evaluation
      if (user.role === 'district') {
        const forbiddenMsg = 'Access denied: resource outside district jurisdiction';

        if (resourceType === 'province') {
          // District operators have no province-level access
          return res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: forbiddenMsg
            }
          });
        } else if (resourceType === 'district') {
          if (targetId !== user.jurisdiction_id) {
            return res.status(403).json({
              error: {
                code: 'FORBIDDEN',
                message: forbiddenMsg
              }
            });
          }
        } else if (resourceType === 'substation') {
          const substation = await GridSubstation.findOne({ id: targetId });
          if (substation && substation.district_id !== user.jurisdiction_id) {
            return res.status(403).json({
              error: {
                code: 'FORBIDDEN',
                message: forbiddenMsg
              }
            });
          }
        } else if (resourceType === 'installation') {
          const installation = await SolarInstallation.findOne({ id: targetId, is_deleted: { $ne: true } });
          if (installation) {
            const substation = await GridSubstation.findOne({ id: installation.substation_id });
            if (substation && substation.district_id !== user.jurisdiction_id) {
              return res.status(403).json({
                error: {
                  code: 'FORBIDDEN',
                  message: forbiddenMsg
                }
              });
            }
          }
        } else if (resourceType === 'reading') {
          const reading = await GenerationReading.findOne({ id: targetId });
          if (reading) {
            const installation = await SolarInstallation.findOne({ id: reading.installation_id, is_deleted: { $ne: true } });
            if (installation) {
              const substation = await GridSubstation.findOne({ id: installation.substation_id });
              if (substation && substation.district_id !== user.jurisdiction_id) {
                return res.status(403).json({
                  error: {
                    code: 'FORBIDDEN',
                    message: forbiddenMsg
                  }
                });
              }
            }
          }
        }
        return next();
      }

      return next();
    } catch (error) {
      return res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        }
      });
    }
  };
}

module.exports = {
  authorizeJurisdiction
};
