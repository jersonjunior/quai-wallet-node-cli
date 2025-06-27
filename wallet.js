// wallet.js

const quais = require('quais');
const crypto = require('crypto');
const axios = require('axios');

const QUAI_EXPLORER_API_URL = 'https://quaiscan.io/api';
let walletCache = { decryptedPhrase: null, bip39Passphrase: null };

function lockWallet({ chalk, strings }) {
    walletCache = { decryptedPhrase: null, bip39Passphrase: null };
    console.log(chalk.yellow.bold(`\n${strings.walletLocked}`));
}

async function getDecryptedSeedPhrase({ inquirer, chalk, ora, strings }) {
    if (walletCache.decryptedPhrase) return walletCache.decryptedPhrase;
    console.log(chalk.yellow(strings.walletIsLocked));
    const { decryptionPassword } = await inquirer.prompt([{ type: 'password', name: 'decryptionPassword', message: strings.unlockPrompt }]);
    
    const spinner = ora(strings.decryptingWallet).start();
    const { ENCRYPTED_SEED_PHRASE, SALT, IV } = process.env;
    const key = crypto.pbkdf2Sync(decryptionPassword, Buffer.from(SALT, 'hex'), 200000, 32, 'sha512');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(IV, 'hex'));
    
    try {
        let decryptedSeed = decipher.update(ENCRYPTED_SEED_PHRASE, 'hex', 'utf8');
        decryptedSeed += decipher.final('utf8');
        walletCache.decryptedPhrase = decryptedSeed;
        spinner.succeed(chalk.green(strings.decryptionSuccess));
        return decryptedSeed;
    } catch (e) {
        spinner.fail(chalk.red(strings.decryptionFailed));
        throw new Error(strings.incorrectPassword);
    }
}

async function getBip39Passphrase({ inquirer, chalk, strings }) {
    if (walletCache.bip39Passphrase !== null) {
        console.log(chalk.blue(strings.usingBip39FromSession));
        return walletCache.bip39Passphrase;
    }
    const { bip39 } = await inquirer.prompt([{ type: 'password', name: 'bip39', message: strings.enterBip39 }]);
    walletCache.bip39Passphrase = bip39 || '';
    return walletCache.bip39Passphrase;
}

async function checkBalance({ ora, chalk, boxen, strings }) {
    const spinner = ora(strings.fetchingBalances).start();
    try {
        const mainAddress = process.env.MAIN_ADDRESS;
        const derivedAddress = process.env.DERIVED_ADDRESS;
        if (!mainAddress || !derivedAddress) {
            throw new Error("Addresses not found in .env file. Please re-run setup.");
        }

        const provider = new quais.JsonRpcProvider('https://rpc.quai.network');
        const [balanceMainWei, balanceDerivedWei] = await Promise.all([
            provider.getBalance(mainAddress),
            provider.getBalance(derivedAddress)
        ]);
        const balanceMainQuai = quais.formatUnits(balanceMainWei, 18);
        const balanceDerivedQuai = quais.formatUnits(balanceDerivedWei, 18);
        spinner.succeed(strings.balancesFetched);

        const balanceBox = boxen(
            `${chalk.bold(strings.mainWallet)}\n  ${chalk.dim(strings.address)} ${mainAddress}\n  ${chalk.dim(strings.balance)} ${chalk.green(balanceMainQuai + ' QUAI')}\n\n` +
            `${chalk.bold(strings.derivedWalletWithBip39)}\n  ${chalk.dim(strings.address)} ${derivedAddress}\n  ${chalk.dim(strings.balance)} ${chalk.green(balanceDerivedQuai + ' QUAI')}`,
            {
                title: strings.balanceSummary,
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'cyan'
            }
        );
        console.log(balanceBox);

    } catch (error) {
        spinner.fail(chalk.red(strings.failedToFetchBalances));
        console.error(chalk.red(`\n${strings.errorCheckingBalance}`), error.message);
    }
}

