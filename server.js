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

// Function to send notifications using Firebase HTTP v1 API to all tokens
const sendNotification = async (userId, message) => {
  try {
    // Get an access token using the service account credentials
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // Fetch all tokens for the given userId
    const [tokenResults] = await db.promise().query('SELECT token FROM tokens WHERE user_id = 1');

    // Create an array of tokens
    const tokens = tokenResults.map(row => row.token);

    // Send notification to each token
    for (const token of tokens) {
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

      await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`Successfully sent message to token: ${token}`);
    }
  } catch (error) {
    console.error('Error sending notification:', error.response ? error.response.data : error.message);
  }
};

// Helper function to send notifications (used in /orders/:id) to all tokens
const sendNotification1 = async (tokens, messages) => {
  try {
    // Get an access token using the service account credentials
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // Ensure that the messages array has the same length as the tokens array
    if (tokens.length !== messages.length) {
      throw new Error('The number of tokens and messages must be the same.');
    }

    // Loop through each token and corresponding message to send notifications
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const message = messages[i];

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

      console.log(`Successfully sent message "${message}" to token ${token}:`, response.data);
    }
  } catch (error) {
    console.error('Error sending notifications:', error.response ? error.response.data : error.message);
  }
};


// Endpoint to handle user registration
app.post('/signup', (req, res) => {
  const { user_id, name, password, email, phone_number } = req.body;
  console.log('Signup request received:', req.body);

  // Validation
  if (!user_id || !name || !password || !email || !phone_number) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (user_id.length !== 10) {
    return res.status(400).json({ error: 'User ID must be exactly 10 characters long' });
  }

  if (!/^\d{10}$/.test(phone_number)) {
    return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: 'Email format is invalid' });
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

    // Send notification to all tokens
    await sendNotification(userId, message);

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


// Endpoint to handle order status update and send notification
app.patch('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const updateOrderSql = 'UPDATE orders SET status = ? WHERE id = ?';
  const fetchOrderSql = 'SELECT * FROM orders WHERE id = ?';
  const fetchTokensSql = 'SELECT token FROM tokens WHERE user_id = ?';

  try {
    // Fetch the order details
    const [orderResults] = await db.promise().query(fetchOrderSql, [id]);

    if (orderResults.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResults[0];

    // Fetch all tokens for the user
    const [tokenResults] = await db.promise().query(fetchTokensSql, [order.user_id]);
    const tokens = tokenResults.map(row => row.token);

    // Update the order status
    await db.promise().query(updateOrderSql, [status, id]);

    // Prepare a message for each token
    const messages = tokens.map(token => `Your order with ID ${id} has been updated to: ${status}`);

    // Send notifications with multiple messages
    await sendNotification1(tokens, messages);

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ error: 'Failed to update order' });
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

// Start the server
const port = process.env.PORT || 3500;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});






