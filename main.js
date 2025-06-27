// main.js

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const setup = require('./setup');
const wallet = require('./wallet');

// Função de inicialização do aplicativo
async function main() {
    const { default: inquirer } = await import('inquirer');
    
    // Pergunta inicial de idioma
    const { language } = await inquirer.prompt([
        {
            type: 'list',
            name: 'language',
            message: 'Please select a language / Por favor selecione um idioma:',
            choices: [
                { name: 'English', value: 'en' },
                { name: 'Português', value: 'pt' }
            ],
            loop: false
        }
    ]);
    const strings = require(`./locales/${language}.js`);

    const { default: chalk } = await import('chalk');
    const { default: boxen } = await import('boxen');
    const { default: ora } = await import('ora');

    const modules = { chalk, boxen, inquirer, ora, strings };

    const dataDir = path.join(process.cwd(), 'data');
    const envPath = path.join(dataDir, '.env');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }

    if (!fs.existsSync(envPath)) {
        console.clear();
        console.log(boxen(chalk.bold.yellow(strings.welcome), { padding: 1, margin: 1, borderStyle: 'round' }));
        try {
            await setup.runSetup(modules);
            
            const newEnv = dotenv.parse(fs.readFileSync(envPath));
            for (const key in newEnv) {
                process.env[key] = newEnv[key];
            }

            console.log(chalk.green(`\n${strings.setupComplete}`));
            await pressEnterToContinue(modules);
            await showMainMenu(modules);
        } catch (error) {
            console.error(chalk.red(`\n${strings.error}:`), error.message);
        }
    } else {
        await showMainMenu(modules);
    }
}

async function pressEnterToContinue({ inquirer, chalk, strings }) {
    console.log('\n');
    await inquirer.prompt([
        {
            type: 'input',
            name: 'key',
            message: chalk.dim(strings.pressEnterToContinue),
        },
    ]);
}

// ===================================================================================
// A FUNÇÃO ABAIXO FOI REESCRITA PARA USAR O MENU ESTÁTICO
// ===================================================================================
async function showMainMenu(modules) {
    const { inquirer, chalk, boxen, strings } = modules;
    while (true) {
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
        console.log(chalk.bold.white("             QUAI NETWORK WALLET"));
        
        // 1. Criar o texto do menu
        const menuOptions = [
            `1. ${strings.checkBalanceOpt}`,
            `2. ${strings.sendDerivedOpt}`,
            `3. ${strings.sendToDerivedOpt}`,
            ``, // Linha em branco para separar
            `4. ${strings.listReceivedOpt}`,
            `5. ${strings.listSentOpt}`,
            ``, // Linha em branco para separar
            `6. ${chalk.yellow(strings.lockWalletOpt)}`,
            `7. ${chalk.red(strings.exitOpt)}`
        ].join('\n');

        // 2. Exibir o menu dentro de uma caixa (boxen)
        console.log(boxen(menuOptions, {
            title: strings.mainMenuTitle,
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            titleAlignment: 'center'
        }));

        // 3. Pedir ao usuário para digitar o número da opção
        const { choice } = await inquirer.prompt([
            {
                type: 'input',
                name: 'choice',
                message: `${strings.mainMenuTitle.replace(/---/g, '').trim()}:`,
                validate: function(value) {
                    const valid = !isNaN(parseFloat(value)) && value > 0 && value <= 7;
                    return valid || strings.invalidOption;
                }
            }
        ]);
        
        console.clear();

        // 4. Agir com base na escolha
        switch (choice) {
            case '1':
                await wallet.checkBalance(modules);
                await pressEnterToContinue(modules);
                break;
            case '2':
                await wallet.sendFromDerivedWallet(modules);
                await pressEnterToContinue(modules);
                break;
            case '3':
                await wallet.sendToDerivedWallet(modules);
                await pressEnterToContinue(modules);
                break;
            case '4':
                await wallet.listTransactions(modules, 'received');
                await pressEnterToContinue(modules);
                break;
            case '5':
                await wallet.listTransactions(modules, 'sent');
                await pressEnterToContinue(modules);
                break;
            case '6':
                wallet.lockWallet(modules);
                await pressEnterToContinue(modules);
                break;
            case '7':
                console.log(chalk.blue(strings.goodbye));
                return; // Encerra o loop e o programa
            default:
                // A validação do prompt já impede que se chegue aqui, mas é uma boa prática
                console.log(chalk.red(strings.invalidOption));
                await pressEnterToContinue(modules);
                break;
        }
    }
}

main().catch(err => console.error(err));
