const express = require('express');
const router = express.Router();
const {
  getCategories,
  getPostsByCategory
} = require('../controllers/categoryController');

// Routes
router.get('/', getCategories);
router.get('/:slug/posts', getPostsByCategory);

module.exports = router;