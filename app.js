// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy,
    limit,
    updateDoc,
    arrayUnion,
    arrayRemove,
    addDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ============================================================================
// Configuration & Global Variables
// ============================================================================

// Environment variable configuration - supports both .env and platform variables
const getEnvVar = (viteName, processName, platformName) => {
    // Try Vite env first
    if (typeof importMeta !== 'undefined' && importMeta.env?.[viteName]) {
        return importMeta.env[viteName];
    }
    // Try process env
    if (typeof process !== 'undefined' && process.env?.[processName]) {
        return process.env[processName];
    }
    // Try platform-specific variables
    if (typeof window !== 'undefined') {
        if (platformName && typeof window[platformName] !== 'undefined') {
            return window[platformName];
        }
        if (typeof __api_keys !== 'undefined' && platformName) {
            const key = platformName.split('.').pop();
            if (__api_keys[key]) return __api_keys[key];
        }
    }
    return "";
};

const API_KEYS = {
    GEMINI: getEnvVar('VITE_GEMINI_API_KEY', 'VITE_GEMINI_API_KEY', '__api_keys.GEMINI'),
    YOUTUBE: getEnvVar('VITE_YOUTUBE_API_KEY', 'VITE_YOUTUBE_API_KEY', '__api_keys.YOUTUBE'),
    PEXELS: getEnvVar('VITE_PEXELS_API_KEY', 'VITE_PEXELS_API_KEY', '__api_keys.PEXELS')
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? 
    JSON.parse(__firebase_config) : {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY', null),
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN', null),
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID', null),
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET', null),
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', null),
    appId: getEnvVar('VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID', null),
    measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID', 'VITE_FIREBASE_MEASUREMENT_ID', null)
};

// Global state
let db, auth, userId, appId;
let currentRecipeList = [];
let currentTab = 'generated';
let commentUnsubscribers = new Map();

// ============================================================================
// Firebase Initialization & Authentication
// ============================================================================

const initFirebase = async () => {
    try {
        appId = typeof __app_id !== 'undefined' ? __app_id : 'macrochef-app';
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        // Handle authentication state changes
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                updateUserStatus(`Logged in as: ${user.uid.substring(0, 8)}...`);
                checkForSavedRecipes();
            } else {
                userId = null;
                updateUserStatus('Not logged in');
            }
        });
        
        // Try custom token first, fall back to anonymous auth
        if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization error:', error);
        showMessage('Failed to connect to Firebase. Some features may be limited.', 'Warning');
    }
};

// ============================================================================
// UI Utility Functions
// ============================================================================

const showLoading = (show, text = 'Loading...') => {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = text;
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
};

const showMessage = (message, title = 'Alert') => {
    const modalContainer = document.getElementById('message-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    
    if (modalTitle) modalTitle.textContent = title;
    if (modalMessage) modalMessage.textContent = message;
    if (modalContainer) modalContainer.style.display = 'flex';
};

const updateUserStatus = (status) => {
    const statusElement = document.getElementById('user-status');
    if (statusElement) statusElement.textContent = status;
};

const showStep = (stepNumber) => {
    const screens = ['splash-screen', 'step-1', 'step-2', 'step-3'];
    screens.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) element.style.display = index === stepNumber ? 'flex' : 'none';
    });
    
    // Update progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        const progress = (stepNumber / (screens.length - 1)) * 100;
        progressBar.style.width = `${progress}%`;
    }
    
    // Update navigation active state
    updateNavigation(stepNumber);
};

const updateNavigation = (currentStep) => {
    const navItems = document.querySelectorAll('.nav-item');
    
    // Reset all nav items
    navItems.forEach(item => {
        item.classList.remove('text-purple-600');
        item.classList.add('text-gray-400');
    });
    
    // Set active nav item
    if (currentStep === 0) {
        const homeNav = document.getElementById('nav-home');
        if (homeNav) {
            homeNav.classList.remove('text-gray-400');
            homeNav.classList.add('text-purple-600');
        }
    } else if (currentStep === 3) {
        const searchNav = document.getElementById('nav-search');
        if (searchNav) {
            searchNav.classList.remove('text-gray-400');
            searchNav.classList.add('text-purple-600');
        }
    }
};

// ============================================================================
// External API Functions
// ============================================================================

