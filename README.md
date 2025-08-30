
# MacroChef

## AI-Powered Macro-Friendly Meal Planning

MacroChef is a web application that helps users find and generate recipes based on their available ingredients and specific nutritional goals (macros). It leverages AI to create unique recipes and uses external APIs for real-world images and video tutorials.

Show Image

### Features

* **AI Recipe Generation:** Generate custom recipes based on ingredients and target calories, protein, carbs, and fat
* **Image Analysis:** Upload a photo of your kitchen/fridge and get a list of ingredients
* **Visual Enhancements:** Recipes automatically enriched with high-quality images from Pexels API and video tutorials from YouTube
* **Community Features:** Browse community recipes sorted by popularity, rate recipes, and add comments
* **Smart Caching:** Three-tier recipe system (community favorites, saved recipes, newly generated)
* **Personal Library:** Save recipes to your personal collection
* **Responsive Design:** Clean and modern user interface that works seamlessly on desktop and mobile devices

### Prerequisites

To run this project, you will need:

* **Node.js** (v14 or higher) and npm
* **Python 3.x** (optional, for Firebase admin tools)
* API keys for Gemini, Pexels, YouTube, and Firebase

### Getting Started

Follow these steps to set up and run the project locally:

#### 1. Clone the Repository

bash

```bash
git clone [your-repo-url]
cd MacroChef
```

#### 2. Install Dependencies

For local development with Vite:

bash

```bash
npminstall vite --save-dev
```

For Python dependencies (optional):

bash

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install Python packages
pip install -r requirements.txt
```

#### 3. Set up Environment Variables

Create a `.env` file in the root of your project and add your API keys:

env

```env
# Gemini API (Required)
# Get from: https://makersuite.google.com/app/apikey
VITE_GEMINI_API_KEY="your_gemini_api_key"

# YouTube Data API (Required)
# Get from: https://console.cloud.google.com/
VITE_YOUTUBE_API_KEY="your_youtube_api_key"

# Pexels API (Required)
# Get from: https://www.pexels.com/api/
VITE_PEXELS_API_KEY="your_pexels_api_key"

# Firebase Configuration (Required)
# Get from: https://console.firebase.google.com/
VITE_FIREBASE_API_KEY="your_firebase_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain"
VITE_FIREBASE_PROJECT_ID="your_firebase_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_firebase_messaging_sender_id"
VITE_FIREBASE_APP_ID="your_firebase_app_id"
VITE_FIREBASE_MEASUREMENT_ID="your_firebase_measurement_id"
```

**⚠️ Important:** Never commit your `.env` file to version control!

#### 4. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable **Authentication** with Anonymous sign-in
4. Enable **Firestore Database**
5. Set Firestore rules for development:

javascript

```javascript
rules_version ='2';
service cloud.firestore{
  match /databases/{database}/documents {
// Allow read/write for authenticated users
    match /artifacts/{appId}/users/{userId}/{document=**}{
      allow read,write:if request.auth!=null&& request.auth.uid== userId;
}
  
// Allow read for public recipes, write for authenticated users
    match /artifacts/{appId}/public/{document=**}{
      allow read:iftrue;
      allow write:if request.auth!=null;
}
}
}
```

#### 5. Run the Application

Using Vite (recommended for development):

bash

```bash
npm run dev
```

Or with a simple HTTP server:

bash

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server
```

The application will be available at `http://localhost:5173` (Vite) or `http://localhost:8000` (Python).

### Project Structure

```
MacroChef/
├── .env                  # Environment variables (not committed)
├── .gitignore           # Git ignore file
├── README.md            # This file
├── index.html           # Main HTML structure
├── style.css            # All styling
├── app.js               # All JavaScript logic
└── requirements.txt     # Python dependencies
```

### API Keys Setup Guide

#### Gemini API

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Get API Key"
3. Create a new API key
4. Copy and add to `.env` file

#### YouTube Data API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "YouTube Data API v3"
4. Create credentials (API Key)
5. Copy and add to `.env` file

#### Pexels API

1. Visit [Pexels API](https://www.pexels.com/api/)
2. Create an account
3. Generate API key
4. Copy and add to `.env` file

#### Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create/select project
3. Go to Project Settings
4. Under "Your apps", click web icon (</>)
5. Register app and copy configuration
6. Add each value to `.env` file

### Usage

1. **Add Ingredients:**
   * Type ingredients manually OR
   * Upload/take a photo of your fridge/pantry
2. **Set Your Macros:**
   * Enter target calories, protein, carbs, and fat
   * Select meal type and cuisine preference
   * Add dietary restrictions if needed
3. **Generate Recipes:**
   * AI generates recipes matching your exact macro targets
   * Browse community favorites and saved recipes
   * Each recipe includes images and video tutorials
4. **Save & Share:**
   * Save recipes to your personal collection
   * Rate recipes with likes/dislikes
   * Add comments to share tips with the community

### Troubleshooting

**Issue: "Failed to connect to Firebase"**

* Check your Firebase configuration in `.env`
* Ensure Firestore and Authentication are enabled
* Verify your internet connection

**Issue: "Failed to generate recipes"**

* Verify your Gemini API key is valid
* Check API quotas in Google Cloud Console
* Ensure ingredients field is not empty

**Issue: "No images loading"**

* Check Pexels API key in `.env`
* Verify API rate limits haven't been exceeded

**Issue: "No video links"**

* Verify YouTube API key
* Check YouTube API quota in Google Cloud Console

### Development Tips

* Use Chrome DevTools for debugging
* Check browser console for error messages
* Firebase data is stored in: `artifacts/[appId]/users/[userId]/saved_recipes`
* Public recipes are in: `artifacts/[appId]/public/recipes`

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### License

This project is licensed under the MIT License - see the LICENSE file for details.

### Acknowledgments

* Google Gemini for AI recipe generation
* Pexels for food imagery
* YouTube for video tutorials
* Firebase for backend services
* Tailwind CSS for styling
