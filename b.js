const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');

// Initialize express app
const app = express();
app.use(bodyParser.json());
app.use(cors());  // Allow all origins for development; configure more specifically in production

// MySQL connection
const db = mysql.createConnection({
  host: 'database-2.ctkkg4sos8it.us-east-1.rds.amazonaws.com',
  user: 'admin',
  password: 'priyatham',  // Change this to your MySQL password
  database: 'food_app',   // Change this to your database name
});

db.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
});

// Firebase Cloud Messaging setup
const projectId = 'food-6f1c3'; // Replace with your Firebase project ID
const keyFilePath = path.join(__dirname, './serviceAccountKey.json'); // Path to your service account key file

// Create a GoogleAuth instance
const auth = new GoogleAuth({
  keyFile: keyFilePath,
  scopes: 'https://www.googleapis.com/auth/firebase.messaging',
});

// Function to send notifications using Firebase HTTP v1 API
const sendNotification = async (token, message) => {
  try {
    // Get an access token using the service account credentials
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const payload = {
      message: {
        token: token,
        notification: {
          title: 'Order Status Update',
          body: message,
        },
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      },
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Successfully sent message:', response.data);
  } catch (error) {
    console.error('Error sending notification:', error.response ? error.response.data : error.message);
  }
};

// Helper function to send notifications (used in /orders/:id)
const sendNotification1 = async (token, message) => {
  try {
    // Get an access token using the service account credentials
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const payload = {
      message: {
        token: token,
        notification: {
          title: 'Order Status Update',
          body: message,
        },
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      },
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Successfully sent message:', response.data);
  } catch (error) {
    console.error('Error sending notification:', error.response ? error.response.data : error.message);
  }
};

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

// Endpoint to save device token
app.post('/save-token', (req, res) => {
  const { userId, token } = req.body;
  if (!userId || !token) {
    return res.status(400).json({ error: 'User ID and token are required' });
  }

  const query = 'INSERT INTO tokens (user_id, token) VALUES (?, ?)';
  db.query(query, [userId, token], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Error saving token' });
    }
    res.status(200).json({ success: 'Token saved successfully' });
  });
});

// Endpoint to update food item availability
app.put('/food-items/:id', (req, res) => {
  const id = req.params.id;
  const { available } = req.body;

  if (typeof available !== 'boolean') {
    return res.status(400).json({ error: 'Invalid availability status' });
  }

  const query = 'UPDATE food_items SET available = ? WHERE id = ?';
  db.query(query, [available, id], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).json({ error: 'Error updating food item' });
    }
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
    res.json(results);
  });
});

// Endpoint to place an order and send notification
app.post('/place-order', async (req, res) => {
  const { userEmail, userName, userPhone, items, totalAmount, status, userToken, userId } = req.body;
  console.log('Place order request received:', { userEmail, userName, userPhone, items, totalAmount, status, userToken, userId });

  const sql = 'INSERT INTO orders (user_email, user_name, user_phone, items, total_amount, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
  const values = [userEmail, userName, userPhone, items, totalAmount, status, userId];
  
  try {
    const [results] = await db.promise().query(sql, values);
    const newOrderId = results.insertId; // Get the new order ID
    const message = `Order received with ID ${newOrderId}`;

    // Send notification
    await sendNotification(userToken, message);

    res.json({ success: true, orderId: newOrderId });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
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

// Endpoint to fetch all orders
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

// Endpoint to update order status
app.patch('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const updateOrderSql = 'UPDATE orders SET status = ? WHERE id = ?';
  const fetchOrderSql = 'SELECT * FROM orders WHERE id = ?';

  try {
    await db.promise().query(updateOrderSql, [status, id]);

    const [orderResults] = await db.promise().query(fetchOrderSql, [id]);
    if (orderResults.length > 0) {
      const order = orderResults[0];
      const message = ` order with ID ${id} has been updated to ${status}`;

      // Fetch user token from database
      const [tokenResults] = await db.promise().query('SELECT token FROM tokens WHERE user_id = ?', [order.user_id]);
      if (tokenResults.length > 0) {
        const userToken = tokenResults[0].token;
        // Send notification to the user
        console.log(userToken)
        await sendNotification1(userToken, message);
      }

      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});
app.get('/get-token', async (req, res) => {
  const { user_id } = req.query;

  try {
    // Query to get the token from the tokens table where user_id matches
    const [rows] = await db.promise().execute('SELECT token FROM tokens WHERE user_id = 1');

    if (rows.length > 0) {
      // If a token is found, return it in the response
      res.json({ success: true, token: rows[0].token });
    } else {
      // If no token is found, return an appropriate message
      res.status(404).json({ success: false, message: 'Token not found for this user' });
    }
  } catch (error) {
    console.error('Error retrieving token:', error);
    res.status(500).json({ error: 'Error retrieving token' });
  }
});

// Start server
const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
