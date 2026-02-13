require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");

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
	try {
		console.log("🔐 Récupération page login...");

		// 1️⃣ GET page login pour récupérer cookie initial + CSRF
		const loginPage = await axios.get("https://www.bg87.com/connexion", {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
				"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
				"Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
				"Cache-Control": "no-cache",
				"Pragma": "no-cache"
			},
			validateStatus: s => s < 500
		});


		const initialCookies = loginPage.headers["set-cookie"]
			.map(c => c.split(";")[0])
			.join("; ");

		const $login = cheerio.load(loginPage.data);

		const csrfToken = $login('input[name="signin[_csrf_token]"]').val();

		if (!csrfToken) throw new Error("CSRF token introuvable");

		console.log("🔑 CSRF trouvé");

		// 2️⃣ POST login avec CSRF + cookie initial
		const loginResponse = await axios.post(
			"https://www.bg87.com/connexion",
			new URLSearchParams({
				"signin[username]": process.env.BG87_USER,
				"signin[password]": process.env.BG87_PASS,
				"signin[_csrf_token]": csrfToken
			}),
			{
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
					"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
					"Referer": "https://www.bg87.com/connexion",
					"Origin": "https://www.bg87.com",
					"Cookie": initialCookies
				},
				maxRedirects: 0,
				validateStatus: s => s < 500
			}
		);


		console.log("Status login:", loginResponse.status);
		console.log("Location redirect:", loginResponse.headers.location);

		if (loginResponse.status !== 302) {
			throw new Error("Login échoué");
		}

		const authCookies = loginResponse.headers["set-cookie"]
			.map(c => c.split(";")[0])
			.join("; ");

		console.log("✅ Connecté");

		// 3️⃣ Accès au forum avec cookie authentifié
		const forumResponse = await axios.get(
			"https://www.bg87.com/forums",
			{
				headers: {
					"Cookie": authCookies,
					"User-Agent": "Mozilla/5.0",
					"Referer": "https://www.bg87.com/"
				}
			}
		);

		const $ = cheerio.load(forumResponse.data);

		const kopHeader = $('th.category')
			.filter((i, el) => $(el).text().includes('KOP 2025/2026'))
			.first();

		if (!kopHeader.length) {
			console.log("⚠️ Section 'KOP 2025/2026' non trouvée");
			return;
		}

		const tbody = kopHeader.closest('thead').next('tbody');
		const forums = [];

		tbody.find('tr').each((i, row) => {
			const img = $(row).find('td.statement img[src*="lu.png"], img[src*="nonlu.png"]');
			const forumLink = $(row).find('td.subject h3 a');

			if (img.length && forumLink.length) {
				forums.push({
					name: forumLink.text().trim(),
					hasNewMessages: img.attr("src").includes("nonlu.png")
				});
			}
		});

		const forumsWithNewMessages = forums.filter(f => f.hasNewMessages);

		if (forumsWithNewMessages.length > 0) {

			let telegramMsg =
				`🚨 <b>Nouveau${forumsWithNewMessages.length > 1 ? 'x' : ''} message${forumsWithNewMessages.length > 1 ? 's' : ''} sur le forum ⚜️</b>\n\n`;

			forumsWithNewMessages.forEach((forum) => {
				const forumLink = FORUM_LINKS[forum.name] || 'https://www.bg87.com/forums';
				telegramMsg += `➡️ ${forum.name}\n${forumLink}\n\n`;
			});

			await sendTelegram(telegramMsg.trim());
		} else {
			console.log("✅ Pas de nouveaux messages");
		}

	} catch (err) {
		console.error("❌ Erreur :", err.message);
	}
}

console.log("🚀 BG87 Notifier lancé...");
checkForum();
