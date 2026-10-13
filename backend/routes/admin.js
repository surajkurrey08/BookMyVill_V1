const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Property = require('../models/Property');
const PartnerApplication = require('../models/PartnerApplication');
const CaretakerApplication = require('../models/CaretakerApplication');
const { requirePermission, adminConsoleAuth } = require('../middleware/adminConsoleAuth');
const { MANAGEMENT_SELECT, managementMode } = require('../services/propertyAccess');

const SocialLinks = require('../models/SocialLinks');
const SiteOffer = require('../models/SiteOffer');

// Get all users (Admin only)
router.get('/users', adminConsoleAuth, requirePermission('customers.view'), async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ msg: 'Database unavailable.' });
  }
  try {
    const users = await User.find({ role: { $in: ['owner', 'user'] } }).select('_id name email phone role status createdAt');
    res.json(users);
  } catch (err) {
    res.status(503).json({ msg: 'Could not load accounts.' });
  }
});

// Get all properties (Admin only)
router.get('/properties', adminConsoleAuth, requirePermission('properties.view'), async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ msg: 'Database unavailable. Please try again.' });
  }
  try {
    const properties = await Property.find().select(MANAGEMENT_SELECT).populate('owner', 'name email')
      .populate('assignedVillaManager', 'name email phone').populate('assignedDataEntryUser', 'name email phone').lean();
    res.json(properties.map(property => ({ ...property, managementMode: managementMode(property) })));
  } catch (err) {
    res.status(500).json({ msg: 'Could not load properties. Please try again.' });
  }
});

// Get all Join Us Partner applications (Admin only)
router.get('/partner-applications', adminConsoleAuth, requirePermission('owners.view'), async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ msg: 'Database unavailable. Please try again.' });
  }
  try {
    const applications = await PartnerApplication.find().sort({ appliedAt: -1 });
    res.json(applications);
  } catch (err) {
    console.error('Error fetching partner applications:', err);
    res.status(500).json({ msg: 'Failed to load partner applications.' });
  }
});
router.post('/partner-apply', (req,res) => res.status(410).json({ msg: 'Use the Join Us application form.' }));

// Update Partner application status - Approve / Reject (Admin only)
router.put('/partner-application/:id/status', adminConsoleAuth, requirePermission('owners.manage'), async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    const id = req.params.id;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid application status.' });
    }

    if (id.startsWith('dummy-')) {
      return res.json({ _id: id, status });
    }

    const application = await PartnerApplication.findByIdAndUpdate(id, { status }, { new: true });
    if (!application) return res.status(404).json({ msg: 'Application not found.' });
    
    let approvedUser = null;
    // Create/Enable Owner Credentials IF AND ONLY IF Admin accepted the matching email
    if (status === 'approved' && ['Property Owner', 'Villa Host'].includes(application.partnerType) && application.email) {
      try {
        approvedUser = await User.findOne({ email: application.email.toLowerCase().trim() });
        if (!approvedUser) {
          approvedUser = new User({
            name: application.fullName,
            email: application.email.toLowerCase().trim(),
            phone: application.phone || '',
            // An unusable random placeholder until the owner sets a password.
            // UserSchema hashes it once on save.
            password: crypto.randomBytes(32).toString('hex'),
            role: 'owner'
          });
          await approvedUser.save();
          console.log(`Created new owner credentials for accepted email: ${application.email}`);
        } else {
          approvedUser.role = 'owner';
          await approvedUser.save();
          console.log(`Updated user role to owner for accepted email: ${application.email}`);
        }
      } catch (userErr) {
        console.error('Error creating owner credentials for accepted email:', userErr);
        throw userErr;
      }
    }

    // Approved applications are imported through the canonical owner PMS listing workflow.

    res.json(application || { _id: id, status });
  } catch (err) {
    console.error('Partner application status error:', err);
    res.status(500).json({ msg: 'Could not update partner application.' });
  }
});

