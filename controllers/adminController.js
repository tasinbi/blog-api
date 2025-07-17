const db = require('../config/database');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs').promises;

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
// @access  Admin
const getDashboardStats = async (req, res) => {
  try {
    // Get total users
    const [userCount] = await db.execute(
      'SELECT COUNT(*) as total FROM users'
    );

    // Get total posts
    const [postCount] = await db.execute(
      'SELECT COUNT(*) as total FROM posts'
    );

    // Get total comments
    const [commentCount] = await db.execute(
      'SELECT COUNT(*) as total FROM comments'
    );

    // Get total categories
    const [categoryCount] = await db.execute(
      'SELECT COUNT(*) as total FROM categories'
    );

    // Get posts by status
    const [postsByStatus] = await db.execute(
      'SELECT status, COUNT(*) as count FROM posts GROUP BY status'
    );

    // Get recent posts
    const [recentPosts] = await db.execute(
      `SELECT p.id, p.title, p.status, p.created_at,
        u.username as author
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 5`
    );

    // Get recent comments
    const [recentComments] = await db.execute(
      `SELECT c.id, c.content, c.created_at,
        u.username as author,
        p.title as post_title
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN posts p ON c.post_id = p.id
      ORDER BY c.created_at DESC
      LIMIT 5`
    );

    res.json({
      stats: {
        totalUsers: userCount[0].total,
        totalPosts: postCount[0].total,
        totalComments: commentCount[0].total,
        totalCategories: categoryCount[0].total,
        postsByStatus: postsByStatus.reduce((acc, curr) => {
          acc[curr.status] = curr.count;
          return acc;
        }, {})
      },
      recentPosts,
      recentComments
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM users'
    );
    const total = countResult[0].total;

    // Get users
    const [users] = await db.execute(
      `SELECT id, username, email, role, avatar, created_at 
      FROM users 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Admin
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ['user', 'admin', 'moderator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Prevent admin from changing their own role
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    // Update user role
    await db.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Delete user (posts and comments will be deleted due to CASCADE)
    await db.execute('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all posts (admin view)
// @route   GET /api/admin/posts
// @access  Admin/Moderator
const getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status; // all statuses for admin

    let query = `
      SELECT 
        p.id, p.title, p.slug, p.status, p.views, 
        p.created_at, p.updated_at,
        u.id as user_id, u.username as author,
        c.name as category_name
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
    `;

    let countQuery = 'SELECT COUNT(*) as total FROM posts';
    const params = [];

    if (status) {
      query += ' WHERE p.status = ?';
      countQuery += ' WHERE status = ?';
      params.push(status);
    }

    // Get total count
    const [countResult] = await db.execute(countQuery, params);
    const total = countResult[0].total;

    // Get posts
    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [posts] = await db.execute(query, params);

    res.json({
      posts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPosts: total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update post status
// @route   PUT /api/admin/posts/:id/status
// @access  Admin/Moderator
const updatePostStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['draft', 'published'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Update post status
    await db.execute(
      'UPDATE posts SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({ message: 'Post status updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete any post
// @route   DELETE /api/admin/posts/:id
// @access  Admin
const deleteAnyPost = async (req, res) => {
  try {
    const { id } = req.params;

    // Get post details
    const [posts] = await db.execute(
      'SELECT featured_image FROM posts WHERE id = ?',
      [id]
    );

    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Delete post
    await db.execute('DELETE FROM posts WHERE id = ?', [id]);

    // Delete featured image if exists
    if (posts[0].featured_image) {
      try {
        const imagePath = path.join(__dirname, '..', posts[0].featured_image);
        await fs.unlink(imagePath);
      } catch (error) {
        console.error('Error deleting featured image:', error);
      }
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create category
// @route   POST /api/admin/categories
// @access  Admin
const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const { slugify } = require('../utils/slugify');
    
    const slug = slugify(name);

    // Check if category exists
    const [existing] = await db.execute(
      'SELECT id FROM categories WHERE slug = ?',
      [slug]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    // Create category
    const [result] = await db.execute(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
      [name, slug, description || null]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      slug,
      description,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Admin
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    await db.execute(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name, description || null, id]
    );

    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Admin
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has posts
    const [posts] = await db.execute(
      'SELECT COUNT(*) as total FROM posts WHERE category_id = ?',
      [id]
    );

    if (posts[0].total > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with existing posts' 
      });
    }

    await db.execute('DELETE FROM categories WHERE id = ?', [id]);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all comments (admin view)
// @route   GET /api/admin/comments
// @access  Admin/Moderator
const getAllComments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM comments'
    );
    const total = countResult[0].total;

    // Get comments
    const [comments] = await db.execute(
      `SELECT 
        c.id, c.content, c.created_at,
        u.username as author,
        p.title as post_title, p.slug as post_slug
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN posts p ON c.post_id = p.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      comments,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalComments: total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete any comment
// @route   DELETE /api/admin/comments/:id
// @access  Admin/Moderator
const deleteAnyComment = async (req, res) => {
  try {
    const { id } = req.params;

    await db.execute('DELETE FROM comments WHERE id = ?', [id]);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
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
};