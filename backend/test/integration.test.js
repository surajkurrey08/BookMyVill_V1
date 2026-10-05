const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const RoomNight = require('../models/RoomNight');
const Hold = require('../models/CustomerHold');
const Housekeeping = require('../models/HousekeepingTask');
const Request = require('../models/GuestRequest');
const Task = require('../models/OperationalTask');
const Audit = require('../models/AdminAudit');
const gateway = require('../services/paymentGateway');
const { CHECKLIST } = require('../services/roomReadiness');
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
let admin, owner, customer, outsider, entry, entryB, manager, managerB, self, managed, originals, sequence = 0;
const orders = new Map();
const call = (method,path,token,body) => h.api(method,path,{token,body});
async function createStaff(role,label) {
 const result = await call('POST','/api/admin-console/staff-accounts',admin.token,{ name:label,email:label+'@example.com',password:'staff-password-123',role });
 assert.equal(result.status,201,JSON.stringify(result.data)); assert.equal(result.data.password,undefined);
 const login = await call('POST','/api/auth/login',null,{ email:result.data.email,password:'staff-password-123' }); assert.equal(login.status,200);
 return { user:result.data, token:login.data.token };
}
async function paid(villa,guest=customer,offset=0) {
 const held = await call('POST','/api/customer-booking/holds',guest.token,{ propertyId:villa.property.id,roomId:villa.room.id,checkIn:h.day(offset),checkOut:h.day(offset+1),guests:2 }); assert.equal(held.status,201,JSON.stringify(held.data));
 const payment = await call('POST','/api/customer-booking/holds/'+held.data.holdId+'/pay',guest.token,{guest:{name:'Test Traveler',phone:'9811111111',email:guest.user.email,idType:'Passport',idNumber:'AB123456'}});assert.equal(payment.status,200,JSON.stringify(payment.data));
 const body={razorpay_order_id:payment.data.order_id,razorpay_payment_id:'pay_'+payment.data.order_id.slice(6),razorpay_signature:'signed'};
 return { holdId:held.data.holdId,bookingId:payment.data.bookingId,body,verify:()=>call('POST','/api/customer-booking/holds/'+held.data.holdId+'/verify',guest.token,body) };
}
async function availability(villa,status,token) {
 const q='?start='+h.day()+'&end='+h.day(1);
 const publicRooms=await call('GET','/api/customer-booking/properties/'+villa.property.id+'/rooms?checkIn='+h.day()+'&checkOut='+h.day(1)+'&guests=2');assert.equal(publicRooms.data.rooms[0].status,status);
 const ownerCalendar=await call('GET','/api/owner-pms/properties/'+villa.property.id+'/availability'+q,owner.token);assert.equal(ownerCalendar.data.availability.rooms[0].days[0].status,status);
 const adminCalendar=await call('GET','/api/admin-console/properties/'+villa.property.id+'/availability'+q,admin.token);assert.equal(adminCalendar.data.rooms[0].days[0].status,status);
 if(token)assert.equal((await call('GET','/api/villa-manager/calendar/'+villa.property.id+q,token)).data.rooms[0].days[0].status,status);
}
test.before(async()=>{
 await h.start();admin=await h.createAdmin();owner=await h.createOwner('integration-owner');customer=await h.createCustomer('integration-customer');outsider=await h.createCustomer('integration-other');
 entry=await createStaff('data_entry','entry-one');entryB=await createStaff('data_entry','entry-two');manager=await createStaff('villa_manager','manager-one');managerB=await createStaff('villa_manager','manager-two');
 self=await h.createProperty(owner.user,{name:'Integration Self Villa'});managed=await h.createProperty(owner.user,{name:'Integration Managed Villa',managementMode:'BOOKMYVILLA_MANAGED',assignedVillaManager:manager.user._id,assignedDataEntryUser:entry.user._id,status:'pending'});
 originals=Object.fromEntries(['available','keyId','mode','createOrder','fetchPayment','validSignature'].map(k=>[k,gateway[k]]));
 gateway.available=()=>true;gateway.keyId=()=> 'rzp_test_integration';gateway.mode=()=> 'test';gateway.validSignature=(_,__,signature)=>signature==='signed';
 gateway.createOrder=async({amountPaise})=>{const id='order_integration'+(++sequence);orders.set(id,amountPaise);return{id,amount:amountPaise}};
 gateway.fetchPayment=async(id)=>{const order='order_'+id.slice(4);return {order_id:order,amount:orders.get(order),currency:'INR',status:'captured'}};
});
test.after(async()=>{Object.assign(gateway,originals);await h.stop()});

