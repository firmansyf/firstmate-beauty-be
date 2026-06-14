/**
 * One-time migration: re-upload images stored in MinIO to Cloudinary and
 * rewrite the URLs saved in the database.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/migrate-minio-to-cloudinary.ts          # dry run (no DB writes, no uploads)
 *   npx ts-node scripts/migrate-minio-to-cloudinary.ts --apply  # perform uploads + DB updates
 *
 * Idempotent: only URLs pointing at the MinIO host are touched, so re-running
 * after a successful pass is a no-op. A JSON report is written to scripts/.
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { pool } from '../src/config/database';
import { uploadToCloudinary } from '../src/config/cloudinary';

const MINIO_HOST = 'bucket-production-f594.up.railway.app';
const APPLY = process.argv.includes('--apply');

const isMinioUrl = (url: unknown): url is string =>
  typeof url === 'string' && url.includes(MINIO_HOST);

// Cache so the same MinIO object is uploaded to Cloudinary only once
const urlCache = new Map<string, string>();
const report: Array<Record<string, unknown>> = [];
let uploaded = 0;
let failed = 0;
let rowsUpdated = 0;

function log(msg: string) {
  console.log(msg);
  report.push({ ts: new Date().toISOString(), msg });
}

/**
 * Download a MinIO image and re-upload it to Cloudinary.
 * Returns the new Cloudinary URL, or null on failure (caller keeps old URL).
 */
async function migrateUrl(oldUrl: string, folder: string): Promise<string | null> {
  if (!isMinioUrl(oldUrl)) return oldUrl; // already migrated or external
  if (urlCache.has(oldUrl)) return urlCache.get(oldUrl)!;

  if (!APPLY) {
    log(`  [dry-run] would migrate: ${oldUrl}`);
    urlCache.set(oldUrl, oldUrl);
    return oldUrl;
  }

  try {
    const resp = await axios.get<ArrayBuffer>(oldUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const mimetype = (resp.headers['content-type'] as string) || 'image/png';
    const buffer = Buffer.from(resp.data);

    const { url } = await uploadToCloudinary(buffer, mimetype, folder);
    urlCache.set(oldUrl, url);
    uploaded++;
    log(`  ✅ ${oldUrl}\n     -> ${url}`);
    return url;
  } catch (e: any) {
    failed++;
    const status = e.response?.status ?? e.message;
    log(`  ❌ FAILED (${status}) ${oldUrl} — keeping original URL`);
    report.push({ error: true, oldUrl, status });
    return null; // signal failure
  }
}

async function migrateProducts() {
  log('\n=== PRODUCTS ===');
  const { rows } = await pool.query(
    `SELECT id, image_url, images FROM products
     WHERE image_url LIKE $1 OR array_to_string(images, ',') LIKE $1`,
    [`%${MINIO_HOST}%`]
  );
  log(`Found ${rows.length} product row(s) with MinIO images`);

  for (const row of rows) {
    log(`\nProduct #${row.id}`);
    let changed = false;

    // single image_url
    let newImageUrl: string = row.image_url;
    if (isMinioUrl(row.image_url)) {
      const migrated = await migrateUrl(row.image_url, 'products');
      if (migrated && migrated !== row.image_url) {
        newImageUrl = migrated;
        changed = true;
      }
    }

    // images[] array
    const oldImages: string[] = Array.isArray(row.images) ? row.images : [];
    const newImages: string[] = [];
    for (const img of oldImages) {
      if (isMinioUrl(img)) {
        const migrated = await migrateUrl(img, 'products');
        if (migrated && migrated !== img) {
          newImages.push(migrated);
          changed = true;
        } else {
          newImages.push(img); // failed or unchanged -> keep original
        }
      } else {
        newImages.push(img);
      }
    }

    if (APPLY && changed) {
      await pool.query(`UPDATE products SET image_url = $1, images = $2 WHERE id = $3`, [
        newImageUrl,
        newImages,
        row.id,
      ]);
      rowsUpdated++;
      log(`  💾 updated products #${row.id}`);
    }
  }
}

async function migrateBanners() {
  log('\n=== BANNERS ===');
  const { rows } = await pool.query(
    `SELECT id, image_url FROM banners WHERE image_url LIKE $1`,
    [`%${MINIO_HOST}%`]
  );
  log(`Found ${rows.length} banner row(s) with MinIO images`);

  for (const row of rows) {
    log(`\nBanner #${row.id}`);
    const migrated = await migrateUrl(row.image_url, 'banners');
    if (APPLY && migrated && migrated !== row.image_url) {
      await pool.query(`UPDATE banners SET image_url = $1 WHERE id = $2`, [migrated, row.id]);
      rowsUpdated++;
      log(`  💾 updated banners #${row.id}`);
    }
  }
}

async function main() {
  log(`MinIO → Cloudinary migration  (mode: ${APPLY ? 'APPLY' : 'DRY-RUN'})`);
  await migrateProducts();
  await migrateBanners();

  log(`\n=== SUMMARY ===`);
  log(`Uploaded to Cloudinary: ${uploaded}`);
  log(`Failed downloads:       ${failed}`);
  log(`DB rows updated:        ${rowsUpdated}`);
  if (!APPLY) log(`\nThis was a DRY RUN. Re-run with --apply to perform the migration.`);

  const reportPath = path.join(
    __dirname,
    `migration-report-${APPLY ? 'apply' : 'dryrun'}-${Date.now()}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\nReport written to ${reportPath}`);
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
