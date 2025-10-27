const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// API endpoint to get macros from Gemini
app.post('/api/get-macros', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY not found in environment variables');
            return res.status(500).json({ error: 'API key not configured' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const systemPrompt = `You are a nutrition expert. The user will provide a food query. You must analyze the query, calculate the total nutritional information, and return *ONLY* a single JSON object with the following exact structure:
{
  "name": "A corrected or parsed name of the food items",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0
}
All values should be numbers (integers). Do not return any text, explanation, or markdown \`\`\`json\`\`\` formatting around the JSON object.`;

        const schema = {
            type: "OBJECT",
            properties: {
                "name": { "type": "STRING" },
                "calories": { "type": "NUMBER" },
                "protein": { "type": "NUMBER" },
                "carbs": { "type": "NUMBER" },
                "fat": { "type": "NUMBER" }
            },
            required: ["name", "calories", "protein", "carbs", "fat"]
        };

        const payload = {
            contents: [{
                parts: [{ text: query }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema
            }
        };

        // Fetch with retry logic
        let delay = 1000;
        const maxRetries = 5;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    if (response.status >= 500 || response.status === 429) {
                        throw new Error(`Server error: ${response.status}`);
                    }
                    const errorBody = await response.text();
                    console.error("API Error Response:", errorBody);
                    return res.status(response.status).json({ error: `API request failed: ${response.status}` });
                }

                const result = await response.json();

                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    
                    const jsonText = result.candidates[0].content.parts[0].text;
                    const macros = JSON.parse(jsonText);
                    
                    // Ensure all fields are numbers, default to 0 if not
                    macros.calories = Number(macros.calories) || 0;
                    macros.protein = Number(macros.protein) || 0;
                    macros.carbs = Number(macros.carbs) || 0;
                    macros.fat = Number(macros.fat) || 0;

                    return res.json(macros);
                } else {
                    console.error("Invalid API response structure:", result);
                    return res.status(500).json({ error: "AI returned an invalid response" });
                }

            } catch (error) {
                if (i === maxRetries - 1) {
                    console.error("Error in getMacrosFromAI:", error);
                    return res.status(500).json({ error: "Failed to get macro data from AI" });
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            }
        }

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Make sure to set GEMINI_API_KEY in your .env file');
});
