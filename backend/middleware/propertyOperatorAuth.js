const accountAuth = require('./accountAuth');

// Reuse operational routes for assigned managers; propertyAccess still scopes
// every property/resource. Data-entry accounts never enter these routers.
module.exports = function propertyOperatorAuth(req, res, next) {
  return accountAuth(req, res, () => {
    if (!['owner', 'villa_manager'].includes(req.user.role)) return res.status(403).json({ msg: 'Property operator access required.' });
    if (req.user.role === 'villa_manager' && !['active','approved'].includes(req.user.status)) return res.status(403).json({ msg: 'An active Villa Manager account is required.' });
    next();
  });
};
