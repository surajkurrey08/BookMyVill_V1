const accountAuth = require('./accountAuth');

module.exports = function ownerAuth(req, res, next) {
  return accountAuth(req, res, () => {
    if (req.user.role !== 'owner') return res.status(403).json({ msg: 'Property owner access required.' });
    next();
  });
};
