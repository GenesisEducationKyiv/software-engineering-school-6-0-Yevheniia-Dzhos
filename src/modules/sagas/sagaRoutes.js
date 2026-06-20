import { Router } from 'express';
import { getSaga, listSagas } from './sagaController.js';

const router = Router();

router.get('/sagas', listSagas);
router.get('/sagas/:id', getSaga);

export default router;
