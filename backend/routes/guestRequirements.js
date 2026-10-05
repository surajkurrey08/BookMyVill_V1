const router = require('express').Router();
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const Request = require('../models/GuestRequest');
const { propertyScope, requirePropertyAccess } = require('../services/propertyAccess');
const { createWithCode } = require('../services/refCode');
const { validId, cleanText, HttpError, sendError } = require('../utils/validate');
router.use(require('../middleware/ownerAuth'));
const legacyOperation = require('../middleware/legacyOwnerOperation')();
const run = fn => async(req,res) => { try { await fn(req,res); } catch(err) { sendError(res,err,'Guest requirements'); } };
async function view(booking) {
 const requests = await Request.find({ booking: booking._id, status: { $in: Request.OPEN_STATUSES } }).sort({ createdAt: 1 }).lean();
 return { id: booking._id, guestName: booking.guest?.name || booking.user?.name || 'Guest', rooms: booking.room?.name || '', checkIn: booking.checkIn, phone: booking.guest?.phone || booking.user?.phone || '', requests: requests.map(r => r.description) };
}
router.get('/owner',run(async(req,res) => {
 const ids=await Property.find(propertyScope(req.user,'report')).distinct('_id');
 const bookings=await Booking.find({ property: { $in: ids }, status: 'confirmed', stayStatus: { $ne:'checked_out' } }).populate('room','name').populate('user','name phone').limit(100);
 res.json(await Promise.all(bookings.map(view)));
}));
router.get('/caretaker',(req,res) => res.status(403).json({ msg:'Use property-scoped operations with an authorized account.' }));
async function owned(req) {
 if(!validId(req.params.guestId)) throw new HttpError(404,'Guest booking not found.');
 const booking=await Booking.findById(req.params.guestId).populate('room','name').populate('user','name phone');
 if(!booking) throw new HttpError(404,'Guest booking not found.');
 const property=await requirePropertyAccess(req.user,booking.property);
 return { booking,property };
}
router.post('/:guestId/requests',legacyOperation,run(async(req,res) => {
 const { booking,property }=await owned(req); const label=cleanText(req.body.label,1000);
 if(!label || booking.status !== 'confirmed' || booking.stayStatus === 'checked_out') throw new HttpError(400,'Choose an active booking and valid requirement.');
 await createWithCode(Request,'REQ',{ booking:booking._id, property:property._id, owner:property.owner, customer:booking.user?._id || null, guestName:booking.guest?.name || booking.user?.name || '',kind:'request',category:'other',description:label,updates:[{status:'open',byRole:'owner'}] });
 res.json(await view(booking));
}));
router.delete('/:guestId/requests/:idx',legacyOperation,run(async(req,res) => {
 const {booking}=await owned(req);const index=Number(req.params.idx);
 if(!Number.isInteger(index)||index<0) throw new HttpError(400,'Invalid requirement.');
 const requests=await Request.find({ booking:booking._id,status:{$in:Request.OPEN_STATUSES}}).sort({createdAt:1});const item=requests[index];
 if(!item)throw new HttpError(404,'Requirement not found.');
 await Request.updateOne({_id:item._id,status:item.status},{$set:{status:'cancelled',resolvedAt:new Date()},$push:{updates:{status:'cancelled',byRole:'owner',note:'Cancelled by operations'}}});res.json(await view(booking));
}));
module.exports=router;
