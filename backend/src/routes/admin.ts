import { Router, Response, NextFunction } from 'express';
import { AdminController } from '../controllers/adminController';

const router = Router();

// Superuser Middleware
const isSuperuser = (req: any, res: Response, next: NextFunction) => {
    // BattleNet ID check for 100379014
    if (req.user && String(req.user.battleNetId) === '100379014') {
        return next();
    }
    console.warn(`[SECURITY] Blocked non-superuser access to admin routes: ${req.user?.battleNetId}`);
    return res.status(403).json({ success: false, error: 'Forbidden: Superuser access required' });
};

// Apply superuser middleware to all admin routes
router.use(isSuperuser);

// Table management
router.get('/tables', AdminController.listTables);
router.get('/tables/:table', AdminController.getTableRecords);
router.patch('/tables/:table/:id', AdminController.updateRecord);
router.delete('/tables/:table/:id', AdminController.deleteRecord);

// System management
router.post('/system/reset', AdminController.fullReset);

export default router;
