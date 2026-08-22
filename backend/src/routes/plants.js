import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { plantList } from '../plantCatalog.js';

const router = Router();

router.get('/', authenticate, (req, res) => {
  res.json({ plants: plantList });
});

export default router;
