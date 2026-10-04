const { User, Province, District, GridSubstation, SolarInstallation } = require('../models');

function authorizeJurisdiction(resourceType) {
  return async (req, res, next) => {
    try {
      const userId = req.headers['x-user-id'];

      // Unauthenticated requests pass through
      if (!userId) {
        return next();
      }

      // Identify user
      const user = await User.findOne({ id: Number(userId) });
      if (!user) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid user identification'
          }
        });
      }

      // 1. National role has unrestricted access
      if (user.role === 'national') {
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
          const installation = await SolarInstallation.findOne({ id: targetId });
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
          const installation = await SolarInstallation.findOne({ id: targetId });
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