const getRecipeImage = async (recipeName) => {
    try {
        const response = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(recipeName + ' food')}&per_page=1`,
            { headers: { 'Authorization': API_KEYS.PEXELS } }
        );
        const data = await response.json();
        return data.photos?.[0]?.src?.medium || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg';
    } catch (error) {
        console.error('Pexels API error:', error);
        return 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg';
    }
};

const getYouTubeVideo = async (recipeName) => {
    const searchQuery = encodeURIComponent(`${recipeName} recipe tutorial`);
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=1&key=${API_KEYS.YOUTUBE}`
        );
        const data = await response.json();
        const videoId = data.items?.[0]?.id?.videoId;
        
        if (videoId) {
            const videoTitle = data.items[0].snippet.title;
            const recipeWords = recipeName.toLowerCase().split(' ');
            const titleWords = videoTitle.toLowerCase().split(' ');
            const matchScore = recipeWords.filter(word => titleWords.includes(word)).length / recipeWords.length;
            
            if (matchScore > 0.4) { // 40% word match threshold
                return `https://youtube.com/watch?v=${videoId}`;
            }
        }
        return null;
    } catch (error) {
        console.error('YouTube API error:', error);
        return null;
    }
};

const analyzeImage = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEYS.GEMINI}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: "List all food items and ingredients you see. Return only a comma-separated list." },
                                    { inlineData: { mimeType: file.type, data: base64 } }
                                ]
                            }]
                        })
                    }
                );
                
                const result = await response.json();
                const ingredients = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                resolve(ingredients);
            } catch (error) {
                console.error('Image analysis error:', error);
                reject(error);
            }
        };
        reader.readAsDataURL(file);
    });
};

// ============================================================================
// Firebase Database Functions
// ============================================================================

const saveRecipe = async (recipe) => {
    if (!userId || !db) {
        showMessage('You must be logged in to save recipes.', 'Authentication Required');
        return false;
    }
    
    try {
        const recipeId = recipe.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const recipeData = {
            ...recipe,
            id: recipeId,
            savedBy: userId,
            savedAt: new Date().toISOString(),
            likes: recipe.likes || 0,
            dislikes: recipe.dislikes || 0,
            likedBy: recipe.likedBy || [],
            dislikedBy: recipe.dislikedBy || []
        };
        
        // Save to user's personal collection
        const userRecipeRef = doc(db, `artifacts/${appId}/users/${userId}/saved_recipes`, recipeId);
        await setDoc(userRecipeRef, recipeData);
        
        // Also save to public collection if not already there
        const publicRecipeRef = doc(db, `artifacts/${appId}/public/recipes`, recipeId);
        const publicDoc = await getDoc(publicRecipeRef);
        
        if (!publicDoc.exists()) {
            await setDoc(publicRecipeRef, {
                ...recipeData,
                createdBy: userId,
                createdAt: new Date().toISOString()
            });
        }
        
        showMessage('Recipe saved successfully!', 'Success');
        return true;
    } catch (error) {
        console.error('Error saving recipe:', error);
        showMessage('Failed to save recipe. Please try again.', 'Error');
        return false;
    }
};

const fetchSavedRecipes = async () => {
    if (!userId || !db) return [];
    
    try {
        const recipesRef = collection(db, `artifacts/${appId}/users/${userId}/saved_recipes`);
        const querySnapshot = await getDocs(recipesRef);
        
        const recipes = [];
        querySnapshot.forEach(doc => {
            recipes.push({ ...doc.data(), id: doc.id });
        });
        
        return recipes.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    } catch (error) {
        console.error('Error fetching saved recipes:', error);
        return [];
    }
};

const fetchCommunityRecipes = async (ingredients = []) => {
    if (!db) return [];
    
    try {
        const recipesRef = collection(db, `artifacts/${appId}/public/recipes`);
        let q = query(recipesRef, orderBy('likes', 'desc'), limit(20));
        
        const querySnapshot = await getDocs(q);
        let recipes = [];
        
        querySnapshot.forEach(doc => {
            recipes.push({ ...doc.data(), id: doc.id });
        });
        
        // Filter by ingredients if provided
        if (ingredients.length > 0) {
            recipes = recipes.filter(recipe => {
                const recipeIngredients = (recipe.ingredients || []).join(' ').toLowerCase();
                return ingredients.some(ing => recipeIngredients.includes(ing.toLowerCase()));
            });
        }
        
        return recipes;
    } catch (error) {
        console.error('Error fetching community recipes:', error);
        return [];
    }
};

