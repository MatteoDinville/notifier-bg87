require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");

const FORUM_LINKS = {
	"Entrée matos 2025-2026": "https://www.bg87.com/forum/146",
	"Déplacements 2025-2026": "https://www.bg87.com/forum/147",
	"Permanence stade 2025-2026": "https://www.bg87.com/forum/148",
	"Divers 2025-2026": "https://www.bg87.com/forum/149",
	"Vie de La Tribune 2025-2026": "https://www.bg87.com/forum/150"
};

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
		return response.data;
	} catch (error) {
		console.error("❌ Erreur Telegram:", error.response?.data || error.message);
		throw error;
	}
}
async function connectionToForum() {
	try {
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

		if (loginResponse.status !== 302) {
			throw new Error("Login échoué");
		}

		const authCookies = loginResponse.headers["set-cookie"]
			.map(c => c.split(";")[0])
			.join("; ");

		console.log("✅ Connecté");
		return authCookies;
	}
	catch (err) {
		console.error("❌ Erreur de connexion :", err.message);
		throw err;
	}

}
async function checkForum() {
	try {
		const authCookies = await connectionToForum();

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

		const mode = process.argv[2];

		if (!mode || mode === 'forum') {
			await checkForumMessages(forumResponse.data);
		}

		if (!mode || mode === 'messages') {
			await checkMessagerie(forumResponse.data);
		}

	} catch (err) {
		console.error("❌ Erreur :", err.message);
	}
}
async function getLastMessageDetails(htmlData) {
	const $ = cheerio.load(htmlData);
	const forumTable = $('.forums.forum_name');
	const tbody = forumTable.find('tbody');

	const lastMessages = [];

	tbody.find('tr').each((i, row) => {
		const $row = $(row);
		const img = $row.find('td.statement img');
		const forumLink = $row.find('td.subject h3 a');
		const lastMessageCell = $row.find('td.last_message');

		if (img.length && forumLink.length && lastMessageCell.length) {
			const forumName = forumLink.text().trim();
			const forumUrl = forumLink.attr('href');
			const hasNewMessages = img.attr("src").includes("nonlu.png");

			const authorLink = lastMessageCell.find('a[href*="/profil/"]');
			const topicLink = lastMessageCell.find('a[href*="/forum/"][href*="/sujet/"]');
			const dateLink = lastMessageCell.find('a[href*="#"]');

			const messageDetails = {
				forumName: forumName,
				forumUrl: `https://www.bg87.com${forumUrl}`,
				hasNewMessages: hasNewMessages,
				lastMessage: {
					author: authorLink.length ? authorLink.text().trim() : null,
					authorUrl: authorLink.length ? `https://www.bg87.com${authorLink.attr('href')}` : null,
					topicTitle: topicLink.length ? topicLink.html() : null,
					topicUrl: topicLink.length ? `https://www.bg87.com${topicLink.attr('href')}` : null,
					dateTime: dateLink.length ? dateLink.text().trim() : null,
					messageUrl: dateLink.length ? `https://www.bg87.com${dateLink.attr('href')}` : null,
					fullText: lastMessageCell.text().trim()
				}
			};

			lastMessages.push(messageDetails);
		}
	});
	return lastMessages;
}
async function checkForumMessages(htmlData) {
	const $ = cheerio.load(htmlData);
	console.log("🔍 Analyse des messages du forum...");

	const lastMessages = await getLastMessageDetails(htmlData);

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
			`🚨 <b>Nouveau${forumsWithNewMessages.length > 1 ? 'x' : ''} message${forumsWithNewMessages.length > 1 ? 's' : ''} ⚜️</b>\n\n`;


		forumsWithNewMessages.forEach((forum) => {
			const forumLink = FORUM_LINKS[forum.name] || 'https://www.bg87.com/forums';
			telegramMsg += `➡️ ${forum.name}\n`;

			// Ajouter les détails du dernier message
			const lastMsg = lastMessages.find(m => m.forumName === forum.name);
			if (lastMsg && lastMsg.lastMessage) {
				telegramMsg += `👤 Par ${lastMsg.lastMessage.author}\n`;
				telegramMsg += `📝 ${lastMsg.lastMessage.topicTitle}\n`;
				telegramMsg += `🕒 Le ${lastMsg.lastMessage.dateTime}\n`;
			}
			telegramMsg += `🔗 ${forumLink}\n`;
			telegramMsg += `\n`;
		});

		console.log("📤 Message Telegram envoyé avec succès car il y a " + forumsWithNewMessages.length + " forum(s) avec de nouveaux messages");
		await sendTelegram(telegramMsg.trim());
	} else {
		console.log("✅ Pas de nouveaux messages sur le forum");
	}
}
async function checkMessagerie(htmlData) {
	try {
		const $ = cheerio.load(htmlData);
		console.log("🔍 Analyse des messages privés du forum...");

		const connectedDiv = $('.connected');
		const messagerieLien = connectedDiv.find('a[href="/messagerie"]');

		if (messagerieLien.length === 0) {
			console.log('❌ Lien messagerie non trouvé');
			return;
		}
		const counter = messagerieLien.find('.mp_counter');
		const counterText = counter.text().trim();
		const messageReceived = counterText.length;

		if (counterText.length > 0) {
			console.log("📤 Message Telegram envoyé avec succès car il y a " + messageReceived + " message(s) privé(s) non lu(s)");
			const telegramMsg = `📧 <b>${messageReceived} message${messageReceived > 1 ? 's' : ''} privé${messageReceived > 1 ? 's' : ''} non lu${messageReceived > 1 ? 's' : ''} ⚜️</b>\nhttps://www.bg87.com/messagerie`;
			await sendTelegram(telegramMsg);
		}
		else {
			console.log('✅ Pas de messages privés non lus');
		}
	} catch (err) {
		console.error("❌ Erreur checkMessagerie :", err.message);
	}
}

console.log("🚀 BG87 Notifier lancé...");
checkForum();
