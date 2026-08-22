import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createPlant,
  deletePlant,
  getPlantForUser,
  getPlantsForUser,
  updatePlant,
  validatePlantInput,
} from '../userPlants.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ plants: getPlantsForUser(req.user.id) });
});

router.post('/', (req, res) => {
  const validated = validatePlantInput(req.user.id, req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });
  const plant = createPlant(req.user.id, validated);
  res.status(201).json({ plant });
});

router.put('/:id', (req, res) => {
  const existing = getPlantForUser(req.user.id, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pflanze nicht gefunden.' });

  const validated = validatePlantInput(req.user.id, req.body, { excludePlantId: Number(req.params.id) });
  if (validated.error) return res.status(400).json({ error: validated.error });

  const plant = updatePlant(req.user.id, req.params.id, validated);
  res.json({ plant });
});

router.delete('/:id', (req, res) => {
  const existing = getPlantForUser(req.user.id, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Pflanze nicht gefunden.' });

  const result = deletePlant(req.user.id, req.params.id);
  if (result.error === 'inUse') {
    return res.status(409).json({
      error: `Diese Pflanze wird noch in ${result.count} Pflanzung${result.count === 1 ? '' : 'en'} verwendet und kann nicht gelöscht werden.`,
    });
  }
  res.status(204).end();
});

export default router;
