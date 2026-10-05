const router=require('express').Router();
const Feedback=require('../models/Feedback');
const Property=require('../models/Property');
const Booking=require('../models/Booking');
const {adminConsoleAuth,requirePermission}=require('../middleware/adminConsoleAuth');
const {validId,cleanText,HttpError,sendError}=require('../utils/validate');
const run=fn=>async(req,res)=>{try{await fn(req,res)}catch(err){sendError(res,err,'Guest feedback')}};
router.get('/owner',require('../middleware/ownerAuth'),run(async(req,res)=>{const ids=await Property.find({owner:req.user.id}).distinct('_id');res.json(await Feedback.find({propertyId:{$in:ids}}).sort({createdAt:-1}));}));
router.get('/admin',adminConsoleAuth,requirePermission('customers.view'),run(async(req,res)=>res.json(await Feedback.find().sort({createdAt:-1}))));
router.get('/property/:propertyId',run(async(req,res)=>{
 if(!validId(req.params.propertyId)||!await Property.exists({_id:req.params.propertyId,status:'approved'}))throw new HttpError(404,'Published property not found.');
 res.json(await Feedback.find({propertyId:req.params.propertyId,selectedForHotelPage:true}).select('_id guestName rating reviewText facilitiesUsed createdAt').sort({createdAt:-1}));
}));
const operation=require('../middleware/legacyOwnerOperation')(Feedback);
router.put('/:id/toggle-select',require('../middleware/ownerAuth'),operation,run(async(req,res)=>{const fb=await Feedback.findById(req.params.id);if(!fb)throw new HttpError(404,'Feedback not found.');fb.selectedForHotelPage=!fb.selectedForHotelPage;await fb.save();res.json(fb);}));
router.delete('/:id',require('../middleware/ownerAuth'),operation,run(async(req,res)=>{await Feedback.findByIdAndDelete(req.params.id);res.json({msg:'Feedback removed.'});}));
router.post('/',require('../middleware/accountAuth'),run(async(req,res)=>{
 if(req.user.role!=='user')throw new HttpError(403,'Customer account required.');
 const id=req.body.propertyId;if(!validId(id))throw new HttpError(400,'Choose a property.');
 const booking=await Booking.findOne({user:req.user.id,property:id,status:'confirmed',paymentStatus:'paid',stayStatus:'checked_out'}).populate('property','name owner');
 if(!booking)throw new HttpError(403,'Only your completed paid stay can be reviewed.');
 const rating=Number(req.body.rating),reviewText=cleanText(req.body.reviewText,1000);
 if(!Number.isInteger(rating)||rating<1||rating>5||!reviewText)throw new HttpError(400,'Enter a rating and review.');
 const user=await require('../models/User').findById(req.user.id).select('name phone');
 const fb=await Feedback.create({propertyId:id,propertyName:booking.property.name,ownerId:booking.property.owner,guestName:booking.guest?.name||user.name,guestPhone:booking.guest?.phone||user.phone,rating,reviewText,facilitiesUsed:Array.isArray(req.body.facilitiesUsed)?req.body.facilitiesUsed.filter(s=>typeof s==='string').map(s=>s.slice(0,100)).slice(0,20):[],selectedForHotelPage:false});res.status(201).json({ _id:fb._id,rating:fb.rating,reviewText:fb.reviewText });
}));
module.exports=router;
