const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  searchPosts
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

// Validation rules
const postValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 255 })
    .withMessage('Title must be less than 255 characters'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required'),
  body('meta_description')
    .optional()
    .isLength({ max: 160 })
    .withMessage('Meta description must be less than 160 characters'),
  body('focus_keyword')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Focus keyword must be less than 100 characters')
];

// Routes
router.route('/')
  .get(getPosts)
  .post(protect, postValidation, createPost);

router.get('/search', searchPosts);

router.route('/:id')
  .put(protect, postValidation, updatePost)
  .delete(protect, deletePost);

router.get('/:slug', getPost);
router.post('/:id/like', protect, toggleLike);

module.exports = router;