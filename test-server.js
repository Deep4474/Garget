const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', express.static(path.join(__dirname)));

// In-memory user store
const registeredUsers = {};

// In-memory order store
const orders = [];

// Test endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'GOD OWN PHONE GADGET API is running',
        timestamp: new Date().toISOString(),
        environment: 'test'
    });
});

// Mock products endpoint
app.get('/api/products/featured', (req, res) => {
    const limit = parseInt(req.query.limit) || 8;
    
    const mockProducts = [
        {
            id: '1',
            name: 'Premium Smartphone',
            description: 'Latest flagship smartphone with cutting-edge features',
            price: 999,
            image: 'images/product1.jpg',
            category: 'phones',
            stock: 10
        },
        {
            id: '2',
            name: 'High-Performance Tablet',
            description: 'Perfect for work and entertainment on the go',
            price: 699,
            image: 'images/product2.jpg',
            category: 'tablets',
            stock: 15
        },
        {
            id: '3',
            name: 'Wireless Earbuds',
            description: 'Crystal clear sound with noise cancellation',
            price: 199,
            image: 'images/product3.jpg',
            category: 'accessories',
            stock: 25
        },
        {
            id: '4',
            name: 'Budget-Friendly Phone',
            description: 'Great value for money with essential features',
            price: 299,
            image: 'images/product4.jpg',
            category: 'phones',
            stock: 20
        }
    ];
    
    res.json({
        success: true,
        data: mockProducts.slice(0, limit)
    });
});

// Mock register endpoint
app.post('/api/auth/register', (req, res) => {
    const { email, name, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    if (registeredUsers[email]) {
        return res.status(400).json({ success: false, message: 'User already registered' });
    }
    registeredUsers[email] = { name: name || 'Demo User', email, password };
    res.json({
        success: true,
        token: 'mock-jwt-token',
        user: {
            id: '1',
            name: name || 'Demo User',
            email,
            role: 'user'
        }
    });
});

// Mock login endpoint
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = registeredUsers[email];
    if (!user || user.password !== password) {
        return res.status(401).json({ success: false, message: 'Invalid credentials or not registered' });
    }
    res.json({
        success: true,
        token: 'mock-jwt-token',
        user: {
            id: '1',
            name: user.name,
            email: user.email,
            role: 'user'
        }
    });
});

// Update checkout endpoint to store orders
app.post('/api/checkout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== 'Bearer mock-jwt-token') {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }
    const { method, cart, address } = req.body;
    if (!method || !['pickup', 'delivery'].includes(method)) {
        return res.status(400).json({ success: false, message: 'Checkout method must be pickup or delivery' });
    }
    if (method === 'delivery' && !address) {
        return res.status(400).json({ success: false, message: 'Delivery address required for delivery method' });
    }
    // Simulate user email from token (in real app, decode token)
    const userEmail = Object.keys(registeredUsers)[0] || 'unknown@example.com';
    const order = {
        id: Date.now().toString(),
        user: userEmail,
        method,
        address: method === 'delivery' ? address : undefined,
        cart,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    orders.push(order);
    res.json({
        success: true,
        message: 'Order sent for admin approval.',
        orderId: order.id
    });
});

// Admin: Get all orders
app.get('/api/admin/orders', (req, res) => {
    res.json({ success: true, orders });
});

// Admin: Confirm order (with message)
app.post('/api/admin/orders/:id/confirm', (req, res) => {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const msg = req.body && req.body.message ? req.body.message : '';
    order.status = 'confirmed';
    order.adminMessage = msg;
    res.json({ success: true, message: 'Order confirmed', order });
});

// Admin: Reject order (with message)
app.post('/api/admin/orders/:id/reject', (req, res) => {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const msg = req.body && req.body.message ? req.body.message : '';
    order.status = 'rejected';
    order.adminMessage = msg;
    res.json({ success: true, message: 'Order rejected', order });
});

// User: Get my orders (simulate by email)
app.get('/api/my-orders', (req, res) => {
    // Simulate user email from token
    const userEmail = Object.keys(registeredUsers)[0] || 'unknown@example.com';
    const myOrders = orders.filter(o => o.user === userEmail);
    res.json({ success: true, orders: myOrders });
});

// Catch-all for unknown API routes (returns JSON 404)
app.all('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Serve the main HTML file for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Test server running on port ${PORT}`);
    console.log(`📱 GOD OWN PHONE GADGET Test Server is live!`);
    console.log(`🔗 API URL: http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend URL: http://localhost:${PORT}`);
}); 