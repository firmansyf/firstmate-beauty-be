import { Router } from 'express';
import { getProvinces, getCities, getDistricts, getVillages } from '../controllers/wilayah.controller';

const router = Router();

router.get('/provinces', getProvinces);
router.get('/cities/:province_id', getCities);
router.get('/districts/:city_id', getDistricts);
router.get('/villages/:district_id', getVillages);

export default router;
