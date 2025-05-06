// Search functionality
function handleSearch(event) {
    event.preventDefault();
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    
    if (query) {
        // Redirect to Google search
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
}

// Plugin Manager
class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.activePlugins = new Set();
        this.pluginContainer = document.getElementById('pluginContainer');
        this.marketplaceGrid = document.getElementById('marketplaceGrid');
        this.initializeEventListeners();
        this.loadPlugins();
    }

    initializeEventListeners() {
        // Add event listeners for plugin management
        document.addEventListener('DOMContentLoaded', () => {
            // Load plugins when the page loads
            this.loadPlugins();
        });
    }

    async loadPlugins() {
        try {
            // Load installed plugins from localStorage
            const installedPlugins = JSON.parse(localStorage.getItem('velocity_plugins') || '[]');
            
            // Clear existing plugins
            this.plugins.clear();
            this.pluginContainer.innerHTML = '';

            // Load each installed plugin
            for (const pluginId of installedPlugins) {
                const pluginData = JSON.parse(localStorage.getItem(`velocity_plugin_${pluginId}`));
                if (pluginData) {
                    this.plugins.set(pluginId, pluginData);
                    if (pluginData.active) {
                        this.activatePlugin(pluginId);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading plugins:', error);
        }
    }

    async installPlugin(pluginData) {
        try {
            const pluginId = crypto.randomUUID();
            const plugin = {
                id: pluginId,
                ...pluginData,
                active: false,
                installedAt: new Date().toISOString()
            };

            // Save plugin data
            localStorage.setItem(`velocity_plugin_${pluginId}`, JSON.stringify(plugin));

            // Add to installed plugins list
            const installedPlugins = JSON.parse(localStorage.getItem('velocity_plugins') || '[]');
            installedPlugins.push(pluginId);
            localStorage.setItem('velocity_plugins', JSON.stringify(installedPlugins));

            // Add to plugins map
            this.plugins.set(pluginId, plugin);

            // Show success notification
            this.showNotification('Plugin installed successfully!');
        } catch (error) {
            console.error('Error installing plugin:', error);
            this.showNotification('Error installing plugin', true);
        }
    }

    async uninstallPlugin(pluginId) {
        try {
            // Remove from installed plugins list
            const installedPlugins = JSON.parse(localStorage.getItem('velocity_plugins') || '[]');
            const updatedPlugins = installedPlugins.filter(id => id !== pluginId);
            localStorage.setItem('velocity_plugins', JSON.stringify(updatedPlugins));

            // Remove plugin data
            localStorage.removeItem(`velocity_plugin_${pluginId}`);

            // Remove from plugins map
            this.plugins.delete(pluginId);

            // Deactivate if active
            this.deactivatePlugin(pluginId);

            // Show success notification
            this.showNotification('Plugin uninstalled successfully!');
        } catch (error) {
            console.error('Error uninstalling plugin:', error);
            this.showNotification('Error uninstalling plugin', true);
        }
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
            
            // Update plugin state
            plugin.active = true;
            localStorage.setItem(`velocity_plugin_${pluginId}`, JSON.stringify(plugin));

            // Show success notification
            this.showNotification('Plugin activated successfully!');
        } catch (error) {
            console.error('Error activating plugin:', error);
            this.showNotification('Error activating plugin', true);
        }
    }

    deactivatePlugin(pluginId) {
        this.activePlugins.delete(pluginId);
        
        // Update plugin state
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
            plugin.active = false;
            localStorage.setItem(`velocity_plugin_${pluginId}`, JSON.stringify(plugin));
        }

        // Remove plugin's iframe if it exists
        const iframe = document.querySelector(`iframe[data-plugin-id="${pluginId}"]`);
        if (iframe) {
            iframe.remove();
        }
    }

    showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-white fade-in ${
            isError ? 'bg-red-500' : 'bg-green-500'
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

// Marketplace functions
function openMarketplace() {
    document.getElementById('marketplaceModal').classList.remove('hidden');
    loadMarketplace();
}

function closeMarketplace() {
    document.getElementById('marketplaceModal').classList.add('hidden');
}

async function loadMarketplace() {
    const marketplaceGrid = document.getElementById('marketplaceGrid');
    marketplaceGrid.innerHTML = '';

    try {
        // Fetch available plugins from the plugins directory
        const response = await fetch('/plugins/index.json');
        const plugins = await response.json();

        plugins.forEach(plugin => {
            const card = createPluginCard(plugin);
            marketplaceGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading marketplace:', error);
        pluginManager.showNotification('Error loading marketplace', true);
    }
}

function createPluginCard(plugin) {
    const card = document.createElement('div');
    card.className = 'bg-[#1a1a1a] rounded-lg p-4 border border-[#333] hover:border-red-500 transition-colors';
    card.innerHTML = `
        <div class="flex items-center space-x-3 mb-3">
            <img src="${plugin.icon}" alt="${plugin.name}" class="w-10 h-10 rounded">
            <div>
                <h3 class="font-medium">${plugin.name}</h3>
                <p class="text-sm text-gray-400">v${plugin.version}</p>
            </div>
        </div>
        <p class="text-sm text-gray-300 mb-4">${plugin.description}</p>
        <div class="flex justify-between items-center">
            <span class="text-xs text-gray-400">by ${plugin.author}</span>
            <div class="space-x-2">
                <button onclick="installPlugin('${plugin.id}')" 
                        class="px-3 py-1 bg-red-500 hover:bg-red-600 rounded text-sm transition-colors">
                    Install
                </button>
            </div>
        </div>
    `;
    return card;
}

async function installPlugin(pluginId) {
    try {
        // Fetch plugin code from the plugins directory
        const response = await fetch(`/plugins/${pluginId}.js`);
        const pluginCode = await response.text();

        // Extract manifest from the plugin code
        const manifestMatch = pluginCode.match(/\/\*[\s\S]*?\*\//);
        if (!manifestMatch) {
            throw new Error('Plugin manifest not found');
        }

        const manifest = JSON.parse(manifestMatch[0].replace(/\/\*|\*\//g, ''));

        // Create plugin object
        const plugin = {
            id: pluginId,
            name: manifest.name,
            description: manifest.description,
            version: manifest.version,
            icon: manifest.icon,
            author: manifest.author,
            code: pluginCode
        };

        // Install the plugin
        await pluginManager.installPlugin(plugin);
    } catch (error) {
        console.error('Error installing plugin:', error);
        pluginManager.showNotification('Error installing plugin', true);
    }
} 