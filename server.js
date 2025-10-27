const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variable checking and logging
function checkEnvironmentVariables() {
    console.log('\n=== ENVIRONMENT VARIABLES CHECK ===');
    
    const requiredEnvVars = {
        'GEMINI_API_KEY': process.env.GEMINI_API_KEY,
        'NODE_ENV': process.env.NODE_ENV || 'development',
        'PORT': process.env.PORT || '3000'
    };
    
    const optionalEnvVars = {
        'DEBUG': process.env.DEBUG,
        'LOG_LEVEL': process.env.LOG_LEVEL || 'info'
    };
    
    console.log('Required Environment Variables:');
    Object.entries(requiredEnvVars).forEach(([key, value]) => {
        if (value) {
            console.log(`✅ ${key}: ${key === 'GEMINI_API_KEY' ? '[SET]' : value}`);
        } else {
            console.log(`❌ ${key}: NOT SET`);
        }
    });
    
    console.log('\nOptional Environment Variables:');
    Object.entries(optionalEnvVars).forEach(([key, value]) => {
        if (value) {
            console.log(`ℹ️  ${key}: ${value}`);
        } else {
            console.log(`⚪ ${key}: NOT SET`);
        }
    });
    
    console.log('\n=== ENVIRONMENT STATUS ===');
    if (requiredEnvVars.GEMINI_API_KEY) {
        console.log('✅ Environment is properly configured');
    } else {
        console.log('❌ WARNING: GEMINI_API_KEY is not set!');
        console.log('   Please create a .env file with: GEMINI_API_KEY=your_api_key_here');
    }
    console.log('=====================================\n');
}

// Enhanced error logging function
function logError(error, context = '') {
    const timestamp = new Date().toISOString();
    console.error(`\n🚨 ERROR [${timestamp}] ${context ? `[${context}] ` : ''}`);
    console.error('Error Details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
    });
    
    if (error.response) {
        console.error('Response Details:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
        });
    }
    
    console.error('=====================================\n');
}

// Enhanced info logging function
function logInfo(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`ℹ️  INFO [${timestamp}] ${message}`);
    if (data) {
        console.log('Data:', data);
    }
}

// Check environment on startup
checkEnvironmentVariables();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// API endpoint to get macros from Gemini
app.post('/api/get-macros', async (req, res) => {
    try {
        const { query } = req.body;
        
        logInfo('Received macro request', { query: query?.substring(0, 50) + '...' });
        
        if (!query) {
            logError(new Error('Query is required'), 'get-macros');
            return res.status(400).json({ error: 'Query is required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            const error = new Error('GEMINI_API_KEY not found in environment variables');
            logError(error, 'get-macros');
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
                    logError(new Error(`API Error Response: ${errorBody}`), 'get-macros');
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

                    logInfo('Successfully processed macro request', { name: macros.name, calories: macros.calories });
                    return res.json(macros);
                } else {
                    logError(new Error(`Invalid API response structure: ${JSON.stringify(result)}`), 'get-macros');
                    return res.status(500).json({ error: "AI returned an invalid response" });
                }

            } catch (error) {
                if (i === maxRetries - 1) {
                    logError(error, 'get-macros');
                    return res.status(500).json({ error: "Failed to get macro data from AI" });
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            }
        }

    } catch (error) {
        logError(error, 'get-macros');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to analyze food images
app.post('/api/analyze-image', async (req, res) => {
    try {
        const { image } = req.body;
        
        logInfo('Received image analysis request', { imageSize: image?.length || 0 });
        
        if (!image) {
            logError(new Error('Image is required'), 'analyze-image');
            return res.status(400).json({ error: 'Image is required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            const error = new Error('GEMINI_API_KEY not found in environment variables');
            logError(error, 'analyze-image');
            return res.status(500).json({ error: 'API key not configured' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const systemPrompt = `You are a food recognition expert. Analyze the provided food image and identify what food items are visible. Return *ONLY* a single JSON object with the following exact structure:
{
  "foodName": "The primary food item detected (e.g., 'apple', 'chicken breast', 'rice')",
  "suggestedQuantity": "A reasonable suggested quantity (e.g., '1 medium', '150g', '2 pieces')"
}
Do not return any text, explanation, or markdown formatting around the JSON object.`;

        const schema = {
            type: "OBJECT",
            properties: {
                "foodName": { "type": "STRING" },
                "suggestedQuantity": { "type": "STRING" }
            },
            required: ["foodName", "suggestedQuantity"]
        };

        const payload = {
            contents: [{
                parts: [
                    { text: systemPrompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: image
                        }
                    }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema
            }
        };

        // Fetch with retry logic
        let delay = 1000;
        const maxRetries = 3;
        
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
                    logError(new Error(`API Error Response: ${errorBody}`), 'analyze-image');
                    return res.status(response.status).json({ error: `API request failed: ${response.status}` });
                }

                const result = await response.json();

                if (result.candidates && result.candidates.length > 0 &&
                    result.candidates[0].content && result.candidates[0].content.parts &&
                    result.candidates[0].content.parts.length > 0) {
                    
                    const jsonText = result.candidates[0].content.parts[0].text;
                    const analysis = JSON.parse(jsonText);
                    
                    logInfo('Successfully analyzed image', { foodName: analysis.foodName });
                    return res.json(analysis);
                } else {
                    logError(new Error(`Invalid API response structure: ${JSON.stringify(result)}`), 'analyze-image');
                    return res.status(500).json({ error: "AI returned an invalid response" });
                }

            } catch (error) {
                if (i === maxRetries - 1) {
                    logError(error, 'analyze-image');
                    return res.status(500).json({ error: "Failed to analyze image" });
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            }
        }

    } catch (error) {
        logError(error, 'analyze-image');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test endpoint to verify environment setup
app.get('/api/test-env', (req, res) => {
    try {
        logInfo('Environment test endpoint accessed');
        
        const envStatus = {
            timestamp: new Date().toISOString(),
            environment: {
                NODE_ENV: process.env.NODE_ENV || 'development',
                PORT: process.env.PORT || '3000',
                DEBUG: process.env.DEBUG || 'not set',
                LOG_LEVEL: process.env.LOG_LEVEL || 'info'
            },
            apiKeys: {
                GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '[SET]' : '[NOT SET]'
            },
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.version,
                platform: process.platform
            },
            status: process.env.GEMINI_API_KEY ? 'READY' : 'MISSING_API_KEY'
        };
        
        logInfo('Environment test completed', { status: envStatus.status });
        res.json(envStatus);
        
    } catch (error) {
        logError(error, 'test-env');
        res.status(500).json({ 
            error: 'Failed to check environment',
            timestamp: new Date().toISOString()
        });
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