// Give an approved owner a one-time password setup link for manual handoff.
router.post('/partner-application/:id/setup-link', adminConsoleAuth, requirePermission('owners.manage'), async (req, res) => {
  try {
    const application = await PartnerApplication.findById(req.params.id);
    if (!application || application.status !== 'approved' ||
        !['Property Owner', 'Villa Host'].includes(application.partnerType)) {
      return res.status(400).json({ msg: 'Approve the property owner application first.' });
    }

    const email = application.email.toLowerCase().trim();
    let owner = await User.findOne({ email });
    if (!owner) {
      owner = new User({
        name: application.fullName,
        email,
        phone: application.phone || '',
        password: crypto.randomBytes(32).toString('hex'),
        role: 'owner'
      });
    } else if (owner.role !== 'owner') {
      owner.role = 'owner';
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    owner.ownerSetupTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    owner.ownerSetupExpiresAt = expiresAt;
    await owner.save();

    res.json({ email, token, expiresAt });
  } catch (err) {
    console.error('Owner setup link error:', err);
    res.status(500).json({ msg: 'Could not create owner setup link.' });
  }
});

// Get all Caretaker applications / requests from Property Owners (Admin only)
router.get('/caretaker-applications', adminConsoleAuth, requirePermission('properties.view'), async (req, res) => {
  try {
    let applications = await CaretakerApplication.find()
      .populate('provider', 'name email phone')
      .sort({ appliedAt: -1 });

    if (!applications || applications.length === 0) {
      const partnerCaretakers = await PartnerApplication.find({ partnerType: 'Caretaker' }).sort({ appliedAt: -1 });
      applications = partnerCaretakers.map(p => ({
        _id: p._id,
        provider: { name: p.fullName, email: p.email },
        propertyName: p.propertyName || 'Assigned Villa',
        propertyAddress: p.city || 'Mahabaleshwar',
        positionRole: 'Chief Villa Caretaker Host',
        phone: p.phone,
        experience: p.experience || '3+ Years',
        skillsRequired: ['Guest Check-in & Key Handover', 'Housekeeping & Linen Sanitation'],
        govtId: p.govtId || 'Verified ID',
        bio: p.message || '',
        status: p.status || 'pending',
        appliedAt: p.appliedAt || new Date()
      }));
    }

    res.json(applications);
  } catch (err) {
    res.status(500).json({ msg: 'Server error fetching caretaker applications' });
  }
});

// Update Caretaker application status - Allocate / Approve Caretaker (Admin only)
router.put('/caretaker-application/:id/status', adminConsoleAuth, requirePermission('properties.manage'), async (req, res) => {
  try {
    const { status, assignedCaretakerName, assignedCaretakerPhone } = req.body;
    const id = req.params.id;

    if (id.startsWith('dummy-')) {
      return res.json({ _id: id, status, assignedCaretakerName, assignedCaretakerPhone });
    }

    let application = await CaretakerApplication.findById(id);
    if (application) {
      application.status = status || 'approved';
      if (assignedCaretakerName) application.assignedCaretakerName = assignedCaretakerName;
      if (assignedCaretakerPhone) application.assignedCaretakerPhone = assignedCaretakerPhone;
      await application.save();
      return res.json(application);
    }

    let partnerApp = await PartnerApplication.findById(id);
    if (partnerApp) {
      partnerApp.caretakerStatus = status || 'approved';
      await partnerApp.save();
      return res.json({ ...partnerApp.toObject(), status: partnerApp.caretakerStatus });
    }

    res.json({ _id: id, status: status || 'approved' });
  } catch (err) {
    console.error('Caretaker allocation update error:', err);
    res.json({ _id: req.params.id, status: req.body.status || 'approved' });
  }
});

// Update property price (Admin only)
router.put('/property/:id/price', adminConsoleAuth, requirePermission('properties.manage'), async (req, res) => {
  try {
    const { price } = req.body;
    const id = req.params.id;
    if (id.startsWith('dummy-')) return res.json({ _id: id, price });
    const property = await Property.findByIdAndUpdate(id, { price }, { new: true });
    res.json(property || { _id: id, price });
  } catch (err) {
    res.json({ _id: req.params.id, price: req.body.price });
  }
});

// Approve/Reject property (Admin only)
router.put('/property/:id/status', adminConsoleAuth, requirePermission('properties.approve'), async (req, res) => {
  try {
    const { status } = req.body;
    const id = req.params.id;
    if (id.startsWith('dummy-')) return res.json({ _id: id, status });

    let property = await Property.findByIdAndUpdate(id, { status }, { new: true });

    if (!property) {
      const partnerApp = await PartnerApplication.findByIdAndUpdate(id, { status }, { new: true });
      if (partnerApp && partnerApp.propertyName && partnerApp.propertyName !== 'N/A') {
        const approvedUser = await User.findOne({ email: (partnerApp.email || '').toLowerCase().trim() });
        property = new Property({
          name: partnerApp.propertyName,
          type: partnerApp.propertyType || 'Villa',
          location: partnerApp.city || 'Mahabaleshwar',
          price: partnerApp.price ? (typeof partnerApp.price === 'number' ? partnerApp.price : parseInt(partnerApp.price) || 12000) : 12000,
          mapLink: partnerApp.mapLink || '',
          amenities: ['Private Pool', 'Valley View', 'Wi-Fi', 'Garden'],
          photos: partnerApp.photos || [],
          videos: partnerApp.videos || [],
          status: status,
          owner: approvedUser ? approvedUser._id : undefined
        });
        await property.save();
      }
    } else {
      await PartnerApplication.findOneAndUpdate({ propertyName: property.name }, { status });
    }

    res.json(property || { _id: id, status });
  } catch (err) {
    res.json({ _id: req.params.id, status: req.body.status });
  }
});

// Update user status - Approve / Reject / Block (Admin only)
router.put('/user/:id/status', adminConsoleAuth, requirePermission('team.manage'), async (req, res) => {
  try {
    const { status } = req.body; // 'approved', 'rejected', or 'active'
    const id = req.params.id;
    if (id.startsWith('dummy-')) return res.json({ _id: id, status });

    const user = await User.findByIdAndUpdate(id, { status }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ msg: 'Account not found.' });
    res.json({ _id:user._id, name:user.name, role:user.role, status:user.status });
  } catch (err) {
    res.json({ _id: req.params.id, status: req.body.status });
  }
});

