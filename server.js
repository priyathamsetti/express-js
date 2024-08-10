const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());  // Allow all origins for development; configure more specifically in production

// MySQL connection
const db = mysql.createConnection({
  host: 'database-2.ctkkg4sos8it.us-east-1.rds.amazonaws.com',
  user: 'admin',
  password: 'priyatham',  // Change this to your MySQL password
  database: 'food_app',       // Change this to your database name
});

db.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
});

// Endpoint to handle user registration
app.post('/signup', (req, res) => {
  const { user_id, name, password, email, phone_number } = req.body;
  console.log('Signup request received:', req.body);

  if (!user_id || !name || !password || !email || !phone_number) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const query = 'INSERT INTO users (user_id, name, password, email, phone_number) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [user_id, name, password, email, phone_number], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Error signing up user' });
    }
    console.log('User signed up:', results);
    res.status(201).json({ success: true });
  });
});

// Endpoint to handle user login
app.post('/login', (req, res) => {
  const { user_id, password } = req.body;

  if (!user_id || !password) {
    return res.status(400).json({ error: 'User ID and password are required' });
  }

  const query = 'SELECT * FROM users WHERE user_id = ? AND password = ?';
  db.query(query, [user_id, password], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Error logging in user' });
    }
    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid user ID or password' });
    }
    res.json({ success: true, user: results[0] });
  });
});

// Endpoint to update food item availability
app.put('/food-items/:id', (req, res) => { // Changed from POST to PUT
  const id = req.params.id;
  const { available } = req.body;
  console.log('Update food item request received:', { id, available });

  if (typeof available !== 'boolean') {
    return res.status(400).json({ error: 'Invalid availability status' });
  }

  const query = 'UPDATE food_items SET available = ? WHERE id = ?';
  db.query(query, [available, id], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Error updating food item' });
    }
    console.log('Food item updated:', results);
    res.json({ success: true });
  });
});

// Endpoint to fetch all restaurants
app.get('/restaurants', (req, res) => {
  const query = 'SELECT * FROM restaraunts';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Error fetching restaurants' });
    }
    console.log('Restaurants fetched:', results);
    res.json(results);
  });
});
app.post('/place-order', (req, res) => {
  const { userEmail, userName, userPhone, items, totalAmount, status } = req.body;
  console.log(userEmail)
  const sql = 'INSERT INTO orders (user_email, user_name, user_phone, items, total_amount, status) VALUES (?, ?, ?, ?, ?, ?)';
  const values = [userEmail, userName, userPhone, items, totalAmount, status];
  
  db.query(sql, values, (err, results) => {
    if (err) {
      console.error('Error placing order:', err);
      res.status(500).json({ error: 'Failed to place order' });
      return;
    }
    
    const newOrderId = results.insertId; // Get the new order ID
    res.json({ success: true, orderId: newOrderId });
  });
  });

// Endpoint to fetch all food items
app.get('/food-items', (req, res) => {
  const query = 'SELECT * FROM food_items';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Error fetching food items' });
    }
    res.json(results);
  });
});


app.get('/orders', (req, res) => {
  const sql = 'SELECT * FROM orders';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching orders:', err);
      res.status(500).json({ error: 'Failed to fetch orders' });
      return;
    }
    res.json(results);
  });
});

app.patch('/orders/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const sql = 'UPDATE orders SET status = ? WHERE id = ?';
  const values = [status, id];

  db.query(sql, values, (err, results) => {
    if (err) {
      console.error('Error updating order status:', err);
      res.status(500).json({ error: 'Failed to update order status' });
      return;
    }

    if (results.affectedRows === 0) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    res.json({ message: 'Order status updated successfully' });
  });
});

// Start the server
const PORT = 3500;
app.listen(PORT, () => {
  console.log(`Server is running on http://database-2.ctkkg4sos8it.us-east-1.rds.amazonaws.com:${PORT}`);
});
