import { Request, Response } from 'express';
import { query } from '../config/database';

// Public: Get active banners (for homepage)
export const getActiveBanners = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, title, description, image_url, link_url, display_order
       FROM banners
       WHERE is_active = true
       AND (start_date IS NULL OR start_date <= NOW())
       AND (end_date IS NULL OR end_date >= NOW())
       ORDER BY display_order ASC, created_at DESC`
    );

    res.json({
      message: 'Data banner berhasil diambil',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get active banners error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get all banners
export const getAllBanners = async (req: Request, res: Response) => {
  try {
    const { is_active, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let queryText = `SELECT * FROM banners WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 0;

    if (is_active !== undefined && is_active !== '') {
      paramCount++;
      queryText += ` AND is_active = $${paramCount}`;
      params.push(is_active === 'true');
    }

    if (search) {
      paramCount++;
      queryText += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY display_order ASC, created_at DESC`;

    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    queryText += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await query(queryText, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM banners WHERE 1=1`;
    const countParams: any[] = [];
    let countParamNum = 0;

    if (is_active !== undefined && is_active !== '') {
      countParamNum++;
      countQuery += ` AND is_active = $${countParamNum}`;
      countParams.push(is_active === 'true');
    }

    if (search) {
      countParamNum++;
      countQuery += ` AND (title ILIKE $${countParamNum} OR description ILIKE $${countParamNum})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      message: 'Data banner berhasil diambil',
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get all banners error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Get banner by ID
export const getBannerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM banners WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Banner tidak ditemukan' });
    }

    res.json({
      message: 'Detail banner berhasil diambil',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get banner by ID error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Create banner
export const createBanner = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      image_url,
      link_url,
      is_active = true,
      display_order = 0,
      start_date,
      end_date,
    } = req.body;

    // Validation
    if (!title || !image_url) {
      return res.status(400).json({
        message: 'Judul dan gambar wajib diisi',
      });
    }

    const result = await query(
      `INSERT INTO banners (title, description, image_url, link_url, is_active, display_order, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description, image_url, link_url, is_active, display_order, start_date || null, end_date || null]
    );

    res.status(201).json({
      message: 'Banner berhasil dibuat',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Update banner
export const updateBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      image_url,
      link_url,
      is_active,
      display_order,
      start_date,
      end_date,
    } = req.body;

    // Check if banner exists
    const existingBanner = await query('SELECT id FROM banners WHERE id = $1', [id]);
    if (existingBanner.rows.length === 0) {
      return res.status(404).json({ message: 'Banner tidak ditemukan' });
    }

    const result = await query(
      `UPDATE banners SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        image_url = COALESCE($3, image_url),
        link_url = $4,
        is_active = COALESCE($5, is_active),
        display_order = COALESCE($6, display_order),
        start_date = $7,
        end_date = $8,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [title, description, image_url, link_url, is_active, display_order, start_date || null, end_date || null, id]
    );

    res.json({
      message: 'Banner berhasil diupdate',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Delete banner
export const deleteBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM banners WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Banner tidak ditemukan' });
    }

    res.json({ message: 'Banner berhasil dihapus' });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Admin: Toggle banner active status
export const toggleBannerStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE banners SET
        is_active = NOT is_active,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Banner tidak ditemukan' });
    }

    res.json({
      message: `Banner berhasil ${result.rows[0].is_active ? 'diaktifkan' : 'dinonaktifkan'}`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Toggle banner status error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
