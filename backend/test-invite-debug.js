import express from 'express';
const app = express();

app.use(express.json());

// Debug middleware
app.use((req, res, next) => {
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Body type:', typeof req.body);
  console.log('Body keys:', Object.keys(req.body || {}));
  next();
});

app.post('/test', (req, res) => {
  const { email, first_name, last_name } = req.body;
  console.log('Extracted values:', { email, first_name, last_name });
  console.log('Email exists?', !!email);
  console.log('First name exists?', !!first_name);
  console.log('Last name exists?', !!last_name);
  
  if (!email || !first_name || !last_name) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      received: req.body,
      missing: {
        email: !email,
        first_name: !first_name,
        last_name: !last_name
      }
    });
  }
  
  res.json({ success: true, received: req.body });
});

app.listen(3003, () => {
  console.log('Debug server running on port 3003');
});