# 🚨 BG87 Forum Notifier ⚜️

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)

**Bot de notification automatique pour le forum BG87** - Recevez instantanément les nouveaux messages du forum et de votre messagerie privée directement sur Telegram !

## 🎯 Fonctionnalités

- 🔍 **Surveillance du forum** : Détecte automatiquement les nouveaux messages dans les sections KOP 2025/2026
- 📧 **Messages privés** : Vérifie votre messagerie privée et notifie les messages non lus
- 📱 **Notifications Telegram** : Envoi automatique de notifications avec liens directs
- ⚡ **Automatisation GitHub Actions** : Vérifications programmées (forum toutes les heures, MP toutes les 30min)
- 🔐 **Authentification sécurisée** : Connexion automatique au forum avec gestion des cookies

## 🏟️ Sections surveillées

- 🎫 **Entrée matos 2025-2026**
- 🚌 **Déplacements 2025-2026**
- 🏟️ **Permanence stade 2025-2026**
- 💬 **Divers 2025-2026**
- 📯 **Vie de La Tribune 2025-2026**

## 🚀 Installation

### Prérequis
- Node.js 18+
- Compte Telegram + Bot Token
- Compte sur le forum BG87

### Configuration locale

1. **Cloner le repository**
   ```bash
   git clone https://github.com/votre-username/notifier-bg87.git
   cd notifier-bg87
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement**

   Créer un fichier `.env` :
   ```env
   BG87_USER=votre_nom_utilisateur
   BG87_PASS=votre_mot_de_passe
   TELEGRAM_TOKEN=votre_bot_token
   TELEGRAM_CHAT_ID=votre_chat_id
   ```

4. **Tester le script**
   ```bash
   # Vérifier tout (forum + messages privés)
   node index.js

   # Vérifier uniquement le forum
   node index.js forum

   # Vérifier uniquement les messages privés
   node index.js messages
   ```

## 🤖 Configuration Telegram

### 1. Créer un bot Telegram
1. Ouvrez Telegram et cherchez `@BotFather`
2. Envoyez `/newbot` et suivez les instructions
3. Récupérez votre `TELEGRAM_TOKEN`

### 2. Obtenir votre Chat ID
1. Ajoutez votre bot à un groupe ou écrivez-lui en privé
2. Visitez : `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Récupérez votre `TELEGRAM_CHAT_ID`

## ⚙️ Configuration GitHub Actions

### Secrets à configurer dans GitHub

Dans votre repository GitHub, allez dans `Settings > Secrets and variables > Actions` :

| Secret | Description |
|--------|-------------|
| `BG87_USER` | Nom d'utilisateur BG87 |
| `BG87_PASS` | Mot de passe BG87 |
| `TELEGRAM_TOKEN` | Token du bot Telegram |
| `TELEGRAM_CHAT_ID` | ID du chat Telegram |

### Workflows automatiques

Le projet inclut deux workflows GitHub Actions :

#### 🔍 Forum Check (Toutes les heures)
- **Fichier** : `.github/workflows/bg87-forum.yml`
- **Fréquence** : `0 * * * *` (toutes les heures)
- **Action** : Vérifie les nouveaux messages du forum

#### 📧 Messages Check (Toutes les 30 minutes)
- **Fichier** : `.github/workflows/bg87-messages.yml`
- **Fréquence** : `*/30 * * * *` (toutes les 30 minutes)
- **Action** : Vérifie les messages privés non lus

## 📋 Structure du projet

```
notifier-bg87/
├── 📄 index.js                    # Script principal
├── 📄 package.json                # Dépendances Node.js
├── 📄 .env.example                # Exemple de configuration
├── 📄 README.md                   # Documentation
└── 📁 .github/workflows/
    ├── 📄 bg87-forum.yml          # Workflow forum
    └── 📄 bg87-messages.yml       # Workflow messages privés
```

## 📱 Exemple de notifications

### Nouveaux messages forum
```
🚨 Nouveaux messages ⚜️

➡️ Déplacements 2025-2026
https://www.bg87.com/forum/147

➡️ Vie de La Tribune 2025-2026
https://www.bg87.com/forum/150
```

### Messages privés
```
📧 2 messages privés non lus
https://www.bg87.com/messagerie
```
## ⚜️ Support

Pour toute question ou problème :
- 🐛 Ouvrir une issue sur GitHub

---

<div align="center">
  <img src="https://img.shields.io/badge/Fait_avec-❤️-red?style=for-the-badge">
  <img src="https://img.shields.io/badge/Pour_les-Gones-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/Allez-L'OL-white?style=for-the-badge">
</div>

**🦁 ALLEZ L'OL ! ❤️🩵⚜️**