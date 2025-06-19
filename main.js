// main.js

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// --- CORRECTED INITIALIZATION LOGIC ---

// Define the path to the data folder and the .env file
const dataDir = path.join(process.cwd(), 'data');
const envPath = path.join(dataDir, '.env');

// Ensures the data directory exists on the host (for the volume to work)
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Load the .env IMMEDIATELY if it already exists.
// We specify the path to ensure it reads from the correct location.
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// NOW that the .env (if it exists) has been loaded, WE REQUIRE the other modules.
// This ensures they are initialized with the correct environment variables.
const setup = require('./setup');
const wallet = require('./wallet');
const readline = require('readline');


// --- UI Functions ---
function clearScreen() { console.clear(); }

async function pressEnterToContinue() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question('\nPress Enter to return to the menu...', () => {
            rl.close();
            resolve();
        });
    });
}

// --- Main Menu ---
async function showMainMenu() {
    while (true) {
        clearScreen();

        const coloredAsciiLogo = `\x1b[31m
              ████████
          ██████    ██████
        ████          ██████
      ████              ████
     ████                ████
     ████                ████
      ████              ████
       ████          ████████
         ██████    ██████  ██
              ████████      ██\x1b[0m`;

        console.log(coloredAsciiLogo);
        console.log("\n             QUAI NETWORK");

        console.log("\n--- Main Wallet Menu ---");
        console.log("1. Check Balance");
        console.log("2. Send (FROM Derived Wallet with BIP-39 Passphrase)");
        console.log("3. Send (TO Derived Wallet with BIP-39 Passphrase)");
        console.log("4. List Received Transactions");
        console.log("5. Lock Wallet (Forget Password)");
        console.log("6. Exit");

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const choice = await new Promise(resolve => {
            rl.question('Select an option: ', answer => {
                rl.close();
                resolve(answer.trim());
            });
        });

        clearScreen();

        switch (choice) {
            case '1': await wallet.checkBalance(); await pressEnterToContinue(); break;
            case '2': await wallet.sendFromDerivedWallet(); await pressEnterToContinue(); break;
            case '3': await wallet.sendToDerivedWallet(); await pressEnterToContinue(); break;
            case '4': await wallet.listTransactions(); await pressEnterToContinue(); break;
            case '5': wallet.lockWallet(); await pressEnterToContinue(); break;
            case '6': console.log("Goodbye!"); return;
            default: console.log("Invalid option. Please try again."); await pressEnterToContinue(); break;
        }
    }
}


// --- Application Start Logic ---
async function start() {
    // The .env check was already performed at the top of the file.
    if (!fs.existsSync(envPath)) {
        clearScreen();
        console.log("Welcome! It looks like this is your first time running the wallet.");
        console.log("Let's begin with the secure setup.");
        try {
            await setup.runSetup(); // Creates the .env file inside the /data folder

            // Reload the environment so the current session is aware of the new variables
            const newEnv = dotenv.parse(fs.readFileSync(envPath));
            for (const key in newEnv) {
                process.env[key] = newEnv[key];
            }

            await pressEnterToContinue();
            await showMainMenu();
        } catch (error) {
            console.error("\nAn error occurred during setup:", error.message);
        }
    } else {
        // If the file already existed, the variables have been loaded. Go straight to the menu.
        await showMainMenu();
    }
}

// Start the application
start();
