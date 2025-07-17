const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const db = require('../config/database');
const generateToken = require('../utils/generateToken');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    // Check if user exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (new users always get 'user' role)
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'user']
    );

    const userId = result.insertId;

    res.status(201).json({
      id: userId,
      username,
      email,
      role: 'user',
      token: generateToken(userId)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check user exists (now including role)
    const [users] = await db.execute(
      'SELECT id, username, email, password, role FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      token: generateToken(user.id)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, username, email, avatar, bio, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { username, bio, avatar } = req.body;
    const userId = req.user.id;

    // Check if username is taken
    if (username) {
      const [existingUsers] = await db.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    // Build update query dynamically
    let updateFields = [];
    let updateValues = [];

    if (username) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }

    if (bio !== undefined) {
      updateFields.push('bio = ?');
      updateValues.push(bio || null);
    }

    if (avatar !== undefined) {
      updateFields.push('avatar = ?');
      updateValues.push(avatar || null);
    }

    // Only update if there are fields to update
    if (updateFields.length > 0) {
      updateValues.push(userId);
      await db.execute(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    // Get updated user
    const [users] = await db.execute(
      'SELECT id, username, email, avatar, bio, role FROM users WHERE id = ?',
      [userId]
    );

    res.json(users[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide both current and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Get user with password
    const [users] = await db.execute(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check current password
    const isPasswordValid = await bcrypt.compare(currentPassword, users[0].password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await db.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user stats
// @route   GET /api/auth/stats
// @access  Private
const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get total posts
    const [postCount] = await db.execute(
      'SELECT COUNT(*) as total FROM posts WHERE user_id = ?',
      [userId]
    );

    // Get total comments
    const [commentCount] = await db.execute(
      'SELECT COUNT(*) as total FROM comments WHERE user_id = ?',
      [userId]
    );

    // Get total likes received
    const [likesCount] = await db.execute(
      `SELECT COUNT(*) as total 
      FROM post_likes pl 
      JOIN posts p ON pl.post_id = p.id 
      WHERE p.user_id = ?`,
      [userId]
    );

    // Get total views
    const [viewsCount] = await db.execute(
      'SELECT SUM(views) as total FROM posts WHERE user_id = ?',
      [userId]
    );

    res.json({
      totalPosts: postCount[0].total,
      totalComments: commentCount[0].total,
      totalLikesReceived: likesCount[0].total,
      totalViews: viewsCount[0].total || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getUserStats
};