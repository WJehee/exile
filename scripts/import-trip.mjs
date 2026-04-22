/**
 * Import a trip from a directory of images.
 * Reads GPS and date EXIF data from each image and generates a trip.yaml skeleton.
 *
 * Usage: node scripts/import-trip.mjs <image-dir> <trip-slug>
 * Or via just: just import-trip <image-dir> <trip-slug>
 */

import { readdir, mkdir, copyFile, writeFile, access } from 'fs/promises';
import { join, extname, basename } from 'path';
import { parse as parseExif } from 'exifr';
import { dump as yamlDump } from 'js-yaml';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.webp', '.tiff']);

async function main() {
  const [, , sourceDir, slug] = process.argv;

  if (!sourceDir || !slug) {
    console.error('Usage: node scripts/import-trip.mjs <image-dir> <trip-slug>');
    process.exit(1);
  }

  const tripDir = join(process.cwd(), 'trips', slug);
  const publicImagesDir = join(process.cwd(), 'public', 'trips', slug, 'images');

  // Create directories
  await mkdir(tripDir, { recursive: true });
  await mkdir(publicImagesDir, { recursive: true });

  // Check if trip.yaml already exists
  const yamlPath = join(tripDir, 'trip.yaml');
  try {
    await access(yamlPath);
    console.error(`trips/${slug}/trip.yaml already exists. Remove it first if you want to reimport.`);
    process.exit(1);
  } catch {
    // expected — file does not exist yet
  }

  // Read image files
  const files = (await readdir(sourceDir))
    .filter(f => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.error(`No image files found in ${sourceDir}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} images. Reading EXIF data...`);

  const imageData = [];
  for (const file of files) {
    const srcPath = join(sourceDir, file);
    let exif = {};
    try {
      exif = await parseExif(srcPath, {
        gps: true,
        pick: ['GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef', 'DateTimeOriginal', 'CreateDate'],
      }) ?? {};
    } catch {
      // No EXIF data in this file
    }

    const lat = exif.latitude ?? null;
    const lon = exif.longitude ?? null;
    const date = exif.DateTimeOriginal ?? exif.CreateDate ?? null;

    imageData.push({ file, lat, lon, date });

    if (lat && lon) {
      console.log(`  ${file}: ${lat.toFixed(4)}, ${lon.toFixed(4)} (${date ? formatDate(date) : 'no date'})`);
    } else {
      console.log(`  ${file}: no GPS data (${date ? formatDate(date) : 'no date'})`);
    }
  }

  // Group images by GPS proximity (within ~10km) to suggest stops
  const stops = groupIntoStops(imageData);

  // Copy images to public directory
  console.log(`\nCopying ${files.length} images to public/trips/${slug}/images/...`);
  for (const file of files) {
    await copyFile(join(sourceDir, file), join(publicImagesDir, file));
  }

  // Build the YAML skeleton
  const tripData = {
    title: slug.replace(/-/g, ' '),
    date_start: stops[0]?.date ?? formatDate(new Date()),
    date_end: stops.at(-1)?.date ?? null,
    description: '',
    stops: stops.map(stop => ({
      name: stop.name,
      lat: stop.lat !== null ? parseFloat(stop.lat.toFixed(4)) : 0,
      lon: stop.lon !== null ? parseFloat(stop.lon.toFixed(4)) : 0,
      date: stop.date ?? null,
      note: '',
      images: stop.images,
    })),
  };

  // Remove null values for cleaner YAML
  const yaml = yamlDump(tripData, { noRefs: true, sortKeys: false })
    .replace(/: null\n/g, ':\n');

  await writeFile(yamlPath, yaml);

  console.log(`\nDone. Edit trips/${slug}/trip.yaml to fill in names and notes.`);
  console.log(`Images are at public/trips/${slug}/images/`);
}

function formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return String(d).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function groupIntoStops(images) {
  // Images without GPS go into a single unnamed stop
  const withGps = images.filter(i => i.lat !== null && i.lon !== null);
  const withoutGps = images.filter(i => i.lat === null || i.lon === null);

  const stops = [];

  // Simple clustering: greedily group images within ~0.1 degrees (~10km) of each other
  const used = new Set();
  for (let i = 0; i < withGps.length; i++) {
    if (used.has(i)) continue;
    const group = [withGps[i]];
    used.add(i);
    for (let j = i + 1; j < withGps.length; j++) {
      if (used.has(j)) continue;
      const dlat = Math.abs(withGps[i].lat - withGps[j].lat);
      const dlon = Math.abs(withGps[i].lon - withGps[j].lon);
      if (dlat < 0.1 && dlon < 0.1) {
        group.push(withGps[j]);
        used.add(j);
      }
    }
    const avgLat = group.reduce((s, x) => s + x.lat, 0) / group.length;
    const avgLon = group.reduce((s, x) => s + x.lon, 0) / group.length;
    const dates = group.map(x => x.date).filter(Boolean).sort();
    stops.push({
      name: `Stop ${stops.length + 1}`,
      lat: avgLat,
      lon: avgLon,
      date: dates[0] ? formatDate(dates[0]) : null,
      images: group.map(x => x.file),
    });
  }

  if (withoutGps.length > 0) {
    stops.push({
      name: 'Unknown location',
      lat: null,
      lon: null,
      date: null,
      images: withoutGps.map(x => x.file),
    });
  }

  return stops;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
