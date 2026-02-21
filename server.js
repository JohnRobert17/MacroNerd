const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/api/analyze-food', async (req, res) => {
    try {
        const { image, text } = req.body;

        // Use the stable 2.5 Flash model (Decommissioned preview replaced)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Analyze this food image and description. 
            Provide the estimated calories, protein, carbs, and fats.
            Description: ${text || 'No description provided'}
            Format the output as JSON: { "calories": 0, "protein": 0, "carbs": 0, "fats": 0, "food_items": [] }
        `;

        const parts = [
            { text: prompt },
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: image
                }
            }
        ];

        const result = await model.generateContent(parts);
        const response = await result.response;
        const resultText = response.text();

        // Clean up potential Markdown formatting from AI response
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Could not parse response" };

        res.json(data);

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ error: "Failed to analyze food image." });
    }
});

app.listen(port, () => {
    console.log(`MacroNerd server running at http://localhost:${port}`);
});
