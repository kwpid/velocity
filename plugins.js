import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, orderBy, limit, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.activePlugins = new Set();
        this.pluginContainer = document.getElementById('pluginContainer');
        this.pluginList = document.getElementById('pluginList');
        this.marketplaceGrid = document.getElementById('marketplaceGrid');
        this.uploadPlugin = document.getElementById('uploadPlugin');
        this.pluginEditorModal = document.getElementById('pluginEditorModal');
        this.closeEditorModal = document.getElementById('closeEditorModal');
        this.savePlugin = document.getElementById('savePlugin');
        this.publishPlugin = document.getElementById('publishPlugin');
        this.marketplaceSearch = document.getElementById('marketplaceSearch');
        this.marketplaceFilter = document.getElementById('marketplaceFilter');
        
        this.currentEditingPlugin = null;
        this.initializeEventListeners();
        this.initializeDatabase();
    }

    async initializeDatabase() {
        // Create collections if they don't exist
        const collections = ['plugins', 'users', 'plugin_versions', 'plugin_stats'];
        for (const collectionName of collections) {
            const collectionRef = collection(db, collectionName);
            const q = query(collectionRef, limit(1));
            await getDocs(q);
        }
    }

    initializeEventListeners() {
        this.uploadPlugin.addEventListener('click', () => this.openPluginEditor());
        this.closeEditorModal.addEventListener('click', () => this.closePluginEditor());
        this.savePlugin.addEventListener('click', () => this.savePluginChanges());
        this.publishPlugin.addEventListener('click', () => this.publishPluginUpdate());
        this.marketplaceSearch.addEventListener('input', () => this.searchMarketplace());
        this.marketplaceFilter.addEventListener('change', () => this.filterMarketplace());
    }

    openPluginEditor(plugin = null) {
        this.currentEditingPlugin = plugin;
        const editor = this.pluginEditorModal;
        
        if (plugin) {
            // Editing existing plugin
            document.getElementById('pluginName').value = plugin.name;
            document.getElementById('pluginVersion').value = plugin.version;
            document.getElementById('pluginDescription').value = plugin.description;
            document.getElementById('pluginCode').value = plugin.code;
            document.getElementById('pluginPublic').checked = plugin.isPublic;
            document.querySelector('.version-badge').textContent = `v${plugin.version}`;
            this.publishPlugin.style.display = 'block';
        } else {
            // New plugin
            document.getElementById('pluginName').value = '';
            document.getElementById('pluginVersion').value = '1.0.0';
            document.getElementById('pluginDescription').value = '';
            document.getElementById('pluginCode').value = '';
            document.getElementById('pluginPublic').checked = false;
            document.querySelector('.version-badge').textContent = 'v1.0.0';
            this.publishPlugin.style.display = 'none';
        }
        
        editor.classList.remove('hidden');
    }

    closePluginEditor() {
        this.pluginEditorModal.classList.add('hidden');
        this.currentEditingPlugin = null;
    }

    async savePluginChanges() {
        const user = auth.currentUser;
        if (!user) return;

        const pluginData = {
            name: document.getElementById('pluginName').value,
            version: document.getElementById('pluginVersion').value,
            description: document.getElementById('pluginDescription').value,
            code: document.getElementById('pluginCode').value,
            isPublic: document.getElementById('pluginPublic').checked,
            lastUpdated: new Date().toISOString()
        };

        if (this.currentEditingPlugin) {
            // Update existing plugin
            const pluginRef = doc(db, 'plugins', this.currentEditingPlugin.id);
            await updateDoc(pluginRef, pluginData);
        } else {
            // Create new plugin
            const pluginId = crypto.randomUUID();
            const pluginRef = doc(db, 'plugins', pluginId);
            await setDoc(pluginRef, {
                ...pluginData,
                id: pluginId,
                author: user.uid,
                createdAt: new Date().toISOString(),
                downloads: 0,
                rating: 0,
                ratingCount: 0
            });

            // Add to user's plugins
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data() || {};
            const userPlugins = userData.plugins || [];
            userPlugins.push(pluginId);
            await setDoc(userRef, { plugins: userPlugins }, { merge: true });
        }

        this.closePluginEditor();
        await this.loadPlugins();
    }

    async publishPluginUpdate() {
        if (!this.currentEditingPlugin) return;

        const newVersion = document.getElementById('pluginVersion').value;
        const pluginRef = doc(db, 'plugins', this.currentEditingPlugin.id);
        
        // Create version history
        const versionRef = doc(collection(db, 'plugin_versions'));
        await setDoc(versionRef, {
            pluginId: this.currentEditingPlugin.id,
            version: newVersion,
            code: document.getElementById('pluginCode').value,
            publishedAt: new Date().toISOString()
        });

        // Update plugin
        await updateDoc(pluginRef, {
            version: newVersion,
            code: document.getElementById('pluginCode').value,
            lastUpdated: new Date().toISOString()
        });

        this.closePluginEditor();
        await this.loadPlugins();
    }

    async loadMarketplace() {
        const q = query(
            collection(db, 'plugins'),
            where('isPublic', '==', true),
            where('deleted', '==', false),
            orderBy('downloads', 'desc')
        );

        const snapshot = await getDocs(q);
        this.marketplaceGrid.innerHTML = '';

        snapshot.forEach(doc => {
            const plugin = doc.data();
            this.renderMarketplaceCard(plugin);
        });
    }

    renderMarketplaceCard(plugin) {
        const card = document.createElement('div');
        card.className = 'marketplace-card fade-in';
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-3">
                    <img src="${plugin.icon || 'https://via.placeholder.com/32'}" alt="${plugin.name}" class="w-8 h-8">
                    <div>
                        <h4 class="font-semibold">${plugin.name}</h4>
                        <p class="text-sm text-gray-400">v${plugin.version}</p>
                    </div>
                </div>
                <span class="plugin-status ${plugin.isPublic ? 'public' : 'private'}">
                    ${plugin.isPublic ? 'Public' : 'Private'}
                </span>
            </div>
            <p class="text-sm text-gray-400 mb-3">${plugin.description}</p>
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-2">
                    <span class="text-sm text-gray-400">${plugin.downloads} downloads</span>
                    <span class="text-sm text-gray-400">★ ${plugin.rating.toFixed(1)}</span>
                </div>
                <button class="btn btn-primary install-plugin" data-plugin-id="${plugin.id}">
                    Install
                </button>
            </div>
        `;

        card.querySelector('.install-plugin').addEventListener('click', () => this.installPlugin(plugin.id));
        this.marketplaceGrid.appendChild(card);
    }

    async installPlugin(pluginId) {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const pluginRef = doc(db, 'plugins', pluginId);
            const pluginDoc = await getDoc(pluginRef);
            
            if (!pluginDoc.exists()) {
                throw new Error('Plugin not found');
            }

            // Add to user's installed plugins
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data() || {};
            const installedPlugins = userData.installedPlugins || [];
            
            if (!installedPlugins.includes(pluginId)) {
                installedPlugins.push(pluginId);
                await setDoc(userRef, { installedPlugins }, { merge: true });

                // Increment download count
                await updateDoc(pluginRef, {
                    downloads: increment(1)
                });
            }

            await this.loadPlugins();
        } catch (error) {
            console.error('Error installing plugin:', error);
            alert('Error installing plugin: ' + error.message);
        }
    }

    async searchMarketplace() {
        const searchTerm = this.marketplaceSearch.value.toLowerCase();
        const cards = this.marketplaceGrid.querySelectorAll('.marketplace-card');
        
        cards.forEach(card => {
            const name = card.querySelector('h4').textContent.toLowerCase();
            const description = card.querySelector('p').textContent.toLowerCase();
            const isVisible = name.includes(searchTerm) || description.includes(searchTerm);
            card.style.display = isVisible ? 'block' : 'none';
        });
    }

    async filterMarketplace() {
        const filter = this.marketplaceFilter.value;
        let q;

        switch (filter) {
            case 'popular':
                q = query(
                    collection(db, 'plugins'),
                    where('isPublic', '==', true),
                    where('deleted', '==', false),
                    orderBy('downloads', 'desc')
                );
                break;
            case 'recent':
                q = query(
                    collection(db, 'plugins'),
                    where('isPublic', '==', true),
                    where('deleted', '==', false),
                    orderBy('lastUpdated', 'desc')
                );
                break;
            default:
                q = query(
                    collection(db, 'plugins'),
                    where('isPublic', '==', true),
                    where('deleted', '==', false)
                );
        }

        const snapshot = await getDocs(q);
        this.marketplaceGrid.innerHTML = '';

        snapshot.forEach(doc => {
            const plugin = doc.data();
            this.renderMarketplaceCard(plugin);
        });
    }

    async handlePluginUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.js';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const content = await file.text();
                const manifest = this.parsePluginManifest(content);
                
                if (!manifest) {
                    throw new Error('Invalid plugin manifest');
                }

                // Create plugin document
                const pluginId = crypto.randomUUID();
                const pluginRef = doc(db, 'plugins', pluginId);
                
                await setDoc(pluginRef, {
                    id: pluginId,
                    name: manifest.name,
                    description: manifest.description,
                    version: manifest.version,
                    icon: manifest.icon,
                    code: content,
                    author: auth.currentUser?.uid,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    isPublic: manifest.isPublic || false,
                    downloads: 0,
                    rating: 0,
                    ratingCount: 0,
                    deleted: false
                });

                // Add to user's plugins
                const userRef = doc(db, 'users', auth.currentUser.uid);
                const userDoc = await getDoc(userRef);
                const userData = userDoc.data() || {};
                const userPlugins = userData.plugins || [];
                userPlugins.push(pluginId);
                await setDoc(userRef, { plugins: userPlugins }, { merge: true });

                // Show success notification
                this.showNotification('Plugin uploaded successfully!');
                
                // Refresh plugin list
                await this.loadPlugins();
            } catch (error) {
                console.error('Error uploading plugin:', error);
                this.showNotification('Error uploading plugin: ' + error.message, true);
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

    async updatePlugin(pluginId, newFile) {
        try {
            const content = await newFile.text();
            const manifest = this.parsePluginManifest(content);
            
            if (!manifest) {
                throw new Error('Invalid plugin manifest');
            }

            const pluginRef = doc(db, 'plugins', pluginId);
            const pluginDoc = await getDoc(pluginRef);
            
            if (!pluginDoc.exists()) {
                throw new Error('Plugin not found');
            }

            // Create version history
            const versionRef = doc(collection(db, 'plugin_versions'));
            await setDoc(versionRef, {
                pluginId: pluginId,
                version: manifest.version,
                code: content,
                publishedAt: new Date().toISOString()
            });

            // Update plugin
            await updateDoc(pluginRef, {
                version: manifest.version,
                code: content,
                lastUpdated: new Date().toISOString()
            });

            this.showNotification('Plugin updated successfully!');
            await this.loadPlugins();
        } catch (error) {
            console.error('Error updating plugin:', error);
            this.showNotification('Error updating plugin: ' + error.message, true);
        }
    }

    showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-white fade-in ${
            isError ? 'bg-[#da3633]' : 'bg-[#238636]'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize plugin manager
const pluginManager = new PluginManager();

// Load plugins when auth state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        pluginManager.loadPlugins();
        pluginManager.loadMarketplace();
    }
}); 