test('Admin creates both staff roles, enforces RBAC, hashes credentials, and suspends existing sessions',async()=>{
 const finance=await h.createAdmin('finance');
 assert.equal((await call('POST','/api/admin-console/staff-accounts',finance.token,{role:'data_entry'})).status,403);
 assert.equal((await call('POST','/api/admin-console/staff-accounts',admin.token,{name:'Escalate',email:'escalate@example.com',role:'admin',password:'staff-password-123'})).status,400);
 assert.equal((await call('POST','/api/admin-console/staff-accounts',admin.token,{name:'Duplicate',email:entry.user.email,role:'data_entry',password:'staff-password-123'})).status,409);
 const saved=await User.findById(entry.user._id);assert.notEqual(saved.password,'staff-password-123');
 assert.equal((await call('GET','/api/villa-manager/session',entry.token)).status,403);assert.equal((await call('GET','/api/properties/data-entry/session',manager.token)).status,403);
 assert.equal((await call('PATCH','/api/admin-console/staff-accounts/'+entryB.user._id,admin.token,{status:'suspended'})).status,200);
 assert.equal((await call('GET','/api/properties/data-entry/session',entryB.token)).status,403);
 assert.equal((await call('POST','/api/auth/login',null,{email:entryB.user.email,password:'staff-password-123'})).status,403);
 await call('PATCH','/api/admin-console/staff-accounts/'+entryB.user._id,admin.token,{status:'active'});
 await User.updateOne({_id:manager.user._id},{$set:{status:'restricted'}});
 assert.ok([403,404].includes((await call('PUT','/api/properties/'+managed.property.id,manager.token,{name:'Unauthorized change'})).status));
 assert.notEqual((await Property.findById(managed.property.id)).name,'Unauthorized change');
 await User.updateOne({_id:manager.user._id},{$set:{status:'active'}});
 assert.ok(await Audit.exists({action:'team.staff_created',entityId:manager.user._id}));
});

test('public APIs expose canonical approved properties only; account deletion, finance and IDOR are denied',async()=>{
 const app=await require('../models/PartnerApplication').create({fullName:'Application Owner',email:'application-only@example.com',phone:'9811111111',partnerType:'Property Owner',propertyName:'Application only',city:'Panchgani',status:'approved'});
 const all=await call('GET','/api/properties/all');assert.equal(all.data.some(p=>p._id===app.id),false);
 assert.equal((await call('GET','/api/properties/'+app.id)).status,404);
 const view=(await call('GET','/api/properties/'+self.property.id)).data;
 for(const key of ['owner','managementMode','assignedVillaManager','assignedDataEntryUser','listingData','listingDraft','stayInfo','assignedCaretaker'])assert.equal(Object.hasOwn(view,key),false,key);
 assert.equal((await call('DELETE','/api/auth/user/'+owner.user.id)).status,403);assert.ok(await User.exists({_id:owner.user.id}));
 for(const token of [customer.token,entry.token,manager.token])for(const path of ['/api/inventory/owner','/api/tourist-register/owner','/api/guest-requirements/owner','/api/caretaker-tasks/owner','/api/feedback/admin'])assert.equal((await call('GET',path,token)).status,403,path);
 assert.equal((await call('GET','/api/guest-requirements/caretaker')).status,401);
 assert.equal((await call('GET','/api/villa-manager/properties/'+self.property.id,manager.token)).status,404);
 assert.equal((await call('PUT','/api/properties/'+self.property.id,entry.token,{managementMode:'BOOKMYVILLA_MANAGED'})).status,403);
 assert.equal((await call('GET','/api/bookings/all',(await h.createAdmin('content')).token)).status,403);
});

