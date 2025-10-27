# MacroNerd - AI Macro Tracker

A secure, AI-powered macro tracking application that uses Google's Gemini API to analyze food and calculate nutritional information.

## 🔒 Security Features

- **API Key Protection**: Your Gemini API key is securely stored on the server-side
- **Environment Variables**: Sensitive data is kept in environment variables
- **CORS Protection**: Backend includes proper CORS configuration
- **Input Validation**: Server-side validation for all API requests

## 🚀 Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- A Google Gemini API key

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the project root:
   ```bash
   # Gemini API Configuration
   GEMINI_API_KEY=your_actual_api_key_here
   
   # Server Configuration
   PORT=3000
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

### Development Mode

For development with auto-restart:
```bash
npm run dev
```

## 🏗️ Architecture

### Frontend (index.html)
- Clean, responsive UI built with Tailwind CSS
- Client-side state management with localStorage
- Secure API calls to backend endpoints

### Backend (server.js)
- Express.js server with CORS support
- Secure API key management
- Retry logic with exponential backoff
- Input validation and error handling

## 🔧 API Endpoints

- `POST /api/get-macros` - Analyzes food input and returns nutritional data
- `GET /` - Serves the main application

## 🛡️ Security Best Practices

1. **Never commit API keys to version control**
2. **Use environment variables for sensitive data**
3. **Validate all inputs on the server side**
4. **Implement proper error handling**
5. **Use HTTPS in production**

## 📝 Usage

1. Enter food items in natural language (e.g., "2 large eggs and 100g rice")
2. The AI analyzes your input and calculates macros
3. View your daily totals and logged items
4. Reset data when needed

## 🚀 Deployment

For production deployment:

1. Set environment variables on your hosting platform
2. Ensure your API key is properly configured
3. Use HTTPS for secure communication
4. Consider rate limiting for production use

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.
