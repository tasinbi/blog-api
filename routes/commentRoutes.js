const express = require('express');
const router = express.Router();
const {
  getComments,
  createComment,
  deleteComment
} = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

// Routes
router.get('/posts/:postId/comments', getComments);
router.post('/posts/:postId/comments', protect, createComment);
router.delete('/:id', protect, deleteComment);

module.exports = router;