import express from 'express';
import guildsRouter from './routes/guilds';

const router = express.Router();
router.use('/guilds', guildsRouter);

export default router;
