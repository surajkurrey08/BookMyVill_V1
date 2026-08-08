const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

let tasksStore = [
  { id: '1', title: 'Morning Swimming Pool Filtration & Leaf Skim', category: 'Pool Care', time: '07:30 AM', priority: 'High', completed: true },
  { id: '2', title: 'Check-in Lawn Bonfire Wood Stack Prep', category: 'Garden & Lawn', time: '11:00 AM', priority: 'Medium', completed: false },
  { id: '3', title: 'Master Bedroom Deep Sanitization & Bedding', category: 'Housekeeping', time: '02:00 PM', priority: 'High', completed: false }
];

router.get('/owner', auth, (req, res) => {
  res.json(tasksStore);
});

router.get('/caretaker', (req, res) => {
  res.json(tasksStore);
});

router.post('/', auth, (req, res) => {
  const { title, category, time, priority } = req.body;
  const newTask = {
    id: Date.now().toString(),
    title: title || 'New Duty Task',
    category: category || 'Housekeeping',
    time: time || '10:00 AM',
    priority: priority || 'Medium',
    completed: false
  };
  tasksStore.unshift(newTask);
  res.status(201).json(newTask);
});

router.delete('/:id', auth, (req, res) => {
  const { id } = req.params;
  tasksStore = tasksStore.filter(t => t.id !== id && t._id !== id);
  res.json({ msg: 'Task deleted successfully' });
});

router.put('/:id/toggle', (req, res) => {
  const { id } = req.params;
  const task = tasksStore.find(t => t.id === id || t._id === id);
  if (task) {
    task.completed = !task.completed;
  }
  res.json(task || { msg: 'Updated' });
});

module.exports = router;
