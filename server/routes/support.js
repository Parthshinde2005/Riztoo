const express = require('express');
const { body, validationResult } = require('express-validator');
const BugReport = require('../models/BugReport');
const upload = require('../middlewares/multer');

const router = express.Router();

// Submit bug report
router.post('/bug-report', upload.array('attachments', 3), [
  body('email').isEmail().normalizeEmail(),
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('title').trim().isLength({ min: 5, max: 200 }),
  body('description').trim().isLength({ min: 10, max: 2000 }),
  body('category').isIn(['bug', 'feature-request', 'ui-issue', 'performance', 'security', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      name,
      title,
      description,
      category,
      priority,
      userAgent,
      url,
      screenResolution
    } = req.body;

    const bugReport = new BugReport({
      userId: req.session?.user?.id || null,
      email,
      name,
      title,
      description,
      category: category || 'bug',
      priority: priority || 'medium',
      browserInfo: {
        userAgent: userAgent || '',
        url: url || '',
        screenResolution: screenResolution || ''
      },
      attachments: req.files ? req.files.map(file => ({
        filename: file.originalname,
        path: `/uploads/${file.filename}`,
        mimetype: file.mimetype
      })) : []
    });

    await bugReport.save();

    res.json({ 
      message: 'Bug report submitted successfully',
      reportId: bugReport._id 
    });

  } catch (error) {
    console.error('Submit bug report error:', error);
    res.status(500).json({ error: 'Failed to submit bug report' });
  }
});

// Get bug reports (admin only)
router.get('/bug-reports', async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { status, category, priority, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    const bugReports = await BugReport.find(query)
      .populate('userId', 'name email')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BugReport.countDocuments(query);

    res.json({
      bugReports,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get bug reports error:', error);
    res.status(500).json({ error: 'Failed to fetch bug reports' });
  }
});

// Update bug report status (admin only)
router.put('/bug-reports/:id', [
  body('status').optional().isIn(['open', 'in-progress', 'resolved', 'closed', 'duplicate']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('adminNotes').optional().trim().isLength({ max: 1000 })
], async (req, res) => {
  try {
    // Check if user is admin
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, priority, adminNotes } = req.body;
    
    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (adminNotes) updateData.adminNotes = adminNotes;
    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
    }

    const bugReport = await BugReport.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!bugReport) {
      return res.status(404).json({ error: 'Bug report not found' });
    }

    res.json({ 
      message: 'Bug report updated successfully',
      bugReport 
    });

  } catch (error) {
    console.error('Update bug report error:', error);
    res.status(500).json({ error: 'Failed to update bug report' });
  }
});

// Get bug report by ID
router.get('/bug-reports/:id', async (req, res) => {
  try {
    const bugReport = await BugReport.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('assignedTo', 'name');

    if (!bugReport) {
      return res.status(404).json({ error: 'Bug report not found' });
    }

    // Check if user can access this report
    const canAccess = req.session?.user && (
      req.session.user.role === 'admin' ||
      req.session.user.id === bugReport.userId?.toString() ||
      bugReport.email === req.session.user.email
    );

    if (!canAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(bugReport);

  } catch (error) {
    console.error('Get bug report error:', error);
    res.status(500).json({ error: 'Failed to fetch bug report' });
  }
});

module.exports = router;