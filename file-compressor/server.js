const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-lib');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const cors = require('cors');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Ensure directories exist
const ensureDirectories = () => {
  const dirs = ['uploads', 'compressed'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  });
};
ensureDirectories();

// Routes
app.post('/api/compress-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { quality } = req.body;
    const inputPath = req.file.path;
    const outputPath = path.join('compressed', `compressed-${req.file.filename}`);

    // Load and save PDF (simplified compression for demo)
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await pdf.PDFDocument.load(pdfBytes);
    const compressedPdfBytes = await pdfDoc.save();

    fs.writeFileSync(outputPath, compressedPdfBytes);

    // Calculate sizes
    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    const savings = Math.round((1 - compressedSize / originalSize) * 100);

    // Clean up
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      downloadUrl: `/download?file=${path.basename(outputPath)}`,
      originalSize,
      compressedSize,
      savings
    });

  } catch (error) {
    console.error('PDF compression error:', error);
    res.status(500).json({ error: 'Failed to compress PDF' });
  }
});

app.post('/api/compress-image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { quality } = req.body;
    const inputPath = req.file.path;
    const outputPath = path.join('compressed', `compressed-${req.file.filename}`);

    // Compress image using sharp
    await sharp(inputPath)
      .jpeg({ quality: parseInt(quality) })
      .toFile(outputPath);

    // Calculate sizes
    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    const savings = Math.round((1 - compressedSize / originalSize) * 100);

    // Clean up
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      downloadUrl: `/download?file=${path.basename(outputPath)}`,
      originalSize,
      compressedSize,
      savings
    });

  } catch (error) {
    console.error('Image compression error:', error);
    res.status(500).json({ error: 'Failed to compress image' });
  }
});

app.post('/api/compress-video', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { quality } = req.body;
    const inputPath = req.file.path;
    const outputPath = path.join('compressed', `compressed-${req.file.filename}`);

    // Video compression settings
    const settings = {
      high: { bitrate: '500k', size: '640x360' },
      medium: { bitrate: '1000k', size: '854x480' },
      low: { bitrate: '2000k', size: '1280x720' }
    }[quality] || settings.medium;

    // Compress video
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoBitrate(settings.bitrate)
        .size(settings.size)
        .on('error', reject)
        .on('end', resolve)
        .save(outputPath);
    });

    // Calculate sizes
    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;
    const savings = Math.round((1 - compressedSize / originalSize) * 100);

    // Clean up
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      downloadUrl: `/download?file=${path.basename(outputPath)}`,
      originalSize,
      compressedSize,
      savings
    });

  } catch (error) {
    console.error('Video compression error:', error);
    res.status(500).json({ error: 'Failed to compress video' });
  }
});

app.get('/download', (req, res) => {
  const fileName = req.query.file;
  const filePath = path.join('compressed', fileName);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, fileName, (err) => {
      if (!err) fs.unlinkSync(filePath); // Delete after download
    });
  } else {
    res.status(404).send('File not found');
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Make sure FFmpeg is installed: ${ffmpegPath}`);
});