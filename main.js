// main.js

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// --- LÓGICA DE INICIALIZAÇÃO CORRIGIDA ---

const dataDir = path.join(process.cwd(), 'data');
const envPath = path.join(dataDir, '.env');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Carrega o .env IMEDIATAMENTE se ele já existir.
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// AGORA que o .env (se existir) foi carregado, REQUEREMOS os outros módulos.
const setup = require('./setup');
const wallet = require('./wallet');
const readline = require('readline');


// --- Funções da UI ---
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

// --- Menu Principal ---
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
        console.log("2. Send (Wallet with Passphrase)");
        console.log("3. Send (Normal Wallet)");
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


// --- Lógica de Início da Aplicação ---
async function start() {
    if (!fs.existsSync(envPath)) {
        clearScreen();
        console.log("Welcome! It looks like this is your first time running the wallet.");
        console.log("Let's begin with the secure setup.");
        try {
            await setup.runSetup(); // Cria o .env na pasta /data

            // Recarrega o ambiente para que a sessão atual reconheça as novas variáveis
            const newEnv = dotenv.parse(fs.readFileSync(envPath));
            for (const key in newEnv) {
                process.env[key] = newEnv[key];
            }

            console.log("\nSetup complete! Press Enter to proceed to the main menu.");
            await pressEnterToContinue();
            await showMainMenu();
        } catch (error) {
            console.error("\nAn error occurred during setup:", error.message);
        }
    } else {
        await showMainMenu();
    }
}

// Inicia a aplicação
start();