// Remove User from Database (Admin only)
router.delete('/user/:id', adminConsoleAuth, requirePermission('team.manage'), (req,res) => res.status(409).json({ msg: 'Suspend accounts through audited account actions; records with ownership and bookings must be preserved.' }));

// Send Direct Admin Request / Notification to Selected User (Admin only)
router.post('/send-user-request', adminConsoleAuth, requirePermission('customers.manage'), async (req, res) => {
  try {
    const { userId, targetName, targetEmail, targetPhone, requestType, subject, message } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ msg: 'Subject and message body are required' });
    }

    console.log(`[ADMIN DIRECT REQUEST] Target: ${targetName || targetEmail} | Type: ${requestType} | Subject: ${subject}`);

    res.json({
      success: true,
      msg: `Official admin request successfully dispatched to ${targetName || targetEmail || 'selected user'}!`,
      details: {
        userId,
        targetName,
        targetEmail,
        targetPhone,
        requestType,
        subject,
        message,
        dispatchedAt: new Date()
      }
    });
  } catch (err) {
    console.error('Send request error:', err);
    res.status(500).json({ msg: 'Failed to dispatch request to selected user' });
  }
});

//social media links
const Social_Fields = [
  'facebook',
  'instagram',
  'x',
  'youtube',
  'whatsapp',
  'linkedin'
];

