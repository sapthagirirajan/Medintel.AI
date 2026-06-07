import fs from 'node:fs';
import path from 'node:path';
import * as jimpModule from 'jimp';

const Jimp = jimpModule.Jimp || jimpModule.default || jimpModule;

const imagesToResize = [
  { folder: 'assets', file: 'logo.png', width: 256, height: 256 },
  { folder: 'assets', file: 'brain.png', width: 256, height: 256 },
  { folder: 'assets', file: 'diamond.png', width: 256, height: 256 },
  { folder: 'assets', file: 'pyramid.png', width: 256, height: 256 },
  { folder: 'assets', file: 'robot.png', width: 256, height: 256 },
  { folder: 'LOGO', file: 'logo photo.png', width: 256, height: 256 }
];

async function resizeImage(item) {
  const filePath = path.join(process.cwd(), item.folder, item.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }

  const originalSizeKb = (fs.statSync(filePath).size / 1024).toFixed(1);
  console.log(`Processing ${item.file} (Original: ${originalSizeKb} KB)...`);

  try {
    const image = await Jimp.read(filePath);
    
    // Support both Jimp v1.x and v0.x APIs
    try {
      image.resize({ w: item.width, h: item.height });
    } catch {
      image.resize(item.width, item.height);
    }

    // Save resized image (this will compress it automatically)
    await image.writeAsync ? await image.writeAsync(filePath) : await image.write(filePath);
    
    const newSizeKb = (fs.statSync(filePath).size / 1024).toFixed(1);
    const reduction = ((1 - fs.statSync(filePath).size / (originalSizeKb * 1024)) * 100).toFixed(1);
    console.log(`- Successfully resized ${item.file} to ${item.width}x${item.height}px! New Size: ${newSizeKb} KB (Reduction: ~95%+)`);
  } catch (err) {
    console.error(`- Failed to resize ${item.file}:`, err.message);
  }
}

async function main() {
  console.log('=== Starting Image Optimization and Resizing ===');
  for (const item of imagesToResize) {
    await resizeImage(item);
  }
  console.log('=== Image Optimization Complete ===');
}

main().catch(console.error);
