const socket = io(); // Connect to the server that served this page

socket.on('connect', () => {
    console.log('Connected to server! My socket ID is', socket.id);
});

socket.on('gameStateUpdate', (gameState) => {
    // We will fill this in later. For now, let's just log it.
    console.log("Received a game state update from the server:", gameState);
    
    // This is where we will eventually call renderDice(), updateScores(), etc.
    // based on the data we get from the server.
});

document.addEventListener('DOMContentLoaded', () => {
    // --- Game Constants ---
    const WINNING_SCORE = 10000;
    const MIN_SCORE_TO_GET_ON_BOARD = 500;
    const DICE_COUNT = 6;

    // --- DOM Elements ---
    const dom = {
        diceContainer: document.getElementById('dice-container'),
        turnScore: document.getElementById('turn-score'),
        startGameBtn: document.getElementById('start-game-btn'),
        rollBtn: document.getElementById('roll-btn'),
        bankBtn: document.getElementById('bank-btn'),
        continueBtn: document.getElementById('continue-btn'),
        gameLog: document.getElementById('game-log'),
        loadingIndicator: document.getElementById('loading-indicator'),
        gameOverScreen: document.getElementById('game-over-screen'),
        winnerMessage: document.getElementById('winner-message'),
        restartBtn: document.getElementById('restart-btn'),
        playerScoreCards: [
            document.getElementById('player-0-score-card'),
            document.getElementById('player-1-score-card')
        ],
        playerScores: [
            document.getElementById('player-0-score'),
            document.getElementById('player-1-score')
        ],
        playerOnBoardStatus: [
            document.getElementById('player-0-on-board'),
            document.getElementById('player-1-on-board')
        ]
    };

    // --- Game State ---
    let players = [];
    let dice = [];
    let currentPlayerIndex = 0;
    let turnScore = 0;
    let isPlayerTurn = true;
    let gameState = 'NotStarted'; // NotStarted, PlayerTurn, AITurn, Finished

    // --- Game Logic Functions ---

    /**
     * Calculates the score of a given set of dice values.
     * @param {number[]} diceValues - An array of numbers representing dice rolls.
     * @returns {{score: number, usedDice: number[]}} - The calculated score and the dice that were used.
     */
    function calculateScore(diceValues) {
        let score = 0;
        const counts = [0, 0, 0, 0, 0, 0, 0];
        diceValues.forEach(val => counts[val]++);
        let usedDice = [];
        let remainingValues = [...diceValues];

        remainingValues.sort((a,b) => a - b);

        // Special combinations on a full roll of 6 dice
        if (diceValues.length === 6) {
            // Straights
            if (remainingValues.join(',') === '1,2,3,4,5,6') {
                return { score: 1500, usedDice: diceValues };
            }
            // Three Pairs
            if (counts.filter(c => c === 2).length === 3) {
                return { score: 1500, usedDice: diceValues };
            }
             // 4 of a kind + a pair
            const fourOfaKindValue = counts.indexOf(4);
            const pairValue = counts.indexOf(2);
            if (fourOfaKindValue !== -1 && pairValue !== -1) {
                 return { score: 1500, usedDice: diceValues };
            }
             // Two triplets
            if (counts.filter(c => c === 3).length === 2) {
                 return { score: 2500, usedDice: diceValues };
            }
        }


        // Three or more of a kind
        for (let i = 1; i <= 6; i++) {
            if (counts[i] >= 3) {
                let baseScore = (i === 1) ? 1000 : i * 100;
                score += baseScore * (1 << (counts[i] - 3));
                for (let j = 0; j < counts[i]; j++) {
                     usedDice.push(i);
                     const indexToRemove = remainingValues.indexOf(i);
                     if (indexToRemove > -1) remainingValues.splice(indexToRemove, 1);
                }
            }
        }
        
        // Singles (1s and 5s) from remaining dice
        let diceLeft = [...remainingValues];
        diceLeft.forEach(val => {
            if (val === 1) {
                score += 100;
                usedDice.push(1);
            } else if (val === 5) {
                score += 50;
                usedDice.push(5);
            }
        });

        return { score, usedDice: usedDice.sort((a, b) => a - b) };
    }

    /**
     * [BUG FIX 2] Determines which dice values from a roll are part of any scoring combination.
     * @param {number[]} diceValues - An array of numbers representing dice rolls.
     * @returns {Set<number>} - A set of numbers (1-6) that are scoring.
     */
    function getScoringValues(diceValues) {
        const scoringDieValues = new Set();
        const counts = [0,0,0,0,0,0,0];
        diceValues.forEach(v => counts[v]++);

        // Check for special cases only on a full 6-dice roll
        if (diceValues.length === 6) {
            const isStraight = new Set(diceValues).size === 6;
            const isThreePairs = counts.filter(c => c === 2).length === 3;
            const isFourAndPair = counts.includes(4) && counts.includes(2);
            const isTwoTriplets = counts.filter(c => c === 3).length === 2;

            if (isStraight || isThreePairs || isFourAndPair || isTwoTriplets) {
                diceValues.forEach(v => scoringDieValues.add(v));
                return scoringDieValues; // All dice are scoring
            }
        }

        // Check for sets of 3 or more
        for (let i = 1; i <= 6; i++) {
            if (counts[i] >= 3) {
                scoringDieValues.add(i);
            }
        }

        // Check for individual 1s and 5s
        if (counts[1] > 0) scoringDieValues.add(1);
        if (counts[5] > 0) scoringDieValues.add(5);

        // Final check: if the entire roll is scoring (e.g., three 1s and three 5s), mark all dice.
        const allDiceScoreCheck = calculateScore(diceValues);
        if (allDiceScoreCheck.usedDice.length === diceValues.length) {
             diceValues.forEach(v => scoringDieValues.add(v));
        }

        return scoringDieValues;
    }


    // --- UI Update Functions ---

    function renderDice() {
        dom.diceContainer.innerHTML = '';
        dice.forEach(die => {
            const dieEl = document.createElement('div');
            dieEl.className = 'die';
            dieEl.textContent = die.value;
            dieEl.dataset.id = die.id;

            if (die.isLocked) dieEl.classList.add('locked');
            if (die.isScoring) dieEl.classList.add('scoring');
            if (die.isSelected) dieEl.classList.add('selected');
            
            if (die.isScoring && !die.isLocked && isPlayerTurn) {
                dieEl.addEventListener('click', () => handleDieClick(die.id));
            }
            dom.diceContainer.appendChild(dieEl);
        });
    }

    function updateScores() {
        players.forEach((player, i) => {
            dom.playerScores[i].textContent = player.score;
            if (player.isOnBoard) {
                dom.playerOnBoardStatus[i].textContent = 'Tithe Paid';
                dom.playerOnBoardStatus[i].classList.add('on');
            } else {
                dom.playerOnBoardStatus[i].textContent = 'Awaiting First Tithe';
                dom.playerOnBoardStatus[i].classList.remove('on');
            }
        });
        dom.turnScore.textContent = turnScore;
    }
    
    function updateActivePlayerUI() {
        players.forEach((_, i) => {
            dom.playerScoreCards[i].classList.remove('active-player');
        });
        dom.playerScoreCards[currentPlayerIndex].classList.add('active-player');
    }

    function addToLog(text, source = 'game') {
        const li = document.createElement('li');
        const timestamp = new Date().toLocaleTimeString();
        li.innerHTML = `<span>[${timestamp}]</span> ${text}`;
        
        if (source === 'ai') {
            li.className = 'source-ai';
        } else if (text.includes('HERESY')) {
             li.className = 'source-game-heresy';
        } else if (text.includes('secures') || text.includes('glory')) {
             li.className = 'source-game-glory';
        }

        dom.gameLog.prepend(li);
    }

    function updateControls() {
        const isAITurn = players[currentPlayerIndex].id === 1;
        const hasSelectedDice = dice.some(d => d.isSelected);

        dom.startGameBtn.style.display = gameState === 'NotStarted' ? 'block' : 'none';
        
        const showPlayerControls = gameState === 'PlayerTurn' && !isAITurn;
        dom.rollBtn.style.display = showPlayerControls ? 'block' : 'none';
        dom.bankBtn.style.display = showPlayerControls ? 'block' : 'none';
        dom.continueBtn.style.display = showPlayerControls ? 'block' : 'none';
        
        if (showPlayerControls) {
            const canRoll = !dice.every(d => d.isLocked || d.isSelected);
            dom.rollBtn.disabled = hasSelectedDice || !canRoll;
            dom.bankBtn.disabled = !hasSelectedDice || turnScore === 0;
            dom.continueBtn.disabled = !hasSelectedDice;
        }
    }


    // --- Game Flow Functions ---
    
    function initializeGame() {
        players = [
            { id: 0, name: 'Player Commander', score: 0, isOnBoard: false },
            { id: 1, name: 'AI Heretek', score: 0, isOnBoard: false },
        ];
        currentPlayerIndex = 0;
        turnScore = 0;
        gameState = 'NotStarted';
        dom.gameLog.innerHTML = '';
        resetDiceState();
        updateAllUI();
        addToLog("A new crusade for glory awaits.");
        dom.gameOverScreen.style.display = 'none';
    }

    function startGame() {
        socket.emit('startGame'); // Just tell the server we want to start
    }

    
    function resetDiceState(fullReset = true) {
        if (fullReset) {
            dice = Array.from({ length: DICE_COUNT }, (_, i) => ({ id: i, value: 1, isSelected: false, isLocked: false, isScoring: false }));
        } else {
             dice.forEach(d => {
                 d.isSelected = false;
                 d.isScoring = false;
             });
        }
    }

    function handleRoll() {
        isPlayerTurn = players[currentPlayerIndex].id === 0;
        if (!isPlayerTurn) { 
             updateAllUI();
             return;
        }

        const diceToRollCount = dice.filter(d => !d.isLocked).length;
        if (diceToRollCount === 0) {
            addToLog("Hot Dice! The Emperor provides! Roll all dice again.");
            resetDiceState();
        }

        let rollInterval = setInterval(() => {
            dice.forEach(d => {
                if (!d.isLocked) d.value = Math.floor(Math.random() * 6) + 1;
            });
            renderDice();
        }, 50);

        setTimeout(() => {
            clearInterval(rollInterval);
            
            const rolledValues = dice.filter(d => !d.isLocked).map(d => d.value);
            const scoringValues = getScoringValues(rolledValues);

            if (scoringValues.size === 0) {
                addToLog(`You rolled: ${rolledValues.join(', ')}... A Farkle! That's HERESY!`);
                renderDice(); 
                setTimeout(() => endTurn('Heresy'), 1500);
            } else {
                 dice.forEach(d => {
                    if (!d.isLocked && scoringValues.has(d.value)) {
                        d.isScoring = true;
                    }
                 });
            }
            updateAllUI();
        }, 1000);
    }
    
    function handleDieClick(id) {
        const die = dice.find(d => d.id === id);
        if (!die || !die.isScoring || !isPlayerTurn) return;

        die.isSelected = !die.isSelected;
        updateAllUI();
    }
    
    function handleBankOrContinue(action) {
        const selectedDice = dice.filter(d => d.isSelected && !d.isLocked);
        if (selectedDice.length === 0) {
            addToLog("Must select scoring dice first.");
            return;
        }

        const selectedValues = selectedDice.map(d => d.value);
        const { score, usedDice } = calculateScore(selectedValues);

        if (score === 0 || usedDice.length < selectedValues.length) {
            addToLog("Invalid selection. Choose a valid scoring combination.");
            return;
        }
        
        turnScore += score;

        selectedDice.forEach(die => {
            die.isLocked = true;
            die.isSelected = false;
        });

        if (action === 'Bank') {
            endTurn('Bank');
        } else {
            resetDiceState(false);
            updateAllUI(); 
            setTimeout(handleRoll, 200);
        }
    }
    
    async function endTurn(outcome) {
        const currentPlayer = players[currentPlayerIndex];
        let finalTurnScore = 0;
        
        dom.loadingIndicator.style.display = 'block';

        if (outcome === 'Bank') {
            finalTurnScore = turnScore;

            if (!currentPlayer.isOnBoard && finalTurnScore < MIN_SCORE_TO_GET_ON_BOARD) {
                addToLog(`${currentPlayer.name} failed to meet the minimum glory of ${MIN_SCORE_TO_GET_ON_BOARD}. Their tithe is rejected.`);
                finalTurnScore = 0;
            } else {
                currentPlayer.score += finalTurnScore;
                currentPlayer.isOnBoard = true;
                addToLog(`${currentPlayer.name} secures ${finalTurnScore} glory! New total: ${currentPlayer.score}.`);

                if (currentPlayer.score >= WINNING_SCORE) {
                    dom.loadingIndicator.style.display = 'none';
                    showGameOver(currentPlayer);
                    return;
                }
            }
        } else {
             addToLog(`${currentPlayer.name} has committed HERESY! All glory lost for this turn.`);
        }
        
        const report = await getActionReport(finalTurnScore, outcome);
        addToLog(report, 'ai');
        dom.loadingIndicator.style.display = 'none';

        turnScore = 0;
        resetDiceState();
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        updateAllUI();

        if (players[currentPlayerIndex].id === 1) {
            gameState = 'AITurn';
            updateControls();
            setTimeout(aiTurn, 1500);
        }
    }
    
    function showGameOver(winner) {
        gameState = 'Finished';
        dom.winnerMessage.textContent = `${winner.name} has achieved ULTIMATE VICTORY!`;
        dom.gameOverScreen.style.display = 'flex';
        updateControls();
    }
    
    async function aiTurn() {
        const aiPlayer = players[1];
        addToLog(`--- ${aiPlayer.name}'s Turn ---`);
        
        let currentTurnScore = 0;
        let diceInPlay = DICE_COUNT;
        
        while(true) {
            await new Promise(res => setTimeout(res, 2000));

            const rolledValues = Array.from({length: diceInPlay}, () => Math.floor(Math.random() * 6) + 1);
            addToLog(`${aiPlayer.name} rolls... ${rolledValues.join(', ')}`);

            const { score, usedDice } = calculateScore(rolledValues);

            if (score === 0) {
                addToLog(`AI has committed HERESY!`);
                turnScore = 0;
                await endTurn('Heresy');
                break;
            }

            currentTurnScore += score;
            addToLog(`${aiPlayer.name} scores ${score} glory. Turn total: ${currentTurnScore}.`);

            diceInPlay -= usedDice.length;
            if (diceInPlay === 0) {
                diceInPlay = DICE_COUNT;
                addToLog("AI has Hot Dice! Rolling again!");
            }

            const shouldBank = 
                (!aiPlayer.isOnBoard && currentTurnScore >= MIN_SCORE_TO_GET_ON_BOARD) ||
                (aiPlayer.isOnBoard && currentTurnScore >= 400 && diceInPlay <= 3) ||
                (currentTurnScore + aiPlayer.score >= WINNING_SCORE);

            if (shouldBank) {
                addToLog(`${aiPlayer.name} decides to bank its glory.`);
                turnScore = currentTurnScore;
                await endTurn('Bank');
                break;
            } else {
                 addToLog(`${aiPlayer.name} presses the attack!`);
            }
        }
         gameState = 'PlayerTurn';
         updateAllUI();
    }
    
    function getActionReport(score, outcome) {
        return new Promise(resolve => {
            setTimeout(() => {
                let report;
                if (outcome === 'Heresy') {
                    const heresyReports = [
                        "A catastrophic failure of machine spirit. The Omnissiah is displeased.",
                        "Such weakness invites corruption. A disappointing display.",
                        "This unit's logic is flawed. Recalibration is required.",
                    ];
                    report = heresyReports[Math.floor(Math.random() * heresyReports.length)];
                } else {
                     if (score === 0) {
                         report = "The tithe was insufficient. The Imperium demands more.";
                     } else if (score < 500) {
                         report = `Data confirmed: ${score} points secured. A minor but acceptable gain.`;
                     } else if (score < 1000) {
                         report = `Tactical analysis: ${score} points represents a significant victory. Well executed.`;
                     } else {
                         report = `Glorious! A magnificent tithe of ${score} points! The Emperor's light shines upon this day!`;
                     }
                }
                resolve(report);
            }, 1200);
        });
    }

    function updateAllUI() {
        renderDice();
        updateScores();
        updateControls();
        updateActivePlayerUI();
    }

    // --- Event Listeners ---
    dom.startGameBtn.addEventListener('click', startGame);
    dom.restartBtn.addEventListener('click', initializeGame);
    dom.rollBtn.addEventListener('click', handleRoll);
    dom.bankBtn.addEventListener('click', () => handleBankOrContinue('Bank'));
    dom.continueBtn.addEventListener('click', () => handleBankOrContinue('Continue'));

    // --- Initial Setup ---
    initializeGame();
});