// setup.js

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const quais = require('quais');

async function runSetup({ inquirer, chalk, ora, boxen, strings }) {
    let seedPhrase = '';

    console.clear();
    const logo = chalk.red(`
              ████████
          ██████    ██████
        ████          ██████
      ████              ████
     ████                ████
     ████                ████
      ████              ████
       ████          ████████
         ██████    ██████  ██
              ████████      ██`);

    console.log(logo);
    console.log(chalk.bold.white("\n             QUAI NETWORK"));
    console.log(chalk.bold.white(`\n${strings.walletSetup}`));

    const { initialChoice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'initialChoice',
            message: strings.createOrRestore,
            choices: [
                { name: strings.createWallet, value: '1' },
                { name: strings.restoreWallet, value: '2' },
            ],
            loop: false
        },
    ]);

    if (initialChoice === '1') {
        console.clear();
        console.log(chalk.bold.white(`\n${strings.createWalletTitle}`));
        const { wordCountStr } = await inquirer.prompt([
            {
                type: 'list',
                name: 'wordCountStr',
                message: strings.wordCountPrompt,
                choices: ['12', '24'],
                loop: false
            }
        ]);
        const wordCount = parseInt(wordCountStr, 10);

        const spinner = ora(strings.generatingSeed).start();
        const entropyBytes = wordCount === 12 ? 16 : 32;
        const entropy = crypto.randomBytes(entropyBytes);
        const mnemonic = quais.Mnemonic.fromEntropy(entropy);
        seedPhrase = mnemonic.phrase;
        spinner.succeed(strings.seedGenerated);

        console.clear();
        console.log(boxen(chalk.red.bold(strings.importantWriteDown), { padding: 1, margin: { top: 1, bottom: 1 }, borderStyle: 'double', borderColor: 'red' }));
        console.log(strings.seedWarning);
        console.log(`${strings.storeOffline}\n`);
        console.log(chalk.cyan.bold(`   ${seedPhrase}\n`));
        await inquirer.prompt([{ type: 'input', name: 'key', message: strings.pressEnterAfterWriting }]);
        console.clear();
    } else {
        console.clear();
        console.log(chalk.bold.white(`\n${strings.restoreWalletTitle}`));
        const { choice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'choice',
                message: strings.howToEnterSeed,
                choices: [
                    { name: strings.pasteFullPhrase, value: '1' },
                    { name: strings.typeWordByWord, value: '2' },
                ],
                loop: false
            },
        ]);

        if (choice === '1') {
            const { pastedPhrase } = await inquirer.prompt([{ type: 'password', name: 'pastedPhrase', message: strings.pasteYourSeed }]);
            seedPhrase = pastedPhrase;
        } else {
            const { wordCountStr } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'wordCountStr',
                    message: strings.words12or24,
                    choices: ['12', '24'],
                    loop: false
                }
            ]);
            const wordCount = parseInt(wordCountStr, 10);
            const words = [];
            console.log(`\n${strings.enterYourWords.replace('{wordCount}', wordCount)}`);
            for (let i = 0; i < wordCount; i++) {
                const { word } = await inquirer.prompt([{ type: 'password', name: 'word', message: `${strings.word} ${i + 1}:` }]);
                words.push(word.trim());
            }
            seedPhrase = words.join(' ');
        }
    }

    if (!seedPhrase || seedPhrase.split(' ').length < 11) {
        throw new Error(strings.incompleteSeed);
    }
    console.log(chalk.green(strings.seedReceived));

    console.log(`\n${strings.setupDerived}`);
    const { bip39Passphrase } = await inquirer.prompt([{ type: 'password', name: 'bip39Passphrase', message: strings.enterBip39 }]);

    const mainMnemonic = quais.Mnemonic.fromPhrase(seedPhrase);
    const mainWallet = quais.QuaiHDWallet.fromMnemonic(mainMnemonic);
    const mainAddress = (await mainWallet.getNextAddress(0, quais.Zone.Cyprus1)).address;

    const derivedMnemonic = quais.Mnemonic.fromPhrase(seedPhrase, bip39Passphrase);
    const derivedWallet = quais.QuaiHDWallet.fromMnemonic(derivedMnemonic);
    const derivedAddress = (await derivedWallet.getNextAddress(0, quais.Zone.Cyprus1)).address;

    console.log(boxen(`${chalk.bold(strings.mainAddress)} ${mainAddress}\n${chalk.bold(strings.derivedAddress)} ${derivedAddress}`, { title: strings.configuredAddresses, padding: 1, margin: 1, borderStyle: 'round' }));

    const { password } = await inquirer.prompt([{ type: 'password', name: 'password', message: strings.createPassword }]);
    if (!password) { throw new Error(strings.passwordCantBeEmpty); }

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 200000, 32, 'sha512');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encryptedSeed = cipher.update(seedPhrase, 'utf8', 'hex');
    encryptedSeed += cipher.final('hex');
    console.log(chalk.green.bold(`\n${strings.walletEncrypted}`));

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
    console.log(chalk.green.bold(`${strings.walletSaved} ${envPath}`));
}

module.exports = { runSetup };