async function listTransactions(modules, transactionType) {
    const { inquirer, ora, chalk, boxen, strings } = modules;
    let spinner; 
    try {
        const mainAddress = process.env.MAIN_ADDRESS;
        const derivedAddress = process.env.DERIVED_ADDRESS;
        if (!mainAddress || !derivedAddress) { throw new Error("Addresses not found in .env file."); }

        const { choice } = await inquirer.prompt([{
            type: 'list',
            name: 'choice',
            message: strings.whichAddress,
            choices: [
                { name: `${strings.mainWallet} (${mainAddress})`, value: '1' },
                // CORREÇÃO 1: Usando a chave correta 'derivedWalletWithBip39'
                { name: `${strings.derivedWalletWithBip39} (${derivedAddress})`, value: '2' },
            ],
            loop: false
        }]);

        const targetAddress = (choice === '1') ? mainAddress : derivedAddress;
        // CORREÇÃO 2: Usando a chave correta aqui também
        const walletName = (choice === '1') ? strings.mainWallet : strings.derivedWalletWithBip39;
        const lowerCaseTargetAddress = targetAddress.toLowerCase();

        spinner = ora(strings.fetchingTransactions.replace('{walletName}', walletName)).start();
        const apiUrl = `${QUAI_EXPLORER_API_URL}?module=account&action=txlist&address=${targetAddress}&startblock=0&endblock=99999999&sort=asc`;
        const response = await axios.get(apiUrl);

        if (response.data.status === '0' && response.data.message.includes('No transactions found')) {
            spinner.succeed(chalk.yellow(strings.noTransactionsFound));
            return;
        }

        if (response.data.status !== '1') {
            throw new Error(`${strings.apiError} ${response.data.message} | ${response.data.result}`);
        }
        
        spinner.succeed(strings.historyFetched);
        const allTransactions = response.data.result;
        
        let filteredTransactions;
        let title;

        if (transactionType === 'received') {
            title = strings.receivedHistory;
            filteredTransactions = allTransactions.filter(tx => tx.to.toLowerCase() === lowerCaseTargetAddress);
        } else { // transactionType === 'sent'
            title = strings.sentHistory;
            filteredTransactions = allTransactions.filter(tx => tx.from.toLowerCase() === lowerCaseTargetAddress);
        }
        
        console.log(chalk.bold.cyan(`\n${title}`));

        if (filteredTransactions.length === 0) {
            const typeString = transactionType === 'received' ? strings.typeReceived : strings.typeSent;
            console.log(chalk.yellow(strings.noTransactionsOfType.replace('{type}', typeString)));
        } else {
            filteredTransactions.forEach(tx => {
                const value = quais.formatUnits(tx.value, 18);
                const date = new Date(tx.timeStamp * 1000).toLocaleString(strings.goodbye === 'Até mais!' ? 'pt-BR' : 'en-US');
                
                let amountDisplay;
                let fromToDisplay;

                if (transactionType === 'received') {
                    amountDisplay = chalk.green(`+ ${value} QUAI`);
                    fromToDisplay = `${chalk.bold(strings.from)} ${tx.from}`;
                } else {
                    amountDisplay = chalk.red(`- ${value} QUAI`);
                    fromToDisplay = `${chalk.bold(strings.to)} ${tx.to}`;
                }

                const txBox = boxen(
                    `${chalk.bold(strings.date)} ${date}\n` +
                    `${fromToDisplay}\n` +
                    `${chalk.bold(strings.value)} ${amountDisplay}`,
                    { 
                        padding: 1, 
                        margin: { top: 1 }, 
                        borderStyle: 'round',
                        title: `${strings.hash} ${tx.hash}`
                    }
                );
                console.log(txBox);
            });
        }

    } catch (error) {
        if (spinner) {
            spinner.fail(chalk.red(strings.failedToFetchTx));
        }

        if (error.response && error.response.status === 502) {
            console.error(chalk.red(`\n${strings.quaiscanError}`));
        } else {
            console.error(chalk.red(`\n${strings.errorListingTx}`), error.message);
        }
    }
}

