const mongoose = require('mongoose');

const bugReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  email: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['bug', 'feature-request', 'ui-issue', 'performance', 'security', 'other'],
    default: 'bug'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed', 'duplicate'],
    default: 'open'
  },
  browserInfo: {
    userAgent: String,
    url: String,
    screenResolution: String
  },
  attachments: [{
    filename: String,
    path: String,
    mimetype: String
  }],
  adminNotes: {
    type: String
  },
  resolvedAt: {
    type: Date
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BugReport', bugReportSchema);