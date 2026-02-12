require("dotenv").config();
const { chromium } = require("playwright");
const axios = require("axios");
const cron = require("node-cron");

let alreadyNotified = false;

// Table de correspondance des forums KOP avec leurs IDs
const FORUM_LINKS = {
	"Entrée matos 2025-2026": "https://www.bg87.com/forum/146",
	"Déplacements 2025-2026": "https://www.bg87.com/forum/147",
	"Permanence stade 2025-2026": "https://www.bg87.com/forum/148",
	"Divers 2025-2026": "https://www.bg87.com/forum/149",
	"Vie de La Tribune 2025-2026": "https://www.bg87.com/forum/150"
};

// Vérification config au démarrage
if (!process.env.TELEGRAM_CHAT_ID) {
	console.error("❌ TELEGRAM_CHAT_ID manquant dans .env");
	console.log("👉 Lancez 'node get-chat-id.js' pour l'obtenir");
	process.exit(1);
}

async function sendTelegram(message) {
	try {
		const response = await axios.post(
			`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
			{
				chat_id: process.env.TELEGRAM_CHAT_ID,
				text: message,
				parse_mode: "HTML",
			}
		);
		console.log("📤 Message Telegram envoyé avec succès");
		return response.data;
	} catch (error) {
		console.error("❌ Erreur Telegram:", error.response?.data || error.message);
		throw error;
	}
}

async function checkForum() {
	const browser = await chromium.launch({
		headless: true,
	});
	const page = await browser.newPage();

	try {
		console.log("🔎 Vérification en cours...");

		// Étape 1: Connexion
		console.log("🔐 Connexion au site...");
		await page.goto("https://www.bg87.com/connexion", {
			waitUntil: "networkidle",
		});

		// Attendre que la page soit complètement chargée
		await page.waitForTimeout(2000);

		await page.waitForSelector('input[name="signin[username]"]', { timeout: 5000 });

		// Remplir le username dans le formulaire VISIBLE (le gros au centre)
		await page.evaluate((username) => {
			// Chercher tous les champs username
			const inputs = document.querySelectorAll('input[name="signin[username]"]');
			// Prendre le dernier (formulaire principal au centre)
			const input = inputs[inputs.length - 1];
			if (input) {
				input.focus();
				input.value = username;
				input.dispatchEvent(new Event('input', { bubbles: true }));
				input.dispatchEvent(new Event('change', { bubbles: true }));
			}
		}, process.env.BG87_USER);

		console.log("   ✓ Username rempli");
		await page.waitForTimeout(500);

		// Remplir le password dans le formulaire VISIBLE
		await page.evaluate((password) => {
			const inputs = document.querySelectorAll('input[name="signin[password]"]');
			// Prendre le dernier (formulaire principal au centre)
			const input = inputs[inputs.length - 1];
			if (input) {
				input.focus();
				input.value = password;
				input.dispatchEvent(new Event('input', { bubbles: true }));
				input.dispatchEvent(new Event('change', { bubbles: true }));
			}
		}, process.env.BG87_PASS);

		console.log("   ✓ Password rempli");

		// Attendre 2 secondes pour BIEN voir le formulaire rempli
		console.log("   Attente avant soumission...");
		await page.waitForTimeout(2000);

		// Soumettre le formulaire
		await page.evaluate(() => {
			const forms = document.querySelectorAll('form[action*="connexion"]');
			const form = forms[forms.length - 1]; // Prendre le dernier
			if (form) {
				form.submit();
			}
		});

		console.log("   ✓ Formulaire soumis");

		// Attendre la navigation après connexion
		await page.waitForNavigation({ timeout: 10000 });
		console.log("✅ Connexion réussie");

		// Étape 2: Aller sur la page forums
		await page.goto("https://www.bg87.com/forums", {
			waitUntil: "networkidle",
		});

		const currentUrl = page.url();
		if (currentUrl.includes("connexion")) {
			throw new Error("Échec de la connexion");
		}

		await page.waitForTimeout(2000);

		// Screenshot pour debug
		// await page.screenshot({ path: 'debug-forums-structure.png', fullPage: true });
		// console.log("📸 Screenshot sauvegardé: debug-forums-structure.png\n");

		// Étape 3: Trouver la section "KOP 2025/2026" et vérifier les images nonlu/lu

		// DEBUG: Voir toutes les sections disponibles
		const allSections = await page.evaluate(() => {
			const headers = Array.from(document.querySelectorAll('th.category'));
			return headers.map(h => h.textContent.trim());
		});

		// console.log("📋 Sections trouvées sur la page:");
		// allSections.forEach((section, i) => {
		// 	console.log(`   ${i + 1}. "${section}"`);
		// });
		// console.log("");

		const kopSection = await page.evaluate(() => {
			// Trouver le th.category "KOP 2025/2026"
			const headers = Array.from(document.querySelectorAll('th.category'));
			const kopHeader = headers.find(h => h.textContent.includes('KOP 2025/2026'));

			if (!kopHeader) return { found: false };

			// Trouver le thead parent
			const thead = kopHeader.closest('thead');
			if (!thead) return { found: false };

			// Trouver le tbody qui suit ce thead
			const tbody = thead.nextElementSibling;
			if (!tbody || tbody.tagName !== 'TBODY') return { found: false };

			// Récupérer toutes les lignes du tbody
			const rows = Array.from(tbody.querySelectorAll('tr'));
			const forumsInSection = [];

			// Parcourir toutes les lignes du tbody
			for (const row of rows) {
				// Chercher l'image dans td.statement
				const statementTd = row.querySelector('td.statement');
				const img = statementTd ? statementTd.querySelector('img[src*="lu.png"], img[src*="nonlu.png"]') : null;

				// Nom du forum dans td.subject
				const subjectTd = row.querySelector('td.subject');
				const forumLink = subjectTd ? subjectTd.querySelector('h3 a') : null;

				if (img && forumLink) {
					forumsInSection.push({
						name: forumLink.textContent.trim(),
						hasNewMessages: img.src.includes('nonlu.png'),
						imageSrc: img.src,
						imageAlt: img.alt
					});
				}
			}

			return {
				found: true,
				forums: forumsInSection
			};
		});

		if (!kopSection.found) {
			console.log("⚠️ Section 'KOP 2025/2026' non trouvée");
			return;
		}

		// DEBUG: Afficher les détails de chaque forum trouvé
		if (kopSection.forums.length > 0) {
			console.log("🔍 Détails des forums:");
			kopSection.forums.forEach(forum => {
				console.log(`   - ${forum.name}`);
				console.log(`     Image: ${forum.imageSrc}`);
				console.log(`     Alt: ${forum.imageAlt}`);
				console.log(`     Nouveaux: ${forum.hasNewMessages}`);
			});
			console.log("");
		}

		// Afficher le statut de chaque forum
		kopSection.forums.forEach(forum => {
			const icon = forum.hasNewMessages ? '🔴' : '✅';
			console.log(`${icon} ${forum.name}`);
		});

		// Vérifier s'il y a des nouveaux messages
		const forumsWithNewMessages = kopSection.forums.filter(f => f.hasNewMessages);

		if (forumsWithNewMessages.length > 0 && !alreadyNotified) {
			console.log(`\n🚨 ${forumsWithNewMessages.length} forum(s) avec nouveaux messages détecté(s) !`);

			// Construire le message Telegram
			let telegramMsg = `🚨 <b>Nouveau${forumsWithNewMessages.length > 1 ? 'x' : ''} message${forumsWithNewMessages.length > 1 ? 's' : ''} sur le forum ⚜️</b>\n\n`;

			forumsWithNewMessages.forEach((forum) => {
				const forumLink = FORUM_LINKS[forum.name] || 'https://www.bg87.com/forums';
				telegramMsg += `➡️ ${forum.name}\n${forumLink}\n\n`;
			});

			// Supprimer le dernier \n\n et ajouter le lien général
			telegramMsg = telegramMsg.trim();

			await sendTelegram(telegramMsg);
			alreadyNotified = true;
		} else if (forumsWithNewMessages.length === 0) {
			if (alreadyNotified) {
				console.log("\n✅ Messages lus, réinitialisation");
				alreadyNotified = false;
			} else {
				console.log("\n✅ Pas de nouveaux messages dans KOP 2025/2026");
			}
		} else {
			console.log("\nℹ️ Nouveaux messages (déjà notifié)");
		}

	} catch (err) {
		console.error("❌ Erreur lors de la vérification :", err.message);
		// await sendTelegram(`⚠️ Erreur BG87 Notifier: ${err.message}`);
	} finally {
		await browser.close();
	}
}

// Test au démarrage
console.log("🚀 BG87 Notifier lancé...");
// console.log(`📱 Chat ID: ${process.env.TELEGRAM_CHAT_ID}`);

// Test Telegram
sendTelegram("✅ BG87 Notifier démarré !")
	.then(() => checkForum())
	.catch(console.error);

// Planification toutes les heures
cron.schedule("0 * * * *", () => {
	console.log("\n" + "=".repeat(60));
	console.log("⏰ Vérification programmée - " + new Date().toLocaleString('fr-FR'));
	console.log("=".repeat(60) + "\n");
	checkForum();
});

console.log("⏰ Vérifications programmées toutes les heures");