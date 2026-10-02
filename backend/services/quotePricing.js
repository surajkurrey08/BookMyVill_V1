const { HttpError, daysBetween, addDays } = require('../utils/validate');

// Pure pricing for quotations. Everything is whole rupees; the server always
// recomputes these numbers, so a client can never set its own total.

// GST on hotel accommodation is decided by the tariff actually charged per
// unit per night. Owners pick this mode explicitly; owners who are not GST
// registered use "none". Rates change by notification — confirm with a tax
// advisor and update this table when they do.
const GST_HOTEL_SLABS = [
  { maxNightly: 7500, rate: 5 },
  { maxNightly: Infinity, rate: 18 }
];

const CANCELLATION_TEXT = {
  flexible: 'Full refund if cancelled at least 24 hours before check-in. Cancellations within 24 hours of check-in are charged for the first night.',
  moderate: 'Full refund if cancelled at least 7 days before check-in. 50% refund if cancelled 2–7 days before check-in. No refund within 48 hours of check-in.',
  strict: '50% refund if cancelled at least 14 days before check-in. No refund after that.',
  non_refundable: 'This rate is non-refundable once the booking is confirmed.'
};

const MAX_AMOUNT = 100000000;

function promotionDiscount(promo, accommodationAmount) {
  if (!promo || !accommodationAmount || accommodationAmount <= 0) return 0;
  let discount = promo.discountType === 'percent'
    ? Math.floor(accommodationAmount * promo.discountValue / 100)
    : promo.discountValue;
  if (promo.discountType === 'percent' && promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
  return Math.max(0, Math.min(discount, accommodationAmount));
}

const taxOn = (amount, rate) => Math.round(amount * rate / 100);

function addOnAmount(unitPrice, pricingUnit, quantity, nights) {
  const perNight = pricingUnit === 'per_night' || pricingUnit === 'per_guest_per_night';
  return unitPrice * quantity * (perNight ? nights : 1);
}

function accommodationRate(taxMode, customTaxRate, effectiveNightly) {
  if (taxMode === 'gst_hotel') return GST_HOTEL_SLABS.find(slab => effectiveNightly <= slab.maxNightly).rate;
  if (taxMode === 'custom') return customTaxRate;
  return 0;
}

function priceQuote({
  nights, nightlyRate, addOns = [], fees = [], promotion = null, manualDiscount = 0,
  taxMode = 'none', customTaxRate = 0, advancePercent = 100, balanceDueDaysBeforeCheckIn = 0, checkIn, today
}) {
  const accommodation = nightlyRate * nights;
  const promoDiscount = promotionDiscount(promotion, accommodation);
  if (manualDiscount < 0 || manualDiscount > accommodation - promoDiscount) {
    throw new HttpError(400, 'The extra discount cannot be more than the accommodation amount after other discounts.');
  }
  const discount = promoDiscount + manualDiscount;
  const accommodationNet = accommodation - discount;
  const accommodationTaxRate = accommodationRate(taxMode, customTaxRate, accommodationNet / nights);
  const accommodationTax = taxOn(accommodationNet, accommodationTaxRate);
  const lineTaxRate = rate => (taxMode === 'none' ? 0 : rate);

  const addOnLines = addOns.map(line => {
    const amount = addOnAmount(line.unitPrice, line.pricingUnit, line.quantity, nights);
    const taxRate = lineTaxRate(line.taxRate || 0);
    return { ...line, taxRate, amount, tax: taxOn(amount, taxRate) };
  });
  const feeLines = fees.map(line => {
    const taxRate = lineTaxRate(line.taxRate || 0);
    return { ...line, taxRate, tax: taxOn(line.amount, taxRate) };
  });

  const addOnsTotal = addOnLines.reduce((sum, line) => sum + line.amount, 0);
  const feesTotal = feeLines.reduce((sum, line) => sum + line.amount, 0);
  const subtotal = accommodation + addOnsTotal + feesTotal;
  const taxable = subtotal - discount;
  const tax = accommodationTax + addOnLines.reduce((sum, line) => sum + line.tax, 0) + feeLines.reduce((sum, line) => sum + line.tax, 0);
  const total = taxable + tax;
  if (!Number.isSafeInteger(total) || total > MAX_AMOUNT) throw new HttpError(400, 'Quotation total is too large.');

  const advanceAmount = advancePercent >= 100 ? total : Math.round(total * advancePercent / 100);
  const balanceAmount = total - advanceAmount;
  let balanceDueDate = null;
  if (balanceAmount > 0 && checkIn) {
    balanceDueDate = addDays(checkIn, -balanceDueDaysBeforeCheckIn);
    if (today && daysBetween(today, balanceDueDate) < 0) balanceDueDate = today;
  }

  return {
    accommodation, promoDiscount, manualDiscount, discount, accommodationNet, accommodationTaxRate, accommodationTax,
    addOnLines, feeLines,
    totals: { accommodation, addOns: addOnsTotal, fees: feesTotal, subtotal, discount, taxable, tax, total },
    schedule: { advanceAmount, balanceAmount, balanceDueDate }
  };
}

module.exports = { GST_HOTEL_SLABS, CANCELLATION_TEXT, promotionDiscount, addOnAmount, priceQuote };
