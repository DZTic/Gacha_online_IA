class AIAgent {
    constructor() {
        // --- Hyperparamètres d'apprentissage ---
        this.learningRate = 0.01;
        this.discountFactor = 0.95;
        this.explorationRate = 1.0;
        this.explorationDecay = 0.998;
        this.minExplorationRate = 0.05;

        this.isRunning = false;
        
        // CORRIGÉ FINAL: La taille de l'état est de 12 (jeu) + 14 (UI) = 26
        this.maxActionSpaceSize = 14; 
        this.stateSize = 13 + 16;
        this.model = this.createModel();

        this.delay = 500;
        this.episode = 0;
        this.totalReward = 0;
        this.dashboard = null;
        this.currentEpisodeReflectionLogs = [];

        this.consecutiveStoryLosses = 0;
        this.stuckOnLevelId = null;

         this.ACTION_MAP = {
            [UI_STATE_MAIN]: [
                { name: "Tirage Standard x10", func: () => multiPull() },
                { name: "Jouer prochain niveau Histoire", func: this.playNextStoryLevel },
                // MODIFIÉ : Renommé pour plus de clarté
                { name: "Farmer le niveau Histoire le plus rentable", func: this.farmBestCompletedLevel },
                // NOUVEAU : Ajout de l'action pour farmer les challenges
                { name: "Farmer le niveau Challenge le plus rentable", func: this.farmBestChallengeLevel },
                { name: "Ouvrir l'Inventaire", func: () => showTab('inventory') },
                { name: "Ouvrir l'onglet Traits", func: () => showTab('trait') },
                { name: "Ouvrir l'onglet Curse", func: () => showTab('curse') },
                { name: "Ouvrir l'onglet Stat Change", func: () => showTab('stat-change') },
                { name: "Ouvrir sous-onglet Légende", func: () => showSubTab('legende') },
                { name: "Ouvrir sous-onglet Challenge", func: () => showSubTab('challenge') },
                { name: "Ouvrir sous-onglet Matériaux", func: () => showSubTab('materiaux') },
                { name: "Attendre", func: async () => {} }
            ],
            [UI_STATE_BATTLE_SELECTION]: [
                // --- CORRECTION IA ---
                // Les actions de sélection ont été retirées. L'IA ne prend plus de décision sur cet écran.
                // Ces actions sont conservées comme fallback si l'IA se retrouve bloquée ici par erreur,
                // lui donnant une porte de sortie pour annuler ou confirmer une sélection manuelle.
                { name: "Confirmer la sélection", func: () => confirmSelection() },
                { name: "Annuler la sélection", func: () => cancelSelection() }
            ],
            [UI_STATE_LEGEND_SUBTAB]: [ // NOUVEAU
                { name: "Jouer Légende le plus fort", func: this.playStrongestLegendLevel },
                { name: "Retourner à l'Histoire", func: () => showSubTab('story') }
            ],
            [UI_STATE_CHALLENGE_SUBTAB]: [ // NOUVEAU
                { name: "Jouer Challenge le plus fort", func: this.playStrongestChallengeLevel },
                { name: "Retourner à l'Histoire", func: () => showSubTab('story') }
            ],
            [UI_STATE_MATERIAL_SUBTAB]: [ // NOUVEAU
                { name: "Jouer Matériaux le plus fort", func: this.playStrongestMaterialLevel },
                { name: "Retourner à l'Histoire", func: () => showSubTab('story') }
            ],
            [UI_STATE_INVENTORY]: [
                { name: "Utiliser les objets d'EXP", func: this.useExpItemsOnBestChar },
                { name: "Inspecter le meilleur perso pour fusion", func: this.inspectBestCharForFusion },
                { name: "Retourner au menu principal", func: () => showTab('play') }
            ],
            [UI_STATE_STATS_MODAL]: [
                { name: "Lancer la fusion (auto-sélection)", func: this.executeFusionOnBestChar },
                { name: "Donner des objets (auto-sélection)", func: this.executeGiveItemsOnCurrentChar },
                { name: "Retourner à l'inventaire", func: () => closeModal() } 
            ],
            [UI_STATE_FUSION_SELECTION]: [
                { name: "Confirmer la fusion (Fallback)", func: () => confirmFusion() },
                { name: "Annuler la fusion (Fallback)", func: () => cancelFusion() }
            ],
                    [UI_STATE_GIVE_ITEMS]: [
                { name: "Confirmer le don d'objets", func: () => confirmGiveItems() },
                { name: "Annuler le don d'objets", func: () => cancelGiveItems() }
            ],
            [UI_STATE_MISSIONS]: [ { name: "Retourner au menu principal", func: () => showTab('play') } ],
            [UI_STATE_TRAIT]: [
                { name: "Appliquer Trait au meilleur perso", func: this.applyTraitToBestChar },
                { name: "Retourner au menu principal", func: () => showTab('play') }
            ],
            [UI_STATE_CURSE]: [
                { name: "Appliquer Curse au meilleur perso", func: this.applyCurseToBestChar },
                { name: "Retourner au menu principal", func: () => showTab('play') }
            ],
            [UI_STATE_STAT_CHANGE]: [
                { name: "Changer Stat du meilleur perso", func: this.changeStatOfBestChar },
                { name: "Retourner au menu principal", func: () => showTab('play') }
            ],
            // NOUVEAU : Définir les actions pour l'onglet Limit Break
            [UI_STATE_LIMIT_BREAK]: [
                { name: "Briser la limite du meilleur perso", func: this.applyLimitBreakToBestChar },
                { name: "Retourner au menu principal", func: () => showTab('play') }
            ]
        };
        
        this.loadModel();
    }

    // --- Helper pour logger les réflexions ---
    logReflection(message) {
        this.currentEpisodeReflectionLogs.push(message);
        if (this.dashboard) {
            this.dashboard.log(`[IA Réflexion] ${message}`);
        }
    }

    // --- Fonctions de sauvegarde, chargement, export et import ---
    async saveModel() {
        try {
            await this.model.save('localstorage://gacha-ai-model');
            const trainingState = { episode: this.episode, explorationRate: this.explorationRate };
            localStorage.setItem('gacha-ai-training-state', JSON.stringify(trainingState));
            if (this.dashboard) this.dashboard.log("Modèle sauvegardé.");
        } catch (error) { console.error('[IA] Erreur lors de la sauvegarde du modèle:', error); }
    }

    async loadModel() {
        try {
            this.model = await tf.loadLayersModel('localstorage://gacha-ai-model');
            this.model.compile({ optimizer: tf.train.adam(this.learningRate), loss: 'meanSquaredError' });
            const trainingStateJSON = localStorage.getItem('gacha-ai-training-state');
            if (trainingStateJSON) {
                const trainingState = JSON.parse(trainingStateJSON);
                this.episode = trainingState.episode || 0;
                this.explorationRate = trainingState.explorationRate || 1.0;
            }
            if (this.dashboard) this.dashboard.log(`Modèle chargé. Reprise à l'épisode ${this.episode}.`);
        } catch (error) {
            this.model = this.createModel();
            if (this.dashboard) this.dashboard.log("Aucun modèle trouvé. Nouvel apprentissage.");
        }
    }

    async deleteModel() {
        try {
            await tf.io.removeModel('localstorage://gacha-ai-model');
            localStorage.removeItem('gacha-ai-training-state');
            if (this.dashboard) this.dashboard.log("Modèle supprimé. L'IA est réinitialisée.");
            this.episode = 0; this.explorationRate = 1.0; this.model = this.createModel();
        } catch (error) { console.error('[IA] Erreur lors de la suppression du modèle:', error); }
    }

    async exportModel() {
        if (this.isRunning) { this.dashboard.log("Erreur: Arrêtez l'IA avant d'exporter."); return; }
        try {
            await this.model.save('downloads://gacha-ai-model');
            const trainingState = { episode: this.episode, explorationRate: this.explorationRate, };
            const stateBlob = new Blob([JSON.stringify(trainingState, null, 2)], { type: 'application/json' });
            const stateUrl = URL.createObjectURL(stateBlob);
            const a = document.createElement('a');
            a.href = stateUrl; a.download = 'gacha-ai-training-state.json';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(stateUrl);
            this.dashboard.log("Modèle et état exportés.");
        } catch (error) { console.error('[IA] Erreur lors de l\'exportation:', error); }
    }

    async importModel(files) {
        if (this.isRunning) { this.dashboard.log("Erreur: Arrêtez l'IA avant d'importer."); return; }
        const modelFile = Array.from(files).find(file => file.name.endsWith('model.json'));
        const weightsFile = Array.from(files).find(file => file.name.endsWith('.bin'));
        const stateFile = Array.from(files).find(file => file.name.endsWith('state.json'));
        if (!modelFile || !weightsFile || !stateFile) { alert("Erreur: Veuillez sélectionner les 3 fichiers requis (model.json, .bin, et state.json)."); return; }
        try {
            this.model = await tf.loadLayersModel(tf.io.browserFiles([modelFile, weightsFile]));
            this.model.compile({ optimizer: tf.train.adam(this.learningRate), loss: 'meanSquaredError' });
            const stateText = await stateFile.text();
            const trainingState = JSON.parse(stateText);
            this.episode = trainingState.episode || 0;
            this.explorationRate = trainingState.explorationRate || 1.0;
            this.dashboard.log(`Modèle importé. Reprise à l'épisode ${this.episode}.`);
            this.dashboard.updateStatusDisplay();
        } catch (error) {
            console.error('[IA] Erreur lors de l\'importation:', error);
            alert("Erreur lors de l'importation. Fichiers invalides ? Voir la console.");
            this.model = this.createModel();
        }
    }

    // --- Fonctions de base de l'agent ---
    setDelay(ms) { this.delay = Math.max(50, ms); }
    setDashboard(dashboard) { this.dashboard = dashboard; }

    createModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 64, inputShape: [this.stateSize], activation: 'relu' }));
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        model.add(tf.layers.dense({ units: this.maxActionSpaceSize, activation: 'linear' }));
        model.compile({ optimizer: tf.train.adam(this.learningRate), loss: 'meanSquaredError' });
        return model;
    }

    getState() {
        const teamPower = ownedCharacters.filter(c => !c.locked).sort((a, b) => b.power - a.power).slice(0, 3).reduce((sum, char) => sum + char.power, 0);
        const bestCharacterPower = ownedCharacters.length > 0 ? Math.max(...ownedCharacters.map(c => c.power)) : 0;
        const bestCharacterLevel = ownedCharacters.length > 0 ? Math.max(...ownedCharacters.map(c => c.level)) : 0;
        const legendaryCount = ownedCharacters.filter(c => c.rarity === 'Légendaire').length;
        const mythicCount = ownedCharacters.filter(c => c.rarity === 'Mythic').length;
        const topTierCount = ownedCharacters.filter(c => c.rarity === 'Secret' || c.rarity === 'Vanguard').length;

        const gameState = [
            level / 100,
            gems / 10000,
            coins / 50000,
            teamPower / 100000,
            bestCharacterPower / 10000,
            bestCharacterLevel / 100,
            pullCount / 1000,
            legendaryCount / 20,
            mythicCount / 10,
            topTierCount / 5,
            (inventory['Stat Chip'] || 0) / 10,
            (inventory['Cursed Token'] || 0) / 10,
            (inventory['Reroll Token'] || 0) / 10
        ];

        const realTimeUIState = getVisibleUIContext();
        const uiStates = [
            UI_STATE_MAIN, UI_STATE_BATTLE_SELECTION, UI_STATE_INVENTORY, 
            UI_STATE_GIVE_ITEMS, UI_STATE_MISSIONS, UI_STATE_SHOP, 
            UI_STATE_EVOLUTION_TAB, UI_STATE_TRAIT, UI_STATE_CURSE, UI_STATE_STAT_CHANGE,
            UI_STATE_LIMIT_BREAK,UI_STATE_STATS_MODAL, UI_STATE_FUSION_SELECTION,
            UI_STATE_LEGEND_SUBTAB, UI_STATE_CHALLENGE_SUBTAB, UI_STATE_MATERIAL_SUBTAB
        ];
        const uiStateVector = uiStates.map(s => s === realTimeUIState ? 1 : 0);
        
        return tf.tensor2d([gameState.concat(uiStateVector)], [1, this.stateSize]);
    }

    async chooseAction(state) {
        const realTimeUIState = getVisibleUIContext();
        const availableActions = this.ACTION_MAP[realTimeUIState] || this.ACTION_MAP[UI_STATE_MAIN];
        
        if (Math.random() <= this.explorationRate) {
            const actionIndex = Math.floor(Math.random() * availableActions.length);
            this.logReflection(`Action choisie par exploration (au hasard) : "${availableActions[actionIndex].name}"`);
            return actionIndex;
        }

        const qValuesTensor = this.model.predict(state);
        const qValues = await qValuesTensor.data();
        qValuesTensor.dispose();

        const availableQValues = qValues.slice(0, availableActions.length);
        const actionIndex = tf.argMax(availableQValues).dataSync()[0];

        this.logReflection('--- Analyse des actions possibles ---');
        availableActions.forEach((action, index) => {
            const qValue = availableQValues[index].toFixed(4);
            const isChosen = index === actionIndex;
            this.logReflection(`${isChosen ? '-> ' : '   '}[${action.name}]: Q-Value = ${qValue}`);
        });
        this.logReflection(`Action choisie par exploitation (Q-Value max) : "${availableActions[actionIndex].name}"`);

        return actionIndex;
    }

    async inspectBestCharForFusion() {
        // Trouve le meilleur personnage qui n'est PAS à son niveau maximum.
        const bestCharToLevelUp = ownedCharacters
            .filter(c => !c.locked && c.level < (c.maxLevelCap || 60))
            .sort((a, b) => b.power - a.power)[0];

        if (!bestCharToLevelUp) {
            throw new Error("Aucun personnage à améliorer trouvé (tous sont au niveau maximum).");
        }

        this.logReflection(`Inspection de ${bestCharToLevelUp.name} (Niv. ${bestCharToLevelUp.level}) pour une fusion potentielle.`);
        
        // Simule le clic sur la carte du personnage dans l'inventaire pour ouvrir ses stats.
        await showCharacterStats(bestCharToLevelUp.id);
    }

    async executeFusionOnBestChar() {
        // 1. L'IA doit d'abord trouver le bouton "Fusionner" dans la modale de stats et le cliquer.
        // La fonction du jeu `startFusion` fait exactement cela.
        if (typeof startFusion !== 'function') throw new Error("La fonction startFusion n'est pas disponible.");
        // `currentFusionCharacterId` est défini globalement par `showCharacterStats`.
        await startFusion(currentFusionCharacterId); 

        // Attendre un court instant que la modale de fusion s'affiche
        await new Promise(r => setTimeout(r, 150)); 

        // 2. Sélectionner intelligemment les personnages "sacrifiables" (fodder)
        const fodderCharacters = ownedCharacters
            .filter(c => 
                c.id !== currentFusionCharacterId && // Ne pas se fusionner soi-même
                !c.locked &&                       // Ne pas fusionner les personnages verrouillés
                (c.rarity === 'Rare' || c.rarity === 'Épique') // Cible uniquement les Rares et Épiques
            )
            .sort((a, b) => a.power - b.power) // Trier par puissance croissante pour sacrifier les plus faibles
            .slice(0, 5); // Sélectionner jusqu'à 5 personnages

        if (fodderCharacters.length === 0) {
            // Si aucun personnage sacrifiable n'est trouvé, annuler pour ne pas rester bloqué.
            if (typeof cancelFusion === 'function') cancelFusion();
            throw new Error("Aucun personnage sacrifiable (Rare/Épique) trouvé.");
        }

        this.logReflection(`Sélection de ${fodderCharacters.length} personnage(s) à fusionner : ${fodderCharacters.map(c => c.name).join(', ')}.`);

        // 3. Simuler la sélection de chaque personnage sacrifiable
        for (const fodder of fodderCharacters) {
            if (typeof selectFusionCharacter === 'function') {
                selectFusionCharacter(fodder.id);
            }
        }
        await new Promise(r => setTimeout(r, 50)); 

        // 4. Confirmer la fusion
        if (typeof confirmFusion !== 'function') throw new Error("La fonction confirmFusion n'est pas disponible.");
        const fusionResult = await confirmFusion(); // Supposons que confirmFusion retourne des infos utiles
        
        // Cette action est un succès, même si fusionResult est simple.
        // La récompense sera calculée sur le changement d'état (gain de puissance/niveau).
        return { success: true }; 
    }

    // Version améliorée de useExpItemsOnBestChar qui devient "intelligente"
    async executeGiveItemsOnCurrentChar() {
        if (!currentGiveItemsCharacterId) throw new Error("Aucun personnage n'est inspecté.");

        const expItems = Object.keys(inventory).filter(i => inventory[i] > 0 && itemEffects[i] && itemEffects[i].exp);
        if (expItems.length === 0) {
            if (typeof cancelGiveItems === 'function') cancelGiveItems();
            throw new Error("Aucun objet d'EXP disponible dans l'inventaire.");
        }
        
        this.logReflection(`Utilisation de tous les objets d'EXP sur le personnage inspecté.`);
        
        // `startGiveItems` est déjà appelé par le clic sur le bouton dans la modale de stats,
        // mais on s'assure qu'il est bien appelé si ce n'est pas le cas.
        if (getVisibleUIContext() !== UI_STATE_GIVE_ITEMS) {
            await startGiveItems(currentGiveItemsCharacterId);
            await new Promise(r => setTimeout(r, 150));
        }

        // Sélectionner tous les objets d'EXP disponibles
        expItems.forEach(item => {
            if (inventory[item] > 0) {
                selectedItemsForGiving.set(item, inventory[item]);
            }
        });
        
        // Confirmer le don
        if (typeof confirmGiveItems === 'function') {
            await confirmGiveItems();
            return { success: true };
        } else {
            throw new Error("La fonction confirmGiveItems n'est pas disponible.");
        }
    }
    
    // Nouvelle fonction helper pour encapsuler la logique de combat complète
    async _executeBattle(levelId) {
        if (levelId === null || levelId === undefined) {
            throw new Error("ID de niveau invalide fourni pour l'exécution de la bataille.");
        }
        
        // Ouvre la modale de sélection de personnage
        await startLevel(levelId);
        
        // Réinitialise la sélection pour s'assurer qu'elle est propre
        if (typeof cancelSelection === 'function') {
            cancelSelection();
            await new Promise(r => setTimeout(r, 50)); // Courte pause pour la mise à jour de l'UI
        }
    
        // Récupère les 3 meilleurs personnages non verrouillés
        const bestChars = ownedCharacters
            .filter(char => !char.locked)
            .sort((a, b) => b.power - a.power)
            .slice(0, 3);
    
        if (bestChars.length === 0) {
            throw new Error("Aucun personnage non verrouillé disponible pour le combat.");
        }
        if (bestChars.length < 3) {
            this.logReflection(`AVERTISSEMENT: Moins de 3 personnages disponibles. L'équipe sera incomplète.`);
        }
    
        this.logReflection(`Composition automatique de l'équipe : ${bestChars.map(c => c.name).join(', ')}.`);
    
        // Sélectionne chaque personnage trouvé dans l'UI
        for (const char of bestChars) {
            const originalIndex = ownedCharacters.findIndex(ownedChar => ownedChar.id === char.id);
            if (originalIndex !== -1) {
                selectBattleCharacter(originalIndex);
            }
        }
    
        await new Promise(r => setTimeout(r, 100)); // Courte pause pour que l'UI enregistre les clics
    
        // Confirme la sélection et lance le combat
        if (typeof confirmSelection === 'function') {
            await confirmSelection(); 
        } else {
            throw new Error("La fonction de confirmation de bataille (confirmSelection) n'est pas disponible.");
        }
    }

    async playNextStoryLevel() {
        const nextLevel = storyProgress.find(p => p.unlocked && !p.completed && allGameLevels.find(l => l.id === p.id && l.type === 'story'));
        if (nextLevel) {
            await this._executeBattle(nextLevel.id);
        } else {
            throw new Error("Aucun nouveau niveau d'histoire disponible.");
        }
    }

    async playStrongestLegendLevel() {
        const possibleLegendLevels = storyProgress.filter(p => p.unlocked && allGameLevels.find(l => l.id === p.id && l.type === 'legendary')).map(p => allGameLevels.find(l => l.id === p.id)).sort((a, b) => b.enemy.power - a.enemy.power);
        if (possibleLegendLevels.length > 0) {
            await this._executeBattle(possibleLegendLevels[0].id);
        } else {
            throw new Error("Aucun niveau de légende disponible.");
        }
    }

    async farmBestCompletedLevel() {
        const teamPower = ownedCharacters.sort((a,b) => b.power - a.power).slice(0, 3).reduce((s, c) => s + c.power, 0);
        const farmableLevels = storyProgress.filter(p => p.completed && allGameLevels.find(l => l.id === p.id && l.type === 'story' && !l.isInfinite && teamPower > l.enemy.power * 1.1)).map(p => allGameLevels.find(l => l.id === p.id));
        if (farmableLevels.length > 0) {
            const calculateFarmScore = (level) => {
                // Reward Score
                const worldData = baseStoryLevels.find(l => l.id === level.id);
                const worldNumberMatch = worldData ? worldData.world.match(/\d+/) : null;
                const worldNumber = worldNumberMatch ? parseInt(worldNumberMatch[0]) : 1;
                const worldReward = worldRewards.find(wr => wr.world === worldNumber);
                const itemExp = worldReward && itemEffects[worldReward.item] ? itemEffects[worldReward.item].exp : 0;
                const rewardScore = (level.rewards.gems * 1.0) + (level.rewards.coins * 0.1) + (itemExp * 0.5);

                // Difficulty Penalty
                const powerRatio = teamPower / level.enemy.power;
                let difficultyPenalty = 0;
                if (powerRatio < 1.5) {
                    difficultyPenalty = (1.5 - powerRatio) * 50;
                }

                return rewardScore - difficultyPenalty;
            };
            const scoredLevels = farmableLevels.map(level => ({...level, farmScore: calculateFarmScore(level)})).sort((a, b) => b.farmScore - a.farmScore);
            this.logReflection('--- Analyse des niveaux à farmer ---');
            scoredLevels.slice(0, 5).forEach((level, index) => { this.logReflection(`${index === 0 ? '-> ' : '   '}[${level.name}]: Score = ${level.farmScore.toFixed(2)}`); });
            this.logReflection(`Niveau choisi pour le farm : "${scoredLevels[0].name}"`);
            await this._executeBattle(scoredLevels[0].id);
        } else { throw new Error("Aucun niveau farmable trouvé."); }
    }
    
    async playStrongestChallengeLevel() {
        const possibleChallengeLevels = allGameLevels
            .filter(l => l.type === 'challenge' && storyProgress.find(p => p.id === l.id)?.unlocked)
            .sort((a, b) => b.enemy.power - a.enemy.power);
        if (possibleChallengeLevels.length > 0) {
            await this._executeBattle(possibleChallengeLevels[0].id);
        } else {
            throw new Error("Aucun niveau de challenge disponible.");
        }
    }
    
    async playStrongestMaterialLevel() {
        const possibleMaterialLevels = allGameLevels
            .filter(l => l.type === 'material' && storyProgress.find(p => p.id === l.id)?.unlocked)
            .sort((a, b) => b.enemy.power - a.enemy.power);
        if (possibleMaterialLevels.length > 0) {
            await this._executeBattle(possibleMaterialLevels[0].id);
        } else {
            throw new Error("Aucun niveau de matériaux disponible.");
        }
    }
    
    async farmBestChallengeLevel() {
        const teamPower = ownedCharacters.sort((a, b) => b.power - a.power).slice(0, 3).reduce((s, c) => s + c.power, 0);
        const farmableLevels = allGameLevels.filter(level =>
            level.type === 'challenge' &&
            storyProgress.find(p => p.id === level.id)?.completed &&
            teamPower > level.enemy.power * 1.3
        );

        if (farmableLevels.length === 0) {
            throw new Error("Aucun niveau de challenge farmable trouvé (non complété ou trop difficile).");
        }

        const CHALLENGE_ITEM_SCORES = {
            'Divin Wish': 1000, 'Reroll Token': 750, 'Stat Chip': 750, 'Cursed Token': 600,
        };

        const calculateChallengeScore = (level) => {
            let score = 0;
            if (level.rewards.itemChance) {
                const chances = Array.isArray(level.rewards.itemChance) ? level.rewards.itemChance : [level.rewards.itemChance];
                for (const chance of chances) {
                    if (CHALLENGE_ITEM_SCORES[chance.item]) {
                        score += CHALLENGE_ITEM_SCORES[chance.item] * chance.probability;
                    }
                }
            }
            return score;
        };

        const scoredLevels = farmableLevels
            .map(level => ({ ...level, farmScore: calculateChallengeScore(level) }))
            .sort((a, b) => b.farmScore - a.farmScore);

        if (scoredLevels.length === 0 || scoredLevels[0].farmScore <= 0) {
            throw new Error("Aucun niveau de challenge avec des récompenses intéressantes trouvé.");
        }

        this.logReflection('--- Analyse des niveaux de Challenge à farmer ---');
        scoredLevels.slice(0, 3).forEach((level, index) => {
            this.logReflection(`${index === 0 ? '-> ' : '   '}[${level.name}]: Score = ${level.farmScore.toFixed(2)}`);
        });
        this.logReflection(`Niveau de Challenge choisi pour le farm : "${scoredLevels[0].name}"`);
        await this._executeBattle(scoredLevels[0].id);
    }
    // --- FIN CORRECTION IA ---

    async useExpItemsOnBestChar() {
        const bestChar = ownedCharacters.filter(c => !c.locked && c.level < (c.maxLevelCap || 60)).sort((a, b) => b.power - a.power)[0];
        const expItems = Object.keys(inventory).filter(i => inventory[i] > 0 && itemEffects[i] && itemEffects[i].exp);
        if (bestChar && expItems.length > 0) {
            await startGiveItems(bestChar.id);
            expItems.forEach(i => { selectedItemsForGiving.set(i, inventory[i]); });
        } else { throw new Error("Aucun personnage à améliorer ou objet d'EXP."); }
    }

    async applyTraitToBestChar() {
        // AMÉLIORATION: L'IA cible les personnages sans trait puissant et utilise la fonction de reroll automatique.
        const bestChar = ownedCharacters
            .filter(c => !c.locked && (!c.trait || !c.trait.id || !['monarch', 'golder'].includes(c.trait.id))) // Cible les persos sans trait ou avec un trait non-optimal
            .sort((a, b) => b.power - a.power)[0];

        if (!bestChar) throw new Error("Aucun personnage éligible pour un nouveau trait.");
        if ((inventory['Reroll Token'] || 0) < 1) throw new Error("Pas de Reroll Tokens.");
        
        await selectTraitCharacter(bestChar.id);

        this.logReflection("Stratégie de Trait: Activation de la recherche automatique de traits supérieurs.");
        // Simule l'activation de la recherche continue dans l'UI
        if (traitKeepBetterToggle) traitKeepBetterToggle.checked = true;

        // L'IA définit ses traits cibles (les meilleurs possibles)
        const targetTraits = ['monarch', 'golder', 'strength_3']; 
        this.logReflection(`Ciblage des traits: ${targetTraits.join(', ')}.`);
        
        // Simule la sélection des checkboxes cibles dans l'UI
        document.querySelectorAll('#trait-target-selection .trait-target-checkbox').forEach(checkbox => {
            if (targetTraits.includes(checkbox.value)) {
                checkbox.checked = true;
            } else {
                checkbox.checked = false;
            }
        });

        // Lance la tentative, qui va maintenant utiliser la configuration UI que nous avons préparée
        const result = await tryRandomTrait(); 
        return { powerDelta: result.powerDelta };
    }

    async applyCurseToBestChar() {
        // AMÉLIORATION: L'IA utilise la fonction "garder si meilleur" et fixe l'objectif à 0% pour ne jamais accepter une malédiction négative.
        const bestChar = ownedCharacters.filter(c => !c.locked).sort((a, b) => b.power - a.power)[0];
        if (!bestChar) throw new Error("Aucun personnage à maudire.");
        if ((inventory['Cursed Token'] || 0) < 1) throw new Error("Pas de Cursed Tokens.");

        await selectCurseCharacter(bestChar.id);

        this.logReflection("Stratégie de Malédiction: Activation de la recherche d'un effet positif.");
        // Simule l'activation de la recherche continue dans l'UI
        if(curseKeepBetterToggle) curseKeepBetterToggle.checked = true;
        
        // L'IA choisit le pourcentage minimum
        const targetPercentage = 0;
        this.logReflection(`Définition du pourcentage minimum de la malédiction à ${targetPercentage}%.`);
        if(curseMinPercentageInput) {
            curseMinPercentageInput.value = targetPercentage;
            curseMinPercentageInput.disabled = false;
            // Déclenche l'événement pour que l'UI réagisse si nécessaire
            curseMinPercentageInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Lance la tentative
        const result = await applyCurse();
        return { powerDelta: result.powerDelta };
    }
    
    async changeStatOfBestChar() {
        // AMÉLIORATION: L'IA utilise la fonction "garder si meilleur" et cible uniquement les meilleurs rangs.
        const bestChar = ownedCharacters.filter(c => !c.locked && c.statRank !== 'SSS').sort((a, b) => b.power - a.power)[0];
        if (!bestChar) throw new Error("Aucun personnage éligible pour un changement de stat.");
        if ((inventory['Stat Chip'] || 0) < 1) throw new Error("Pas de Stat Chips.");

        await selectStatChangeCharacter(bestChar.id);

        this.logReflection("Stratégie de Stat: Activation de la recherche automatique de rangs supérieurs.");
        // Simule l'activation de la recherche continue dans l'UI
        if(statKeepBetterToggle) statKeepBetterToggle.checked = true;

        // L'IA définit ses rangs cibles
        const targetRanks = ['S', 'SS', 'SSS'];
        this.logReflection(`Ciblage des rangs: ${targetRanks.join(', ')}.`);

        // Simule la sélection des checkboxes cibles dans l'UI
        document.querySelectorAll('#stat-target-ranks-selection .stat-target-rank-checkbox').forEach(checkbox => {
            if (targetRanks.includes(checkbox.value)) {
                checkbox.checked = true;
            } else {
                checkbox.checked = false;
            }
        });
        
        // Lance la tentative
        const result = await applyStatChange();
        return { powerDelta: result.powerDelta };
    }

    async applyLimitBreakToBestChar() {
        const bestChar = ownedCharacters
            .filter(c => !c.locked && c.level >= (c.maxLevelCap || 60) && (c.maxLevelCap || 60) < 100)
            .sort((a, b) => b.power - a.power)[0];
            
        if (!bestChar) throw new Error("Aucun personnage éligible pour un Limit Break.");
        if ((inventory['Divin Wish'] || 0) < 1) throw new Error("Pas de Divin Wish.");

        await selectLimitBreakCharacter(bestChar.id);
        await applyLimitBreak();
        return { success: true };
    }

    async performAction(action) {
        const realTimeUIState = getVisibleUIContext();
        const actionMap = this.ACTION_MAP[realTimeUIState] || this.ACTION_MAP[UI_STATE_MAIN];
        const chosenAction = actionMap[action];
        if (!chosenAction) {
            return { success: false, name: "Action Invalide", error: "Index hors limites" };
        }
        try {
            // --- CORRECTION : L'IA récupère maintenant le résultat direct ('win'/'loss') du combat ---
            const actionResultValue = await chosenAction.func.call(this);
            let battleOutcome = null;
            let powerDelta = undefined;

            // Interprète le résultat retourné par la fonction du jeu
            if (actionResultValue === 'win' || actionResultValue === 'loss') {
                battleOutcome = actionResultValue;
            } else if (actionResultValue && typeof actionResultValue === 'object') {
                // Gère les résultats d'autres actions (ex: amélioration de personnage)
                if (actionResultValue.powerDelta !== undefined) {
                    powerDelta = actionResultValue.powerDelta;
                }
            }
            
            // L'ancienne méthode de lecture de l'écran est supprimée, rendant le résultat fiable.
            return { success: true, name: chosenAction.name, result: actionResultValue, battleOutcome: battleOutcome, powerDelta };
            // --- FIN CORRECTION ---
        } catch (error) {
            return { success: false, name: chosenAction.name, error: error.message };
        }
    }

    calculateReward(oldState, newState, actionResult) {
        let reward = 0;
        const rewardLog = [`--- Calcul de la récompense pour "${actionResult.name}" ---`];
        const addLog = (reason, value) => {
            if (value !== 0) { rewardLog.push(`   ${reason}: ${value > 0 ? '+' : ''}${value.toFixed(2)}`); }
        };

        if (!actionResult.success) {
            if (actionResult.name === "Inspecter le meilleur perso pour fusion" && actionResult.error.includes("tous sont au niveau maximum")) {
                reward -= 2; 
                addLog("Pénalité (Tentative de fusion inutile)", -2);
            } else {
                reward -= 5; addLog("Échec de l'action", -5);
            }
            addLog("TOTAL FINAL", reward); this.logReflection(rewardLog.join('\n'));
            return reward;
        }

        const combatInitiationActions = [
            "Jouer prochain niveau Histoire",
            "Farmer le niveau Histoire le plus rentable",
            "Farmer le niveau Challenge le plus rentable",
            "Jouer Légende le plus fort",
            "Jouer Challenge le plus fort",
            "Jouer Matériaux le plus fort"
        ];
        if (combatInitiationActions.includes(actionResult.name)) {
            const initiativeBonus = 3; // Bonus modéré pour encourager l'action
            reward += initiativeBonus;
            addLog("Bonus (Initiative de combat)", initiativeBonus);
        }

        // 1. Récompense massive pour les résultats de combat
        if (actionResult.battleOutcome === 'win') {
            const winBonus = 50;
            reward += winBonus;
            addLog("Bonus (Victoire en combat)", winBonus);
        } else if (actionResult.battleOutcome === 'loss') {
            const lossPenalty = -25;
            reward += lossPenalty;
            addLog("Pénalité (Défaite en combat)", lossPenalty);
        }

        // 2. Bonus pour les actions d'amélioration
        const improvementActions = [
            "Appliquer Trait au meilleur perso", "Appliquer Curse au meilleur perso",
            "Changer Stat du meilleur perso", "Utiliser les objets d'EXP",
            "Briser la limite du meilleur perso",
            "Inspecter le meilleur perso pour fusion",
            "Lancer la fusion (auto-sélection)"
        ];
        if (improvementActions.includes(actionResult.name)) {
            const bonus = 15;
            reward += bonus;
            addLog("Bonus (Action d'amélioration réussie)", bonus);
        }
        
        // --- CORRECTION IA ---
        // La récompense d'encouragement pour les étapes de sélection a été supprimée
        // pour empêcher l'IA d'exploiter une boucle de récompense sans combattre.

        const navigationPenaltyActions = ["Annuler la sélection", "Retourner au menu principal"];
        if (navigationPenaltyActions.includes(actionResult.name)) {
            const penalty = -0.5; // Petite pénalité pour décourager les allers-retours
            reward += penalty;
            addLog("Pénalité (Navigation contre-productive)", penalty);
        }
        
        // 4. Bonus pour la découverte (changement d'écran)
        if (newState.uiState !== oldState.uiState && !navigationPenaltyActions.includes(actionResult.name)) {
            const discoveryBonus = 0.5;
            reward += discoveryBonus;
            addLog("Bonus (Changement d'écran)", discoveryBonus);
        }

        if (actionResult.powerDelta !== undefined) {
            const r = actionResult.powerDelta * 0.5;
            reward += r;
            addLog(`Delta de puissance via amélioration`, r);
        }

        if (this.consecutiveStoryLosses > 0) {
            const strategicActions = ["Farmer le niveau Histoire le plus rentable", "Farmer le niveau Challenge le plus rentable", "Tirage Standard x10", "Utiliser les objets d'EXP", "Appliquer Trait au meilleur perso", "Appliquer Curse au meilleur perso", "Changer Stat du meilleur perso", "Briser la limite du meilleur perso"];
            if (actionResult.name === 'Jouer prochain niveau Histoire') {
                const penalty = -50 * this.consecutiveStoryLosses;
                reward += penalty;
                addLog(`Pénalité (entêtement sur niveau bloqué x${this.consecutiveStoryLosses})`, penalty);
            } else if (strategicActions.includes(actionResult.name)) {
                const bonus = 30;
                reward += bonus;
                addLog("Bonus (Stratégie de farm anti-blocage)", bonus);
            }
        }

        if (newState.bestCharacterLevel > oldState.bestCharacterLevel) {
            const levelUpBonus = (newState.bestCharacterLevel - oldState.bestCharacterLevel) * 10;
            reward += levelUpBonus;
            addLog(`Bonus (Niveau perso augmenté x${newState.bestCharacterLevel - oldState.bestCharacterLevel})`, levelUpBonus);
        }

        
        if (newState.totalPower > oldState.totalPower) {
            const r = (newState.totalPower - oldState.totalPower) * 0.02;
            reward += r;
            addLog(`Gain de puissance (+${newState.totalPower - oldState.totalPower})`, r);
        }
        
        addLog("TOTAL FINAL", reward);
        this.logReflection(rewardLog.join('\n'));
        return isNaN(reward) ? -1 : reward;
    }

    async train(state, action, reward, nextState) {
        const targetQTensor = this.model.predict(state);
        const targetQ = await targetQTensor.data();
        let target = reward;
        if (nextState) {
            const nextQTensor = this.model.predict(nextState);
            const realTimeUIStateAfterAction = getVisibleUIContext();
            const futureActions = this.ACTION_MAP[realTimeUIStateAfterAction] || this.ACTION_MAP[UI_STATE_MAIN];
            const nextQ = await nextQTensor.data();
            const maxNextQ = tf.max(nextQ.slice(0, futureActions.length)).dataSync()[0];
            target = reward + this.discountFactor * maxNextQ;
            nextQTensor.dispose();
        }
        targetQ[action] = target;
        const newQ = tf.tensor2d(targetQ, [1, this.maxActionSpaceSize]);
        await this.model.fit(state, newQ, { epochs: 1, verbose: 0 });
        targetQTensor.dispose();
        newQ.dispose();
    }

    async gameLoop() {
        const MAX_STEPS_PER_EPISODE = 50;
        let step = 0;
        this.totalReward = 0;
        let episodeWins = 0, episodeLosses = 0;
        let lastActionNameInEpisode = '-';
        this.currentEpisodeReflectionLogs = [];
        
        let episodeStartPower = ownedCharacters.filter(c => !c.locked).sort((a,b)=>b.power - a.power).slice(0,3).reduce((s,c)=>s+c.power,0);
        let episodeStartState = { gems: gems, totalPower: episodeStartPower };

        while (this.isRunning) {
            const oldUIState = getVisibleUIContext();
            const state = this.getState();
            
            const stateDataBefore = {
                level: level,
                totalPower: ownedCharacters.filter(c => !c.locked).sort((a,b)=>b.power - a.power).slice(0,3).reduce((s,c)=>s+c.power,0),
                legendaryCount: ownedCharacters.filter(c => c.rarity === 'Légendaire').length,
                mythicCount: ownedCharacters.filter(c => c.rarity === 'Mythic').length,
                topTierCount: ownedCharacters.filter(c => c.rarity === 'Secret' || c.rarity === 'Vanguard').length,
                uiState: oldUIState
            };

            const action = await this.chooseAction(state);
            const actionResult = await this.performAction(action);
            
            if (actionResult.name === 'Jouer prochain niveau Histoire') {
                const nextLevel = storyProgress.find(p => p.unlocked && !p.completed && allGameLevels.find(l => l.id === p.id && l.type === 'story'));
                if (actionResult.battleOutcome === 'loss' && nextLevel) {
                    if (this.stuckOnLevelId === nextLevel.id) { this.consecutiveStoryLosses++; } 
                    else { this.stuckOnLevelId = nextLevel.id; this.consecutiveStoryLosses = 1; }
                    this.logReflection(`Échec au niveau ${this.stuckOnLevelId}. Échecs consécutifs : ${this.consecutiveStoryLosses}.`);
                } else if (actionResult.battleOutcome === 'win') {
                    this.consecutiveStoryLosses = 0; this.stuckOnLevelId = null;
                }
            }
            
            if (actionResult.battleOutcome === 'win') episodeWins++;
            if (actionResult.battleOutcome === 'loss') episodeLosses++;
            lastActionNameInEpisode = actionResult.name;

            const nextState = this.getState();
            const stateDataAfter = {
                level: level,
                gems: gems,
                totalPower: ownedCharacters.filter(c => !c.locked).sort((a,b)=>b.power - a.power).slice(0,3).reduce((s,c)=>s+c.power,0),
                legendaryCount: ownedCharacters.filter(c => c.rarity === 'Légendaire').length,
                mythicCount: ownedCharacters.filter(c => c.rarity === 'Mythic').length,
                topTierCount: ownedCharacters.filter(c => c.rarity === 'Secret' || c.rarity === 'Vanguard').length,
                uiState: getVisibleUIContext()
            };
            
            const reward = this.calculateReward(stateDataBefore, stateDataAfter, actionResult);
            this.totalReward += reward;

            this.dashboard.log(`[${oldUIState}] -> Action: ${actionResult.name} | Récompense: ${reward.toFixed(2)}`);
            this.dashboard.updateStatusDisplay(actionResult.name, getVisibleUIContext());

            await this.train(state, action, reward, nextState);
            
            state.dispose();
            nextState.dispose();
            
            step++;
            if (step >= MAX_STEPS_PER_EPISODE) {
                this.episode++;
                const episodeData = {
                    totalReward: this.totalReward,
                    gameStateStart: episodeStartState,
                    gameStateEnd: stateDataAfter,
                    lastActionName: lastActionNameInEpisode,
                    wins: episodeWins,
                    losses: episodeLosses,
                    reflectionLog: this.currentEpisodeReflectionLogs.join('\n')
                };
                this.dashboard.update(this.episode, episodeData);
                if (this.explorationRate > this.minExplorationRate) {
                    this.explorationRate *= this.explorationDecay;
                }
                if (this.episode % 10 === 0) {
                    this.saveModel();
                }
                step = 0;
                this.totalReward = 0;
                episodeWins = 0;
                episodeLosses = 0;
                this.currentEpisodeReflectionLogs = [];
                episodeStartState.gems = gems;
                episodeStartState.totalPower = stateDataAfter.totalPower;
            }
            
            await new Promise(r => setTimeout(r, this.delay));
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.gameLoop();
    }

    stop() {
        if (this.isRunning) {
            this.isRunning = false;
            this.saveModel();
        }
    }
}