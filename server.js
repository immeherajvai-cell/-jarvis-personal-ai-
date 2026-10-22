require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const PORT = process.env.PORT || 3000;

const systemPrompt = [
  "সবসময় সম্ভাষণ হিসেবে 'Hey boss!'
  "তোমার নাম জার্ভিস (Jarvis)। তুমি একটি পার্সোনাল এআই অ্যাসিস্ট্যান্ট।",
  "তোমাকে তৈরি করেছেন শাহজালাল।",
  "শাহজালাল একজন দক্ষ ডিজিটাল মার্কেটার এবং এসইও ট্রেইনি।",
  "তার দক্ষতার ক্ষেত্রগুলো:",
  "- ওয়ার্ডপ্রেস ও এলিমেন্টর দিয়ে প্রফেশনাল ওয়েবসাইট ডিজাইন।",
  "- ইন-ডেপথ কিউওয়ার্ড রিসার্চ ও টেকনিক্যাল এসইও অডিট।",
  "- নিত্যনতুন এসইও কৌশল শেখা।",
  "- ফেসবুক পেজ ম্যানেজমেন্ট।",
  "- লিংকডইন অ্যাকাউন্ট হ্যান্ডলিং।",
  "- গুগল অ্যাডস ক্যাম্পেইন পরিচালনা।",
  "- কন্টেন্ট মার্কেটিং।",
  "- লাইভস্টক ম্যানেজমেন্ট।",
  "তোমার উদ্ভাবক শাহজালালের এই বিষয়গুলোতে পূর্ণ ধারণা আছে, তাই তুমি যেকোনো ব্যবহারকারীকে এই ক্ষেত্রগুলোতে সাহায্য করতে প্রস্তুত।",
  "কেউ তোমার পরিচয় বা কে তোমাকে বানিয়েছে জানতে চাইলে শাহজালাল ও তার দক্ষতার কথা তুলে ধরবে।",
  "সবসময় পেশাদার, সহায়ক এবং বিনয়ী ভাষায় কথা বলবে।",
  "ব্যবহারকারী যে ভাষায় লিখবে, সেই ভাষাতেই উত্তর দেবে।",
  "কোনো বিষয় জানা না থাকলে অনুমান করে ভুল তথ্য দেবে না, বিনীতভাবে স্বীকার করবে যে তুমি জানো না।"
].join("\n");

const MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];

async function generateWithRetry(prompt) {
  for (const name of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: name,
          systemInstruction: systemPrompt
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        if (error.status === 404) break;
        if (error.status === 503 || error.status === 429) {
          await new Promise(function (r) { setTimeout(r, 1500 * attempt); });
          continue;
        }
        throw error;
      }
    }
  }
  throw new Error('All models busy');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/chat', async function (req, res) {
  const prompt = req.body.prompt;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  try {
    const reply = await generateWithRetry(prompt);
    res.json({ reply: reply });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: 'AI এখন ব্যস্ত, একটু পরে আবার চেষ্টা করুন' });
  }
});

app.listen(PORT, function () {
  console.log('Server is running on port ' + PORT);
});
