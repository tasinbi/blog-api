const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { isAdmin, isModerator } = require('../middleware/adminMiddleware');
const {
  getDashboardStats,
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllPosts,
  updatePostStatus,
  deleteAnyPost,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllComments,
  deleteAnyComment
} = require('../controllers/adminController');

// Admin only routes
router.get('/dashboard', protect, isAdmin, getDashboardStats);
router.get('/users', protect, isAdmin, getAllUsers);
router.put('/users/:id/role', protect, isAdmin, updateUserRole);
router.delete('/users/:id', protect, isAdmin, deleteUser);
router.delete('/posts/:id', protect, isAdmin, deleteAnyPost);
router.post('/categories', protect, isAdmin, createCategory);
router.put('/categories/:id', protect, isAdmin, updateCategory);
router.delete('/categories/:id', protect, isAdmin, deleteCategory);

// Admin and Moderator routes
router.get('/posts', protect, isModerator, getAllPosts);
router.put('/posts/:id/status', protect, isModerator, updatePostStatus);
router.get('/comments', protect, isModerator, getAllComments);
router.delete('/comments/:id', protect, isModerator, deleteAnyComment);

module.exports = router;