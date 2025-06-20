// wallet.js

const quais = require('quais');
const prompt = require('prompt');
const crypto = require('crypto');
const axios = require('axios');

const QUAI_EXPLORER_API_URL = 'https://quaiscan.io/api';
let walletCache = { decryptedPhrase: null, bip39Passphrase: null };

// Funções de lock, getDecryptedSeedPhrase, getBip39Passphrase, checkBalance e listTransactions
// permanecem as mesmas da última versão e estão corretas.
function lockWallet() { walletCache = { decryptedPhrase: null, bip39Passphrase: null }; console.log("\nWallet locked. Password will be required for the next operation."); }
async function getDecryptedSeedPhrase() { if (walletCache.decryptedPhrase) return walletCache.decryptedPhrase; console.log("Your wallet is locked."); prompt.start(); const { decryptionPassword } = await prompt.get({ properties: { decryptionPassword: { description: 'Enter wallet password to unlock', hidden: true, replace: '*', required: true } } }); const { ENCRYPTED_SEED_PHRASE, SALT, IV } = process.env; const key = crypto.pbkdf2Sync(decryptionPassword, Buffer.from(SALT, 'hex'), 200000, 32, 'sha512'); const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(IV, 'hex')); try { let decryptedSeed = decipher.update(ENCRYPTED_SEED_PHRASE, 'hex', 'utf8'); decryptedSeed += decipher.final('utf8'); walletCache.decryptedPhrase = decryptedSeed; console.log("✅ Wallet decrypted successfully."); return decryptedSeed; } catch (e) { throw new Error("Incorrect password or corrupt .env file."); } }
async function getBip39Passphrase() { if (walletCache.bip39Passphrase !== null) { console.log("Using BIP-39 passphrase from current session."); return walletCache.bip39Passphrase; } console.log("\n(Optional) If the operation involves the derived wallet, enter its BIP-39 passphrase."); prompt.start(); const { bip39 } = await prompt.get({ properties: { bip39: { description: 'BIP-39 Passphrase (press Enter for none)', hidden: true, replace: '*' } } }); walletCache.bip39Passphrase = bip39 || ''; return walletCache.bip39Passphrase; }
async function checkBalance() { try { const mainAddress = process.env.MAIN_ADDRESS; const derivedAddress = process.env.DERIVED_ADDRESS; if (!mainAddress || !derivedAddress) { throw new Error("Addresses not found in .env file. Please re-run setup."); } console.log("\nFetching balances... Connecting to Quai Network..."); const provider = new quais.JsonRpcProvider('https://rpc.quai.network'); const [balanceMainWei, balanceDerivedWei] = await Promise.all([ provider.getBalance(mainAddress), provider.getBalance(derivedAddress) ]); const balanceMainQuai = quais.formatUnits(balanceMainWei, 18); const balanceDerivedQuai = quais.formatUnits(balanceDerivedWei, 18); console.log("\n======================================"); console.log("              BALANCE SUMMARY             "); console.log("======================================"); console.log(`Main Wallet`); console.log(`  Address: ${mainAddress}`); console.log(`  Balance: ${balanceMainQuai} QUAI`); console.log("--------------------------------------"); console.log(`Derived Wallet (with BIP-39 passphrase)`); console.log(`  Address: ${derivedAddress}`); console.log(`  Balance: ${balanceDerivedQuai} QUAI`); console.log("======================================"); } catch (error) { if (error.message !== 'canceled') { console.error("\nAn error occurred while checking balance:", error.message); } } }
async function listTransactions() { try { const mainAddress = process.env.MAIN_ADDRESS; const derivedAddress = process.env.DERIVED_ADDRESS; if (!mainAddress || !derivedAddress) { throw new Error("Addresses not found in .env file. Please re-run setup."); } console.log("\nWhich address's received transactions do you want to see?"); console.log(`1. Main Wallet (${mainAddress})`); console.log(`2. Derived Wallet (${derivedAddress})`); prompt.start(); const { choice } = await prompt.get({ properties: { choice: { description: 'Select an option (1 or 2)', pattern: /^[12]$/, required: true } } }); const targetAddress = (choice === '1') ? mainAddress : derivedAddress; const walletName = (choice === '1') ? "Main" : "Derived"; console.log(`\nFetching transactions for the ${walletName} wallet: ${targetAddress}`); console.log("Please wait..."); const apiUrl = `${QUAI_EXPLORER_API_URL}?module=account&action=txlist&address=${targetAddress}&startblock=0&endblock=99999999&sort=asc`; const response = await axios.get(apiUrl); if (response.data.status !== '1') { throw new Error(`Could not fetch history. API Message: ${response.data.message} | ${response.data.result}`); } const allTransactions = response.data.result; const receivedTransactions = allTransactions.filter(tx => tx.to.toLowerCase() === targetAddress.toLowerCase()); console.log("\n--- Received Transaction History ---"); if (receivedTransactions.length === 0) { console.log("No received transactions found for this address."); } else { receivedTransactions.forEach(tx => { const amount = quais.formatUnits(tx.value, 18); const date = new Date(tx.timeStamp * 1000).toLocaleString('en-US'); console.log("-----------------------------------------"); console.log(`   Date: ${date}`); console.log(`   From: ${tx.from}`); console.log(` Amount: +${amount} QUAI`); console.log(`   Hash: ${tx.hash}`); }); console.log("-----------------------------------------"); } } catch (error) { if (error.response && error.response.status === 502) { console.error("\nCould not communicate with the QuaiScan server (Error 502). This is usually a temporary issue on their end. Please try again later."); } else if (error.message !== 'canceled') { console.error("\nAn error occurred while listing transactions:", error.message); } else { console.log("\nOperation canceled by user."); } } }


