# Quai Network CLI Wallet

A secure, feature-rich, interactive command-line interface (CLI) wallet for managing accounts and interacting with the Quai Network. This wallet is built with Node.js and is designed to run securely inside a Docker container.

## Core Features

- **Encrypted On-Disk Storage**: Your 24-word seed phrase is never stored in plaintext. It is encrypted at rest using AES-256-CBC and a user-provided password.
- **Secure Key Derivation**: The encryption key is derived from your password and a random salt using PBKDF2 with a high iteration count (200,000 rounds), making it resistant to brute-force attacks.
- **BIP-39 Passphrase Support**: Full support for creating and managing a "hidden" derived wallet with a BIP-39 passphrase (sometimes referred to as the "25th word"). The application allows you to manage funds on both your main wallet and your derived wallet seamlessly.
- **Quai Network HD Wallet Standard**: The wallet correctly derives addresses for Quai's unique sharded architecture (e.g., Cyprus Zone) from a standard EVM-compatible BIP-39 mnemonic phrase.
- **Interactive Menu**: A user-friendly, menu-driven interface for all wallet operations.
- **Full-Featured Functionality**:
    - Check balances for both main and derived wallets.
    - Send QUAI from either the main or derived wallet.
    - List incoming transaction history for both addresses using the QuaiScan API.
    - In-memory session caching for passwords, avoiding repetitive prompts.
    - Ability to "lock" the wallet, clearing all sensitive data from memory.
- **Portable & Secure Execution**: The entire application is containerized with Docker and Docker Compose, ensuring a consistent and isolated environment with no external dependencies required on the host machine.

## Security Model

Security is the primary design consideration for this wallet.

### 1. Encrypted Seed Phrase
The most critical piece of data, your 24-word seed phrase, is **never written to disk in plaintext**. During the initial setup, the phrase is immediately encrypted. The only files stored on disk are:
- The encrypted ciphertext of your seed phrase.
- The `salt` and `IV` used during encryption.
- Your public, non-sensitive wallet addresses (`MAIN_ADDRESS`, `DERIVED_ADDRESS`).

An attacker who gains access to the `.env` file cannot access your funds without also knowing the separate, high-entropy password you provide.

### 2. In-Memory Decryption
The decrypted seed phrase exists **only in the application's memory** and only when the wallet is "unlocked" by the user during an active session. When you use the "Lock Wallet" feature or exit the application, this in-memory data is cleared.

### 3. Read-Only Operations are Password-Free
Operations that only require public information, such as checking balances or listing transaction history, **do not require a password**. The application reads the saved public addresses from the `.env` file for these functions. Your password is only required for operations that need to sign a transaction (i.e., sending funds).

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

---

## Getting Started

Follow these steps to set up and run your wallet securely.

1.  **Clone or Download the Project Files**
    Ensure all project files (`main.js`, `wallet.js`, `setup.js`, `package.json`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`) are in a single directory.

2.  **Build the Docker Image**
    Navigate to the project directory in your terminal and run the build command. This only needs to be done once, or whenever you change the code or dependencies.
    ```bash
    docker-compose build
    ```

3.  **Run the Wallet**
    Use the following command to start the application.
    ```bash
    docker-compose run --rm quai-wallet
    ```
    - **On the first run**, the application will detect that no `.env` file exists and will launch the interactive setup wizard. Follow the prompts to import your seed phrase and create your encryption password.
    - **On subsequent runs**, the application will detect the existing `.env` file (stored in a local `wallet-data` folder) and take you directly to the main menu.

---

## Usage

The application provides an interactive menu with the following options:

1.  **Check Balance**: Instantly displays the QUAI balance for both your main and derived wallets. (No password required).
2.  **Send (FROM Derived Wallet)**: Initiates a transaction originating from your BIP-39 passphrase-protected wallet to any destination address. (Requires password if locked).
3.  **Send (TO Derived Wallet)**: Initiates a transaction from your main wallet specifically to your BIP-39 passphrase-protected wallet. (Requires password if locked).
4.  **List Received Transactions**: Fetches and displays the incoming transaction history for either your main or derived wallet via the QuaiScan explorer. (No password required).
5.  **Lock Wallet**: Clears the decrypted seed phrase and BIP-39 passphrase from memory. The next sensitive operation will require you to enter your password again.
6.  **Exit**: Securely closes the application.

---

## Remove wallet
    rm -rf wallet-data or rm wallet-data/.env

## Donations
QUAI: 0x003d09d08Fd59241EB1C9EA4F450A1dD11a0adf1

## Disclaimer

⚠️ **This is a personal project created for educational and experimental purposes. It has not been professionally audited.**

Use at your own risk. It is strongly recommended that you use this wallet with a fresh seed phrase for testing purposes only. **DO NOT USE THIS WALLET WITH A SEED PHRASE THAT HOLDS SIGNIFICANT REAL ASSETS.** The author takes no responsibility for any loss of funds.
