// Your Firebase config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_BUCKET.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Game variables
let playerName = "";
let roomId = "";
let playerNumber = 1;
let gameUnsubscribe = null;

// DOM elements
const joinScreen = document.getElementById('join-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const nameInput = document.getElementById('player-name');
const roomInput = document.getElementById('room-code');
const joinBtn = document.getElementById('join-btn');
const roomIdDisplay = document.getElementById('room-id');
const copyBtn = document.getElementById('copy-btn');
const playerHands = document.querySelectorAll('.hand');
const playerNames = [document.getElementById('player1-name'), document.getElementById('player2-name')];
const playerScores = [document.getElementById('player1-score'), document.getElementById('player2-score')];
const gameStatus = document.getElementById('game-status');
const choiceButtons = document.querySelectorAll('.choices button');

// Join game
joinBtn.addEventListener('click', async () => {
    playerName = nameInput.value.trim();
    const inputRoomId = roomInput.value.trim();
    
    if (!playerName) {
        alert("Please enter your name");
        return;
    }

    if (inputRoomId) {
        // Joining existing room
        roomId = inputRoomId;
        await joinExistingRoom();
    } else {
        // Creating new room
        roomId = generateRoomId();
        await createNewRoom();
    }
});

// Copy room ID
copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId);
    copyBtn.textContent = "Copied!";
    setTimeout(() => copyBtn.textContent = "Copy", 2000);
});

// Make a choice
choiceButtons.forEach(button => {
    button.addEventListener('click', () => {
        const choice = button.getAttribute('data-choice');
        updateChoice(choice);
    });
});

function generateRoomId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

async function createNewRoom() {
    // Player 1 creates the room
    playerNumber = 1;
    
    await db.collection("games").doc(roomId).set({
        player1: {
            name: playerName,
            choice: null,
            score: 0
        },
        player2: null,
        status: "waiting",
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Show waiting screen
    joinScreen.classList.remove('active');
    waitingScreen.classList.add('active');
    roomIdDisplay.textContent = roomId;
    
    // Listen for game updates
    setupGameListener();
}

async function joinExistingRoom() {
    const gameRef = db.collection("games").doc(roomId);
    const gameDoc = await gameRef.get();
    
    if (!gameDoc.exists) {
        alert("Room not found");
        return;
    }
    
    const gameData = gameDoc.data();
    
    if (gameData.player2 !== null) {
        alert("Room is full");
        return;
    }

    // Player 2 joins the room
    playerNumber = 2;
    
    await gameRef.update({
        player2: {
            name: playerName,
            choice: null,
            score: 0
        },
        status: "playing",
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Go straight to game screen
    joinScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    // Update player names
    updatePlayerInfo(gameData);
    
    // Listen for game updates
    setupGameListener();
}

function setupGameListener() {
    const gameRef = db.collection("games").doc(roomId);
    
    gameUnsubscribe = gameRef.onSnapshot(doc => {
        const gameData = doc.data();
        updateGameUI(gameData);
    });
}

function updateGameUI(gameData) {
    // Update player info
    updatePlayerInfo(gameData);
    
    // Update choices
    const myChoice = gameData[`player${playerNumber}`].choice;
    const opponentChoice = gameData[`player${playerNumber === 1 ? 2 : 1}`]?.choice;
    
    if (myChoice) {
        playerHands[playerNumber-1].textContent = getHandEmoji(myChoice);
    }
    
    if (opponentChoice) {
        playerHands[playerNumber === 1 ? 1 : 0].textContent = getHandEmoji(opponentChoice);
        gameStatus.textContent = "Waiting for results...";
    } else {
        gameStatus.textContent = gameData.status === "waiting" 
            ? "Waiting for opponent..." 
            : "Make your choice!";
    }
    
    // Show results if game is over
    if (gameData.status === "result") {
        showResult(gameData);
    }
}

function updatePlayerInfo(gameData) {
    playerNames[0].textContent = gameData.player1?.name || "Player 1";
    playerScores[0].textContent = gameData.player1?.score || 0;
    
    if (gameData.player2) {
        playerNames[1].textContent = gameData.player2.name;
        playerScores[1].textContent = gameData.player2.score;
    }
}

function getHandEmoji(choice) {
    const emojis = { rock: "✊", paper: "✋", scissors: "✌️" };
    return emojis[choice] || "✋";
}

async function updateChoice(choice) {
    const gameRef = db.collection("games").doc(roomId);
    
    await gameRef.update({
        [`player${playerNumber}.choice`]: choice,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function showResult(gameData) {
    const me = gameData[`player${playerNumber}`];
    const opponent = gameData[`player${playerNumber === 1 ? 2 : 1}`];
    
    if (gameData.winner === `player${playerNumber}`) {
        gameStatus.textContent = `You win! ${me.choice} beats ${opponent.choice}`;
    } else if (gameData.winner === `player${playerNumber === 1 ? 2 : 1}`) {
        gameStatus.textContent = `You lose! ${opponent.choice} beats ${me.choice}`;
    } else {
        gameStatus.textContent = "It's a tie!";
    }
    
    // Reset after 3 seconds
    setTimeout(() => {
        db.collection("games").doc(roomId).update({
            "player1.choice": null,
            "player2.choice": null,
            status: "playing",
            winner: null,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    }, 3000);
}

// Clean up on page leave
window.addEventListener('beforeunload', () => {
    if (gameUnsubscribe) gameUnsubscribe();
});