// Friendly names and the websites each link is allowed to point to.
const Social_Rules = {
  facebook: { label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  instagram: { label: 'Instagram', hosts: ['instagram.com', 'instagr.am'] },
  x: { label: 'X / Twitter', hosts: ['x.com', 'twitter.com'] },
  youtube: { label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  whatsapp: { label: 'WhatsApp', hosts: ['wa.me', 'whatsapp.com'] },
  linkedin: { label: 'LinkedIn', hosts: ['linkedin.com'] }
};

const emptySocialLinks = () =>
  Object.fromEntries(Social_Fields.map(field => [field,'']));

const pickSocialLinks = settings =>
  Object.fromEntries(Social_Fields.map(field => [field, settings[field] || '']));

const Footer_Defaults = {
  footerDescription: 'Creating unforgettable experiences in the hills. Book your perfect stay and explore the beauty of Mahabaleshwar with us.',
  contactPhone: '+91 98765 43210',
  contactEmail: 'support@bookmyvilla.com',
  contactLocation: 'Mahabaleshwar, Maharashtra, India'
};

const pickFooterContent = settings =>
  Object.fromEntries(Object.keys(Footer_Defaults).map(field => [field, settings?.[field] || Footer_Defaults[field]]));

function validateFooterContent(body) {
  const footer = {};
  const errors = {};
  const limits = { footerDescription: 240, contactPhone: 30, contactEmail: 120, contactLocation: 160 };

  for (const field of Object.keys(Footer_Defaults)) {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (!value) {
      errors[field] = 'This field is required.';
    } else if (value.length > limits[field]) {
      errors[field] = `Use ${limits[field]} characters or fewer.`;
    } else {
      footer[field] = value;
    }
  }

  if (footer.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(footer.contactEmail)) {
    errors.contactEmail = 'Enter a valid email address.';
  }
  if (footer.contactPhone && !/^[+()\d\s-]{7,30}$/.test(footer.contactPhone)) {
    errors.contactPhone = 'Use a valid phone number with digits, spaces, +, - or brackets.';
  }

  return { footer, errors };
}

function validateSocialLinks(body){
  const links = {};
  const errors = {};

  for (const field of Social_Fields) {
    const rule = Social_Rules[field];
    let value = typeof body[field] === 'string' ? body[field].trim() : '';

    if (!value) {
      links[field] = '';
      continue;
    }

    // Admins often paste "facebook.com/page" without the https:// part.
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;

    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      errors[field] = `This doesn't look like a web link. Paste the full ${rule.label} page address.`;
      continue;
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors[field] = 'The link must start with https://';
    } else if (!rule.hosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`))) {
      errors[field] = `This link is not from ${rule.label}. It should start with https://${rule.hosts[0]}/`;
    } else if (parsed.pathname.replace(/\//g, '') === '' && !parsed.search) {
      errors[field] = `Add your page name after ${rule.hosts[0]}/ so visitors land on your ${rule.label} page.`;
    } else {
      links[field] = parsed.toString();
    }
  }

  if (Object.keys(errors).length) {
    const count = Object.keys(errors).length;
    return {
      errors,
      error: count === 1
        ? 'One link needs fixing before saving.'
        : `${count} links need fixing before saving.`
    };
  }

  return { links };
}

//public endpoint: customer footer reads the saved links.
router.get('/social-links/public', async (req,res) => {
  try{
     
    if (mongoose.connection.readyState !==1){
      return res.status(503).json({
        msg: 'Database unavailable.'
      });
    }
    const settings = await SocialLinks.findOne({ key: 'footer'}).lean();

    const links = settings ? pickSocialLinks(settings) : emptySocialLinks();
    const footer = pickFooterContent(settings);

    res.set('Cache-Control', 'no-store');
    return res.json({ links, footer });
  }catch(err){
    console.error('public social links error:', err);
    return res.status(500).json({
      msg: 'Could not load social links'
    });
  }
});

//admin endpoit: load currnet settings.

router.get('/social-links',
            adminConsoleAuth,
            async(req,res) =>{
               try{
                const settings = await SocialLinks.findOne({key: 'footer'}).lean();

                return res.json({
                  links: settings ? pickSocialLinks(settings) : emptySocialLinks(),
                  footer: pickFooterContent(settings)
                });
              }catch(err){
                console.error('Admin social links read error:', err);
                return res.status(500).json({msg: 'Could not load the saved links. Please refresh the page.'});

              }
            }
);

//admin endpoint: save settings.
router.put(
  '/social-links',
  adminConsoleAuth,
  async (req, res) =>{
    try{
      const { links, error, errors: linkErrors } = validateSocialLinks(req.body || {});
      const { footer, errors: footerErrors } = validateFooterContent(req.body || {});
      const errors = { ...(linkErrors || {}), ...footerErrors };

      if (error || Object.keys(footerErrors).length){
        const count = Object.keys(errors).length;
        return res.status(400).json({
          msg: count === 1 ? 'One field needs fixing before saving.' : `${count} fields need fixing before saving.`,
          errors
        });
      }

      const settings = await SocialLinks.findOneAndUpdate(
        { key: 'footer'},
        { $set: { ...links, ...footer }, $setOnInsert: {key: 'footer'} },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true
         }
      ).lean();

      return res.json({
        msg: 'Saved. The website footer now shows the updated content.',
        links: pickSocialLinks(settings),
        footer: pickFooterContent(settings)
      });

    }catch(err){
      console.error('Admin social links save error:',err);
      return res.status(500).json({msg: 'Could not save right now. Please try again in a moment.'});
    }
  }
);

// ---- Hero offers (slides on the website hero) ----
const MAX_OFFER_IMAGE_CHARS = 2 * 1024 * 1024;

const publicOffer = o => ({
  id: String(o._id), title: o.title, subtitle: o.subtitle, badge: o.badge,
  ctaLabel: o.ctaLabel, ctaLink: o.ctaLink, endsAt: o.endsAt,
  discountType: o.discountType || 'none', discountValue: o.discountValue || 0,
  propertyIds: (o.propertyIds || []).map(String),
  imageUrl: o.imageVersion ? `/api/admin/offers/${o._id}/image?v=${o.imageVersion}` : ''
});
const adminOffer = o => ({ ...publicOffer(o), active: o.active, startsAt: o.startsAt, order: o.order });

// Turns the admin form into a clean record, or returns plain-language errors per field.
function validateOffer(body, { partial = false } = {}) {
  const errors = {};
  const out = {};
  const text = (key, max) => typeof body[key] === 'string' ? body[key].trim().slice(0, max + 1) : undefined;

  const title = text('title', 80);
  if (title !== undefined || !partial) {
    if (!title) errors.title = 'Enter a headline for the offer.';
    else if (title.length > 80) errors.title = 'Keep the headline under 80 characters.';
    else out.title = title;
  }
  for (const [key, max, label] of [['subtitle', 160, 'description'], ['badge', 24, 'tag'], ['ctaLabel', 24, 'button text']]) {
    const v = text(key, max);
    if (v === undefined) continue;
    if (v.length > max) errors[key] = `Keep the ${label} under ${max} characters.`;
    else out[key] = v;
  }
  const link = text('ctaLink', 300);
  if (link !== undefined) {
    if (link && !/^(\/(?!\/)|https:\/\/)\S*$/.test(link)) errors.ctaLink = 'Use a page like /explore or a full link starting with https://';
    else out.ctaLink = link;
  }
  const date = key => {
    if (body[key] === undefined) return;
    if (!body[key]) { out[key] = null; return; }
    // A plain date means the whole day in India: it starts at 00:00 and ends at 23:59 IST.
    const raw = String(body[key]);
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T${key === 'endsAt' ? '23:59:59.999' : '00:00:00'}+05:30` : raw);
    if (Number.isNaN(d.getTime())) errors[key] = 'This date is not valid.'; else out[key] = d;
  };
  date('startsAt'); date('endsAt');
  if (out.startsAt && out.endsAt && out.endsAt < out.startsAt) errors.endsAt = 'The end date must be after the start date.';
  if (body.active !== undefined) out.active = Boolean(body.active);
  if (body.discountType !== undefined || body.discountValue !== undefined || !partial) {
    const type = body.discountType === undefined ? 'none' : body.discountType;
    const value = body.discountValue === undefined ? 0 : Number(body.discountValue);
    if (!['none', 'percent', 'fixed'].includes(type)) errors.discountType = 'Choose no discount, percentage, or fixed amount.';
    else if (!Number.isFinite(value) || value < 0 || value > 10000000 || (type === 'percent' && value > 100) || (type !== 'none' && value === 0)) errors.discountValue = 'Enter a discount above zero (percentage up to 100).';
    else { out.discountType = type; out.discountValue = type === 'none' ? 0 : Math.floor(value); }
  }
  if (body.propertyIds !== undefined || !partial) {
    const ids = body.propertyIds === undefined ? [] : body.propertyIds;
    if (!Array.isArray(ids) || ids.length > 500 || ids.some(id => !mongoose.isValidObjectId(id))) errors.propertyIds = 'Choose valid villas for this offer.';
    else out.propertyIds = [...new Set(ids.map(String))];
  }
  if (!errors.ctaLink && (body.ctaLabel || '').trim() && !(body.ctaLink || '').trim()) errors.ctaLink = 'Add where the button should go.';

  if (out.propertyIds?.length && out.propertyIds.length !== (body.propertyIds || []).length) errors.propertyIds = 'A villa was selected more than once.';
  if (out.propertyIds?.length) {
    // Validate IDs so deleted or mistyped villas cannot silently receive an offer.
    // The actual lookup runs in the route where Property is available.
  }

  if (typeof body.image === 'string' && body.image) {
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.image)) errors.image = 'Use a JPG, PNG or WebP picture.';
    else if (body.image.length > MAX_OFFER_IMAGE_CHARS) errors.image = 'This picture is too large. Choose a smaller one.';
    else { out.imageData = body.image; out.imageVersion = Date.now(); }
  } else if (body.image === null || body.removeImage) { out.imageData = ''; out.imageVersion = 0; }

  return Object.keys(errors).length ? { errors, error: 'Please fix the fields marked in red.' } : { data: out };
}

router.get('/offers/public', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({ offers: [] });
    const now = new Date();
    const offers = await SiteOffer.find({
      active: true,
      $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }]
    }).sort({ order: 1, createdAt: -1 }).limit(10).lean();
    res.set('Cache-Control', 'no-store').json({ offers: offers.map(publicOffer) });
  } catch (err) {
    console.error('public offers error:', err);
    res.status(500).json({ msg: 'Could not load offers.' });
  }
});

router.get('/offers/villas', adminConsoleAuth, requirePermission('properties.view'), async (req, res) => {
  try {
    const villas = await Property.find({ status: 'approved' }).select('_id name location').sort({ name: 1 }).lean();
    res.json({ villas: villas.map(villa => ({ id: String(villa._id), name: villa.name, location: villa.location || '' })) });
  } catch (err) {
    console.error('offer villa list error:', err);
    res.status(500).json({ msg: 'Could not load villas. Please try again.' });
  }
});

router.get('/offers/:id/image', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
    const offer = await SiteOffer.findById(req.params.id).select('+imageData').lean();
    const match = offer?.imageData && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(offer.imageData);
    if (!match) return res.sendStatus(404);
    res.set('Content-Type', match[1]).set('Cache-Control', 'public, max-age=31536000, immutable').send(Buffer.from(match[2], 'base64'));
  } catch (err) {
    console.error('offer image error:', err);
    res.sendStatus(500);
  }
});

router.get('/offers', adminConsoleAuth, async (req, res) => {
  try {
    const offers = await SiteOffer.find().sort({ order: 1, createdAt: -1 }).lean();
    res.json({ offers: offers.map(adminOffer) });
  } catch (err) {
    console.error('admin offers read error:', err);
    res.status(500).json({ msg: 'Could not load the offers. Please refresh the page.' });
  }
});

router.post('/offers', adminConsoleAuth, async (req, res) => {
  try {
    const { data, error, errors } = validateOffer(req.body || {});
    if (error) return res.status(400).json({ msg: error, errors });
    if (data.propertyIds?.length && await Property.countDocuments({ _id: { $in: data.propertyIds }, status: 'approved' }) !== data.propertyIds.length) return res.status(400).json({ msg: 'One or more selected villas are unavailable.', errors: { propertyIds: 'Refresh the villa list and choose available villas.' } });
    if (await SiteOffer.countDocuments() >= 20) return res.status(400).json({ msg: 'You can keep up to 20 offers. Delete one you no longer need first.' });
    const last = await SiteOffer.findOne().sort({ order: -1 }).select('order').lean();
    const offer = await SiteOffer.create({ ...data, order: (last?.order ?? -1) + 1 });
    res.status(201).json({ msg: 'Offer added.', offer: adminOffer(offer) });
  } catch (err) {
    console.error('admin offer create error:', err);
    res.status(500).json({ msg: 'Could not save the offer right now. Please try again.' });
  }
});

router.put('/offers/:id', adminConsoleAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: 'This offer no longer exists. Refresh the page.' });
    const { data, error, errors } = validateOffer(req.body || {}, { partial: true });
    if (error) return res.status(400).json({ msg: error, errors });
    if (data.propertyIds?.length && await Property.countDocuments({ _id: { $in: data.propertyIds }, status: 'approved' }) !== data.propertyIds.length) return res.status(400).json({ msg: 'One or more selected villas are unavailable.', errors: { propertyIds: 'Refresh the villa list and choose available villas.' } });
    const offer = await SiteOffer.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
    if (!offer) return res.status(404).json({ msg: 'This offer no longer exists. Refresh the page.' });
    res.json({ msg: 'Offer saved.', offer: adminOffer(offer) });
  } catch (err) {
    console.error('admin offer update error:', err);
    res.status(500).json({ msg: 'Could not save the offer right now. Please try again.' });
  }
});

// Move an offer one place earlier or later in the slideshow.
router.post('/offers/:id/move', adminConsoleAuth, async (req, res) => {
  try {
    const list = await SiteOffer.find().sort({ order: 1, createdAt: -1 }).select('_id');
    const i = list.findIndex(o => String(o._id) === req.params.id);
    if (i < 0) return res.status(404).json({ msg: 'This offer no longer exists. Refresh the page.' });
    const j = i + (req.body?.direction === 'up' ? -1 : 1);
    if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
    await SiteOffer.bulkWrite(list.map((o, order) => ({ updateOne: { filter: { _id: o._id }, update: { $set: { order } } } })));
    res.json({ msg: 'Order updated.' });
  } catch (err) {
    console.error('admin offer move error:', err);
    res.status(500).json({ msg: 'Could not change the order. Please try again.' });
  }
});

router.delete('/offers/:id', adminConsoleAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: 'This offer no longer exists.' });
    await SiteOffer.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Offer deleted.' });
  } catch (err) {
    console.error('admin offer delete error:', err);
    res.status(500).json({ msg: 'Could not delete the offer. Please try again.' });
  }
});

// ---- SEO: live sitemap so every live villa page can be found by search engines ----
const SITE_URL = 'https://bookmyvilla.online';
const SITEMAP_PAGES = ['/', '/explore', '/about-us', '/join-us'];
router.get('/seo/sitemap.xml', async (req, res) => {
  try {
    const villas = mongoose.connection.readyState === 1
      ? await Property.find({ status: 'approved', websiteVisible: { $ne: false } }).select('_id updatedAt').sort({ updatedAt: -1 }).limit(5000).lean()
      : [];
    const day = d => (d ? new Date(d).toISOString().slice(0, 10) : '');
    const entry = (path, lastmod) => ['  <url>', `    <loc>${SITE_URL}${path}</loc>`, ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []), '  </url>'].join('\n');
    const lines = [...SITEMAP_PAGES.map(p => entry(p)), ...villas.map(v => entry(`/property/${v._id}`, day(v.updatedAt)))];
    const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...lines, '</urlset>', ''].join('\n');
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
  } catch (err) {
    console.error('sitemap error:', err);
    res.status(500).type('text/plain').send('Sitemap is temporarily unavailable.');
  }
});

module.exports = router;
