const db = require('../config/database');

// @desc    Get comments for a post
// @route   GET /api/posts/:postId/comments
// @access  Public
const getComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const [comments] = await db.execute(
      `SELECT 
        c.id, c.content, c.created_at, c.parent_id,
        u.id as user_id, u.username, u.avatar
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at DESC`,
      [postId]
    );

    // Organize comments into nested structure
    const commentMap = {};
    const rootComments = [];

    comments.forEach(comment => {
      comment.replies = [];
      commentMap[comment.id] = comment;
      
      if (comment.parent_id === null) {
        rootComments.push(comment);
      }
    });

    comments.forEach(comment => {
      if (comment.parent_id !== null && commentMap[comment.parent_id]) {
        commentMap[comment.parent_id].replies.push(comment);
      }
    });

    res.json(rootComments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create comment
// @route   POST /api/posts/:postId/comments
// @access  Private
const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.user.id;

    // Check if post exists
    const [posts] = await db.execute(
      'SELECT id FROM posts WHERE id = ?',
      [postId]
    );

    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Insert comment
    const [result] = await db.execute(
      'INSERT INTO comments (content, post_id, user_id, parent_id) VALUES (?, ?, ?, ?)',
      [content, postId, userId, parentId || null]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Comment created successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if comment exists and user owns it
    const [comments] = await db.execute(
      'SELECT id, user_id FROM comments WHERE id = ?',
      [id]
    );

    if (comments.length === 0) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comments[0].user_id !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // Delete comment
    await db.execute('DELETE FROM comments WHERE id = ?', [id]);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getComments,
  createComment,
  deleteComment
};