import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

// Trigger restart
const PORT = process.env.PORT || 3001;

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(compression());

// Routes - API v1
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import inventoryRoutes from './routes/inventory.routes';
import orderRoutes from './routes/order.routes';
import cashShiftRoutes from './routes/cashShift.routes';
import configRoutes from './routes/config.routes';
import { tableRouter } from './routes/table.routes';
import deliveryRoutes from './routes/delivery.routes';
import clientRoutes from './routes/client.routes';
import userRoutes from './routes/user.routes';
import roleRoutes from './routes/role.routes';

// Register all routes under /api/v1 for versioning
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1', inventoryRoutes);   // ingredients, stock-movements
app.use('/api/v1', menuRoutes);         // categories, products
app.use('/api/v1/cash-shifts', cashShiftRoutes);
app.use('/api/v1', configRoutes);       // /config
app.use('/api/v1', tableRouter);        // /tables, /areas

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error Handling (must be after all routes)
import { errorHandler, notFoundHandler } from './middleware/error';

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;

