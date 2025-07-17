const db = require('../config/database');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const [categories] = await db.execute(
      'SELECT * FROM categories ORDER BY name ASC'
    );

    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get posts by category
// @route   GET /api/categories/:slug/posts
// @access  Public
const getPostsByCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get category
    const [categories] = await db.execute(
      'SELECT * FROM categories WHERE slug = ?',
      [slug]
    );

    if (categories.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const category = categories[0];

    // Get total count
    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM posts WHERE category_id = ? AND status = ?',
      [category.id, 'published']
    );
    const total = countResult[0].total;

    // Get posts
    const [posts] = await db.execute(
      `SELECT 
        p.id, p.title, p.slug, p.excerpt, p.featured_image, 
        p.views, p.created_at,
        u.id as user_id, u.username, u.avatar
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.category_id = ? AND p.status = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
      [category.id, 'published', limit, offset]
    );

    res.json({
      category,
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

module.exports = {
  getCategories,
  getPostsByCategory
};