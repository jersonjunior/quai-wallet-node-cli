// setup.js

const crypto = require('crypto');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const quais = require('quais');

// Função para fazer perguntas no terminal (sem alterações)
async function askQuestion(query, options = {}) {
    const { hidden = false } = options;
    return new Promise(resolve => {
        if (hidden) {
            let answer = '';
            process.stdout.write(query);
            const onKeypress = (char, key) => {
                if ((key && key.name === 'enter') || char === '\r' || char === '\n') {
                    process.stdin.removeListener('keypress', onKeypress);
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    process.stdout.write('\n');
                    resolve(answer);
                } else if (key && key.ctrl && key.name === 'c') {
                    process.stdin.setRawMode(false); process.stdin.pause(); process.exit();
                } else if (key && key.name === 'backspace') {
                    if (answer.length > 0) {
                        answer = answer.slice(0, -1);
                        process.stdout.clearLine(0); process.stdout.cursorTo(0);
                        process.stdout.write(query + '*'.repeat(answer.length));
                    }
                } else if (char && !key.ctrl && !key.meta) {
                    answer += char;
                    process.stdout.write('*');
                }
            };
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('keypress', onKeypress);
        } else {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question(query, answer => { rl.close(); resolve(answer.trim()); });
        }
    });
}

// Função principal do setup
async function runSetup() {
    let seedPhrase = '';

    // --- NOVO MENU INICIAL: CRIAR OU RESTAURAR ---
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
    console.log("\n--- Initial Wallet Setup ---");

    console.log("\nWelcome! Would you like to create a new wallet or restore an existing one?");
    console.log("1. Create a new wallet.");
    console.log("2. Restore from an existing seed phrase.");
    
    let initialChoice = '';
    while (initialChoice !== '1' && initialChoice !== '2') {
        initialChoice = await askQuestion('Enter your choice (1 or 2): ');
    }

    // --- LÓGICA DE CRIAÇÃO DE CARTEIRA (NOVO) ---
    if (initialChoice === '1') {
        clearScreen();
        console.log("\n--- Create New Wallet ---");
        let wordCount = 0;
        while (wordCount !== 12 && wordCount !== 24) {
            const countStr = await askQuestion('Do you want a 12 or 24-word seed phrase? ');
            wordCount = parseInt(countStr, 10);
        }

        console.log("\nGenerating your new seed phrase, please wait...");
        const entropyBytes = wordCount === 12 ? 16 : 32; // 12 words = 128 bits = 16 bytes; 24 words = 256 bits = 32 bytes
        const entropy = crypto.randomBytes(entropyBytes);
        const mnemonic = quais.Mnemonic.fromEntropy(entropy);
        seedPhrase = mnemonic.phrase;

        clearScreen();
        console.log("\x1b[31m\n!!! IMPORTANT - WRITE THIS DOWN !!!\x1b[0m");
        console.log("This is your new seed phrase. It is the ONLY way to recover your wallet.");
        console.log("Store it securely offline. Do not share it with anyone.");
        console.log("\n====================================================================");
        console.log(`   ${seedPhrase}`);
        console.log("====================================================================");
        await askQuestion('\nPress Enter after you have securely written down your seed phrase. ');
        clearScreen();
    } 
    // --- LÓGICA DE RESTAURAÇÃO DE CARTEIRA (LÓGICA ANTIGA MOVIDA PARA CÁ) ---
    else {
        let choice = '';
        while (choice !== '1' && choice !== '2') {
            clearScreen();
            console.log("\n--- Restore Existing Wallet ---");
            console.log("\nHow would you like to enter your seed phrase?");
            console.log("1. Paste the full phrase.");
            console.log("2. Type word by word.");
            choice = await askQuestion('Enter your choice (1 or 2): ');
        }
        if (choice === '1') {
            seedPhrase = await askQuestion('Paste your seed phrase and press Enter: ', { hidden: true });
        } else {
            let wordCount = 0;
            while (wordCount !== 12 && wordCount !== 24) {
                const countStr = await askQuestion('Does your seed phrase have 12 or 24 words? ');
                wordCount = parseInt(countStr, 10);
            }
            const words = [];
            console.log(`\nPlease enter your ${wordCount} words.`);
            for (let i = 0; i < wordCount; i++) {
                const word = await askQuestion(`Word ${i + 1}: `, { hidden: true });
                words.push(word.trim());
            }
            seedPhrase = words.join(' ');
        }
    }

    if (!seedPhrase || seedPhrase.split(' ').length < 11) {
        throw new Error("Seed phrase appears to be incomplete or empty. Aborting.");
    }
    console.log("Seed phrase received and ready.");

    // --- FLUXO COMUM (A PARTIR DAQUI, NADA MUDA) ---

    // Derivar e salvar os endereços públicos
    console.log("\nNow, let's set up your derived wallet (with BIP-39 passphrase).");
    const bip39Passphrase = await askQuestion('Enter the BIP-39 passphrase you want to associate with this wallet (optional, but recommended): ', { hidden: true });
    
    // NOTA: A lógica original lançava um erro se a passphrase estivesse vazia. 
    // Alterei para permitir que seja opcional, o que é mais comum. Se quiser forçar, descomente as linhas abaixo.
    /*
    if (!bip39Passphrase) {
        throw new Error("The BIP-39 passphrase cannot be empty for setup.");
    }
    */

    const mainMnemonic = quais.Mnemonic.fromPhrase(seedPhrase);
    const mainWallet = quais.QuaiHDWallet.fromMnemonic(mainMnemonic);
    const mainAddress = (await mainWallet.getNextAddress(0, quais.Zone.Cyprus1)).address;

    const derivedMnemonic = quais.Mnemonic.fromPhrase(seedPhrase, bip39Passphrase);
    const derivedWallet = quais.QuaiHDWallet.fromMnemonic(derivedMnemonic);
    const derivedAddress = (await derivedWallet.getNextAddress(0, quais.Zone.Cyprus1)).address;

    console.log("\nConfigured Addresses:");
    console.log(`- Main Address: ${mainAddress}`);
    console.log(`- Derived Address (with passphrase): ${derivedAddress}`);

    // Criptografar a seed phrase
    const password = await askQuestion('\nCreate a strong password to encrypt your wallet: ', { hidden: true });
    if (!password) { throw new Error("The encryption password cannot be empty."); }

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 200000, 32, 'sha512');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encryptedSeed = cipher.update(seedPhrase, 'utf8', 'hex');
    encryptedSeed += cipher.final('hex');
    console.log("\n✅ Wallet encrypted!");

    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }
    const envPath = path.join(dataDir, '.env');

    const envContent = [
        `ENCRYPTED_SEED_PHRASE=${encryptedSeed}`,
        `SALT=${salt.toString('hex')}`,
        `IV=${iv.toString('hex')}`,
        `# Public (non-sensitive) addresses`,
        `MAIN_ADDRESS=${mainAddress}`,
        `DERIVED_ADDRESS=${derivedAddress}`
    ].join('\n');

    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Wallet securely saved to: ${envPath}`);
}

function clearScreen() { console.clear(); }

module.exports = { runSetup };
