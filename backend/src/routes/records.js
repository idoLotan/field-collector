import express from 'express';
import { getAllRecords, addRecords } from '../storage/recordsStorage.js';

const router = express.Router();

// GET /api/records - retrieve all records
router.get('/', (req, res) => {
  try {
    const records = getAllRecords();
    res.json({ success: true, records, count: records.length });
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/records - upload/sync records
router.post('/', (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, error: 'records must be an array' });
    }
    const result = addRecords(records);
    res.json(result);
  } catch (err) {
    console.error('Error saving records:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