test('Scenario B listing: assigned Data Entry completes draft, submits, Admin approves the same Property and Room',async()=>{
 const base='/api/properties/data-entry/'+managed.property.id;
 const first=await call('GET',base,entry.token);assert.equal(first.status,200);
 const draft={...first.data.draft,photos:[photo],photoCategories:['Exterior'],mapLink:'https://maps.google.com/?q=Mahabaleshwar',amenities:['Free High-Speed Wi-Fi'],details:{shortDescription:'Quiet private mountain villa.',description:'A spacious mountain villa with a private garden and comfortable rooms.',address:'Hill Road 12',city:'Mahabaleshwar',state:'Maharashtra',pincode:'412806',guestCapacity:8,bedrooms:3,bathrooms:3,checkInTime:'14:00',checkOutTime:'11:00',petPolicy:'Pets on request.',smokingPolicy:'Outside only.',partyPolicy:'No parties.',childPolicy:'Children welcome.'}};
 const saved=await call('PUT',base,entry.token,{revision:first.data.revision,draft});assert.equal(saved.status,200,JSON.stringify(saved.data));
 assert.equal((await call('POST',base+'/submit',entry.token,{revision:saved.data.revision})).status,200);
 assert.equal((await call('POST','/api/admin-console/properties/'+managed.property.id+'/review',admin.token,{action:'approve'})).status,200);
 assert.equal(await Property.countDocuments({_id:managed.property.id}),1);assert.ok(await require('../models/Room').exists({_id:managed.room.id}));
 assert.equal((await call('GET','/api/properties/'+managed.property.id)).status,200);
});

