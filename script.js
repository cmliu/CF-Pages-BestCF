const THEME_MODE_CACHE_KEY = "bestcf:theme-mode";
let themeMode = readCachedThemeMode();

function readCachedThemeMode() {
	try {
		const mode = window.localStorage.getItem(THEME_MODE_CACHE_KEY);
		return mode === "light" || mode === "dark" ? mode : "auto";
	} catch (error) {
		return "auto";
	}
}

function cacheThemeMode(mode) {
	try {
		window.localStorage.setItem(THEME_MODE_CACHE_KEY, mode);
	} catch (error) {
		// 手动选择在拒绝存储的环境下仅本次会话生效。
	}
}

function systemPrefersDark() {
	return Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function parentPrefersDark() {
	try {
		const parentDoc = window.parent && window.parent.document;
		return Boolean(parentDoc && (
			parentDoc.documentElement.classList.contains("dark-mode") ||
			parentDoc.body.classList.contains("dark-mode")
		));
	} catch (error) {
		return null;
	}
}

function resolvedThemeIsDark() {
	if (themeMode === "dark") return true;
	if (themeMode === "light") return false;
	const parentDark = parentPrefersDark();
	if (parentDark !== null) return parentDark;
	return systemPrefersDark();
}

function applyThemeMode() {
	document.documentElement.classList.toggle("dark-mode", resolvedThemeIsDark());
	updateThemeToggleButton();
}

function syncEmbeddedTheme() {
	// 手动选择过配色时不再跟随父页面变化。
	if (themeMode !== "auto") return;
	applyThemeMode();
}

function updateThemeToggleButton() {
	const button = document.getElementById("themeToggleBtn");
	if (!button) return;
	const isDark = resolvedThemeIsDark();
	button.innerHTML = isDark ? svgSunIcon() : svgMoonIcon();
	const label = isDark ? "切换到日间配色" : "切换到夜间配色";
	button.title = label;
	button.setAttribute("aria-label", label);
}

function toggleThemeMode() {
	setThemeMode(resolvedThemeIsDark() ? "light" : "dark");
}

function setThemeMode(mode) {
	themeMode = mode;
	cacheThemeMode(mode);
	applyThemeMode();
}

function svgSunIcon() {
	return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M4.93 19.07l1.41-1.41"></path><path d="M17.66 6.34l1.41-1.41"></path></svg>';
}

function svgMoonIcon() {
	return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"></path></svg>';
}

applyThemeMode();
try {
	const parentDoc = window.parent && window.parent.document;
	if (parentDoc) {
		new MutationObserver(syncEmbeddedTheme).observe(parentDoc.documentElement, { attributes: true, attributeFilter: ["class"] });
		new MutationObserver(syncEmbeddedTheme).observe(parentDoc.body, { attributes: true, attributeFilter: ["class"] });
	}
} catch (error) {
	// Standalone demo mode does not need parent theme sync.
}
if (window.matchMedia) {
	window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
		if (themeMode === "auto") applyThemeMode();
	});
}
const TLS_PORTS = [443, 2053, 2083, 2087, 2096, 8443];
// CIDR/IP区间随机采样的候选总量上限（与原“待测IP数”默认值一致）
const CANDIDATE_LIMIT = 512;
const BEST_HOSTS = [
	"bestcf.cmliussss.hidns.vip",
	"ns.psb.kdns.fr"
];
const DETECT_ENDPOINTS = {
	// 基础地址即可，请求时会自动拼接 "/ip.json"
	ipv4: [
		"https://ipv4.fxxk.dedyn.io"
	],
	ipv6: [
		"https://ipv6.fxxk.dedyn.io"
	]
};
function expandWildcardEndpoints(endpoints) {
	return endpoints.map(ep => ep.replace(/\*\*/g, () => Math.floor(Math.random() * 255 + 1).toString(16).padStart(2, '0')));
}
const BEST_HOST_CACHE_KEY = "bestcf:active-best-host";
let activeBestHost = "";

function readCachedBestHost() {
	try {
		return window.localStorage.getItem(BEST_HOST_CACHE_KEY) || "";
	} catch (error) {
		return "";
	}
}

function cacheBestHost(host) {
	if (!host) return;
	activeBestHost = host;
	try {
		window.localStorage.setItem(BEST_HOST_CACHE_KEY, host);
	} catch (error) {
		// Some embedded contexts can deny storage; in-memory restore still works.
	}
}

function buildDetectEndpoints(family, host) {
	return expandWildcardEndpoints(DETECT_ENDPOINTS[family].map(ep => ep.replace("{{host}}", host)));
}

async function resolveBestHost() {
	if (!activeBestHost) activeBestHost = readCachedBestHost();
	if (activeBestHost && BEST_HOSTS.includes(activeBestHost)) return activeBestHost;

	for (const host of BEST_HOSTS) {
		try {
			const allEndpoints = [
				...buildDetectEndpoints("ipv4", host),
				...buildDetectEndpoints("ipv6", host)
			];
			await fetchJsonFromFastestEndpoint(allEndpoints, "ip.json", 6500);
			cacheBestHost(host);
			return host;
		} catch (error) {
			// This host failed; try the next one.
		}
	}

	cacheBestHost(BEST_HOSTS[0]);
	return BEST_HOSTS[0];
}

const CANDIDATE_INPUT_ERROR_MESSAGE = "待选列表为空或格式不符合要求，请输入有效域名（如 dash.cloudflare.com）。";
const RESULT_FILTER_KEYS = ["type", "country", "colo"];
const RESULT_FILTER_LABELS = {
	type: "优选类型",
	country: "国家/地区",
	colo: "数据中心"
};

const state = {
	ipv4: null,
	ipv6: null,
	network: { ipv4: null, ipv6: null },
	locations: [],
	locationsByIata: new Map(),
	latencyRun: null,
	networkChecking: false,
	editorResizeObserver: null,
	results: [],
	selectedIds: new Set(),
	nextResultId: 1,
	sort: { key: "latency", dir: "asc" },
	resultSelectionDrag: null,
	suppressResultClick: false,
	resultFilters: {},
	openResultFilterKey: ""
};

const $ = (selector) => document.querySelector(selector);
const els = {
	ipv4Value: $("#ipv4Value"),
	ipv4Card: $("#ipv4Card"),
	ipv4Tag: $("#ipv4Tag"),
	ipv6Value: $("#ipv6Value"),
	ipv6Card: $("#ipv6Card"),
	ipv6Tag: $("#ipv6Tag"),
	domainImportBtn: $("#domainImportBtn"),
	ipInput: $("#ipInput"),
	lineCount: $("#lineCount"),
	lineGutter: $("#lineGutter"),
	lineNumbers: $("#lineNumbers"),
	lineShades: $("#lineShades"),
	clearBtn: $("#clearBtn"),
	timeoutInput: $("#timeoutInput"),
	threadsInput: $("#threadsInput"),
	portSelect: $("#portSelect"),
	latencyBtn: $("#latencyBtn"),
	themeToggleBtn: $("#themeToggleBtn"),
	latencyStatus: $("#latencyStatus"),
	latencyProgress: $("#latencyProgress"),
	progressText: $("#progressText"),
	resultBody: $("#resultBody"),
	resultCount: $("#resultCount"),
	selectAllHeader: $("#selectAllHeader"),
	invertSelectBtn: $("#invertSelectBtn"),
	clearSelectBtn: $("#clearSelectBtn"),
	copyResultsBtn: $("#copyResultsBtn"),
	exportTxtBtn: $("#exportTxtBtn"),
	exportCsvBtn: $("#exportCsvBtn"),
	selectionStatus: $("#selectionStatus"),
	networkWarningOverlay: $("#networkWarningOverlay"),
	networkWarningModal: $("#networkWarningModal"),
	networkWarningHeading: $("#networkWarningHeading"),
	networkWarningTitle: $("#networkWarningTitle"),
	networkWarningMessage: $("#networkWarningMessage"),
	networkWarningSummary: $("#networkWarningSummary"),
	networkWarningDetails: $("#networkWarningDetails"),
	networkWarningJson: $("#networkWarningJson"),
	networkWarningLocalBtn: $("#networkWarningLocalBtn")
};

// ==================== 开屏加载动画 ====================

const BOOT_LOADING_MIN_VISIBLE = 800;
const bootLoading = {
	active: true,
	startedAt: performance.now(),
	timers: []
};

function scheduleBootLoadingProgress() {
	const bar = document.getElementById("bootLoadingBar");
	if (!bar) return;
	[
		{ delay: 60, width: "30%" },
		{ delay: 700, width: "60%" },
		{ delay: 1600, width: "80%" },
		{ delay: 2600, width: "90%" },
		{ delay: 3000, width: "98%", crawl: true }
	].forEach(({ delay, width, crawl }) => {
		bootLoading.timers.push(window.setTimeout(() => {
			if (crawl) bar.classList.add("is-crawling");
			bar.style.width = width;
		}, delay));
	});
}

