const db = require('../config/database');
const { slugify, slugifyBangla, smartSlugify } = require('../utils/slugify');
const fs = require('fs').promises;
const path = require('path');

// @desc    Get all posts
// @route   GET /api/posts
// @access  Public
const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'published';

    // Get total count
    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM posts WHERE status = ?',
      [status]
    );
    const total = countResult[0].total;

    // Get posts with user and category info
    const [posts] = await db.execute(
      `SELECT 
        p.id, p.title, p.slug, p.excerpt, p.featured_image, 
        p.status, p.views, p.created_at, p.updated_at,
        u.id as user_id, u.username, u.avatar,
        c.id as category_id, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
      [status, limit, offset]
    );

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

// @desc    Get single post
// @route   GET /api/posts/:slug
// @access  Public
const getPost = async (req, res) => {
  try {
    const { slug } = req.params;

    // Get post with user and category
    const [posts] = await db.execute(
      `SELECT 
        p.*, 
        u.id as user_id, u.username, u.avatar, u.bio,
        c.id as category_id, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.slug = ?`,
      [slug]
    );

    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = posts[0];

    // Increment view count
    await db.execute(
      'UPDATE posts SET views = views + 1 WHERE id = ?',
      [post.id]
    );

    // Get tags
    const [tags] = await db.execute(
      `SELECT t.id, t.name, t.slug
      FROM tags t
      JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = ?`,
      [post.id]
    );

    post.tags = tags;

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new post
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res) => {
  try {
    const { 
      title, 
      content, 
      excerpt, 
      category_id, 
      status, 
      tags, 
      featured_image,
      meta_description,
      focus_keyword,
      custom_slug,
      transliterate_slug 
    } = req.body;
    const userId = req.user.id;

    // Generate slug
    let slug;
    if (custom_slug) {
      // Use custom slug if provided
      slug = slugify(custom_slug);
    } else {
      // Auto-generate from title
      slug = smartSlugify(title, transliterate_slug || false);
    }
    
    // Check if slug exists
    const [existingPosts] = await db.execute(
      'SELECT id FROM posts WHERE slug = ?',
      [slug]
    );

    if (existingPosts.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    // Insert post with SEO fields
    const [result] = await db.execute(
      `INSERT INTO posts (
        title, slug, content, excerpt, featured_image, 
        meta_description, focus_keyword, user_id, category_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, 
        slug, 
        content, 
        excerpt, 
        featured_image || null,
        meta_description || null,
        focus_keyword || null,
        userId, 
        category_id || null, 
        status || 'draft'
      ]
    );

    const postId = result.insertId;

    // Handle tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const tagSlug = smartSlugify(tagName, transliterate_slug || false);
        
        // Check if tag exists
        const [existingTags] = await db.execute(
          'SELECT id FROM tags WHERE slug = ?',
          [tagSlug]
        );

        let tagId;
        if (existingTags.length > 0) {
          tagId = existingTags[0].id;
        } else {
          // Create new tag
          const [tagResult] = await db.execute(
            'INSERT INTO tags (name, slug) VALUES (?, ?)',
            [tagName, tagSlug]
          );
          tagId = tagResult.insertId;
        }

        // Link tag to post
        await db.execute(
          'INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)',
          [postId, tagId]
        );
      }
    }

    res.status(201).json({
      id: postId,
      slug,
      message: 'Post created successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      content, 
      excerpt, 
      category_id, 
      status, 
      featured_image,
      meta_description,
      focus_keyword,
      custom_slug,
      transliterate_slug
    } = req.body;
    const userId = req.user.id;

    // Check if post exists and user owns it
    const [posts] = await db.execute(
      'SELECT id, user_id, featured_image, slug FROM posts WHERE id = ?',
      [id]
    );

    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (posts[0].user_id !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this post' });
    }

    const oldFeaturedImage = posts[0].featured_image;
    let newSlug = posts[0].slug;

    // Handle slug update if title changed or custom slug provided
    if (custom_slug || (title && transliterate_slug !== undefined)) {
      if (custom_slug) {
        newSlug = slugify(custom_slug);
      } else if (title) {
        newSlug = smartSlugify(title, transliterate_slug || false);
      }

      // Check if new slug exists (excluding current post)
      const [existingPosts] = await db.execute(
        'SELECT id FROM posts WHERE slug = ? AND id != ?',
        [newSlug, id]
      );

      if (existingPosts.length > 0) {
        newSlug = `${newSlug}-${Date.now()}`;
      }
    }

    // Update post with SEO fields
    await db.execute(
      `UPDATE posts 
      SET title = ?, slug = ?, content = ?, excerpt = ?, 
          featured_image = ?, meta_description = ?, focus_keyword = ?,
          category_id = ?, status = ? 
      WHERE id = ?`,
      [
        title, 
        newSlug,
        content, 
        excerpt, 
        featured_image || null,
        meta_description || null,
        focus_keyword || null,
        category_id, 
        status, 
        id
      ]
    );

    // If featured image changed, delete old image
    if (oldFeaturedImage && oldFeaturedImage !== featured_image) {
      try {
        const oldImagePath = path.join(__dirname, '..', oldFeaturedImage);
        await fs.unlink(oldImagePath);
      } catch (error) {
        console.error('Error deleting old featured image:', error);
      }
    }

    res.json({ 
      message: 'Post updated successfully',
      slug: newSlug 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists and user owns it
    const [posts] = await db.execute(
      'SELECT id, user_id, featured_image FROM posts WHERE id = ?',
      [id]
    );

    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (posts[0].user_id !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    const featuredImage = posts[0].featured_image;

    // Delete post (related comments and tags will be deleted automatically)
    await db.execute('DELETE FROM posts WHERE id = ?', [id]);

    // Delete featured image if exists
    if (featuredImage) {
      try {
        const imagePath = path.join(__dirname, '..', featuredImage);
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

// @desc    Like/Unlike post
// @route   POST /api/posts/:id/like
// @access  Private
const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if already liked
    const [likes] = await db.execute(
      'SELECT * FROM post_likes WHERE user_id = ? AND post_id = ?',
      [userId, id]
    );

    if (likes.length > 0) {
      // Unlike
      await db.execute(
        'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
        [userId, id]
      );
      res.json({ liked: false, message: 'Post unliked' });
    } else {
      // Like
      await db.execute(
        'INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)',
        [userId, id]
      );
      res.json({ liked: true, message: 'Post liked' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Search posts
// @route   GET /api/posts/search?q=query
// @access  Public
const searchPosts = async (req, res) => {
  try {
    const { q, category, tag } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    let query = `
      SELECT DISTINCT
        p.id, p.title, p.slug, p.excerpt, p.featured_image, 
        p.meta_description, p.focus_keyword,
        p.status, p.views, p.created_at,
        u.id as user_id, u.username, u.avatar,
        c.id as category_id, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.status = 'published'
    `;

    const params = [];

    // Search in title, content, meta_description, focus_keyword
    if (q) {
      query += ` AND (
        p.title LIKE ? OR 
        p.content LIKE ? OR 
        p.meta_description LIKE ? OR 
        p.focus_keyword LIKE ?
      )`;
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Filter by category
    if (category) {
      query += ` AND c.slug = ?`;
      params.push(category);
    }

    // Filter by tag
    if (tag) {
      query += ` AND t.slug = ?`;
      params.push(tag);
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT DISTINCT p.id, p.title, p.slug, p.excerpt, p.featured_image, p.meta_description, p.focus_keyword, p.status, p.views, p.created_at, u.id as user_id, u.username, u.avatar, c.id as category_id, c.name as category_name, c.slug as category_slug',
      'SELECT COUNT(DISTINCT p.id) as total'
    );
    
    const [countResult] = await db.execute(countQuery, params);
    const total = countResult[0].total;

    // Get posts
    query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [posts] = await db.execute(query, params);

    res.json({
      posts,
      searchTerm: q,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPosts: total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  searchPosts
};