for(const [scenario,villa,operatingToken] of [['A',()=>self,()=>owner.token],['B',()=>managed,()=>manager.token]])test('Scenario '+scenario+': room hold/payment/arrival/request/check-in/checkout and strict readiness across all panels',async()=>{
 const v=villa(),operator=operatingToken(),payment=await paid(v);
 assert.equal((await payment.verify()).status,200);assert.equal((await payment.verify()).status,200);
 assert.equal(await RoomNight.countDocuments({reference:payment.bookingId,kind:'booking'}),1);
 assert.equal((await call('GET','/api/customer-booking/bookings/'+payment.bookingId+'/confirmation',outsider.token)).status,404);
 const confirmation=await call('GET','/api/customer-booking/bookings/'+payment.bookingId+'/confirmation',customer.token);assert.equal(confirmation.status,200);assert.equal(confirmation.data.booking.actionHistory,undefined);assert.equal(confirmation.data.booking.property.owner,undefined);
 const arrival=await call('POST','/api/customer-booking/bookings/'+payment.bookingId+'/precheckin',customer.token,{arrivalTime:'14:30',additionalGuests:['Second Guest'],idProof:photo});assert.equal(arrival.status,200);
 const request=await call('POST','/api/stay/requests',customer.token,{bookingId:payment.bookingId,kind:'request',category:'towels',description:'Please send two towels.'});assert.equal(request.status,201);
 const issue=await call('POST','/api/stay/requests',customer.token,{bookingId:payment.bookingId,kind:'issue',category:'cleaning',description:'Please clean the balcony.'});assert.equal(issue.status,201);
 const queue=await call('GET','/api/owner-ops/guest-requests/'+v.property.id,operator);assert.ok(queue.data.requests.some(r=>r._id===request.data._id));
 assert.equal((await call('GET','/api/admin-console/operations-issues',admin.token)).data.some(r=>r._id===issue.data._id),false);
 const notifications=await call('GET','/api/owner-ops/notifications?propertyId='+v.property.id,operator);assert.ok(notifications.data.bookings.some(b=>b._id===payment.bookingId));assert.equal(notifications.data.bookings.find(b=>b._id===payment.bookingId).guestDetails.arrivalTime,'14:30');
 await call('PATCH','/api/owner-ops/guest-request/'+issue.data._id,operator,{status:'acknowledged',escalated:true});assert.ok((await call('GET','/api/admin-console/operations-issues',admin.token)).data.some(r=>r._id===issue.data._id));
 if(scenario==='B'){
  assert.equal((await call('POST','/api/owner-ops/bookings/'+payment.bookingId+'/check-in',owner.token,{})).status,403);
  assert.ok((await call('GET','/api/bookings/owner',owner.token)).data.some(b=>b._id===payment.bookingId));
  assert.equal((await call('PATCH','/api/villa-manager/bookings/'+payment.bookingId+'/details',operator,{idVerified:true,depositReceived:true})).status,200);
 }
 assert.equal((await call('POST','/api/owner-ops/bookings/'+payment.bookingId+'/check-in',operator,{})).status,200);
 await availability(v,'in_house',scenario==='B'?operator:null);
 const checkout=await call('POST','/api/owner-ops/bookings/'+payment.bookingId+'/check-out',operator,{});assert.equal(checkout.status,200);
 assert.equal((await call('POST','/api/owner-ops/bookings/'+payment.bookingId+'/check-out',operator,{})).status,409);
 assert.equal(await Housekeeping.countDocuments({dedupeKey:'checkout:'+payment.bookingId}),1);
 const taskId=checkout.data.task._id,path='/api/owner-ops/housekeeping-task/'+taskId;
 assert.equal((await call('PATCH',path,operator,{stage:'ready',checklist:CHECKLIST})).status,409);
 await availability(v,'dirty',scenario==='B'?operator:null);
 for(const stage of ['cleaning','inspection','ready']){assert.equal((await call('PATCH',path,operator,{stage,checklist:stage==='ready'?CHECKLIST:[]})).status,200);await availability(v,stage==='ready'?'booked':stage,scenario==='B'?operator:null);}
 assert.equal((await call('POST','/api/customer-booking/bookings/'+payment.bookingId+'/precheckin',customer.token,{arrivalTime:'15:00'})).status,409);
 const next=await call('GET','/api/customer-booking/properties/'+v.property.id+'/rooms?checkIn='+h.day(1)+'&checkOut='+h.day(2)+'&guests=2');assert.equal(next.data.rooms[0].status,'available');
});

test('Scenario C/D: mixed owner permissions, future booking/payment preserved, assignment transfer reroutes open work without clones',async()=>{
 const v=await h.createProperty(owner.user,{name:'Transfer Villa'});const payment=await paid(v,customer,5);assert.equal((await payment.verify()).status,200);
 const issue=await call('POST','/api/stay/requests',customer.token,{bookingId:payment.bookingId,kind:'issue',category:'ac',description:'AC remote needs replacement.'});
 const before=await Booking.findById(payment.bookingId).lean();
 const management='/api/admin-console/properties/'+v.property.id+'/management';
 assert.equal((await call('PATCH',management,admin.token,{managementMode:'BOOKMYVILLA_MANAGED',assignedVillaManager:manager.user._id,assignedDataEntryUser:entry.user._id})).status,200);
 assert.equal((await call('PUT','/api/properties/'+v.property.id,owner.token,{price:1})).status,403);
 assert.equal((await call('GET','/api/villa-manager/bookings/'+payment.bookingId,manager.token)).status,200);
 assert.equal((await call('GET','/api/owner-ops/notifications?propertyId='+v.property.id,owner.token)).status,403);
 assert.equal((await call('PATCH',management,admin.token,{assignedVillaManager:managerB.user._id,assignedDataEntryUser:entryB.user._id})).status,200);
 assert.equal((await call('GET','/api/villa-manager/bookings/'+payment.bookingId,manager.token)).status,404);
 assert.equal((await call('GET','/api/properties/data-entry/'+v.property.id,entry.token)).status,404);
 assert.equal((await call('GET','/api/properties/data-entry/'+v.property.id,entryB.token)).status,200);
 assert.ok((await call('GET','/api/owner-ops/notifications?propertyId='+v.property.id,managerB.token)).data.requests.some(r=>r._id===issue.data._id));
 await Booking.updateOne({_id:payment.bookingId},{$set:{stayStatus:'in_house'}});
 assert.equal((await call('PATCH',management,admin.token,{managementMode:'SELF_MANAGED'})).status,409);
 await Booking.updateOne({_id:payment.bookingId},{$set:{stayStatus:'expected'}});
 assert.equal((await call('PATCH',management,admin.token,{managementMode:'SELF_MANAGED'})).status,200);
 assert.equal((await call('GET','/api/villa-manager/bookings/'+payment.bookingId,managerB.token)).status,404);
 const after=await Booking.findById(payment.bookingId).lean();assert.equal(after.razorpayPaymentId,before.razorpayPaymentId);assert.equal(after.totalPrice,before.totalPrice);assert.equal(after.actionHistory.length,before.actionHistory.length);assert.equal(await Booking.countDocuments({_id:payment.bookingId}),1);assert.equal(await Request.countDocuments({_id:issue.data._id}),1);assert.equal(String((await Property.findById(v.property.id)).owner),owner.user.id);
 assert.ok((await call('GET','/api/owner-ops/notifications?propertyId='+v.property.id,owner.token)).data.requests.some(r=>r._id===issue.data._id));
 const draft=(await call('GET','/api/properties/data-entry/'+v.property.id,entryB.token)).data;assert.equal(draft.draft.name,v.property.name);
});

