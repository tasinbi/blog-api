const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { protect } = require('../middleware/authMiddleware');
const {
  uploadFeaturedImage,
  uploadContentImage,
  uploadPDF,
  uploadEditorFile
} = require('../middleware/uploadMiddleware');

// @desc    Upload featured image
// @route   POST /api/upload/featured
// @access  Private
router.post('/featured', protect, uploadFeaturedImage, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  res.json({
    message: 'Featured image uploaded successfully',
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: `/uploads/featured/${req.file.filename}`
    }
  });
});

// @desc    Upload content image
// @route   POST /api/upload/image
// @access  Private
router.post('/image', protect, uploadContentImage, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  res.json({
    message: 'Image uploaded successfully',
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: `/uploads/images/${req.file.filename}`
    }
  });
});

// @desc    Upload PDF
// @route   POST /api/upload/pdf
// @access  Private
router.post('/pdf', protect, uploadPDF, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  res.json({
    message: 'PDF uploaded successfully',
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      url: `/uploads/pdfs/${req.file.filename}`
    }
  });
});

// @desc    Upload file for editor (image or PDF)
// @route   POST /api/upload/editor
// @access  Private
router.post('/editor', protect, uploadEditorFile, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'pdf';
  const folder = fileType === 'image' ? 'images' : 'pdfs';

  res.json({
    message: 'File uploaded successfully',
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      type: fileType,
      url: `/uploads/${folder}/${req.file.filename}`
    }
  });
});

// @desc    Delete uploaded file
// @route   DELETE /api/upload/:type/:filename
// @access  Private
router.delete('/:type/:filename', protect, async (req, res) => {
  try {
    const { type, filename } = req.params;
    
    // Validate type
    const validTypes = ['featured', 'images', 'pdfs'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid file type' });
    }

    // Construct file path
    const filePath = path.join(__dirname, '..', 'uploads', type, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete file
    await fs.unlink(filePath);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting file' });
  }
});

// @desc    Get uploaded files list
// @route   GET /api/upload/list/:type
// @access  Private
router.get('/list/:type', protect, async (req, res) => {
  try {
    const { type } = req.params;
    
    // Validate type
    const validTypes = ['featured', 'images', 'pdfs'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid file type' });
    }

    // Read directory
    const dirPath = path.join(__dirname, '..', 'uploads', type);
    const files = await fs.readdir(dirPath);

    // Get file details
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(dirPath, filename);
        const stats = await fs.stat(filePath);
        return {
          filename,
          size: stats.size,
          uploadedAt: stats.birthtime,
          url: `/uploads/${type}/${filename}`
        };
      })
    );

    res.json({
      type,
      count: fileDetails.length,
      files: fileDetails
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving files' });
  }
});

module.exports = router;