async function sendFromDerivedWallet(modules) {
    const { inquirer, chalk, ora, strings } = modules;
    try {
        const phrase = await getDecryptedSeedPhrase(modules);
        if (!phrase) return;

        const bip39Passphrase = await getBip39Passphrase(modules);
        if (!bip39Passphrase) {
            console.log(chalk.red.bold(`\n${strings.bip39Required}`));
            return;
        }

        const provider = new quais.JsonRpcProvider('https://rpc.quai.network', undefined, { usePathing: true });
        const senderMnemonic = quais.Mnemonic.fromPhrase(phrase, bip39Passphrase);
        const senderWallet = quais.QuaiHDWallet.fromMnemonic(senderMnemonic);
        await senderWallet.connect(provider);

        const senderAddressInfo = await senderWallet.getNextAddress(0, quais.Zone.Cyprus1);
        const senderAddress = senderAddressInfo.address;
        const senderBalance = await provider.getBalance(senderAddress);
        const senderBalanceQuai = quais.formatUnits(senderBalance, 18);

        console.log(chalk.yellow(`\n${strings.sourceWalletDerived}`));
        console.log(`  ${strings.address} ${senderAddress}`);
        console.log(`  ${strings.balance} ${senderBalanceQuai} QUAI`);
        if (senderBalance === 0n) { console.log(chalk.red(strings.insufficientBalance)); return; }

        const { toAddress, amount } = await inquirer.prompt([
            { type: 'input', name: 'toAddress', message: strings.enterDestination, validate: (input) => quais.isAddress(input) ? true : strings.invalidAddress },
            { type: 'input', name: 'amount', message: strings.enterAmount.replace('{maxAmount}', senderBalanceQuai), validate: (input) => !isNaN(parseFloat(input.replace(',', '.'))) ? true : strings.invalidNumber }
        ]);

        const normalizedAmount = amount.replace(',', '.');
        const amountToSendWei = quais.parseQuai(normalizedAmount);

        if (amountToSendWei > senderBalance) { throw new Error(strings.insufficientBalanceError.replace('{balanceQuai}', senderBalanceQuai)); }

        const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: strings.confirmSend.replace('{amount}', normalizedAmount).replace('{toAddress}', toAddress), default: false }]);
        if (!confirm) { console.log(chalk.yellow(strings.opCancelled)); return; }

        const spinner = ora(strings.broadcastingTx).start();
        const tx = await senderWallet.sendTransaction({ from: senderAddress, to: toAddress, value: amountToSendWei });
        spinner.text = strings.txSent.replace('{hash}', tx.hash);
        const receipt = await tx.wait();
        spinner.succeed(chalk.green(strings.txConfirmed.replace('{blockNumber}', receipt.blockNumber)));

    } catch (error) {
        console.error(chalk.red(`\n${strings.error}:`), error.message);
    }
}

async function sendToDerivedWallet(modules) {
    const { inquirer, chalk, ora, strings } = modules;
    try {
        const phrase = await getDecryptedSeedPhrase(modules);
        if (!phrase) return;

        const provider = new quais.JsonRpcProvider('https://rpc.quai.network', undefined, { usePathing: true });
        const senderMnemonic = quais.Mnemonic.fromPhrase(phrase);
        const senderWallet = quais.QuaiHDWallet.fromMnemonic(senderMnemonic);
        await senderWallet.connect(provider);

        const senderAddressInfo = await senderWallet.getNextAddress(0, quais.Zone.Cyprus1);
        const senderAddress = senderAddressInfo.address;
        const senderBalance = await provider.getBalance(senderAddress);
        const senderBalanceQuai = quais.formatUnits(senderBalance, 18);

        console.log(chalk.yellow(`\n${strings.sourceWallet}`));
        console.log(`  ${strings.address} ${senderAddress}`);
        console.log(`  ${strings.balance} ${senderBalanceQuai} QUAI`);
        if (senderBalance === 0n) { console.log(chalk.red(strings.insufficientBalance)); return; }

        const toAddress = process.env.DERIVED_ADDRESS;
        if (!toAddress) { throw new Error("Derived address not found in .env. Please run setup again."); }
        console.log(chalk.blue(`\n${strings.destinationIsDerived.replace('{toAddress}', toAddress)}`));

        const { amount } = await inquirer.prompt([{ type: 'input', name: 'amount', message: strings.enterAmount.replace('{maxAmount}', senderBalanceQuai), validate: (input) => !isNaN(parseFloat(input.replace(',', '.'))) ? true : strings.invalidNumber }]);
        
        const normalizedAmount = amount.replace(',', '.');
        const amountToSendWei = quais.parseQuai(normalizedAmount);

        if (amountToSendWei > senderBalance) { throw new Error(strings.insufficientBalanceError.replace('{balanceQuai}', senderBalanceQuai)); }

        const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: strings.confirmSendToDerived.replace('{amount}', normalizedAmount), default: false }]);
        if (!confirm) { console.log(chalk.yellow(strings.opCancelled)); return; }

        const spinner = ora(strings.broadcastingTx).start();
        const tx = await senderWallet.sendTransaction({ from: senderAddress, to: toAddress, value: amountToSendWei });
        spinner.text = strings.txSent.replace('{hash}', tx.hash);
        const receipt = await tx.wait();
        spinner.succeed(chalk.green(strings.txConfirmed.replace('{blockNumber}', receipt.blockNumber)));

    } catch (error) {
        console.error(chalk.red(`\n${strings.errorDuringSend}`), error.message);
    }
}

module.exports = { checkBalance, lockWallet, sendFromDerivedWallet, sendToDerivedWallet, listTransactions };
