const Room = require('../models/Room');
const Staff = require('../models/StaffMember');
const { requirePropertyAccess } = require('./propertyAccess');
const { validId, HttpError, cleanText } = require('../utils/validate');
async function staffId(id, property) {
  if (!id) return null;
  const staff = validId(id) && await Staff.findOne({ _id: id, property, active: true });
  if (!staff) throw new HttpError(400, 'Choose active staff belonging to this property.');
  return staff._id;
}
async function roomId(id, property) {
  if (!id) return null;
  const room = validId(id) && await Room.findOne({ _id: id, property });
  if (!room) throw new HttpError(400, 'Choose a room belonging to this property.');
  return room._id;
}
function text(value, max, required = false) {
  const result = cleanText(value, max);
  if (result === null || (required && !result)) throw new HttpError(400, `Enter valid text under ${max} characters.`);
  return result;
}
function photos(values) {
  if (!Array.isArray(values) || values.length > 3 || values.some(p => typeof p !== 'string' || p.length > 2000000 || !/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(p))) throw new HttpError(400, 'Add up to three JPG, PNG or WebP photos under 1.4 MB each.');
  return values;
}
async function findScoped(Model, req, id, propertyKey = 'property') {
  if (!validId(id)) throw new HttpError(404, 'Record not found.');
  const record = await Model.findById(id);
  if (!record) throw new HttpError(404, 'Record not found.');
  await requirePropertyAccess(req.user, String(record[propertyKey]));
  return record;
}


module.exports = { staffId, roomId, text, photos, findScoped };