test('unassigned managed work stays in Admin fallback; shared maintenance/damage records enforce sellability and property/finance scope',async()=>{
 const v=await h.createProperty(owner.user,{name:'Unassigned Villa',managementMode:'BOOKMYVILLA_MANAGED'});
 const booking=await h.createBooking(customer.user,v.property,{room:v.room._id});
 const req=await call('POST','/api/stay/requests',customer.token,{bookingId:booking.id,kind:'request',category:'water',description:'Please bring water.'});assert.equal(req.status,201);
 const fallback=await call('GET','/api/admin-console/unassigned-operations',admin.token);assert.ok(fallback.data.requests.some(r=>r._id===req.data._id));
 assert.equal((await call('GET','/api/owner-ops/guest-requests/'+v.property.id,manager.token)).status,404);
 const task=await call('POST','/api/owner-ops/tasks',owner.token,{propertyId:self.property.id,roomId:self.room.id,kind:'maintenance',severity:'maintenance',title:'AC failure',dueDate:h.day(),photos:[photo]});assert.equal(task.status,201,JSON.stringify(task.data));await availability(self,'maintenance');
 assert.equal((await call('PATCH','/api/owner-ops/tasks/'+task.data._id,manager.token,{status:'in_progress'})).status,404);
 for(const status of ['in_progress','resolved','verified'])assert.equal((await call('PATCH','/api/owner-ops/tasks/'+task.data._id,owner.token,{status})).status,200);
 const damage=await call('POST','/api/owner-ops/tasks',owner.token,{propertyId:self.property.id,roomId:self.room.id,kind:'damage',title:'Broken lamp',category:'Lamp',notes:'Broken during stay',estimatedAmount:1200,dueDate:h.day(),photos:[photo]});assert.equal(damage.status,201);
 const saved=await Task.findById(damage.data._id);assert.equal(saved.estimatedAmount,1200);assert.equal(String(saved.createdBy),owner.user.id);assert.equal(saved.photos.length,1);
 assert.equal((await call('POST','/api/owner-ops/tasks',entry.token,{propertyId:self.property.id,kind:'damage'})).status,403);
 assert.equal((await call('POST','/api/villa-manager/tasks',manager.token,{propertyId:managed.property.id,roomId:self.room.id,kind:'maintenance',severity:'maintenance',title:'Wrong room',dueDate:h.day()})).status,400);
});