function finishBootLoading() {
	// 冲刺 100%（先退出慢速蠕动）→ 分层淡出（卡片先行、背景随后）→ resolve 后由调用方弹警告/放行
	const overlay = document.getElementById("bootLoading");
	const bar = document.getElementById("bootLoadingBar");
	bootLoading.timers.forEach((timer) => window.clearTimeout(timer));
	bootLoading.timers = [];
	const wait = Math.max(0, BOOT_LOADING_MIN_VISIBLE - (performance.now() - bootLoading.startedAt));
	return new Promise((resolve) => {
		window.setTimeout(() => {
			if (bar) {
				bar.classList.remove("is-crawling");
				bar.style.width = "100%";
			}
			window.setTimeout(() => {
				if (overlay) overlay.classList.add("is-hidden");
				bootLoading.active = false;
				window.setTimeout(resolve, 580);
			}, 320);
		}, wait);
	});
}

document.addEventListener("DOMContentLoaded", () => {
	bindEvents();
	updateEditorMeta();
	scheduleBootLoadingProgress();
	detectNetwork();
	if ("ResizeObserver" in window) {
		state.editorResizeObserver = new ResizeObserver(updateEditorMeta);
		state.editorResizeObserver.observe(els.ipInput);
	}
});

function bindEvents() {
	els.themeToggleBtn.addEventListener("click", toggleThemeMode);
	els.domainImportBtn.addEventListener("click", importCfDomains);
	els.ipInput.addEventListener("input", updateEditorMeta);
	els.ipInput.addEventListener("scroll", syncEditorScroll);
	els.clearBtn.addEventListener("click", () => {
		els.ipInput.value = "";
		updateEditorMeta();
	});
	[els.timeoutInput, els.threadsInput].forEach((input) => {
		input.addEventListener("change", () => clampNumberInput(input));
	});
	els.latencyBtn.addEventListener("click", async () => {
		if (state.latencyRun) {
			stopLatencyRun();
			return;
		}
		if (state.networkChecking) return;
		if (!await ensureCnNetworkBeforeAction({
			button: els.latencyBtn,
			statusEl: els.latencyStatus,
			idleHtml: `${svgPulseIcon()}优选延迟`
		})) return;
		startLatencyRun();
	});
	els.resultBody.addEventListener("click", (event) => {
		if (state.suppressResultClick) {
			state.suppressResultClick = false;
			return;
		}

		const copyAddressBtn = event.target.closest("[data-copy-address]");
		if (copyAddressBtn) {
			event.stopPropagation();
			copyResultAddress(copyAddressBtn.dataset.copyAddress || "", copyAddressBtn);
			return;
		}

		const checkbox = event.target.closest("[data-select-id]");
		if (checkbox) {
			setResultSelected(checkbox.dataset.selectId, checkbox.checked);
			return;
		}

		const row = event.target.closest("[data-result-id]");
		if (!row) return;
		toggleResultSelected(row.dataset.resultId);
	});
	els.resultBody.addEventListener("mousedown", startResultSelectionDrag);
	els.resultBody.addEventListener("mouseover", continueResultSelectionDrag);
	document.addEventListener("mouseup", finishResultSelectionDrag);
	window.addEventListener("blur", finishResultSelectionDrag);
	els.selectAllHeader.addEventListener("change", () => {
		if (els.selectAllHeader.checked) {
			selectAllResults();
		} else {
			clearSelectedResults();
		}
	});
	els.invertSelectBtn.addEventListener("click", invertSelectedResults);
	els.clearSelectBtn.addEventListener("click", resetResultSelection);
	els.copyResultsBtn.addEventListener("click", copySelectedResultsToClipboard);
	els.exportTxtBtn.addEventListener("click", exportSelectedResultsTxt);
	els.exportCsvBtn.addEventListener("click", exportOptimizeResultsCsv);
	els.networkWarningLocalBtn.addEventListener("click", openLocalOptimizeFromWarning);
	document.querySelectorAll("[data-sort]").forEach((button) => {
		button.addEventListener("click", () => setResultSort(button.dataset.sort));
	});
	document.querySelectorAll("[data-filter-key]").forEach((label) => {
		label.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			toggleResultFilterMenu(label.dataset.filterKey, label);
		});
		label.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			event.stopPropagation();
			toggleResultFilterMenu(label.dataset.filterKey, label);
		});
	});
	document.addEventListener("click", (event) => {
		const menu = event.target.closest(".result-filter-menu");
		const label = event.target.closest("[data-filter-key]");
		if (!menu && !label) closeResultFilterMenu();
	});
	window.addEventListener("resize", closeResultFilterMenu);
	window.addEventListener("scroll", handleResultFilterScroll, true);
}

function handleResultFilterScroll(event) {
	const menu = document.querySelector(".result-filter-menu");
	if (menu && event.target instanceof Node && menu.contains(event.target)) return;
	closeResultFilterMenu();
}

function svgStopIcon() {
	return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"></rect></svg>';
}

function svgPulseIcon() {
	return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h4l3-7 3 14 3-7h1"></path></svg>';
}

async function detectNetwork() {
	return refreshCnNetwork({ resetResults: true, stopRuns: true });
}

async function ensureCnNetworkBeforeAction({ button, statusEl, idleHtml }) {
	if (state.networkChecking) return false;
	if (button) button.innerHTML = `${svgPulseIcon()}网络验证`;
	if (statusEl) statusEl.textContent = "正在检测CN网络";
	const allowed = await refreshCnNetwork({ resetResults: false, stopRuns: false });
	if (!allowed) {
		if (button && idleHtml) button.innerHTML = idleHtml;
		if (statusEl) statusEl.textContent = "检测未通过，请关闭代理后重试";
		return false;
	}
	if (statusEl) statusEl.textContent = "CN网络检测通过";
	return true;
}

async function refreshCnNetwork({ resetResults = false, stopRuns = false } = {}) {
	if (state.networkChecking) return availableFamilies().length > 0;
	state.networkChecking = true;

	if (stopRuns) {
		if (state.latencyRun) stopLatencyRun();
	}

	state.ipv4 = null;
	state.ipv6 = null;
	state.network = { ipv4: null, ipv6: null };
	state.locations = [];
	state.locationsByIata = new Map();
	if (resetResults) {
		state.results = [];
		state.selectedIds.clear();
		state.nextResultId = 1;
		resetResultFilters();
		renderResults();
		setProgress(0, 0);
	}

	renderNetworkCard("ipv4", { status: "loading" });
	renderNetworkCard("ipv6", { status: "loading" });
	updateActionAvailability();

	try {
		const bestHost = await resolveBestHost();
		const checks = await Promise.allSettled([
			detectStack("ipv4", bestHost),
			detectStack("ipv6", bestHost)
		]);

		checks.forEach((result, index) => {
			const family = index === 0 ? "ipv4" : "ipv6";
			if (result.status === "fulfilled") {
				state.network[family] = result.value;
				if (result.value.allowed) {
					if (result.value.ipType === "ipv4") state.ipv4 = result.value.ip;
					if (result.value.ipType === "ipv6") state.ipv6 = result.value.ip;
				}
			} else {
				state.network[family] = {
					status: "failed",
					error: result.reason && result.reason.message ? result.reason.message : "不具备优选条件"
				};
			}
		});

		renderNetworkCard("ipv4", state.network.ipv4);
		renderNetworkCard("ipv6", state.network.ipv6);
		await loadLocations();
		updateServiceStatus();

		const allowed = availableFamilies().length > 0;
		if (bootLoading.active) {
			await finishBootLoading();
		}
		if (!allowed) showNetworkWarning();
		return allowed;
	} catch (error) {
		if (bootLoading.active) await finishBootLoading();
		throw error;
	} finally {
		state.networkChecking = false;
		updateActionAvailability();
	}
}

function showNetworkWarning() {
	renderNetworkWarning(buildNetworkWarningContext());
	els.networkWarningOverlay.classList.add("is-visible");
	els.networkWarningLocalBtn.focus();
}

function buildNetworkWarningContext() {
	const entries = ["ipv4", "ipv6"].map((family) => ({
		family,
		info: state.network[family]
	}));
	const completed = entries.filter(({ info }) => info && info.status === "done");
	const nonCn = completed.filter(({ info }) => !info.allowed);

if (nonCn.length) {
	return {
		kind: "non-cn",
		heading: "红牌警告",
		title: "检测到当前网络出口不是 CN 直连",
		message: "请确认浏览器当前网络是否经过了 代理、VPN 或 境外网络，\n在线优选仅有 CN 直连网络环境才可以实现！\n当前网络环境无法进行在线优选，可尝试使用「本地优选」。",
		rows: nonCn,
		details: completed
	};
}

return {
	kind: "request-failed",
	heading: "黄牌警告",
	title: "优选域名请求失败",
	message: "当前网络环境无法进行在线优选，但可尝试使用「本地优选」。\n请自行检查网络环境，确保优选域名可访问。",
	rows: entries,
	details: completed
};
}

function renderNetworkWarning(context) {
	els.networkWarningModal.classList.toggle("is-request-failed", context.kind === "request-failed");
	els.networkWarningHeading.textContent = context.heading;
	els.networkWarningTitle.textContent = context.title;
	els.networkWarningMessage.textContent = context.message;
	els.networkWarningSummary.innerHTML = context.rows.map(({ family, info }) => {
		if (context.kind === "non-cn") return renderNetworkWarningNonCnRow(family, info);
		return renderNetworkWarningFailedRow(family, info);
	}).join("");

	const detailPayload = context.details
		.filter(({ info }) => info && info.raw)
		.map(({ family, info }) => ({
			family,
			endpoint: info.endpoint || "",
			response: info.raw
		}));
	if (detailPayload.length) {
		els.networkWarningJson.textContent = JSON.stringify(detailPayload, null, 2);
		els.networkWarningDetails.hidden = false;
		els.networkWarningDetails.open = false;
	} else {
		els.networkWarningJson.textContent = "";
		els.networkWarningDetails.hidden = true;
		els.networkWarningDetails.open = false;
	}
}

