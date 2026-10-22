require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname,`public`)));

app.get('/', (req, res) => {
 res.sendFile(path.join(__dirname,`public`, 'index.html'));
});
const MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];

async function generateWithRetry(prompt) {
  for (const name of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        if (error.status === 404) break;
        if (error.status === 503 || error.status === 429) {
          await new Promise(r => setTimeout(r, 1500 * attempt));
          continue;
        }
        throw error;
      }
    }
  }
  throw new Error('All models busy');
}

app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  try {
    const reply = await generateWithRetry(prompt);
    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: 'AI এখন ব্যস্ত, একটু পরে আবার চেষ্টা করুন' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
