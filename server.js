require('dotenv').config();
const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const ai = new GoogleGenAI();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [prompt],
    });
    res.json({ reply: response.text });
  } catch (error) {
    res.status(500).json({ error: 'failed to generate response' });
  }
});

app.listen(PORT, () => {
  console.log(Server is running on port ${PORT});
});