test('expired holds, late captured payment after cancellation/conflict and concurrent verification never double-book or auto-confirm on reads',async()=>{
 const v=await h.createProperty(owner.user,{name:'Late payment Villa'});
 const cancelled=await paid(v,customer,7);assert.equal((await call('POST','/api/bookings/cancel/'+cancelled.bookingId,customer.token,{})).status,200);assert.equal((await cancelled.verify()).status,409);let b=await Booking.findById(cancelled.bookingId);assert.equal(b.status,'cancelled');assert.equal(b.paymentStatus,'paid');assert.equal(await RoomNight.countDocuments({reference:b._id}),0);
 const expired=await paid(v,customer,9);await Hold.updateOne({_id:expired.holdId},{$set:{expiresAt:new Date(0)}});await RoomNight.updateMany({reference:expired.holdId},{$set:{expiresAt:new Date(0)}});
 const winner=await paid(v,outsider,9);assert.equal((await winner.verify()).status,200);assert.equal((await expired.verify()).status,409);
 await call('GET','/api/bookings/my-bookings',customer.token);await call('GET','/api/bookings/owner',owner.token);b=await Booking.findById(expired.bookingId);assert.equal(b.status,'pending');assert.equal(b.paymentStatus,'paid');assert.equal(await RoomNight.countDocuments({room:v.room.id,date:h.day(9),kind:'booking'}),1);
 const race=await paid(v,customer,12);const responses=await Promise.all([race.verify(),race.verify()]);assert.ok(responses.some(r=>r.status===200));assert.ok(responses.every(r=>[200,409].includes(r.status)));assert.equal(await RoomNight.countDocuments({reference:race.bookingId,kind:'booking'}),1);assert.equal((await Booking.findById(race.bookingId)).status,'confirmed');assert.equal((await race.verify()).status,200);
 const pending=await h.createBooking(customer.user,v.property,{status:'pending',paymentStatus:'pending',room:null});assert.equal((await call('PUT','/api/bookings/status/'+pending.id,owner.token,{status:'confirmed'})).status,409);
});

test('CORS permits five development ports and configured production origins while rejecting other origins',()=>{
 const {allowedOrigin}=require('../services/cors');for(let port=5173;port<=5177;port++)assert.equal(allowedOrigin('http://localhost:'+port),true);
 for(const host of ['dataentry','villamanage'])assert.equal(allowedOrigin(`https://${host}.bookmyvilla.online`),true);
 assert.equal(allowedOrigin('https://bookmyvilla.online'),true);assert.equal(allowedOrigin('https://attacker.example'),false);assert.equal(allowedOrigin('http://localhost:9000'),false);assert.equal(allowedOrigin('http://localhost:5173/path'),false);
});


test('concurrent Owner check-ins allow one active stay per room; manual confirmation requires reserved inventory',async()=>{
 const v=await h.createProperty(owner.user,{name:'Concurrent checkin Villa'});
 const first=await h.createBooking(customer.user,v.property,{room:v.room.id,checkIn:new Date(h.day()+'T00:00:00Z'),checkOut:new Date(h.day(1)+'T00:00:00Z')});
 const second=await h.createBooking(outsider.user,v.property,{room:v.room.id,checkIn:first.checkIn,checkOut:first.checkOut});
 const results=await Promise.all([first,second].map(b=>call('POST','/api/owner-ops/bookings/'+b.id+'/check-in',owner.token,{})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(await Booking.countDocuments({room:v.room.id,stayStatus:'in_house'}),1);
 const p=await h.createProperty(owner.user,{name:'Manual confirmation Villa'});const unpaid=await h.createBooking(customer.user,p.property,{room:p.room.id,paymentStatus:'pending',status:'pending'});
 const route='/api/owner-finance/bookings/'+unpaid.id+'/manual-payment',body={method:'cash',amount:unpaid.totalPrice};
 assert.equal((await call('POST',route,owner.token,body)).status,409);
 await require('../services/inventory').reserveNights(p.room,[h.day(2),h.day(3)],'booking',unpaid._id);
 assert.equal((await call('POST',route,owner.token,body)).status,200);assert.equal((await Booking.findById(unpaid.id)).status,'confirmed');
});
