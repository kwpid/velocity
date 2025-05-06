// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDuAlOLXHWpO-bqTUw0SqIqL4WT-D0_T1o",
    authDomain: "velocity-e7139.firebaseapp.com",
    projectId: "velocity-e7139",
    storageBucket: "velocity-e7139.firebasestorage.app",
    messagingSenderId: "134656557995",
    appId: "1:134656557995:web:09b345ad2e034fb7b448ee",
    measurementId: "G-1JSWH6SWKB"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// DOM Elements
const userProfile = document.getElementById('userProfile');
const userAvatar = document.getElementById('userAvatar');
const profileModal = document.getElementById('profileModal');
const closeModal = document.getElementById('closeModal');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const darkModeToggle = document.getElementById('darkModeToggle');

// Google Sign In
const googleProvider = new GoogleAuthProvider();

async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        await saveUserData(user);
        updateUI(user);
    } catch (error) {
        console.error('Error signing in with Google:', error);
    }
}

// Save user data to Firestore
async function saveUserData(user) {
    const userRef = doc(db, 'users', user.uid);
    const userData = {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: new Date().toISOString()
    };
    await setDoc(userRef, userData, { merge: true });
}

// Update UI based on user state
function updateUI(user) {
    if (user) {
        userAvatar.src = user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        document.getElementById('userInfo').innerHTML = `
            <img src="${user.photoURL}" alt="${user.displayName}" class="w-20 h-20 rounded-full mx-auto mb-4">
            <h3 class="text-xl font-bold">${user.displayName}</h3>
            <p class="text-gray-400">${user.email}</p>
        `;
    } else {
        userAvatar.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        document.getElementById('userInfo').innerHTML = `
            <p class="text-gray-400">Not signed in</p>
            <button id="signInButton" class="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
                Sign in with Google
            </button>
        `;
        document.getElementById('signInButton')?.addEventListener('click', signInWithGoogle);
    }
}

// Search functionality
function performSearch() {
    const query = searchInput.value.trim();
    if (query) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        window.location.href = searchUrl;
    }
}

// Modal functionality
function toggleModal() {
    profileModal.classList.toggle('hidden');
}

// Tab switching
function switchTab(tabId) {
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    tabContents.forEach(content => {
        content.classList.toggle('hidden', content.id !== tabId);
    });
}

// Event Listeners
userProfile.addEventListener('click', toggleModal);
closeModal.addEventListener('click', toggleModal);
searchButton.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Dark mode toggle
darkModeToggle.addEventListener('change', (e) => {
    document.documentElement.classList.toggle('dark', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
});

// Initialize dark mode from localStorage
const darkMode = localStorage.getItem('darkMode') === 'true';
darkModeToggle.checked = darkMode;
document.documentElement.classList.toggle('dark', darkMode);

// Auth state observer
onAuthStateChanged(auth, (user) => {
    updateUI(user);
});

// Load user preferences
async function loadUserPreferences(userId) {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
        const data = userDoc.data();
        // Apply user preferences
        if (data.preferences) {
            darkModeToggle.checked = data.preferences.darkMode;
            document.documentElement.classList.toggle('dark', data.preferences.darkMode);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for saved quick links
    const savedLinks = JSON.parse(localStorage.getItem('quickLinks') || '[]');
    if (savedLinks.length > 0) {
        const quickLinksContainer = document.getElementById('quickLinks');
        savedLinks.forEach(link => {
            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.className = 'quick-link text-center p-4 bg-gray-800 rounded-lg hover:bg-gray-700';
            linkElement.innerHTML = `
                <img src="${link.icon}" alt="${link.name}" class="w-8 h-8 mx-auto mb-2">
                <span class="text-sm">${link.name}</span>
            `;
            quickLinksContainer.appendChild(linkElement);
        });
    }
}); 