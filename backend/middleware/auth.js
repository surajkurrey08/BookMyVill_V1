const accountAuth = require('./accountAuth');

// Legacy endpoints have no property-assignment scope. Keep their original
// account roles; new internal staff must use the scoped property APIs.
// Reuse verified authentication so JWT/body role claims cannot grant access.
module.exports = function auth(req, res, next) {
  return accountAuth(req, res, () => {
    if (!['user', 'owner', 'admin'].includes(req.user.role)) return res.status(403).json({ msg: 'Use the assigned-property APIs for this staff account.' });
    next();
  });
};
