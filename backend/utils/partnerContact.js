// Both public partner forms use the same contact validation.
function partnerContact(body) {
  const text = key => typeof body[key] === 'string' ? body[key].trim() : '';
  const fullName = text('fullName');
  const email = text('email').toLowerCase();
  const rawPhone = text('phone');
  const phone = rawPhone.replace(/[\s()+.-]/g, '');
  if (fullName.length < 3 || fullName.length > 100 || !/^[\p{L}\p{M}\s.'-]+$/u.test(fullName)) {
    throw new Error('Enter your full name using letters (3–100 characters).');
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!/^\d{10,15}$/.test(phone)) throw new Error('Enter a valid phone number with 10–15 digits.');
  const propertyName = text('propertyName');
  const city = text('city');
  const message = text('message');
  if (propertyName.length > 150 || city.length > 100 || message.length > 2000) throw new Error('Property name, city or message is too long.');
  return { fullName, email, phone, propertyName, city, message };
}

module.exports = { partnerContact };
