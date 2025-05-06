/*{
    "name": "Digital Clock",
    "description": "Adds a digital clock to your dashboard",
    "version": "1.0.0",
    "icon": "https://via.placeholder.com/40",
    "author": "Velocity"
}*/

class ClockPlugin {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'bg-[#1a1a1a] rounded-lg p-4 border border-[#333]';
        this.container.innerHTML = `
            <div class="text-center">
                <div class="text-4xl font-mono text-red-500" id="clock-time"></div>
                <div class="text-sm text-gray-400 mt-2" id="clock-date"></div>
            </div>
        `;
    }

    init() {
        // Add to plugin container
        document.getElementById('pluginContainer').appendChild(this.container);
        
        // Update time every second
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
    }

    updateTime() {
        const now = new Date();
        const timeElement = document.getElementById('clock-time');
        const dateElement = document.getElementById('clock-date');

        // Format time (HH:MM:SS)
        const time = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Format date (Day, Month Date, Year)
        const date = now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        timeElement.textContent = time;
        dateElement.textContent = date;
    }
}

// Initialize the plugin
const clock = new ClockPlugin();
clock.init(); 