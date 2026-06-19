import { Request, Response } from 'express';

const UPSTREAM = 'https://www.emsifa.com/api-wilayah-indonesia/api';

// Simple in-memory cache to avoid repeated upstream calls for the same data
const cache = new Map<string, { data: unknown; at: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchCached(url: string): Promise<unknown> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Upstream ${res.status}: ${url}`);
  const data = await res.json();
  cache.set(url, { data, at: Date.now() });
  return data;
}

export const getProvinces = async (_req: Request, res: Response) => {
  try {
    const data = await fetchCached(`${UPSTREAM}/provinces.json`);
    res.json(data);
  } catch (error) {
    console.error('Wilayah provinces error:', error);
    res.status(502).json({ message: 'Gagal mengambil data provinsi' });
  }
};

export const getCities = async (req: Request, res: Response) => {
  try {
    const data = await fetchCached(`${UPSTREAM}/regencies/${req.params.province_id}.json`);
    res.json(data);
  } catch (error) {
    console.error('Wilayah cities error:', error);
    res.status(502).json({ message: 'Gagal mengambil data kota/kabupaten' });
  }
};

export const getDistricts = async (req: Request, res: Response) => {
  try {
    const data = await fetchCached(`${UPSTREAM}/districts/${req.params.city_id}.json`);
    res.json(data);
  } catch (error) {
    console.error('Wilayah districts error:', error);
    res.status(502).json({ message: 'Gagal mengambil data kecamatan' });
  }
};

export const getVillages = async (req: Request, res: Response) => {
  try {
    const data = await fetchCached(`${UPSTREAM}/villages/${req.params.district_id}.json`);
    res.json(data);
  } catch (error) {
    console.error('Wilayah villages error:', error);
    res.status(502).json({ message: 'Gagal mengambil data desa/kelurahan' });
  }
};