const updateRecipeLikes = async (recipeId, type) => {
    if (!userId || !db) {
        showMessage('You must be logged in to rate recipes.', 'Authentication Required');
        return;
    }
    
    try {
        const publicRecipeRef = doc(db, `artifacts/${appId}/public/recipes`, recipeId);
        const recipeDoc = await getDoc(publicRecipeRef);
        
        if (recipeDoc.exists()) {
            const data = recipeDoc.data();
            const likedBy = data.likedBy || [];
            const dislikedBy = data.dislikedBy || [];
            
            let updateData = {};
            
            if (type === 'like') {
                if (likedBy.includes(userId)) {
                    // Unlike
                    updateData = {
                        likes: Math.max(0, (data.likes || 0) - 1),
                        likedBy: arrayRemove(userId)
                    };
                } else {
                    // Like (and remove dislike if exists)
                    updateData = {
                        likes: (data.likes || 0) + 1,
                        likedBy: arrayUnion(userId)
                    };
                    
                    if (dislikedBy.includes(userId)) {
                        updateData.dislikes = Math.max(0, (data.dislikes || 0) - 1);
                        updateData.dislikedBy = arrayRemove(userId);
                    }
                }
            } else if (type === 'dislike') {
                if (dislikedBy.includes(userId)) {
                    // Un-dislike
                    updateData = {
                        dislikes: Math.max(0, (data.dislikes || 0) - 1),
                        dislikedBy: arrayRemove(userId)
                    };
                } else {
                    // Dislike (and remove like if exists)
                    updateData = {
                        dislikes: (data.dislikes || 0) + 1,
                        dislikedBy: arrayUnion(userId)
                    };
                    
                    if (likedBy.includes(userId)) {
                        updateData.likes = Math.max(0, (data.likes || 0) - 1);
                        updateData.likedBy = arrayRemove(userId);
                    }
                }
            }
            
            await updateDoc(publicRecipeRef, updateData);
            
            // Update local display
            const card = document.querySelector(`[data-recipe-id="${recipeId}"]`);
            if (card) {
                updateRecipeCardStats(card, recipeId);
            }
        }
    } catch (error) {
        console.error('Error updating likes:', error);
        showMessage('Failed to update rating. Please try again.', 'Error');
    }
};

const addComment = async (recipeId, commentText) => {
    if (!userId || !db) {
        showMessage('You must be logged in to comment.', 'Authentication Required');
        return;
    }
    
    try {
        const commentsRef = collection(db, `artifacts/${appId}/public/recipes/${recipeId}/comments`);
        await addDoc(commentsRef, {
            userId: userId,
            text: commentText,
            createdAt: new Date().toISOString()
        });
        
        showMessage('Comment added!', 'Success');
    } catch (error) {
        console.error('Error adding comment:', error);
        showMessage('Failed to add comment. Please try again.', 'Error');
    }
};

const subscribeToComments = (recipeId, callback) => {
    if (!db) return () => {};
    
    const commentsRef = collection(db, `artifacts/${appId}/public/recipes/${recipeId}/comments`);
    const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(5));
    
    return onSnapshot(q, (snapshot) => {
        const comments = [];
        snapshot.forEach(doc => {
            comments.push({ ...doc.data(), id: doc.id });
        });
        callback(comments);
    });
};

// ============================================================================
// Recipe Generation & Management
// ============================================================================

