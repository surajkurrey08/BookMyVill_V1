const crypto = require('crypto');

// Short human-friendly references such as INQ-7K3MQ2 or QT-9XH4PA. The
// alphabet leaves out 0/O and 1/I so codes survive being read over the phone.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function refCode(prefix, length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return `${prefix}-${code}`;
}

// Creates a document whose `code` field is unique, retrying on the rare
// collision instead of surfacing a duplicate-key error to the owner.
async function createWithCode(Model, prefix, data, attempts = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await Model.create({ ...data, code: refCode(prefix) });
    } catch (err) {
      const codeClash = err.code === 11000 && err.keyPattern && err.keyPattern.code;
      if (!codeClash || attempt >= attempts) throw err;
    }
  }
}

module.exports = { refCode, createWithCode };