function renderNetworkWarningNonCnRow(family, info) {
	const ip = info && info.ip ? info.ip : "未获取";
	const country = info && info.country ? String(info.country).toUpperCase() : "未知";
	return `<div class="network-warning-row">
		<span class="network-warning-family">${escapeHtml(family.toUpperCase())}</span>
		<span class="network-warning-ip">${escapeHtml(ip)}</span>
		<span class="network-warning-country">地区代码 ${escapeHtml(country)}</span>
	</div>`;
}

function renderNetworkWarningFailedRow(family, info) {
	const error = info && info.error ? info.error : "请求失败";
	return `<div class="network-warning-row">
		<span class="network-warning-family">${escapeHtml(family.toUpperCase())}</span>
		<span class="network-warning-ip">${escapeHtml(error)}</span>
		<span class="network-warning-country">失败</span>
	</div>`;
}

function openLocalOptimizeFromWarning() {
	// 关闭当前警告弹窗
	els.networkWarningOverlay.classList.remove("is-visible");

	// 嵌入管理面板时优先交给父页面处理（关闭在线优选全屏并打开其本地优选目录）
	if (window.parent && window.parent !== window) {
		try {
			if (typeof window.parent.switchToLocalOptimizeFromOnline === "function") {
				window.parent.switchToLocalOptimizeFromOnline();
				return;
			}
		} catch (error) {
			// 跨域嵌入时无法直接访问父页面函数，改用本页内置的本地优选目录。
		}
	}

	// 独立运行（或父页面无本地优选能力）时，打开本页内置的本地优选工具目录
	openLocalOptimizeModal();
}

// ==================== 本地优选 - CF 优选工具目录 ====================

const CF_TOOLS_RAW_URL = "https://raw.githubusercontent.com/cmliu/cmliu/refs/heads/main/json/best-cf-tools.json";
const RAW_GITHUB_PREFIX = "https://raw.githubusercontent.com";
const RAW_MIRROR_DOMAINS = [
	"https://github.090227.xyz/raw.githubusercontent.com",
	"https://github.cmliussss.com/raw.githubusercontent.com",
	"https://github.cmliussss.net/raw.githubusercontent.com"
];
let localOptimizeProjects = [];
let localUiFilter = "all";

// GitHub Star 图标（octicon star）
const STAR_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>';

// 打开本地优选工具目录弹窗（并发拉取工具清单，RAW 失败自动切换镜像）
async function openLocalOptimizeModal() {
	const modal = document.getElementById("localOptimizeModal");
	const list = document.getElementById("localOptimizeToolList");
	if (!modal || !list) return;

	modal.classList.add("show");

	// 已加载过则直接显示，避免重复请求
	if (list.dataset.loaded === "true") return;

	list.innerHTML = '<div class="local-tools-loading">⏳ 正在拉取 CF 优选工具目录…</div>';

	try {
		const jsonText = await fetchWithAutoMirror(`${CF_TOOLS_RAW_URL}?_t=${Date.now()}`, "CF优选工具目录");
		const data = JSON.parse(jsonText);
		const projects = Array.isArray(data && data.projects) ? data.projects : [];
		renderLocalOptimizeTools(list, projects);
		list.dataset.loaded = "true";
	} catch (error) {
		console.error("[请求RAW] CF优选工具目录拉取失败:", error);
		list.innerHTML = `
			<div class="local-tools-error">
				❌ 工具目录拉取失败，请检查网络后重试<br>
				<button type="button" class="local-tools-retry" onclick="openLocalOptimizeModal()">重试</button>
			</div>`;
	}
}

// 渲染本地优选工具卡片
function renderLocalOptimizeTools(list, projects) {
	localOptimizeProjects = projects;

	// 同步类型筛选按钮高亮态，保证弹窗重开时高亮一致
	const filterButtons = document.querySelectorAll("#localUiFilter .local-ui-filter-btn");
	filterButtons.forEach((button) => {
		button.classList.toggle("is-active", button.dataset.ui === localUiFilter);
	});

	if (!projects.length) {
		list.innerHTML = '<div class="local-tools-error">😕 暂无可用的本地优选工具</div>';
		return;
	}

	const uiLabels = {
		webui: { emoji: "🌐", label: "网页界面" },
		gui: { emoji: "🖥️", label: "图形界面" },
		cli: { emoji: "⌨️", label: "命令行CLI" }
	};

	// 按 stars 数由高到低排序，携带原始索引（openLocalToolGitHub 依赖 localOptimizeProjects 索引）
	const ranked = projects
		.map((project, index) => ({ project, index }))
		.sort((a, b) => (Number(b.project.stars) || 0) - (Number(a.project.stars) || 0));

	// 按类型筛选
	const filtered = ranked.filter(({ project }) => {
		if (localUiFilter === "all") return true;
		const uiValues = Array.isArray(project.ui)
			? project.ui.map((value) => String(value).trim().toLowerCase())
			: [];
		return uiValues.includes(localUiFilter);
	});

	if (!filtered.length) {
		const currentLabel = (uiLabels[localUiFilter] && uiLabels[localUiFilter].label) || "该";
		list.innerHTML = `<div class="local-tools-error">😕 没有「${currentLabel}」类型的工具</div>`;
		return;
	}

	list.innerHTML = filtered.map(({ project, index }, i) => {
		const name = escapeHtml(String(project.name || "未命名工具"));
		const author = project.author ? escapeHtml(String(project.author)) : "";
		const description = project.description ? escapeHtml(String(project.description)) : "";
		const platforms = Array.isArray(project.platforms) ? project.platforms : [];
		const platformBadges = platforms
			.map((platform) => `<span class="local-tool-platform">${escapeHtml(String(platform))}</span>`)
			.join("");
		const uiList = Array.isArray(project.ui) ? project.ui : [];
		const uiBadges = uiList
			.filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
			.map((value) => {
				const key = String(value).trim().toLowerCase();
				const meta = uiLabels[key];
				if (!meta) {
					return `<span class="local-tool-ui">${escapeHtml(String(value))}</span>`;
				}
				return `<span class="local-tool-ui local-tool-ui-${key}">${meta.emoji} ${meta.label}</span>`;
			})
			.join("");

		// GitHub Stars 徽章（无有效数据时不显示）
		const starsNum = Number(project.stars);
		const starsBadge = Number.isFinite(starsNum) && starsNum > 0
			? `<span class="local-tool-stars" title="GitHub Stars">${STAR_SVG}${starsNum.toLocaleString("en-US")}</span>`
			: "";

		return `
			<div class="local-tool-card" style="animation-delay: ${Math.min(i, 8) * 40}ms">
				<div class="local-tool-head">
					<span class="local-tool-name">${name}</span>
					${author ? `<span class="local-tool-author">@${author}</span>` : ""}
					${starsBadge}
				</div>
				<div class="local-tool-desc">${description}</div>
				${(uiBadges || platformBadges) ? `<div class="local-tool-platforms">${uiBadges}${platformBadges}</div>` : ""}
				<div class="local-tool-actions">
					<button type="button" class="local-tool-github" onclick="openLocalToolGitHub(${index})">
						🔗 前往 GitHub
					</button>
				</div>
			</div>`;
	}).join("");
}

// 设置本地优选工具类型筛选（白名单：all/webui/gui/cli）
function setLocalUiFilter(type) {
	if (type !== "all" && type !== "webui" && type !== "gui" && type !== "cli") return;
	localUiFilter = type;

	const filterButtons = document.querySelectorAll("#localUiFilter .local-ui-filter-btn");
	filterButtons.forEach((button) => {
		button.classList.toggle("is-active", button.dataset.ui === localUiFilter);
	});

	const list = document.getElementById("localOptimizeToolList");
	if (list) renderLocalOptimizeTools(list, localOptimizeProjects);
}

// 在新窗口打开所选工具的 GitHub 仓库
function openLocalToolGitHub(index) {
	const project = localOptimizeProjects[index];
	if (!project || !project.url) {
		showOptimizeToast("未找到该工具的 GitHub 地址");
		return;
	}
	window.open(project.url, "_blank", "noopener");
}