const generateRecipes = async () => {
    showLoading(true, 'Calculating perfect recipes...');
    
    const ingredients = document.getElementById('ingredients-text')?.value || '';
    const calories = document.getElementById('calories-target')?.value || 500;
    const protein = document.getElementById('protein-target')?.value || 40;
    const carbs = document.getElementById('carbs-target')?.value || 50;
    const fat = document.getElementById('fat-target')?.value || 15;
    const mealType = document.getElementById('meal-type')?.value || 'any';
    const cuisine = document.getElementById('cuisine')?.value || 'any';
    const dietary = document.getElementById('dietary-restriction')?.value || '';
    const exclude = document.getElementById('exclude')?.value || '';
    
    if (!ingredients) {
        showLoading(false);
        showMessage('Please add ingredients first!', 'Missing Ingredients');
        return;
    }
    
    try {
        currentRecipeList = [];
        const ingredientsList = ingredients.split(',').map(i => i.trim()).filter(i => i);
        
        // Three-tier recipe system
        // Tier 1: Check community recipes (most liked)
        const communityRecipes = await fetchCommunityRecipes(ingredientsList);
        if (communityRecipes.length > 0) {
            currentRecipeList.push(...communityRecipes.slice(0, 2).map(r => ({ ...r, source: 'community' })));
        }
        
        // Tier 2: Check saved recipes
        const savedRecipes = await fetchSavedRecipes();
        const matchingSaved = savedRecipes.filter(recipe => {
            const recipeIngredients = (recipe.ingredients || []).join(' ').toLowerCase();
            return ingredientsList.some(ing => recipeIngredients.includes(ing.toLowerCase()));
        });
        
        if (matchingSaved.length > 0) {
            currentRecipeList.push(...matchingSaved.slice(0, 1).map(r => ({ ...r, source: 'saved' })));
        }
        
        // Tier 3: Generate new recipes if needed
        const recipesToGenerate = Math.max(0, 3 - currentRecipeList.length);
        
        if (recipesToGenerate > 0) {
            const prompt = `Generate ${recipesToGenerate} recipes using these ingredients: ${ingredients}
            
            STRICT REQUIREMENTS:
            - Each recipe MUST hit these exact macros: ${calories} calories, ${protein}g protein, ${carbs}g carbs, ${fat}g fat (±5% tolerance)
            - Meal type: ${mealType}
            - Cuisine preference: ${cuisine}
            - Dietary restrictions: ${dietary}
            - Must exclude: ${exclude}
            - Include exact portion sizes to hit macros
            
            Return ONLY a JSON array with this structure:
            [{
                "name": "Recipe Name",
                "calories": ${calories},
                "protein": ${protein},
                "carbs": ${carbs},
                "fat": ${fat},
                "ingredients": ["ingredient with exact amount"],
                "instructions": ["step by step instructions"]
            }]`;
            
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEYS.GEMINI}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: "application/json" }
                    })
                }
            );
            
            const result = await response.json();
            const newRecipes = JSON.parse(result?.candidates?.[0]?.content?.parts?.[0]?.text || '[]');
            
            // Add images and videos to new recipes
            for (const recipe of newRecipes) {
                recipe.id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                recipe.image_url = await getRecipeImage(recipe.name);
                recipe.youtube_url = await getYouTubeVideo(recipe.name);
                recipe.source = 'generated';
                recipe.likes = 0;
                recipe.dislikes = 0;
                recipe.likedBy = [];
                recipe.dislikedBy = [];
                
                currentRecipeList.push(recipe);
                
                // Auto-save generated recipes to public collection
                if (db) {
                    const publicRecipeRef = doc(db, `artifacts/${appId}/public/recipes`, recipe.id);
                    await setDoc(publicRecipeRef, {
                        ...recipe,
                        createdBy: userId || 'anonymous',
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }
        
        displayRecipes(currentRecipeList);
        showStep(3);
    } catch (error) {
        console.error('Generation error:', error);
        showMessage('Failed to generate recipes. Please check your API keys.', 'Error');
    } finally {
        showLoading(false);
    }
};

// ============================================================================
// UI Creation Functions
// ============================================================================

const createRecipeCard = (recipe) => {
    const container = document.createElement('div');
    container.className = 'card-flip-container';
    container.setAttribute('data-recipe-id', recipe.id);
    
    // Add source badge
    let sourceBadge = '';
    if (recipe.source === 'community') {
        sourceBadge = '<span class="community-badge">Community Favorite</span>';
    } else if (recipe.source === 'saved') {
        sourceBadge = '<span class="community-badge" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">Saved</span>';
    }
    
    const flipHint = document.createElement('div');
    flipHint.className = 'flip-hint';
    flipHint.textContent = 'Tap to flip';
    container.appendChild(flipHint);
    
    const card = document.createElement('div');
    card.className = 'card-flip';
    
    const front = document.createElement('div');
    front.className = 'card-front';
    front.innerHTML = `
        ${sourceBadge}
        <img src="${recipe.image_url}" alt="${recipe.name}" class="recipe-image">
        <div class="p-4">
            <h3 class="text-lg font-bold text-purple-800 mb-2 line-clamp-2">${recipe.name}</h3>
            <div class="macro-bar">
                <div class="macro-item">
                    <span>Calories:</span>
                    <span class="macro-value">${recipe.calories}</span>
                </div>
                <div class="macro-item">
                    <span>Protein:</span>
                    <span class="macro-value">${recipe.protein}g</span>
                </div>
                <div class="macro-item">
                    <span>Carbs:</span>
                    <span class="macro-value">${recipe.carbs}g</span>
                </div>
                <div class="macro-item">
                    <span>Fat:</span>
                    <span class="macro-value">${recipe.fat}g</span>
                </div>
            </div>
            <div class="flex justify-center gap-6 mt-2">
                <span class="text-green-600 text-sm font-medium"><i class="fas fa-thumbs-up"></i> ${recipe.likes || 0}</span>
                <span class="text-red-600 text-sm font-medium"><i class="fas fa-thumbs-down"></i> ${recipe.dislikes || 0}</span>
            </div>
        </div>
    `;
    
    const back = document.createElement('div');
    back.className = 'card-back';
    back.innerHTML = `
        <h3 class="text-lg font-bold text-purple-800 mb-2 sticky top-0 bg-white pb-2">${recipe.name}</h3>
        
        <div class="flex-1 overflow-y-auto">
            <div class="mb-3">
                <h4 class="font-semibold text-purple-700 text-sm mb-1">Ingredients:</h4>
                <ul class="list-disc list-inside text-xs space-y-1 text-gray-600">
                    ${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}
                </ul>
            </div>
            
            <div class="mb-3">
                <h4 class="font-semibold text-purple-700 text-sm mb-1">Instructions:</h4>
                <ol class="list-decimal list-inside text-xs space-y-1 text-gray-600">
                    ${recipe.instructions.map(inst => `<li>${inst}</li>`).join('')}
                </ol>
            </div>
        </div>
        
        <div class="border-t pt-3 mt-3">
            <div class="flex justify-around items-center mb-3">
                <button class="reaction-btn like-btn" data-recipe-id="${recipe.id}">
                    <i class="fas fa-thumbs-up"></i> <span class="like-count">${recipe.likes || 0}</span>
                </button>
                <button class="reaction-btn dislike-btn" data-recipe-id="${recipe.id}">
                    <i class="fas fa-thumbs-down"></i> <span class="dislike-count">${recipe.dislikes || 0}</span>
                </button>
                ${recipe.youtube_url ? `
                    <a href="${recipe.youtube_url}" target="_blank" class="youtube-btn">
                        <i class="fab fa-youtube"></i> Video
                    </a>
                ` : ''}
            </div>
            
            <button class="save-btn w-full text-white font-bold py-2 px-4 rounded-full shadow text-sm">
                <i class="fas fa-save mr-2"></i>Save Recipe
            </button>
            
            <div class="mt-3">
                <div class="comments-container max-h-20 overflow-y-auto mb-2" id="comments-${recipe.id}">
                    <p class="text-gray-500 text-xs">Loading comments...</p>
                </div>
                <div class="flex gap-2">
                    <input type="text" placeholder="Add comment..." 
                        class="comment-input flex-1 p-2 text-xs rounded-lg border border-purple-200 focus:border-purple-500 focus:outline-none"
                        data-recipe-id="${recipe.id}">
                    <button class="comment-btn bg-purple-600 text-white px-3 py-2 rounded-lg text-xs"
                        data-recipe-id="${recipe.id}">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    card.appendChild(front);
    card.appendChild(back);
    container.appendChild(card);
    
    // Event listeners
    card.addEventListener('click', (e) => {
        // Don't flip if clicking on interactive elements
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) {
            return;
        }
        
        card.classList.toggle('is-flipped');
        flipHint.style.display = 'none';
        
        // Load comments when flipped
        if (card.classList.contains('is-flipped') && recipe.id) {
            loadComments(recipe.id);
        }
    });
    
    // Like/Dislike buttons
    back.querySelector('.like-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        updateRecipeLikes(recipe.id, 'like');
    });
    
    back.querySelector('.dislike-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        updateRecipeLikes(recipe.id, 'dislike');
    });
    
    // Save button
    back.querySelector('.save-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const saved = await saveRecipe(recipe);
        if (saved) {
            e.target.innerHTML = '<i class="fas fa-check mr-2"></i>Saved!';
            e.target.classList.add('saved-indicator');
            setTimeout(() => {
                e.target.innerHTML = '<i class="fas fa-save mr-2"></i>Save Recipe';
                e.target.classList.remove('saved-indicator');
            }, 2000);
        }
    });
    
    // Comment functionality
    const commentInput = back.querySelector('.comment-input');
    const commentBtn = back.querySelector('.comment-btn');
    
    if (commentBtn && commentInput) {
        commentBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = commentInput.value.trim();
            if (text) {
                addComment(recipe.id, text);
                commentInput.value = '';
            }
        });
        
        commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
                const text = commentInput.value.trim();
                if (text) {
                    addComment(recipe.id, text);
                    commentInput.value = '';
                }
            }
        });
    }
    
    return container;
};

const loadComments = (recipeId) => {
    // Unsubscribe from previous comments if any
    if (commentUnsubscribers.has(recipeId)) {
        commentUnsubscribers.get(recipeId)();
    }
    
    const unsubscribe = subscribeToComments(recipeId, (comments) => {
        const container = document.getElementById(`comments-${recipeId}`);
        if (!container) return;
        
        if (comments.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No comments yet. Be the first!</p>';
        } else {
            container.innerHTML = comments.map(comment => `
                <div class="comment-item">
                    <div class="comment-author">User ${comment.userId.substring(0, 8)}...</div>
                    <div class="comment-text">${comment.text}</div>
                    <div class="comment-date">${new Date(comment.createdAt).toLocaleDateString()}</div>
                </div>
            `).join('');
        }
    });
    
    commentUnsubscribers.set(recipeId, unsubscribe);
};

const updateRecipeCardStats = async (card, recipeId) => {
    try {
        const publicRecipeRef = doc(db, `artifacts/${appId}/public/recipes`, recipeId);
        const recipeDoc = await getDoc(publicRecipeRef);
        
        if (recipeDoc.exists()) {
            const data = recipeDoc.data();
            const likeCount = card.querySelector('.like-count');
            const dislikeCount = card.querySelector('.dislike-count');
            
            if (likeCount) likeCount.textContent = data.likes || 0;
            if (dislikeCount) dislikeCount.textContent = data.dislikes || 0;
        }
    } catch (error) {
        console.error('Error updating card stats:', error);
    }
};

const displayRecipes = (recipes) => {
    const recipeList = document.getElementById('recipe-list');
    if (!recipeList) return;
    
    recipeList.innerHTML = '';
    
    if (recipes.length === 0) {
        recipeList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🍳</div>
                <div class="empty-state-title">No recipes found</div>
                <div class="empty-state-text">Try adjusting your filters or generating new recipes!</div>
            </div>
        `;
        return;
    }
    
    recipes.forEach(recipe => {
        recipeList.appendChild(createRecipeCard(recipe));
    });
};