// --- FUNÇÕES DE ENVIO CORRIGIDAS ---

async function sendFromDerivedWallet() {
    try {
        const phrase = await getDecryptedSeedPhrase();
        if (!phrase) return;
        const bip39Passphrase = await getBip39Passphrase();
        if (!bip39Passphrase) {
            console.log("This function requires a BIP-39 passphrase to define the source wallet.");
            return;
        }
        const provider = new quais.JsonRpcProvider('https://rpc.quai.network', undefined, { usePathing: true });
        const senderMnemonic = quais.Mnemonic.fromPhrase(phrase, bip39Passphrase);
        const senderWallet = quais.QuaiHDWallet.fromMnemonic(senderMnemonic);
        await senderWallet.connect(provider);

        // CORREÇÃO: Obter o endereço diretamente da carteira criada.
        const senderAddress = (await senderWallet.getNextAddress(0, quais.Zone.Cyprus1)).address;
        
        // Agora, 'senderAddress' nunca será nulo aqui.
        const senderBalanceQuai = quais.formatUnits(await provider.getBalance(senderAddress), 18);

        console.log(`\nYour Source Wallet (with BIP-39 Passphrase): ${senderAddress}`);
        console.log(`AVAILABLE BALANCE: ${senderBalanceQuai} QUAI`);
        if (parseFloat(senderBalanceQuai) === 0) { console.log("Insufficient balance."); return; }
        
        prompt.start();
        const { toAddress, amount } = await prompt.get({ properties: { toAddress: { description: 'Enter destination address', required: true }, amount: { description: 'Enter amount to send (e.g., 0.5)', pattern: /^[0-9]+([.,][0-9]+)?$/, required: true } }});
        if (!quais.isAddress(toAddress)) throw new Error("Invalid destination address.");
        const normalizedAmount = amount.replace(',', '.');
        
        const { confirm } = await prompt.get({properties: { confirm: { description: `Confirm sending ${normalizedAmount} QUAI to ${toAddress}? (y/n)`, pattern: /^[ynYN]$/, required: true } }});
        if (confirm.toLowerCase() !== 'y') { console.log("Operation canceled."); return; }
        
        const tx = await senderWallet.sendTransaction({ to: toAddress, value: quais.parseQuai(normalizedAmount) });
        console.log(`\nTransaction sent! Hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block #${receipt.blockNumber}!`);

    } catch (error) {
        if(error.message !== 'canceled') console.error("\nError:", error.message);
    }
}

async function sendToDerivedWallet() {
    try {
        const phrase = await getDecryptedSeedPhrase();
        if (!phrase) return;
        const provider = new quais.JsonRpcProvider('https://rpc.quai.network', undefined, { usePathing: true });
        const senderMnemonic = quais.Mnemonic.fromPhrase(phrase); // Remetente é a carteira principal
        const senderWallet = quais.QuaiHDWallet.fromMnemonic(senderMnemonic);
        await senderWallet.connect(provider);

        // CORREÇÃO: Obter o endereço diretamente da carteira criada.
        const senderAddress = (await senderWallet.getNextAddress(0, quais.Zone.Cyprus1)).address;

        const senderBalanceWei = await provider.getBalance(senderAddress);
        const senderBalanceQuai = quais.formatUnits(senderBalanceWei, 18);
        console.log(`\nYour Source Wallet (Main): ${senderAddress}`);
        console.log(`AVAILABLE BALANCE: ${senderBalanceQuai} QUAI`);
        if (senderBalanceWei === 0n) { console.log("Insufficient balance."); return; }

        prompt.start();
        const { passphrase } = await prompt.get({ properties: { passphrase: { description: 'Enter the DESTINATION wallet\'s passphrase', hidden: true, replace: '*', required: true } } });
        
        // Verifica se a passphrase digitada corresponde à configurada
        const configuredBip39 = await getBip39Passphrase();
        if(passphrase === configuredBip39){
            const toAddress = process.env.DERIVED_ADDRESS; // Pega o endereço de destino do .env, que é seguro
            console.log(`The derived destination address is: ${toAddress}`);
            const { amount } = await prompt.get({ properties: { amount: { description: 'Enter amount to send (e.g., 0.5)', pattern: /^[0-9]+([.,][0-9]+)?$/, required: true } } });
            const normalizedAmount = amount.replace(',', '.');
            if (quais.parseQuai(normalizedAmount) > senderBalanceWei) { throw new Error(`Insufficient balance. You only have ${senderBalanceQuai} QUAI.`); }
            
            const { confirm } = await prompt.get({ properties: { confirm: { description: `Confirm sending ${normalizedAmount} QUAI? (y/n)`, pattern: /^[ynYN]$/, required: true } } });
            if (confirm.toLowerCase() !== 'y') { console.log("Operation canceled."); return; }
            
            const tx = await senderWallet.sendTransaction({ to: toAddress, value: quais.parseQuai(normalizedAmount) });
            console.log(`\nTransaction sent! Hash: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`✅ Transaction confirmed in block #${receipt.blockNumber}!`);
        } else {
            console.log("The entered passphrase does not match the configured derived wallet.");
        }
    } catch (error) {
        if (error.message !== 'canceled') {
            console.error("\nAn error occurred during send:", error.message);
        } else {
            console.log("\nOperation canceled by user.");
        }
    }
}

module.exports = { checkBalance, lockWallet, sendFromDerivedWallet, sendToDerivedWallet, listTransactions };
