import express from 'express';

const app = express();
const PORT = 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});