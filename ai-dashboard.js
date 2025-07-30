// --- START OF FILE ai-dashboard.js ---

class AIDashboard {
    constructor(agent) {
        this.agent = agent;
        this.chart = null;
        this.history = [];
        this.isZoomed = false;
        this.actionCounts = {};
        this.EPISODE_WINDOW = 20;

        // Références DOM
        this.dashboardElement = document.getElementById('ai-dashboard');
        this.headerElement = document.getElementById('ai-dashboard-header');
        this.contentElement = document.getElementById('ai-dashboard-content');
        this.statusIndicator = document.getElementById('ai-status-indicator');
        this.toggleVisibilityBtn = document.getElementById('ai-toggle-visibility-btn');
        this.logContainer = document.getElementById('ai-log-container');
        this.startButton = document.getElementById('ai-start-btn');
        this.stopButton = document.getElementById('ai-stop-btn');
        this.speedSlider = document.getElementById('ai-speed-slider');
        this.resetButton = document.getElementById('ai-reset-btn');
        this.saveButton = document.getElementById('ai-save-btn');
        this.exportButton = document.getElementById('ai-export-btn');
        this.importButton = document.getElementById('ai-import-btn');
        this.importFilesInput = document.getElementById('ai-import-files');
        this.clearLogsButton = document.getElementById('ai-clear-logs-btn');
        this.zoomButton = document.getElementById('ai-zoom-btn');
        this.performanceChartCanvas = document.getElementById('ai-performance-chart');
        this.rarityChartCanvas = document.getElementById('ai-rarity-chart');
        this.actionTable = document.getElementById('ai-action-table');
        
        this.statusText = document.getElementById('ai-status-text');
        this.episodeNum = document.getElementById('ai-episode-num');
        this.currentRewardVal = document.getElementById('ai-current-reward-val');
        this.explorationRateVal = document.getElementById('ai-exploration-rate-val');
        this.lastActionVal = document.getElementById('ai-last-action-val');
        this.uiStateVal = document.getElementById('ai-ui-state-val');
        this.totalPowerVal = document.getElementById('ai-total-power-val');
        this.bestCharPowerVal = document.getElementById('ai-best-char-power-val');
        this.mythicCountVal = document.getElementById('ai-mythic-count-val');
        this.secretCountVal = document.getElementById('ai-secret-count-val');
        
        this.bestScoreVal = document.getElementById('ai-best-score-val');
        this.winRateVal = document.getElementById('ai-win-rate-val');
        this.avgGemsVal = document.getElementById('ai-avg-gems-val');
        this.avgPowerVal = document.getElementById('ai-avg-power-val');

        // Listeners d'événements
        this.startButton.addEventListener('click', () => this.startAI());
        this.stopButton.addEventListener('click', () => this.stopAI());
        this.speedSlider.addEventListener('input', (e) => this.agent.setDelay(parseInt(e.target.value, 10)));
        this.resetButton.addEventListener('click', () => {
            if (confirm("Voulez-vous vraiment réinitialiser l'apprentissage et toutes les statistiques de l'IA ?")) {
                this.clearGoogleSheet();
                this.agent.deleteModel();
                this.history = [];
                this.actionCounts = {};
                localStorage.removeItem('ai-chart-history');
                localStorage.removeItem('ai-action-counts');
                this.initializePerformanceChart();
                this.initializeRarityChart();
                this.updateStatusDisplay();
                this.updateSessionStats();
                this.updateActionTable();
                this.log('Historique local, stats, modèle IA et logs Google Sheet réinitialisés.');
            }
        });
        this.saveButton.addEventListener('click', () => {
            this.agent.saveModel();
            this.saveChartHistory();
            this.saveActionCounts();
            this.log('Sauvegarde manuelle effectuée.');
        });
        this.clearLogsButton.addEventListener('click', () => this.clearLogs());
        this.toggleVisibilityBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleContentVisibility(); });
        this.zoomButton.addEventListener('click', () => this.toggleZoom());
        this.exportButton.addEventListener('click', () => this.agent.exportModel());
        this.importButton.addEventListener('click', () => this.importFilesInput.click());
        this.importFilesInput.addEventListener('change', (e) => this.agent.importModel(e.target.files));
        
        this.loadChartHistory();
        this.loadActionCounts();
        this.initializePerformanceChart();
        this.initializeRarityChart();
        this.updateStatusDisplay();
        this.updateSessionStats();
        this.updateActionTable();
        
        this.initDraggable();
        this.initResizable();
        this.loadPositionAndSize();
    }

    startAI() {
        this.log('Démarrage de l\'agent IA...');
        this.startButton.disabled = true; this.stopButton.disabled = false; this.resetButton.disabled = true;
        this.saveButton.disabled = true; this.speedSlider.disabled = true; this.importButton.disabled = true; this.exportButton.disabled = true;
        this.statusText.textContent = 'En Cours';
        this.statusIndicator.classList.remove('bg-gray-500', 'bg-red-500');
        this.statusIndicator.classList.add('bg-green-500');
        this.dashboardElement.classList.add('ai-dashboard-running');
        this.agent.start();
        this.updateStatusDisplay();
    }

    stopAI() {
        this.log('Arrêt de l\'agent IA...');
        this.startButton.disabled = false; this.stopButton.disabled = true; this.resetButton.disabled = false;
        this.saveButton.disabled = false; this.speedSlider.disabled = false; this.importButton.disabled = false; this.exportButton.disabled = false;
        this.statusText.textContent = 'Arrêtée';
        this.statusIndicator.classList.remove('bg-green-500');
        this.statusIndicator.classList.add('bg-red-500');
        this.dashboardElement.classList.remove('ai-dashboard-running');
        this.agent.stop();
        this.saveChartHistory();
        this.updateStatusDisplay();
    }

    log(message) {
        const logEntry = document.createElement('div');
        let timestamp = `[${new Date().toLocaleTimeString()}]`;

        if (message.startsWith('[IA Réflexion]')) {
            logEntry.classList.add('ai-reflection-log');
            // Utiliser <pre> pour préserver le formatage multi-lignes des réflexions
            logEntry.innerHTML = `${timestamp} <pre>${message.substring('[IA Réflexion] '.length)}</pre>`;
        } else {
            logEntry.textContent = `${timestamp} ${message}`;
        }

        this.logContainer.appendChild(logEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    clearLogs() {
        this.logContainer.innerHTML = '';
        this.log('Logs effacés.');
    }

    updateStatusDisplay(lastActionName = '-', uiState = '-') {
        if (this.episodeNum) this.episodeNum.textContent = this.agent.episode;
        if (this.explorationRateVal) this.explorationRateVal.textContent = this.agent.explorationRate.toFixed(3);
        if (this.currentRewardVal) this.currentRewardVal.textContent = this.agent.totalReward.toFixed(2);
        if (this.lastActionVal) this.lastActionVal.textContent = lastActionName;
        if (this.uiStateVal) this.uiStateVal.textContent = uiState;
    }

    updateSessionStats() {
        if (this.history.length === 0) {
            this.bestScoreVal.textContent = '0'; this.winRateVal.textContent = 'N/A';
            this.avgGemsVal.textContent = '0'; this.avgPowerVal.textContent = '0';
            return;
        }
        this.bestScoreVal.textContent = Math.max(...this.history.map(h => h.score)).toFixed(2);
        const totalWins = this.history.reduce((s, h) => s + h.wins, 0);
        const totalLosses = this.history.reduce((s, h) => s + h.losses, 0);
        const totalFights = totalWins + totalLosses;
        this.winRateVal.textContent = `${(totalFights > 0 ? (totalWins / totalFights * 100) : 0).toFixed(1)}%`;
        const totalGemsGained = this.history.reduce((s, h) => s + (h.gemsEnd - h.gemsStart), 0);
        this.avgGemsVal.textContent = `+${(totalGemsGained / this.history.length).toFixed(1)}`;
        const totalPowerGained = this.history.reduce((s, h) => s + (h.powerEnd - h.powerStart), 0);
        this.avgPowerVal.textContent = `+${(totalPowerGained / this.history.length).toFixed(0)}`;
    }
    
    initializePerformanceChart() {
        if (!this.performanceChartCanvas) return;
        const ctx = this.performanceChartCanvas.getContext('2d');
        if (Chart.getChart(this.performanceChartCanvas)) { Chart.getChart(this.performanceChartCanvas).destroy(); }
        const rG = ctx.createLinearGradient(0,0,0,150); rG.addColorStop(0,'rgba(20,210,184,0.5)'); rG.addColorStop(1,'rgba(20,210,184,0)');
        const pG = ctx.createLinearGradient(0,0,0,150); pG.addColorStop(0,'rgba(167,139,250,0.5)'); pG.addColorStop(1,'rgba(167,139,250,0)');
        this.chart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [{label: 'Récompense Moyenne', data: [], borderColor: 'rgb(20, 210, 184)', backgroundColor: rG, fill: true, tension: 0.3, yAxisID: 'y'}, {label: 'Niveau Joueur', data: [], borderColor: 'rgb(250, 204, 21)', borderDash: [5, 5], fill: false, tension: 0.3, yAxisID: 'y1'}, {label: 'Puissance Équipe', data: [], borderColor: 'rgb(167, 139, 250)', backgroundColor: pG, fill: true, tension: 0.3, yAxisID: 'y2'}] },
            options: { responsive: true, maintainAspectRatio: false, animation: {duration: 0}, interaction: {mode: 'index', intersect: false}, scales: { x: { display: true, title: {display: true, text: 'Épisode', color: '#FFF8'}, ticks: {color: '#FFF7'}, grid: {color: '#FFF1'} }, y: {type: 'linear', display: true, position: 'left', title: {display: true, text: 'Récompense Moyenne', color: 'rgb(20, 210, 184)'}, ticks: {color: 'rgb(20, 210, 184)'}, grid: {color: '#FFF1'}}, y1: {type: 'linear', display: true, position: 'right', title: {display: true, text: 'Niveau Joueur', color: 'rgb(250, 204, 21)'}, ticks: {color: 'rgb(250, 204, 21)'}, grid: {drawOnChartArea: false}}, y2: {type: 'linear', display: true, position: 'right', title: {display: true, text: 'Puissance Équipe', color: 'rgb(167, 139, 250)'}, ticks: {color: 'rgb(167, 139, 250)', callback: function(v){return v>=1000?(v/1000)+'k':v;}}, grid: {drawOnChartArea: false}} },
                plugins: { legend: {labels:{color: '#FFF8', usePointStyle: true, boxWidth: 8}}, tooltip: {backgroundColor: '#000C', titleColor: '#fff', bodyColor: '#fff', borderColor: '#FFF5', borderWidth: 1, padding: 10, callbacks: {label: function(c){let l=c.dataset.label||''; if(l)l+=': '; if(c.parsed.y!==null)l+=c.parsed.y.toLocaleString(); return l;}}} } }
        });
        this.redrawPerformanceChart();
    }

    redrawPerformanceChart() {
        if (!this.chart) return;
        const dataToDisplay = this.isZoomed ? this.history.slice(-100) : this.history;
        const labels = [], avgRewards = [], playerLevels = [], teamPowers = [];
        dataToDisplay.forEach((dp, i) => {
            if (dp.episode % 5 === 0) {
                const historyIndex = this.history.findIndex(h => h.episode === dp.episode);
                if (historyIndex !== -1) {
                    const avg = this.calculateMovingAverageReward(historyIndex); 
                    labels.push(dp.episode);
                    avgRewards.push(avg);
                    playerLevels.push(dp.playerLevel);
                    teamPowers.push(dp.totalPower);
                }
            }
        });
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = avgRewards;
        this.chart.data.datasets[1].data = playerLevels;
        this.chart.data.datasets[2].data = teamPowers;
        this.chart.update();
    }

    toggleZoom() { this.isZoomed = !this.isZoomed; this.redrawPerformanceChart(); this.log(`Zoom ${this.isZoomed ? 'activé' : 'désactivé'}.`); }

    update(episode, episodeData) {
        this.history.push({ episode, score: episodeData.totalReward, playerLevel: episodeData.gameStateEnd.level, totalPower: episodeData.gameStateEnd.totalPower, gemsStart: episodeData.gameStateStart.gems, gemsEnd: episodeData.gameStateEnd.gems, powerStart: episodeData.gameStateStart.totalPower, powerEnd: episodeData.gameStateEnd.totalPower, wins: episodeData.wins, losses: episodeData.losses });
        const actionName = episodeData.lastActionName;
        this.actionCounts[actionName] = (this.actionCounts[actionName] || 0) + 1;
        this.updateStatusDisplay(actionName, episodeData.gameStateEnd.uiState);
        if (episode % 5 === 0) {
            this.redrawPerformanceChart();
            this.updateSessionStats();
        }
        this.updateRarityChart();
        this.updateActionTable();

        const currentEpisodeIndex = this.history.length - 1;
        const movingAverageReward = this.calculateMovingAverageReward(currentEpisodeIndex);

        const dataForSheet = {
            episode: episode,
            totalReward: episodeData.totalReward,
            movingAverageReward: movingAverageReward,
            explorationRate: this.agent.explorationRate,
            playerLevel: episodeData.gameStateEnd.level,
            totalPower: episodeData.gameStateEnd.totalPower,
            gemsGained: episodeData.gameStateEnd.gems - episodeData.gameStateStart.gems,
            actionCounts: this.actionCounts,
            wins: episodeData.wins,
            losses: episodeData.losses,
            reflectionLog: episodeData.reflectionLog
        };
        this.logToGoogleSheet(dataForSheet);
    }

    saveChartHistory() { const h = this.history.slice(-500); localStorage.setItem('ai-chart-history', JSON.stringify(h)); }
    loadChartHistory() { const h = localStorage.getItem('ai-chart-history'); if (h) { try { this.history = JSON.parse(h); } catch (e) { this.history = []; } } }
    saveActionCounts() { localStorage.setItem('ai-action-counts', JSON.stringify(this.actionCounts)); }
    loadActionCounts() { const c = localStorage.getItem('ai-action-counts'); if (c) { try { this.actionCounts = JSON.parse(c); } catch(e) { this.actionCounts = {}; } } }
    
    toggleContentVisibility() { const iH = this.contentElement.classList.toggle('hidden'); this.toggleVisibilityBtn.textContent = iH ? '▼' : '▲'; if(iH) { this.dashboardElement.style.width = '250px'; this.dashboardElement.style.height = 'auto'; } else { this.loadPositionAndSize(); } }
    
    initDraggable() { let p1=0,p2=0,p3=0,p4=0; const dmd=(e)=>{e=e||window.event;e.preventDefault();p3=e.clientX;p4=e.clientY;document.onmouseup=cd;document.onmousemove=ed;}; this.headerElement.onmousedown=dmd; const ed=(e)=>{e=e||window.event;e.preventDefault();p1=p3-e.clientX;p2=p4-e.clientY;p3=e.clientX;p4=e.clientY;this.dashboardElement.style.top=(this.dashboardElement.offsetTop-p2)+"px";this.dashboardElement.style.left=(this.dashboardElement.offsetLeft-p1)+"px";}; const cd=()=>{document.onmouseup=null;document.onmousemove=null;this.savePositionAndSize();}; }
    initResizable() { const g=document.getElementById('ai-resize-grip'); if(!g)return; let ow=0,oh=0,omx=0,omy=0; const rmd=(e)=>{e.preventDefault();ow=this.dashboardElement.offsetWidth;oh=this.dashboardElement.offsetHeight;omx=e.clientX;omy=e.clientY;window.addEventListener('mousemove',r);window.addEventListener('mouseup',sr);}; g.onmousedown=rmd; const r=(e)=>{const w=ow+(e.clientX-omx),h=oh+(e.clientY-omy),mw=parseInt(getComputedStyle(this.dashboardElement).minWidth),mh=parseInt(getComputedStyle(this.dashboardElement).minHeight);if(w>mw)this.dashboardElement.style.width=w+'px';if(h>mh)this.dashboardElement.style.height=h+'px';}; const sr=()=>{window.removeEventListener('mousemove',r);window.removeEventListener('mouseup',sr);if(this.chart)this.chart.resize();this.savePositionAndSize();}; }
    savePositionAndSize() { const p={top:this.dashboardElement.style.top,left:this.dashboardElement.style.left,width:this.dashboardElement.style.width,height:this.dashboardElement.style.height}; localStorage.setItem('ai-dashboard-pos',JSON.stringify(p)); }
    loadPositionAndSize() { const pJ=localStorage.getItem('ai-dashboard-pos'); if(pJ){try{const p=JSON.parse(pJ); if(p.width)this.dashboardElement.style.width=p.width;if(p.height)this.dashboardElement.style.height=p.height;if(p.top)this.dashboardElement.style.top=p.top;if(p.left)this.dashboardElement.style.left=p.left;}catch(e){localStorage.removeItem('ai-dashboard-pos');}} }
    
    initializeRarityChart() {
        if (!this.rarityChartCanvas) return;
        const ctx = this.rarityChartCanvas.getContext('2d');
        if (Chart.getChart(this.rarityChartCanvas)) { Chart.getChart(this.rarityChartCanvas).destroy(); }
        this.rarityChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Rare', 'Épique', 'Légendaire', 'Mythic', 'Secret/Vanguard'],
                datasets: [{ label: 'Répartition des Raretés', data: [0,0,0,0,0], backgroundColor: ['rgba(156, 163, 175, 0.7)','rgba(167, 139, 250, 0.7)','rgba(250, 204, 21, 0.7)','rgba(236, 72, 153, 0.7)','rgba(239, 68, 68, 0.7)'], borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: 'rgba(255, 255, 255, 0.8)', boxWidth: 10, font: { size: 10 } } }, title: { display: true, text: 'Composition Inventaire', color: 'rgba(255, 255, 255, 0.9)' } }
            }
        });
    }

    async logToGoogleSheet(episodeData) {
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz7EzPz6Tc-lcyEtSWkdjNeDRmaZ7unuE5vZGZmSNw4oQn1J4nWR_C7p-6RIb3rHQgBNw/exec";
        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(episodeData)
            });
        } catch (error) {
            console.error('[Google Sheet] Erreur lors de l\'envoi des données :', error);
            this.log('Erreur d\'envoi vers Google Sheet.');
        }
    }

    async clearGoogleSheet() {
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz7EzPz6Tc-lcyEtSWkdjNeDRmaZ7unuE5vZGZmSNw4oQn1J4nWR_C7p-6RIb3rHQgBNw/exec";
        this.log('Envoi de la commande de réinitialisation à Google Sheet...');
        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clear' }) 
            });
            this.log('Google Sheet a été notifié de la réinitialisation.');
        } catch (error) {
            console.error('[Google Sheet] Erreur lors de l\'envoi de la commande de suppression :', error);
            this.log('Erreur d\'envoi de la commande de reset vers Google Sheet.');
        }
    }

    calculateMovingAverageReward(episodeIndex) {
        if (!this.history || this.history.length === 0 || episodeIndex < 0 || episodeIndex >= this.history.length) {
            return this.history.length > 0 ? this.history[0].score : 0;
        }
        const startIndex = Math.max(0, episodeIndex - this.EPISODE_WINDOW + 1);
        const windowSlice = this.history.slice(startIndex, episodeIndex + 1);
        if (windowSlice.length === 0) return 0;
        const sum = windowSlice.reduce((s, h) => s + h.score, 0);
        return sum / windowSlice.length;
    }

    updateRarityChart() {
        if (!this.rarityChart) return;
        const counts = {
            'Rare': ownedCharacters.filter(c=>c.rarity==='Rare').length,
            'Épique': ownedCharacters.filter(c=>c.rarity==='Épique').length,
            'Légendaire': ownedCharacters.filter(c=>c.rarity==='Légendaire').length,
            'Mythic': ownedCharacters.filter(c=>c.rarity==='Mythic').length,
            'Secret/Vanguard': ownedCharacters.filter(c=>c.rarity==='Secret'||c.rarity==='Vanguard').length
        };
        this.rarityChart.data.datasets[0].data = Object.values(counts);
        this.rarityChart.update('none');
    }

    log(message, type = 'info') {
        const logEntry = document.createElement('div');
        const timestamp = `[${new Date().toLocaleTimeString()}]`;
        logEntry.textContent = `${timestamp} ${message}`;

        switch (type) {
            case 'error':
                logEntry.style.color = '#ff6b6b';
                break;
            case 'save':
                logEntry.style.color = '#6bff6b';
                break;
            case 'reflection':
                logEntry.style.color = '#6b6bff';
                break;
            default:
                logEntry.style.color = 'white';
        }

        this.logContainer.appendChild(logEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    updateActionTable() {
        if (!this.actionTable) return;
        const tbody = this.actionTable.querySelector('tbody') || document.createElement('tbody');
        tbody.innerHTML = '';
        const sortedActions = Object.entries(this.actionCounts).sort(([,a],[,b]) => b - a);
        for (const [name, count] of sortedActions) {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = name;
            row.insertCell(1).textContent = count;
            row.cells[1].className = 'font-semibold text-right';
        }
        if (!this.actionTable.querySelector('tbody')) this.actionTable.appendChild(tbody);
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutationsList, obs) => {
        for(const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const gameContainer = document.getElementById('game-container');
                if (gameContainer && !gameContainer.classList.contains('hidden')) {
                    console.log("Jeu initialisé, création de l'agent et du dashboard IA.");
                    const agent = new AIAgent();
                    const dashboard = new AIDashboard(agent);
                    agent.setDashboard(dashboard);
                    document.getElementById('ai-dashboard').classList.remove('hidden');
                    obs.disconnect(); 
                    return;
                }
            }
        }
    });
    observer.observe(document.getElementById('game-container'), { attributes: true });
});