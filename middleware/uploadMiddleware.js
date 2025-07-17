const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Helper function to create unique filename
const generateFilename = (file) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  return file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
};

// Storage configuration for featured images
const featuredImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/featured');
  },
  filename: (req, file, cb) => {
    cb(null, generateFilename(file));
  }
});

// Storage configuration for content images
const contentImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images');
  },
  filename: (req, file, cb) => {
    cb(null, generateFilename(file));
  }
});

// Storage configuration for PDFs
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/pdfs');
  },
  filename: (req, file, cb) => {
    cb(null, generateFilename(file));
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// File filter for PDFs
const pdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

// File filter for mixed content (images and PDFs)
const mixedFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  const isImage = imageTypes.test(path.extname(file.originalname).toLowerCase());
  const isPDF = file.mimetype === 'application/pdf';

  if (isImage || isPDF) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) and PDF files are allowed'));
  }
};

// Upload middleware for featured images
const uploadFeaturedImage = multer({
  storage: featuredImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: imageFilter
}).single('featured_image');

// Upload middleware for content images
const uploadContentImage = multer({
  storage: contentImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: imageFilter
}).single('image');

// Upload middleware for PDFs
const uploadPDF = multer({
  storage: pdfStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for PDFs
  },
  fileFilter: pdfFilter
}).single('pdf');

// Upload middleware for editor (mixed content)
const uploadEditorFile = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const imageTypes = /jpeg|jpg|png|gif|webp/;
      const isImage = imageTypes.test(path.extname(file.originalname).toLowerCase());
      
      if (isImage) {
        cb(null, 'uploads/images');
      } else {
        cb(null, 'uploads/pdfs');
      }
    },
    filename: (req, file, cb) => {
      cb(null, generateFilename(file));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: mixedFilter
}).single('file');

// Error handling wrapper
const handleMulterError = (uploadFunction) => {
  return (req, res, next) => {
    uploadFunction(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File too large' });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  };
};

module.exports = {
  uploadFeaturedImage: handleMulterError(uploadFeaturedImage),
  uploadContentImage: handleMulterError(uploadContentImage),
  uploadPDF: handleMulterError(uploadPDF),
  uploadEditorFile: handleMulterError(uploadEditorFile)
};