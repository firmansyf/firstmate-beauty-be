// src/routes/cart.routes.ts
import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from '../controllers/cart.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All cart routes require authentication
router.use(authenticateToken);

router.get('/', getCart);
router.post('/items', addToCart);
router.put('/items/:id', updateCartItem);
router.delete('/items/:id', removeCartItem);
router.delete('/clear', clearCart);

export default router;