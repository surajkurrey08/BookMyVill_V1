const AddOn = require('../models/AddOn');
const Promotion = require('../models/Promotion');
const PromotionRedemption = require('../models/PromotionRedemption');

module.exports = {
  addOns: {
    list: filter => AddOn.find(filter).sort({ active: -1, category: 1, name: 1 }).lean(),
    find: (filter, select = '') => AddOn.find(filter).select(select).sort({ name: 1 }).lean(),
    one: filter => AddOn.findOne(filter),
    byId: id => AddOn.findById(id).lean(),
    create: values => AddOn.create(values),
    remove: filter => AddOn.deleteOne(filter)
  },
  promotions: {
    list: filter => Promotion.find(filter).sort({ active: -1, createdAt: -1 }).lean(),
    one: filter => Promotion.findOne(filter),
    byCode: (owner, code) => Promotion.findOne({ owner, code }).lean(),
    byId: id => Promotion.findById(id).lean(),
    create: values => Promotion.create(values),
    // Counts one use; unless forced, only while under maxUses.
    redeem: (owner, id, discount, force) => Promotion.updateOne({ _id: id, owner, ...(!force && { $or: [{ maxUses: null }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }] }) }, { $inc: { usedCount: 1, discountGiven: discount } }),
    release: (id, discount) => Promotion.updateOne({ _id: id }, { $inc: { usedCount: -1, discountGiven: -discount } })
  },
  redemptions: {
    record: values => PromotionRedemption.create(values)
  }
};
