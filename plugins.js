import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.activePlugins = new Set();
        this.pluginContainer = document.getElementById('pluginContainer');
        this.pluginList = document.getElementById('pluginList');
        this.uploadPlugin = document.getElementById('uploadPlugin');
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.uploadPlugin.addEventListener('click', () => this.handlePluginUpload());
    }

    async handlePluginUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.js,.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const content = await file.text();
                const manifest = this.parsePluginManifest(content);
                
                if (!manifest) {
                    throw new Error('Invalid plugin manifest');
                }

                const plugin = {
                    id: crypto.randomUUID(),
                    name: manifest.name,
                    description: manifest.description,
                    version: manifest.version,
                    icon: manifest.icon,
                    code: content,
                    author: auth.currentUser?.uid,
                    createdAt: new Date().toISOString()
                };

                await this.savePlugin(plugin);
                await this.loadPlugins();
            } catch (error) {
                console.error('Error uploading plugin:', error);
                alert('Error uploading plugin: ' + error.message);
            }
        };

        input.click();
    }

    parsePluginManifest(content) {
        try {
            const manifestMatch = content.match(/\/\*([\s\S]*?)\*\//);
            if (!manifestMatch) return null;

            const manifestStr = manifestMatch[1].trim();
            return JSON.parse(manifestStr);
        } catch (error) {
            console.error('Error parsing plugin manifest:', error);
            return null;
        }
    }

    async savePlugin(plugin) {
        const user = auth.currentUser;
        if (!user) throw new Error('User must be logged in to save plugins');

        const pluginRef = doc(db, 'plugins', plugin.id);
        await setDoc(pluginRef, plugin);

        // Add to user's installed plugins
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data() || {};
        const installedPlugins = userData.installedPlugins || [];
        
        if (!installedPlugins.includes(plugin.id)) {
            installedPlugins.push(plugin.id);
            await setDoc(userRef, { installedPlugins }, { merge: true });
        }
    }

    async loadPlugins() {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data() || {};
        const installedPlugins = userData.installedPlugins || [];

        // Clear existing plugins
        this.plugins.clear();
        this.pluginList.innerHTML = '';

        // Load each installed plugin
        for (const pluginId of installedPlugins) {
            const pluginRef = doc(db, 'plugins', pluginId);
            const pluginDoc = await getDoc(pluginRef);
            
            if (pluginDoc.exists()) {
                const plugin = pluginDoc.data();
                this.plugins.set(pluginId, plugin);
                this.renderPluginCard(plugin);
            }
        }
    }

    renderPluginCard(plugin) {
        const card = document.createElement('div');
        card.className = 'plugin-card';
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <img src="${plugin.icon}" alt="${plugin.name}" class="w-8 h-8">
                    <div>
                        <h4 class="font-semibold">${plugin.name}</h4>
                        <p class="text-sm text-gray-400">${plugin.description}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="toggle-plugin px-3 py-1 rounded ${this.activePlugins.has(plugin.id) ? 'bg-green-600' : 'bg-gray-600'}">
                        ${this.activePlugins.has(plugin.id) ? 'Active' : 'Inactive'}
                    </button>
                    <button class="delete-plugin px-3 py-1 bg-red-600 rounded">
                        Delete
                    </button>
                </div>
            </div>
        `;

        // Add event listeners
        const toggleButton = card.querySelector('.toggle-plugin');
        const deleteButton = card.querySelector('.delete-plugin');

        toggleButton.addEventListener('click', () => this.togglePlugin(plugin.id));
        deleteButton.addEventListener('click', () => this.deletePlugin(plugin.id));

        this.pluginList.appendChild(card);
    }

    async togglePlugin(pluginId) {
        if (this.activePlugins.has(pluginId)) {
            this.deactivatePlugin(pluginId);
        } else {
            await this.activatePlugin(pluginId);
        }
        await this.loadPlugins(); // Refresh the UI
    }

    async activatePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return;

        try {
            // Create a sandboxed iframe for the plugin
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            // Execute the plugin code in the sandbox
            const sandbox = iframe.contentWindow;
            const pluginCode = plugin.code.replace(/\/\*[\s\S]*?\*\//, ''); // Remove manifest
            sandbox.eval(pluginCode);

            this.activePlugins.add(pluginId);
            
            // Save active state to Firestore
            const user = auth.currentUser;
            if (user) {
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                    activePlugins: Array.from(this.activePlugins)
                }, { merge: true });
            }
        } catch (error) {
            console.error('Error activating plugin:', error);
            alert('Error activating plugin: ' + error.message);
        }
    }

    deactivatePlugin(pluginId) {
        this.activePlugins.delete(pluginId);
        // Remove plugin's iframe if it exists
        const iframe = document.querySelector(`iframe[data-plugin-id="${pluginId}"]`);
        if (iframe) {
            iframe.remove();
        }
    }

    async deletePlugin(pluginId) {
        if (!confirm('Are you sure you want to delete this plugin?')) return;

        const user = auth.currentUser;
        if (!user) return;

        try {
            // Remove from user's installed plugins
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data() || {};
            const installedPlugins = userData.installedPlugins || [];
            
            const updatedPlugins = installedPlugins.filter(id => id !== pluginId);
            await setDoc(userRef, { installedPlugins: updatedPlugins }, { merge: true });

            // Deactivate if active
            this.deactivatePlugin(pluginId);

            // Remove from plugins collection
            const pluginRef = doc(db, 'plugins', pluginId);
            await setDoc(pluginRef, { deleted: true }, { merge: true });

            await this.loadPlugins(); // Refresh the UI
        } catch (error) {
            console.error('Error deleting plugin:', error);
            alert('Error deleting plugin: ' + error.message);
        }
    }
}

// Initialize plugin manager
const pluginManager = new PluginManager();

// Load plugins when auth state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        pluginManager.loadPlugins();
    }
}); 