const checkForSavedRecipes = async () => {
    const savedRecipes = await fetchSavedRecipes();
    const savedBtn = document.getElementById('view-saved-splash-btn');
    if (savedBtn) {
        savedBtn.style.display = savedRecipes.length > 0 ? 'block' : 'none';
    }
};

// ============================================================================
// Event Listeners
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Fix viewport height for mobile browsers
    const setVH = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    
    // Initialize Firebase
    await initFirebase();
    
    // Splash screen buttons
    document.getElementById('start-btn')?.addEventListener('click', () => showStep(1));
    document.getElementById('view-saved-splash-btn')?.addEventListener('click', async () => {
        showLoading(true, 'Loading saved recipes...');
        currentTab = 'saved';
        currentRecipeList = await fetchSavedRecipes();
        displayRecipes(currentRecipeList);
        showStep(3);
        showLoading(false);
    });
    
    // Step navigation
    document.getElementById('next-to-step-2-btn')?.addEventListener('click', () => {
        const ingredients = document.getElementById('ingredients-text')?.value;
        if (!ingredients) {
            showMessage('Please add ingredients first!', 'Missing Ingredients');
            return;
        }
        showStep(2);
    });
    
    document.getElementById('back-btn')?.addEventListener('click', () => showStep(1));
    document.getElementById('generate-recipes-btn')?.addEventListener('click', generateRecipes);
    document.getElementById('back-to-customize-btn')?.addEventListener('click', () => showStep(2));
    
    // Image upload
    document.getElementById('image-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        showLoading(true, 'Analyzing your fridge...');
        try {
            const ingredients = await analyzeImage(file);
            const textArea = document.getElementById('ingredients-text');
            if (textArea) {
                // Clean up the ingredients string and format it nicely
                const cleanIngredients = ingredients
                    .split(',')
                    .map(i => i.trim())
                    .filter(i => i.length > 0)
                    .join(', ');
                
                textArea.value = cleanIngredients;
                
                // Visual feedback that ingredients were added
                textArea.style.borderColor = '#10b981';
                textArea.style.backgroundColor = '#f0fdf4';
                
                setTimeout(() => {
                    textArea.style.borderColor = '';
                    textArea.style.backgroundColor = '';
                    
                    // Auto-progress to next step if ingredients were found
                    if (cleanIngredients.length > 0) {
                        showStep(2);
                    }
                }, 1500);
            }
        } catch (error) {
            showMessage('Failed to analyze image. Please try typing ingredients manually.', 'Error');
        } finally {
            showLoading(false);
        }
    });
    
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            // Update active state
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('active', 'bg-purple-600', 'text-white');
                b.classList.add('bg-purple-200', 'text-purple-800');
            });
            btn.classList.add('active', 'bg-purple-600', 'text-white');
            btn.classList.remove('bg-purple-200', 'text-purple-800');
            
            const tab = btn.dataset.tab;
            currentTab = tab;
            
            showLoading(true, 'Loading recipes...');
            
            if (tab === 'generated') {
                displayRecipes(currentRecipeList.filter(r => r.source === 'generated'));
            } else if (tab === 'community') {
                const communityRecipes = await fetchCommunityRecipes();
                displayRecipes(communityRecipes);
            } else if (tab === 'saved') {
                const savedRecipes = await fetchSavedRecipes();
                displayRecipes(savedRecipes);
            }
            
            showLoading(false);
        });
    });
    
    // Bottom navigation
    document.getElementById('nav-home')?.addEventListener('click', () => {
        const nav = document.getElementById('nav-home');
        if (nav) {
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('text-purple-600');
                item.classList.add('text-gray-400');
            });
            nav.classList.remove('text-gray-400');
            nav.classList.add('text-purple-600');
        }
        showStep(0);
    });
    
    document.getElementById('nav-search')?.addEventListener('click', async () => {
        const nav = document.getElementById('nav-search');
        if (nav) {
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('text-purple-600');
                item.classList.add('text-gray-400');
            });
            nav.classList.remove('text-gray-400');
            nav.classList.add('text-purple-600');
        }
        showLoading(true, 'Loading community recipes...');
        currentTab = 'community';
        const communityRecipes = await fetchCommunityRecipes();
        displayRecipes(communityRecipes);
        showStep(3);
        showLoading(false);
    });
    
    document.getElementById('nav-saved')?.addEventListener('click', async () => {
        const nav = document.getElementById('nav-saved');
        if (nav) {
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('text-purple-600');
                item.classList.add('text-gray-400');
            });
            nav.classList.remove('text-gray-400');
            nav.classList.add('text-purple-600');
        }
        showLoading(true, 'Loading saved recipes...');
        currentTab = 'saved';
        const savedRecipes = await fetchSavedRecipes();
        displayRecipes(savedRecipes);
        showStep(3);
        showLoading(false);
    });
    
    document.getElementById('nav-help')?.addEventListener('click', () => {
        document.getElementById('help-modal').style.display = 'flex';
    });
    
    // Help modal
    document.getElementById('close-help-btn')?.addEventListener('click', () => {
        document.getElementById('help-modal').style.display = 'none';
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.id === 'help-modal') {
            document.getElementById('help-modal').style.display = 'none';
        }
        if (e.target.id === 'message-modal') {
            document.getElementById('message-modal').style.display = 'none';
        }
    });
    
    // Auto-progress when ingredients are added
    document.getElementById('ingredients-text')?.addEventListener('input', (e) => {
        if (e.target.value.length > 10) {
            document.getElementById('next-to-step-2-btn')?.classList.add('pulse');
        }
    });
});

// ============================================================================
// Cleanup on page unload
// ============================================================================

window.addEventListener('beforeunload', () => {
    // Unsubscribe from all comment listeners
    commentUnsubscribers.forEach(unsubscribe => unsubscribe());
    commentUnsubscribers.clear();
});