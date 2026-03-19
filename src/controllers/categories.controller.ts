import { Request, Response } from 'express';
import { query } from '../config/database';

// Get all categories with pagination
export const getCategories = async (req: Request, res: Response) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let queryText = `
      SELECT c.*,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
      FROM categories c
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      queryText += ` AND (c.name ILIKE $${paramCount} OR c.slug ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY c.name ASC`;

    // Pagination
    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    queryText += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await query(queryText, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM categories c WHERE 1=1';
    const countParams: any[] = [];

    if (search) {
      countQuery += ` AND (c.name ILIKE $1 OR c.slug ILIKE $1)`;
      countParams.push(`%${search}%`);
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      message: 'Data kategori berhasil diambil',
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Get category by ID
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
       FROM categories c
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    }

    res.json({
      message: 'Data kategori berhasil diambil',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get category by id error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Create category
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, slug, description, image_url } = req.body;

    // Validation
    if (!name || !slug) {
      return res.status(400).json({ message: 'Nama dan slug wajib diisi' });
    }

    // Check if slug already exists
    const existingSlug = await query(
      'SELECT id FROM categories WHERE slug = $1',
      [slug]
    );

    if (existingSlug.rows.length > 0) {
      return res.status(400).json({ message: 'Slug sudah digunakan' });
    }

    const result = await query(
      `INSERT INTO categories (name, slug, description, image_url, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [name, slug, description || null, image_url || null]
    );

    res.status(201).json({
      message: 'Kategori berhasil ditambahkan',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Update category
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, description, image_url } = req.body;

    // Check if category exists
    const existing = await query('SELECT id FROM categories WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    }

    // Check if slug already exists for another category
    if (slug) {
      const existingSlug = await query(
        'SELECT id FROM categories WHERE slug = $1 AND id != $2',
        [slug, id]
      );

      if (existingSlug.rows.length > 0) {
        return res.status(400).json({ message: 'Slug sudah digunakan' });
      }
    }

    const result = await query(
      `UPDATE categories
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           description = $3,
           image_url = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, slug, description, image_url, id]
    );

    res.json({
      message: 'Kategori berhasil diperbarui',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Delete category
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category has products
    const productsCount = await query(
      'SELECT COUNT(*) FROM products WHERE category_id = $1',
      [id]
    );

    if (parseInt(productsCount.rows[0].count) > 0) {
      return res.status(400).json({
        message: 'Kategori tidak dapat dihapus karena masih memiliki produk'
      });
    }

    // Check if category exists
    const existing = await query('SELECT id FROM categories WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    }

    await query('DELETE FROM categories WHERE id = $1', [id]);

    res.json({ message: 'Kategori berhasil dihapus' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
