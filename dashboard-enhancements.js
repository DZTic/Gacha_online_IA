/**
 * Améliore l'affichage des logs dans le tableau de bord de l'IA.
 * @param {string} message - Le message à logger.
 * @param {HTMLElement} logContainer - L'élément DOM où afficher le log.
 */
function logEnhanced(message, logContainer) {
    if (!logContainer) {
        console.error("logEnhanced: Le conteneur de log n'est pas fourni.");
        return;
    }

    const logEntry = document.createElement('div');
    const timestamp = `[${new Date().toLocaleTimeString()}]`;
    logEntry.innerHTML = `<span class="text-gray-500">${timestamp}</span> `;

    if (message.startsWith('[IA Réflexion]')) {
        logEntry.classList.add('ai-log-reflection');
        const pre = document.createElement('pre');
        pre.className = 'inline-block';
        pre.textContent = message.substring('[IA Réflexion] '.length);
        logEntry.appendChild(pre);

    } else if (message.includes('Récompense:')) {
        logEntry.classList.add('ai-log-reward');
        logEntry.innerHTML += message.replace(/(Récompense: [-+\d.]+)/, '<span class="font-bold">$1</span>');

    } else if (message.includes('Action:')) {
        logEntry.classList.add('ai-log-action-success');
        logEntry.innerHTML += message.replace(/(Action: [\w\sÀ-ÿ"'()-]+)/, '<span class="font-bold">$1</span>');

    } else if (message.toLowerCase().includes('erreur') || message.toLowerCase().includes('échec')) {
        logEntry.classList.add('ai-log-action-fail');
        logEntry.innerHTML += message;

    } else {
        logEntry.classList.add('ai-log-info');
        logEntry.innerHTML += message;
    }

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

/**
 * Met à jour la visualisation des Q-Values.
 * @param {Array<object>} qValueLog - Un tableau d'objets contenant { name, qValue, isChosen }.
 * @param {HTMLElement} qValuesContainer - L'élément DOM où afficher les Q-Values.
 */
function updateQValuesEnhanced(qValueLog, qValuesContainer) {
    if (!qValuesContainer) return;

    qValuesContainer.innerHTML = ''; // Clear previous values
    if (!qValueLog || qValueLog.length === 0) {
        qValuesContainer.innerHTML = '<p>En attente d\'une décision de l\'IA...</p>';
        return;
    }

    qValueLog.sort((a, b) => b.qValue - a.qValue); // Trier par Q-Value décroissante

    qValueLog.forEach(item => {
        const div = document.createElement('div');
        div.className = `flex justify-between items-center ${item.isChosen ? 'text-teal-300 font-bold' : ''}`;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        nameSpan.className = 'truncate pr-2';

        const qValueSpan = document.createElement('span');
        qValueSpan.textContent = parseFloat(item.qValue).toFixed(4);

        div.appendChild(nameSpan);
        div.appendChild(qValueSpan);
        qValuesContainer.appendChild(div);
    });
}