// 并发拉取 RAW 资源，原始链接与镜像谁先返回用谁（单个候选 10 秒超时）
async function fetchWithAutoMirror(originalUrl, description = "资源") {
	const candidates = [{ url: originalUrl, label: "原始链接" }];
	if (originalUrl.startsWith(RAW_GITHUB_PREFIX)) {
		RAW_MIRROR_DOMAINS.forEach((mirrorDomain, index) => {
			candidates.push({
				url: originalUrl.replace(RAW_GITHUB_PREFIX, mirrorDomain),
				label: `备用镜像 ${index + 1}`
			});
		});
	}

	const controllers = candidates.map(() => new AbortController());
	let hasWinner = false;

	const requests = candidates.map((candidate, index) => (async () => {
		const controller = controllers[index];
		const timer = window.setTimeout(() => controller.abort(), 10000);
		try {
			const response = await fetch(candidate.url, {
				method: "GET",
				cache: "no-store",
				signal: controller.signal
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const text = await response.text();
			return { ...candidate, index, text };
		} catch (error) {
			if (!(hasWinner && error.name === "AbortError")) {
				console.warn(`[请求RAW] ❌ ${candidate.label}拉取失败: ${error.message}`);
			}
			throw error;
		} finally {
			window.clearTimeout(timer);
		}
	})());

	try {
		const winner = await Promise.any(requests);
		hasWinner = true;
		controllers.forEach((controller, index) => {
			if (index !== winner.index) controller.abort();
		});
		return winner.text;
	} catch (error) {
		const mirrorCount = Math.max(candidates.length - 1, 0);
		throw new Error(
			mirrorCount > 0
				? `${description}拉取失败，已尝试原始链接和全部${mirrorCount}个备用镜像`
				: `${description}拉取失败，原始链接不可用`
		);
	}
}

async function detectStack(family, host) {
	const { endpoint, data } = await fetchJsonFromFastestEndpoint(buildDetectEndpoints(family, host), "ip.json", 6500);
	const allowed = data.country === "CN";
	return {
		status: "done",
		allowed,
		endpoint,
		ip: data.ip || "",
		ipType: data.ipType || family,
		country: data.country || "未知",
		cnIspCode: data.cnIspCode || "",
		preferredType: preferredTypeFromCnIspCode(data.cnIspCode),
		colo: data.colo || "",
		asn: data.asn || "",
		raw: data
	};
}

async function loadLocations() {
	const endpoints = [];
	if (state.ipv4 && state.network.ipv4 && state.network.ipv4.endpoint) endpoints.push(state.network.ipv4.endpoint);
	if (state.ipv6 && state.network.ipv6 && state.network.ipv6.endpoint) endpoints.push(state.network.ipv6.endpoint);

	try {
		const { data: locations } = await fetchJsonFromFastestEndpoint([...new Set(endpoints)], "locations", 8000);
		if (!Array.isArray(locations)) throw new Error("locations 响应格式无效");
		state.locations = locations;
		state.locationsByIata = new Map(
			locations
				.filter((item) => item && item.iata)
				.map((item) => [String(item.iata).toUpperCase(), item])
		);
	} catch (error) {
		state.locations = [];
		state.locationsByIata = new Map();
	}
}

function renderNetworkCard(family, info) {
	const card = family === "ipv4" ? els.ipv4Card : els.ipv6Card;
	const value = family === "ipv4" ? els.ipv4Value : els.ipv6Value;
	const tag = family === "ipv4" ? els.ipv4Tag : els.ipv6Tag;
	const note = card.querySelector(".network-note");
	card.classList.remove("is-loading", "is-ok", "is-failed", "is-unavailable");

	if (!info || info.status === "loading") {
		card.classList.remove("is-hidden");
		card.classList.add("is-loading");
		value.textContent = "检测中";
		if (note) note.textContent = "识别线路";
		tag.className = "tag idle";
		tag.textContent = "等待";
		return;
	}

	if (info.status === "failed") {
		card.classList.remove("is-hidden");
		card.classList.add("is-failed");
		value.textContent = "不具备优选条件";
		if (note) note.textContent = "线路不可用";
		tag.className = "tag bad";
		tag.textContent = "未就绪";
		return;
	}

	if (!info.allowed) {
		card.classList.add("is-hidden");
		card.classList.add("is-unavailable");
		value.textContent = "不可用";
		if (note) note.textContent = "非CN网络";
		tag.className = "tag bad";
		tag.textContent = info.country || "非CN";
		return;
	}

	card.classList.remove("is-hidden");
	card.classList.add("is-ok");
	value.textContent = maskIpForDisplay(info.ip, info.ipType || family);
	if (note) note.textContent = info.preferredType || preferredTypeFromCnIspCode(info.cnIspCode);
	tag.className = "tag ok";
	tag.textContent = `${info.country || "未知"} · ${String(info.cnIspCode || "unknown").toUpperCase()}`;
}

function maskIpForDisplay(ip, family) {
	if (!ip) return "未获取";
	if (family === "ipv6") return maskIpv6ForDisplay(ip);
	return maskIpv4ForDisplay(ip);
}

function maskIpv4ForDisplay(ip) {
	const parts = ip.split(".");
	if (parts.length !== 4) return "已脱敏";
	return `${parts[0]}.***.**.${parts[3]}`;
}

function maskIpv6ForDisplay(ip) {
	const normalized = normalizeIpv6(ip);
	if (!normalized) return "已脱敏";
	const groups = expandIpv6Groups(normalized);
	if (!groups) return "已脱敏";
	return `${groups[0]}:****:****:${groups[7]}`;
}

function updateServiceStatus() {
	const available = availableFamilies();
	if (available.length === 0) {
		els.latencyStatus.textContent = "网络不可用";
		return;
	}

	els.latencyStatus.textContent = "等待优选";
}

function availableFamilies() {
	const list = [];
	if (state.ipv4) list.push("ipv4");
	if (state.ipv6) list.push("ipv6");
	return list;
}

function updateActionAvailability() {
	const hasService = availableFamilies().length > 0;
	const latencyActive = Boolean(state.latencyRun);
	els.latencyBtn.disabled = state.networkChecking || (!hasService && !latencyActive);
}

async function importCfDomains() {
	els.domainImportBtn.disabled = true;
	const original = els.domainImportBtn.innerHTML;
	els.domainImportBtn.textContent = "导入中";
	try {
		const response = await fetchWithTimeout(`/cf_domains.txt?_t=${Date.now()}`, { method: "GET", timeout: 20000 });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const text = await response.text();
		const lines = text.split(/\r\n|\r|\n/).map(cleanInputLine).filter(Boolean);
		if (!lines.length) throw new Error("cf_domains.txt 内容为空");
		els.ipInput.value = lines.join("\n");
		updateEditorMeta();
		els.latencyStatus.textContent = `已导入 CF域名（${lines.length} 行）`;
	} catch (error) {
		els.latencyStatus.textContent = `导入失败：${friendlyError(error)}`;
	} finally {
		els.domainImportBtn.innerHTML = original;
		els.domainImportBtn.disabled = false;
	}
}

function updateEditorMeta() {
	const value = els.ipInput.value;
	const lines = value.length ? value.split(/\r\n|\r|\n/).length : 0;
	els.lineCount.textContent = `${lines} 行`;
	const displayLines = Math.max(1, lines);
	els.lineNumbers.textContent = Array.from({ length: displayLines }, (_, index) => index + 1).join("\n");
	const visibleLines = Math.ceil((els.ipInput.clientHeight || 360) / 22) + 2;
	const shadeLines = Math.max(displayLines, visibleLines);
	els.lineShades.innerHTML = Array.from({ length: shadeLines }, () => '<div class="shade-line"></div>').join("");
	syncEditorScroll();
}

function syncEditorScroll() {
	const scrollTop = els.ipInput.scrollTop;
	const offset = `translate3d(0, ${-scrollTop}px, 0)`;
	els.lineNumbers.style.transform = offset;
	els.lineShades.style.transform = offset;
}

async function startLatencyRun() {
	const settings = readSettings();
	let candidates;
	try {
		candidates = prepareCandidates(els.ipInput.value, settings.port);
	} catch (error) {
		const message = friendlyError(error);
		els.latencyStatus.textContent = message;
		els.latencyBtn.innerHTML = `${svgPulseIcon()}优选延迟`;
		showOptimizeToast(message);
		return;
	}

	els.ipInput.value = candidates.join("\n");
	updateEditorMeta();
	state.results = [];
	state.selectedIds.clear();
	state.nextResultId = 1;
	state.sort = { key: "latency", dir: "asc" };
	resetResultFilters();
	renderResults();

	const run = {
		stopped: false,
		controllers: new Set(),
		completed: 0,
		total: candidates.length
	};
	state.latencyRun = run;
	els.latencyBtn.classList.add("danger");
	els.latencyBtn.innerHTML = `${svgStopIcon()}停止优选`;
	els.latencyStatus.textContent = `正在优选 ${candidates.length} 个地址`;
	setProgress(0, candidates.length);
	updateActionAvailability();

	await runPool(candidates, settings.threads, async (address) => {
		if (run.stopped) return;
		try {
			const result = await testLatency(address, settings.timeout, run);
			if (result && !run.stopped) {
				result.id = state.nextResultId++;
				state.results.push(result);
				state.results.sort((a, b) => a.latency - b.latency);
				renderResults();
			}
		} catch (error) {
			// Unavailable addresses are intentionally skipped from the result list.
		} finally {
			run.completed += 1;
			setProgress(run.completed, run.total);
		}
	}, run);

	if (run.stopped) {
		els.latencyStatus.textContent = `已停止，保留 ${state.results.length} 个结果`;
	} else {
		els.latencyStatus.textContent = `优选完成，${state.results.length} 个可用`;
	}
	state.latencyRun = null;
	els.latencyBtn.classList.remove("danger");
	els.latencyBtn.innerHTML = `${svgPulseIcon()}优选延迟`;
	updateActionAvailability();
	renderResults();
}

function stopLatencyRun() {
	const run = state.latencyRun;
	if (!run) return;
	run.stopped = true;
	for (const controller of run.controllers) controller.abort();
	els.latencyStatus.textContent = "正在停止优选";
}

async function testLatency(address, timeout, run) {
	const parsed = parseProbeTarget(address);
	if (!parsed) throw new Error("地址格式无效");
	const url = buildTraceUrl(parsed.host, parsed.port);

	const started = performance.now();
	const response = await fetchWithTimeout(url, { method: "GET", timeout, run });
	if (!response.ok) throw new Error("GET 不可用");
	const text = await response.text();
	const latency = Math.max(1, Math.round(performance.now() - started));
	if (latency > timeout) throw new Error("延迟超过超时时间");

	const trace = parseCfTrace(text);
	if (!isQualifiedTraceDomain(trace, parsed.host)) throw new Error("非合格优选域名");

	return {
		address,
		host: parsed.host,
		port: parsed.port,
		type: "优选域名",
		country: countryFromColo(trace.colo),
		latency,
		ipType: traceFamilyFromIp(trace.ip),
		responseIp: trace.ip || "",
		colo: trace.colo || "",
		raw: trace
	};
}

function preferredTypeFromCnIspCode(cnIspCode) {
	const normalizedCode = normalizeCnIspCode(cnIspCode);
	const typeMap = {
		ct: "电信优选",
		cu: "联通优选",
		cmcc: "移动优选"
	};
	return typeMap[normalizedCode] || "官方优选";
}

function normalizeCnIspCode(value) {
	return String(value || "").trim().toLowerCase();
}

function countryFromColo(colo) {
	if (!colo) return "未知";
	const match = state.locationsByIata.get(String(colo).toUpperCase());
	return match && match.cca2 ? match.cca2 : "未知";
}

function buildTraceUrl(host, port) {
	const portSuffix = port && port !== 443 ? `:${port}` : "";
	return `https://${host}${portSuffix}/cdn-cgi/trace?_t=${Date.now()}`;
}

function parseCfTrace(text) {
	const trace = {};
	String(text || "").split(/\r\n|\r|\n/).forEach((line) => {
		const eq = line.indexOf("=");
		if (eq <= 0) return;
		trace[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
	});
	return trace;
}

function isQualifiedTraceDomain(trace, requestedHost) {
	if (String(trace.h || "").toLowerCase() !== String(requestedHost).toLowerCase()) return false;
	if (trace.ip !== state.ipv4 && trace.ip !== state.ipv6) return false;
	if (String(trace.loc || "").toUpperCase() !== "CN") return false;
	return true;
}

function traceFamilyFromIp(ip) {
	return String(ip || "").includes(":") ? "ipv6" : "ipv4";
}

function parseProbeTarget(address) {
	const text = String(address || "").trim();
	if (!text || /^\d{1,5}$/.test(text)) return null;

	const bracketed = text.match(/^\[(.+)]:(\d{1,5})$/);
	if (bracketed) {
		const port = Number(bracketed[2]);
		if (port < 1 || port > 65535) return null;
		return { host: bracketed[1], port };
	}

	const lastColon = text.lastIndexOf(":");
	if (lastColon > 0) {
		const host = text.slice(0, lastColon);
		const portText = text.slice(lastColon + 1);
		if (/^\d{1,5}$/.test(portText) && !host.includes(":")) {
			const port = Number(portText);
			if (port >= 1 && port <= 65535) return { host, port };
		}
	}

	return { host: text, port: 443 };
}

function renderResults() {
	const rows = getVisibleSortedResults();
	const hasActiveFilter = hasActiveResultFilters();
	els.resultCount.textContent = hasActiveFilter
		? `${rows.length} / ${state.results.length} 个可用`
		: `${state.results.length} 个可用`;
	renderSortMarks();
	renderFilterHeaderState();
	syncOpenResultFilterMenu();
	syncSelectionWithResults();
	if (!state.results.length || !rows.length) {
		els.resultBody.innerHTML = `<tr><td class="empty" colspan="6">${state.results.length ? "筛选后暂无结果" : "暂无结果"}</td></tr>`;
		updateSelectionState();
		updateActionAvailability();
		return;
	}

	els.resultBody.innerHTML = rows.map(({ item }) => {
		const id = String(item.id);
		const selected = state.selectedIds.has(id);
		const safeAddress = escapeHtml(item.address);
		return `<tr class="result-row${selected ? " is-selected" : ""}" data-result-id="${escapeHtml(id)}">
		  <td class="selection-cell"><input type="checkbox" data-select-id="${escapeHtml(id)}" aria-label="选择 ${safeAddress}" ${selected ? "checked" : ""}></td>
		  <td class="ip-cell"><button class="copy-address-btn" type="button" data-copy-address="${safeAddress}" title="点击复制" aria-label="复制 ${safeAddress}">${safeAddress}</button></td>
		  <td>${escapeHtml(item.type)}</td>
		  <td>${renderCountryCell(item.country)}</td>
		  <td>${escapeHtml(item.colo || "未知")}</td>
		  <td>${item.latency}ms</td>
		</tr>`;
	}).join("");
	updateSelectionState();
	updateActionAvailability();
}

function syncSelectionWithResults() {
	const validIds = new Set();
	state.results.forEach((item) => {
		if (!item.id) item.id = state.nextResultId++;
		validIds.add(String(item.id));
	});
	for (const id of [...state.selectedIds]) {
		if (!validIds.has(id)) state.selectedIds.delete(id);
	}
}

function updateSelectionState() {
	const visibleIds = visibleResultIds();
	const total = visibleIds.length;
	const selected = state.selectedIds.size;
	const visibleSelected = visibleIds.filter((id) => state.selectedIds.has(id)).length;
	els.selectionStatus.textContent = `已选 ${selected} 个`;
	const hasResults = state.results.length > 0;
	els.copyResultsBtn.disabled = !hasResults;
	els.exportTxtBtn.disabled = !hasResults;
	els.exportCsvBtn.disabled = !hasResults;
	els.invertSelectBtn.disabled = total === 0;
	els.clearSelectBtn.disabled = selected === 0 && !hasActiveResultFilters();
	els.selectAllHeader.disabled = total === 0;
	els.selectAllHeader.checked = total > 0 && visibleSelected === total;
	els.selectAllHeader.indeterminate = visibleSelected > 0 && visibleSelected < total;
}

function startResultSelectionDrag(event) {
	if (event.button !== 0) return;
	const row = event.target.closest("[data-result-id]");
	if (!row || !els.resultBody.contains(row)) return;
	if (isInteractiveResultTarget(event.target)) return;

	event.preventDefault();
	state.resultSelectionDrag = {
		active: true,
		toggledIds: new Set(),
		lastRow: null
	};
	document.body.classList.add("is-result-dragging");
	toggleResultRowDuringDrag(row);
}

function continueResultSelectionDrag(event) {
	const drag = state.resultSelectionDrag;
	if (!drag || !drag.active) return;
	if ((event.buttons & 1) !== 1) {
		finishResultSelectionDrag();
		return;
	}

	const row = event.target.closest("[data-result-id]");
	if (!row || !els.resultBody.contains(row)) return;
	toggleResultRowDuringDrag(row);
}

function finishResultSelectionDrag() {
	const drag = state.resultSelectionDrag;
	if (!drag || !drag.active) return;
	drag.active = false;
	document.body.classList.remove("is-result-dragging");
	state.suppressResultClick = true;
	window.setTimeout(() => {
		state.suppressResultClick = false;
	}, 0);
}

function toggleResultRowDuringDrag(row) {
	const drag = state.resultSelectionDrag;
	if (!drag || !drag.active) return;
	const rows = Array.from(els.resultBody.querySelectorAll("[data-result-id]"));
	const currentIndex = rows.indexOf(row);
	const lastIndex = drag.lastRow ? rows.indexOf(drag.lastRow) : -1;

	if (currentIndex !== -1 && lastIndex !== -1) {
		const start = Math.min(currentIndex, lastIndex);
		const end = Math.max(currentIndex, lastIndex);
		for (let index = start; index <= end; index += 1) {
			toggleSingleResultRowDuringDrag(rows[index]);
		}
	} else {
		toggleSingleResultRowDuringDrag(row);
	}
	drag.lastRow = row;
}

function toggleSingleResultRowDuringDrag(row) {
	const drag = state.resultSelectionDrag;
	if (!drag || !drag.active || !row) return;
	const id = row.dataset.resultId;
	if (!id || drag.toggledIds.has(id)) return;

	const selected = !state.selectedIds.has(String(id));
	if (selected) {
		state.selectedIds.add(String(id));
	} else {
		state.selectedIds.delete(String(id));
	}
	drag.toggledIds.add(id);
	applyResultRowSelection(row, selected);
	updateSelectionState();
}

function applyResultRowSelection(row, selected) {
	row.classList.toggle("is-selected", selected);
	const checkbox = row.querySelector("[data-select-id]");
	if (checkbox) checkbox.checked = selected;
}

function isInteractiveResultTarget(target) {
	return Boolean(target.closest("button, input, select, textarea, a, label"));
}

function setResultSelected(id, selected) {
	if (!id) return;
	if (selected) {
		state.selectedIds.add(String(id));
	} else {
		state.selectedIds.delete(String(id));
	}
	renderResults();
}

function toggleResultSelected(id) {
	if (!id) return;
	setResultSelected(id, !state.selectedIds.has(String(id)));
}

function selectAllResults() {
	getVisibleSortedResults().forEach(({ item }) => state.selectedIds.add(String(item.id)));
	renderResults();
}

function invertSelectedResults() {
	getVisibleSortedResults().forEach(({ item }) => {
		const id = String(item.id);
		if (state.selectedIds.has(id)) {
			state.selectedIds.delete(id);
		} else {
			state.selectedIds.add(id);
		}
	});
	renderResults();
}

function clearSelectedResults() {
	state.selectedIds.clear();
	renderResults();
}

function resetResultSelection() {
	state.selectedIds.clear();
	resetResultFilters();
	renderResults();
}

function selectedResults() {
	return state.results.filter((item) => state.selectedIds.has(String(item.id)));
}

function formatResultLine(item) {
	const host = String(item.address || "").replace(/:\d+$/, "");
	return `${item.address}#${item.country} ${item.type}[${host} ${item.latency}ms]`;
}

function selectedResultLines() {
	const lines = selectedResults().map(formatResultLine).filter(Boolean);
	if (!lines.length) {
		els.selectionStatus.textContent = "请先勾选结果";
		return null;
	}
	return lines;
}

async function copySelectedResultsToClipboard() {
	const lines = selectedResultLines();
	if (!lines) return;
	try {
		await writeClipboardText(lines.join("\n"));
		els.selectionStatus.textContent = `已复制 ${lines.length} 个`;
	} catch (error) {
		els.selectionStatus.textContent = "复制失败";
	}
}

function exportSelectedResultsTxt() {
	const lines = selectedResultLines();
	if (!lines) return false;
	downloadTextFile(`bestcf-domains-${timestampForFilename()}.txt`, lines.join("\n"), "text/plain;charset=utf-8");
	els.selectionStatus.textContent = `已导出 ${lines.length} 个`;
	return true;
}

function exportOptimizeResultsCsv() {
	const rows = getSortedResults().map(({ item }) => item);
	if (!rows.length) {
		els.selectionStatus.textContent = "暂无可导出的结果";
		return false;
	}

	const header = ["优选域名", "IP类型", "优选类型", "国家/地区", "数据中心", "延迟(ms)"];
	const csvRows = rows.map((item) => [
		item.address || "",
		item.ipType || "未知",
		item.type || "",
		item.country || "未知",
		item.colo || "未知",
		Number.isFinite(item.latency) ? item.latency : ""
	]);
	const csv = [header, ...csvRows].map(formatCsvRow).join("\r\n");
	downloadTextFile(`bestcf-results-${timestampForFilename()}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
	els.selectionStatus.textContent = `已导出 ${rows.length} 个`;
	return true;
}

function formatCsvRow(row) {
	return row.map(formatCsvCell).join(",");
}

function formatCsvCell(value) {
	const text = String(value === null || value === undefined ? "" : value);
	const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
	return /[",\r\n]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText;
}

function timestampForFilename() {
	const date = new Date();
	const pad = (value) => String(value).padStart(2, "0");
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate())
	].join("") + "-" + [
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds())
	].join("");
}

function downloadTextFile(filename, content, mimeType) {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.style.display = "none";
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function copyResultAddress(address, anchor) {
	if (!address) return;
	try {
		await writeClipboardText(address);
		showCopyAddressTip(anchor, "已复制到粘贴板");
	} catch (error) {
		showCopyAddressTip(anchor, "复制失败");
	}
}

async function writeClipboardText(text) {
	if (navigator.clipboard && window.isSecureContext) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.left = "-9999px";
	textarea.style.top = "0";
	document.body.appendChild(textarea);
	textarea.select();
	const copied = document.execCommand("copy");
	textarea.remove();
	if (!copied) throw new Error("copy failed");
}

function showCopyAddressTip(anchor, message) {
	if (!anchor) return;
	document.querySelectorAll(".copy-address-tip").forEach((tip) => tip.remove());
	const rect = anchor.getBoundingClientRect();
	const tip = document.createElement("div");
	tip.className = "copy-address-tip";
	tip.textContent = message;
	tip.style.left = `${rect.left + rect.width / 2}px`;
	tip.style.top = `${rect.top}px`;
	document.body.appendChild(tip);
	window.setTimeout(() => tip.remove(), 1500);
}

let optimizeToastTimer = 0;
function showOptimizeToast(message) {
	let toast = document.querySelector(".optimize-toast");
	if (!toast) {
		toast = document.createElement("div");
		toast.className = "optimize-toast";
		toast.setAttribute("role", "status");
		toast.setAttribute("aria-live", "polite");
		document.body.appendChild(toast);
	}

	toast.textContent = message;
	window.clearTimeout(optimizeToastTimer);
	requestAnimationFrame(() => toast.classList.add("is-visible"));
	optimizeToastTimer = window.setTimeout(() => {
		toast.classList.remove("is-visible");
	}, 3600);
}

function setResultSort(key) {
	if (state.sort.key === key) {
		state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
	} else {
		state.sort = { key, dir: "asc" };
	}
	renderResults();
}

function renderSortMarks() {
	document.querySelectorAll("[data-sort-mark]").forEach((mark) => {
		mark.textContent = mark.dataset.sortMark === state.sort.key
			? (state.sort.dir === "asc" ? "▲" : "▼")
			: "";
	});
}

function renderFilterHeaderState() {
	document.querySelectorAll("[data-filter-key]").forEach((label) => {
		const key = label.dataset.filterKey;
		label.classList.toggle("is-filtered", isResultFilterActive(key));
		label.classList.toggle("is-active", state.openResultFilterKey === key);
		label.title = isResultFilterActive(key)
			? `${RESULT_FILTER_LABELS[key] || "字段"} 已筛选`
			: `筛选 ${RESULT_FILTER_LABELS[key] || "字段"}`;
	});
}

function toggleResultFilterMenu(key, anchor) {
	if (!RESULT_FILTER_KEYS.includes(key)) return;
	const currentMenu = document.querySelector(".result-filter-menu");
	if (state.openResultFilterKey === key && currentMenu) {
		closeResultFilterMenu();
		return;
	}
	openResultFilterMenu(key, anchor);
}

function openResultFilterMenu(key, anchor) {
	closeResultFilterMenu({ keepKey: true });
	state.openResultFilterKey = key;
	const options = resultFilterOptions(key);
	const values = options.map((option) => option.value);
	const selectedValues = selectedResultFilterValues(key, values);
	const menu = document.createElement("div");
	menu.className = "result-filter-menu";
	menu.dataset.filterMenuKey = key;
	menu.innerHTML = `
		<div class="result-filter-actions">
			<button class="result-filter-action" type="button" data-filter-action="all">全选</button>
			<button class="result-filter-action" type="button" data-filter-action="invert">反选</button>
		</div>
		<div class="result-filter-options">
			${options.map((option) => {
		const safeValue = escapeHtml(option.value);
		return `<label class="result-filter-option" title="${safeValue}">
					<input type="checkbox" data-filter-value="${safeValue}" ${selectedValues.has(option.value) ? "checked" : ""}>
					${renderResultFilterOptionText(key, option.value)}
					<span class="result-filter-option-count">(${option.count})</span>
				</label>`;
	}).join("") || '<div class="empty">暂无可筛选内容</div>'}
		</div>`;
	document.body.appendChild(menu);
	positionResultFilterMenu(menu, anchor);

	menu.addEventListener("click", (event) => event.stopPropagation());
	menu.querySelectorAll("[data-filter-action]").forEach((button) => {
		button.addEventListener("click", () => {
			const checkboxes = Array.from(menu.querySelectorAll("[data-filter-value]"));
			if (button.dataset.filterAction === "all") {
				checkboxes.forEach((checkbox) => { checkbox.checked = true; });
			} else {
				checkboxes.forEach((checkbox) => { checkbox.checked = !checkbox.checked; });
			}
			applyResultFilterMenuSelection(key, menu);
		});
	});
	menu.querySelectorAll("[data-filter-value]").forEach((checkbox) => {
		checkbox.addEventListener("change", () => applyResultFilterMenuSelection(key, menu));
	});
	renderFilterHeaderState();
}

function closeResultFilterMenu(options = {}) {
	document.querySelectorAll(".result-filter-menu").forEach((menu) => menu.remove());
	if (!options.keepKey) state.openResultFilterKey = "";
	renderFilterHeaderState();
}

function resetResultFilters() {
	state.resultFilters = {};
	closeResultFilterMenu();
}

function syncOpenResultFilterMenu() {
	if (!state.openResultFilterKey) return;
	const anchor = document.querySelector(`[data-filter-key="${cssEscape(state.openResultFilterKey)}"]`);
	if (!anchor) {
		closeResultFilterMenu();
		return;
	}
	openResultFilterMenu(state.openResultFilterKey, anchor);
}

function positionResultFilterMenu(menu, anchor) {
	const rect = anchor.getBoundingClientRect();
	const padding = 12;
	const width = menu.offsetWidth || 260;
	const height = menu.offsetHeight || 260;
	let left = rect.left;
	let top = rect.bottom + 6;
	if (left + width > window.innerWidth - padding) left = window.innerWidth - width - padding;
	if (top + height > window.innerHeight - padding) top = Math.max(padding, rect.top - height - 6);
	menu.style.left = `${Math.max(padding, left)}px`;
	menu.style.top = `${Math.max(padding, top)}px`;
}

function applyResultFilterMenuSelection(key, menu) {
	const values = resultFilterValues(key);
	const checkedValues = Array.from(menu.querySelectorAll("[data-filter-value]:checked"))
		.map((checkbox) => checkbox.dataset.filterValue);
	if (!checkedValues.length) {
		state.resultFilters[key] = new Set();
	} else if (checkedValues.length === values.length) {
		delete state.resultFilters[key];
	} else {
		state.resultFilters[key] = new Set(checkedValues);
	}
	renderResults();
}

function resultFilterValues(key) {
	return resultFilterOptions(key).map((option) => option.value);
}

function resultFilterOptions(key) {
	const countMap = new Map();
	state.results.forEach((item) => {
		const value = resultFilterValue(item, key);
		countMap.set(value, (countMap.get(value) || 0) + 1);
	});
	return Array.from(countMap.keys())
		.sort((a, b) => compareResultValue(a, b))
		.map((value) => ({ value, count: countMap.get(value) || 0 }));
}

function renderResultFilterOptionText(key, value) {
	if (key === "country") return renderCountryCell(value);
	return `<span class="result-filter-option-text">${escapeHtml(value)}</span>`;
}

function selectedResultFilterValues(key, values) {
	const filter = state.resultFilters[key];
	if (!filter) return new Set(values);
	return new Set(values.filter((value) => filter.has(value)));
}

function isResultFilterActive(key) {
	const values = resultFilterValues(key);
	const filter = state.resultFilters[key];
	return Boolean(filter && filter.size !== values.length);
}

function hasActiveResultFilters() {
	return RESULT_FILTER_KEYS.some(isResultFilterActive);
}

function resultMatchesFilters(item) {
	return RESULT_FILTER_KEYS.every((key) => {
		const filter = state.resultFilters[key];
		if (!filter) return true;
		return filter.has(resultFilterValue(item, key));
	});
}

function resultFilterValue(item, key) {
	if (key === "type") return String(item.type || "未知");
	if (key === "country") return String(item.country || "未知");
	if (key === "colo") return String(item.colo || "未知");
	return String(item[key] || "未知");
}

function getVisibleSortedResults() {
	return getSortedResults().filter(({ item }) => resultMatchesFilters(item));
}

function visibleResultIds() {
	return getVisibleSortedResults().map(({ item }) => String(item.id));
}

function cssEscape(value) {
	if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
	return String(value).replace(/["\\]/g, "\\$&");
}

function getSortedResults() {
	const direction = state.sort.dir === "asc" ? 1 : -1;
	return state.results
		.map((item, index) => ({ item, index }))
		.sort((a, b) => {
			const left = sortValue(a.item, state.sort.key);
			const right = sortValue(b.item, state.sort.key);
			const emptyCompared = compareEmptyValue(left, right);
			if (emptyCompared !== 0) return emptyCompared;
			const compared = compareResultValue(left, right);
			if (compared !== 0) return compared * direction;
			return a.index - b.index;
		});
}

function sortValue(item, key) {
	return item[key];
}

function compareResultValue(left, right) {
	if (typeof left === "number" && typeof right === "number") return left - right;
	return String(left).localeCompare(String(right), "zh-Hans-CN", { numeric: true, sensitivity: "base" });
}

function compareEmptyValue(left, right) {
	const leftEmpty = left === null || left === undefined || left === "";
	const rightEmpty = right === null || right === undefined || right === "";
	if (leftEmpty && rightEmpty) return 0;
	if (leftEmpty) return 1;
	if (rightEmpty) return -1;
	return 0;
}

function renderCountryCell(country) {
	const text = String(country || "未知").trim() || "未知";
	const countryCode = /^[a-zA-Z]{2}$/.test(text) ? text.toLowerCase() : "";
	const flag = countryCode
		? `<img class="country-flag" src="https://ipdata.co/flags/${countryCode}.png" alt="" loading="lazy" onerror="this.remove()">`
		: "";
	return `<span class="country-cell">${flag}<span class="country-code">${escapeHtml(text)}</span></span>`;
}

function prepareCandidates(rawText, preferredPort) {
	const lines = rawText
		.split(/\r\n|\r|\n/)
		.map(cleanInputLine)
		.filter(Boolean);

	if (!lines.length) throw new Error(CANDIDATE_INPUT_ERROR_MESSAGE);

	const fixed = [];
	const cidrs = [];
	const ranges = [];
	for (const line of lines) {
		if (line.includes("/")) {
			const cidr = parseCidr(line);
			if (cidr) cidrs.push(cidr);
			continue;
		}
		const range = parseIpRange(line);
		if (range) {
			ranges.push(range);
			continue;
		}
		const normalized = normalizeDomainCandidate(line, preferredPort) || normalizeAddress(line, preferredPort);
		if (normalized) fixed.push(normalized);
	}

	// 随机打乱固定IP、CIDR和范围列表，以确保每次选取的候选IP是随机且不同的
	for (let i = fixed.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[fixed[i], fixed[j]] = [fixed[j], fixed[i]];
	}
	for (let i = cidrs.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[cidrs[i], cidrs[j]] = [cidrs[j], cidrs[i]];
	}
	for (let i = ranges.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[ranges[i], ranges[j]] = [ranges[j], ranges[i]];
	}

	const candidates = [];
	const seen = new Set();
	const addCandidate = (address) => {
		if (!address || seen.has(address) || candidates.length >= CANDIDATE_LIMIT) return false;
		seen.add(address);
		candidates.push(address);
		return true;
	};

	fixed.forEach(addCandidate);

	if (cidrs.length && candidates.length < CANDIDATE_LIMIT) {
		let attempts = 0;
		const maxAttempts = Math.max(CANDIDATE_LIMIT * 12, cidrs.length * 8);
		while (candidates.length < CANDIDATE_LIMIT && attempts < maxAttempts) {
			const cidr = cidrs[attempts % cidrs.length];
			addCandidate(randomAddressFromCidr(cidr, preferredPort));
			attempts += 1;
		}
	}

	if (ranges.length && candidates.length < CANDIDATE_LIMIT) {
		let attempts = 0;
		const maxAttempts = Math.max(CANDIDATE_LIMIT * 12, ranges.length * 8);
		while (candidates.length < CANDIDATE_LIMIT && attempts < maxAttempts) {
			const range = ranges[attempts % ranges.length];
			addCandidate(randomAddressFromRange(range, preferredPort));
			attempts += 1;
		}
	}

	if (!candidates.length) throw new Error(CANDIDATE_INPUT_ERROR_MESSAGE);
	return candidates;
}

function cleanInputLine(line) {
	return line
		.replace(/：/g, ":")
		.replace(/#.*/, "")
		.replace(/[ 	]/g, "")
		.trim();
}

const DOMAIN_HOST_PATTERN = /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;

function normalizeDomainCandidate(line, preferredPort) {
	const lastColon = line.lastIndexOf(":");
	let host = line;
	let portText = "";
	if (lastColon > 0) {
		const maybeHost = line.slice(0, lastColon);
		const maybePort = line.slice(lastColon + 1);
		if (/^\d{1,5}$/.test(maybePort)) {
			host = maybeHost;
			portText = maybePort;
		}
	}
	if (!DOMAIN_HOST_PATTERN.test(host)) return null;
	const port = validPortOrDefault(portText, choosePort(preferredPort));
	return `${host}:${port}`;
}

function normalizeAddress(line, preferredPort) {
	const fallbackPort = choosePort(preferredPort);
	const bracketed = line.match(/^\[([0-9a-fA-F:.]+)](?::?(\d{1,5}))?$/);
	if (bracketed) {
		const ip = normalizeIpv6(bracketed[1]);
		if (!ip) return null;
		const port = validPortOrDefault(bracketed[2], fallbackPort);
		return `[${ip}]:${port}`;
	}

	const ipv4 = line.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/);
	if (ipv4 && isValidIpv4(ipv4[1])) {
		const port = validPortOrDefault(ipv4[2], fallbackPort);
		return `${ipv4[1]}:${port}`;
	}

	const ipv6Direct = normalizeIpv6(line);
	if (ipv6Direct) return `[${ipv6Direct}]:${fallbackPort}`;

	const lastColon = line.lastIndexOf(":");
	if (lastColon > 0) {
		const maybeIp = line.slice(0, lastColon);
		const maybePort = line.slice(lastColon + 1);
		const ip = normalizeIpv6(maybeIp);
		if (ip && /^\d{1,5}$/.test(maybePort)) {
			return `[${ip}]:${validPortOrDefault(maybePort, fallbackPort)}`;
		}
	}

	return null;
}

function parseIpRange(line) {
	const separator = line.indexOf("-");
	if (separator <= 0 || separator !== line.lastIndexOf("-")) return null;

	const startText = unwrapRangeIp(line.slice(0, separator));
	const endText = unwrapRangeIp(line.slice(separator + 1));

	const startIpv4 = ipv4ToBigInt(startText);
	const endIpv4 = ipv4ToBigInt(endText);
	if (startIpv4 !== null && endIpv4 !== null) {
		if (startIpv4 > endIpv4) return null;
		return { family: "ipv4", start: startIpv4, size: endIpv4 - startIpv4 + 1n };
	}

	const startIpv6 = ipv6ToBigInt(startText);
	const endIpv6 = ipv6ToBigInt(endText);
	if (startIpv6 !== null && endIpv6 !== null) {
		if (startIpv6 > endIpv6) return null;
		return { family: "ipv6", start: startIpv6, size: endIpv6 - startIpv6 + 1n };
	}

	return null;
}

function unwrapRangeIp(value) {
	const bracketed = value.match(/^\[([0-9a-fA-F:.]+)]$/);
	return bracketed ? bracketed[1] : value;
}

function parseCidr(line) {
	const parts = line.split("/");
	if (parts.length !== 2) return null;
	const prefix = Number(parts[1]);
	if (!Number.isInteger(prefix)) return null;

	if (parts[0].includes(".")) {
		const value = ipv4ToBigInt(parts[0]);
		if (value === null || prefix < 0 || prefix > 32) return null;
		const hostBits = 32 - prefix;
		const network = value & prefixMask(32, prefix);
		return { family: "ipv4", bits: 32, prefix, hostBits, network, size: 1n << BigInt(hostBits) };
	}

	const value = ipv6ToBigInt(parts[0]);
	if (value === null || prefix < 0 || prefix > 128) return null;
	const hostBits = 128 - prefix;
	const network = value & prefixMask(128, prefix);
	return { family: "ipv6", bits: 128, prefix, hostBits, network, size: 1n << BigInt(hostBits) };
}

function randomAddressFromCidr(cidr, preferredPort) {
	const value = cidr.network + randomBigIntBelow(cidr.size);
	const port = choosePort(preferredPort);
	if (cidr.family === "ipv4") return `${bigIntToIpv4(value)}:${port}`;
	return `[${bigIntToIpv6(value)}]:${port}`;
}

function randomAddressFromRange(range, preferredPort) {
	const value = range.start + randomBigIntBelow(range.size);
	const port = choosePort(preferredPort);
	if (range.family === "ipv4") return `${bigIntToIpv4(value)}:${port}`;
	return `[${bigIntToIpv6(value)}]:${port}`;
}

function isValidIpv4(ip) {
	const parts = ip.split(".");
	if (parts.length !== 4) return false;
	return parts.every((part) => {
		if (!/^\d{1,3}$/.test(part)) return false;
		const value = Number(part);
		return value >= 0 && value <= 255;
	});
}

function ipv4ToBigInt(ip) {
	if (!isValidIpv4(ip)) return null;
	return ip.split(".").reduce((acc, part) => (acc << 8n) + BigInt(Number(part)), 0n);
}

function bigIntToIpv4(value) {
	return [24n, 16n, 8n, 0n]
		.map((shift) => Number((value >> shift) & 255n))
		.join(".");
}

function normalizeIpv6(ip) {
	const value = ipv6ToBigInt(ip);
	return value === null ? null : bigIntToIpv6(value);
}

function expandIpv6Groups(ip) {
	const value = ipv6ToBigInt(ip);
	if (value === null) return null;
	const groups = [];
	for (let index = 7; index >= 0; index -= 1) {
		groups.push(Number((value >> BigInt(index * 16)) & 0xffffn).toString(16));
	}
	return groups;
}

function ipv6ToBigInt(ip) {
	if (!ip || /[^0-9a-fA-F:.]/.test(ip)) return null;
	if ((ip.match(/::/g) || []).length > 1) return null;

	const sides = ip.split("::");
	let left = sides[0] ? sides[0].split(":") : [];
	let right = sides.length === 2 && sides[1] ? sides[1].split(":") : [];
	if (sides.length === 1 && left.length !== 8) return null;
	if (sides.length === 2) {
		const fill = 8 - left.length - right.length;
		if (fill < 1) return null;
		left = [...left, ...Array(fill).fill("0"), ...right];
	}
	if (left.length !== 8) return null;

	let result = 0n;
	for (const group of left) {
		if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
		result = (result << 16n) + BigInt(parseInt(group, 16));
	}
	return result;
}

function bigIntToIpv6(value) {
	const groups = [];
	for (let index = 7; index >= 0; index -= 1) {
		groups.push(Number((value >> BigInt(index * 16)) & 0xffffn).toString(16));
	}

	let bestStart = -1;
	let bestLength = 0;
	for (let index = 0; index < groups.length;) {
		if (groups[index] !== "0") {
			index += 1;
			continue;
		}
		let end = index;
		while (end < groups.length && groups[end] === "0") end += 1;
		const length = end - index;
		if (length > bestLength && length > 1) {
			bestStart = index;
			bestLength = length;
		}
		index = end;
	}

	if (bestStart === -1) return groups.join(":");
	const before = groups.slice(0, bestStart).join(":");
	const after = groups.slice(bestStart + bestLength).join(":");
	if (!before && !after) return "::";
	if (!before) return `::${after}`;
	if (!after) return `${before}::`;
	return `${before}::${after}`;
}

function prefixMask(bits, prefix) {
	if (prefix === 0) return 0n;
	const all = (1n << BigInt(bits)) - 1n;
	const host = (1n << BigInt(bits - prefix)) - 1n;
	return all ^ host;
}

function randomBigIntBelow(max) {
	if (max <= 1n) return 0n;
	const bits = max.toString(2).length;
	const bytes = Math.ceil(bits / 8);
	const mask = (1n << BigInt(bits)) - 1n;
	const buffer = new Uint8Array(bytes);
	while (true) {
		crypto.getRandomValues(buffer);
		let value = 0n;
		for (const byte of buffer) value = (value << 8n) + BigInt(byte);
		value &= mask;
		if (value < max) return value;
	}
}

function choosePort(preferredPort) {
	if (preferredPort > 0) return preferredPort;
	return TLS_PORTS[Math.floor(Math.random() * TLS_PORTS.length)];
}

function validPortOrDefault(value, fallback) {
	if (!value) return fallback;
	const port = Number(value);
	return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : fallback;
}

function readSettings() {
	[els.timeoutInput, els.threadsInput].forEach((input) => clampNumberInput(input));
	return {
		timeout: Number(els.timeoutInput.value),
		threads: Number(els.threadsInput.value),
		port: Number(els.portSelect.value)
	};
}

function clampNumberInput(input) {
	const min = Number(input.min);
	const max = Number(input.max);
	const fallback = Number(input.defaultValue || min);
	let value = Number(input.value);
	if (!Number.isFinite(value)) value = fallback;
	value = Math.min(max, Math.max(min, Math.round(value)));
	input.value = String(value);
}

async function runPool(items, concurrency, worker, run) {
	let cursor = 0;
	const size = Math.min(Math.max(1, concurrency), items.length);
	const workers = Array.from({ length: size }, async () => {
		while (!run.stopped && cursor < items.length) {
			const index = cursor;
			cursor += 1;
			await worker(items[index], index);
		}
	});
	await Promise.all(workers);
}

async function fetchJson(url, timeout) {
	const response = await fetchWithTimeout(url, { method: "GET", timeout });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json();
}

async function fetchJsonFromFastestEndpoint(endpoints, path, timeout) {
	const bases = Array.from(new Set((Array.isArray(endpoints) ? endpoints : [endpoints]).filter(Boolean)));
	if (!bases.length) throw new Error("无可用检测地址");

	const run = { stopped: false, controllers: new Set() };
	let pending = bases.length;
	let lastError = null;

	return new Promise((resolve, reject) => {
		bases.forEach((endpoint) => {
			fetchJsonFromEndpoint(endpoint, path, timeout, run)
				.then((result) => {
					if (run.stopped) return;
					run.stopped = true;
					for (const controller of run.controllers) controller.abort();
					resolve(result);
				})
				.catch((error) => {
					if (run.stopped) return;
					lastError = error;
					pending -= 1;
					if (pending === 0) reject(lastError || new Error("检测失败"));
				});
		});
	});
}

async function fetchJsonFromEndpoint(endpoint, path, timeout, run) {
	const normalizedPath = String(path || "").replace(/^\/+/, "");
	const response = await fetchWithTimeout(`${endpoint}/${normalizedPath}?_t=${Date.now()}`, {
		method: "GET",
		timeout,
		run
	});
	if (response.status !== 200) throw new Error(`${endpoint} HTTP ${response.status}`);
	const data = await response.json();
	return { endpoint, data };
}

function fetchWithTimeout(url, { method = "GET", timeout = 8000, run = null } = {}) {
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), timeout);
	if (run) {
		run.controllers.add(controller);
		if (run.stopped) controller.abort();
	}
	return fetch(url, {
		method,
		cache: "no-store",
		signal: controller.signal
	}).finally(() => {
		window.clearTimeout(timer);
		if (run) run.controllers.delete(controller);
	});
}

function setProgress(done, total) {
	const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
	els.latencyProgress.style.width = `${percent}%`;
	els.progressText.textContent = `${done} / ${total}`;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function friendlyError(error) {
	if (!error) return "操作失败";
	if (error.name === "AbortError") return "请求超时或已停止";
	return error.message || "操作失败";
}
