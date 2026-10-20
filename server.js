require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;
  try {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const response = await model.generateContent(prompt);
    res.json({ reply: response.text() });
  } catch (error) {
    res.status(500).json({ error: 'failed to generate response' });
  }
});

app.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
