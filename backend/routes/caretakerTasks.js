const router=require('express').Router();
const Property=require('../models/Property');
const Task=require('../models/OperationalTask');
const {propertyScope,requirePropertyAccess}=require('../services/propertyAccess');
const {validId,cleanText,indiaDate,HttpError,sendError}=require('../utils/validate');
router.use(require('../middleware/ownerAuth'));
const legacyOperation=require('../middleware/legacyOwnerOperation')();
const run=fn=>async(req,res)=>{try{await fn(req,res)}catch(err){sendError(res,err,'Operational tasks')}};
const view=t=>({id:t._id,title:t.title,category:t.category,time:t.dueDate,priority:t.priority==='high'?'High':'Medium',completed:['resolved','verified'].includes(t.status),propertyId:t.property});
router.get('/owner',run(async(req,res)=>{const ids=await Property.find(propertyScope(req.user,'report')).distinct('_id');res.json((await Task.find({property:{$in:ids},kind:'task',archived:{$ne:true}}).sort({createdAt:-1})).map(view));}));
router.get('/caretaker',(req,res)=>res.status(403).json({msg:'Use property-scoped operations with an authorized account.'}));
router.post('/',legacyOperation,run(async(req,res)=>{
 let id=req.body.propertyId;if(!id){const properties=await Property.find(propertyScope(req.user));if(properties.length!==1)throw new HttpError(400,'Choose a saved self-managed property.');id=properties[0]._id;}
 const property=await requirePropertyAccess(req.user,id),title=cleanText(req.body.title,120);if(!title)throw new HttpError(400,'Enter a task title.');
 const task=await Task.create({property:property._id,kind:'task',title,category:cleanText(req.body.category||'other',50)||'other',dueDate:indiaDate(),priority:req.body.priority==='High'?'high':'normal',createdBy:req.user.id,history:[{status:'open',by:req.user.id}]});res.status(201).json(view(task));
}));
async function owned(req){if(!validId(req.params.id))throw new HttpError(404,'Task not found.');const task=await Task.findOne({_id:req.params.id,kind:'task',archived:{$ne:true}});if(!task)throw new HttpError(404,'Task not found.');await requirePropertyAccess(req.user,task.property);return task;}
router.delete('/:id',legacyOperation,run(async(req,res)=>{const task=await owned(req);await Task.updateOne({_id:task._id},{$set:{archived:true},$push:{history:{status:task.status,by:req.user.id,note:'Archived by Owner'}}});res.json({msg:'Task archived.'});}));
router.put('/:id/toggle',legacyOperation,run(async(req,res)=>{const task=await owned(req);const status=task.status==='verified'?'open':'verified';const updated=await Task.findOneAndUpdate({_id:task._id,status:task.status},{$set:{status},$push:{history:{status,by:req.user.id}}},{new:true});if(!updated)throw new HttpError(409,'Task changed. Refresh.');res.json(view(updated));}));
module.exports=router;
