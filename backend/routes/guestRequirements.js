const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

let guestReqsStore = [
  {
    id: 'GST-901',
    guestName: 'Vikram & Family',
    rooms: 'Villa Suite 1 & 2',
    checkIn: 'Today, 02:00 PM',
    phone: '+91 98230 11223',
    requests: ['Need 2 Extra Herbal Tea Kits in Living Room', 'Keep Evening Bonfire Firewood Ready by 7 PM']
  }
];

router.get('/owner', auth, (req, res) => {
  res.json(guestReqsStore);
});

router.get('/caretaker', (req, res) => {
  res.json(guestReqsStore);
});

router.post('/:guestId/requests', auth, (req, res) => {
  const { guestId } = req.params;
  const { label } = req.body;
  const item = guestReqsStore.find(g => g.id === guestId);
  if (item && label) {
    item.requests.push(label);
    return res.json(item);
  }
  res.status(400).json({ msg: 'Failed to add requirement' });
});

router.delete('/:guestId/requests/:idx', auth, (req, res) => {
  const { guestId, idx } = req.params;
  const item = guestReqsStore.find(g => g.id === guestId);
  if (item && item.requests[idx] !== undefined) {
    item.requests.splice(idx, 1);
    return res.json(item);
  }
  res.status(400).json({ msg: 'Failed to delete requirement' });
});

module.exports = router;
