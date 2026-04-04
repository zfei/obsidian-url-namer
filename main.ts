import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	requestUrl,
} from "obsidian";

interface UrlNamerSettings {
	autoNameUrlsOnPaste: boolean;
}

const DEFAULT_SETTINGS: UrlNamerSettings = {
	autoNameUrlsOnPaste: false,
};

export default class UrlNamer extends Plugin {
	settings: UrlNamerSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new UrlNamerSettingTab(this.app, this));
		this.registerPasteHandler();

		this.addCommand({
			id: "name-url-links-in-selection",
			name: "Name the URL links in the selected text",
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				this.nameUrlsInEditorSelection(editor, "selected text");
			},
		});
	}

	private registerPasteHandler() {
		this.registerEvent(
			this.app.workspace.on(
				"editor-paste",
				(evt: ClipboardEvent, editor: Editor) => {
					if (!this.settings.autoNameUrlsOnPaste) {
						return;
					}
					const pastedText = evt.clipboardData?.getData("text/plain");
					if (
						!pastedText ||
						!UrlTagger.containsRawUrl(pastedText)
					) {
						return;
					}

					evt.preventDefault();
					this.replaceTextWithNamedUrls(
						editor,
						pastedText,
						"pasted text",
					);
				},
			),
		);
	}

	private nameUrlsInEditorSelection(editor: Editor, sourceLabel: string) {
		const selectedText = editor.getSelection();
		if (!selectedText) {
			new Notice("No text selected.");
			return;
		}
		if (!UrlTagger.containsRawUrl(selectedText)) {
			new Notice("No raw links were found in the selected text.");
			return;
		}

		this.replaceTextWithNamedUrls(editor, selectedText, sourceLabel);
	}

	private replaceTextWithNamedUrls(
		editor: Editor,
		text: string,
		sourceLabel: string,
	) {
		const modal = new MsgModal(this.app);
		const loadingIndicator = new Notice(
			`Fetching titles for ${sourceLabel}...`,
			0,
		);

		UrlTagger.getTaggedText(text)
			.then((taggedText) => {
				editor.replaceSelection(taggedText);
			})
			.catch((e) => {
				const message = e instanceof Error ? e.message : String(e);
				modal.showMsg(message);
			})
			.finally(() => {
				loadingIndicator.hide();
			});
	}

	async loadSettings() {
		const loaded = (await this.loadData()) as Partial<UrlNamerSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(loaded ?? {}) };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MsgModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	msg: string;

	showMsg(theMsg: string) {
		this.msg = theMsg;
		this.open();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText(this.msg);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class UrlTagger {
	// Capture the preceding character (or empty string for start-of-line) in group 1,
	// and the URL in group 2. This avoids lookbehind assertions (unsupported on iOS < 16.4).
	static rawUrlPattern =
		/(^|[\s([])((?:https?:\/\/)?[a-zA-Z0-9]+[a-zA-Z0-9\-_.]*\.[a-z]{2,6}[^\s\])]*)/gim;
	static rawUrlDetectPattern =
		/(^|[\s([])((?:https?:\/\/)?[a-zA-Z0-9]+[a-zA-Z0-9\-_.]*\.[a-z]{2,6}[^\s\])]*)/im;

	static containsRawUrl(text: string): boolean {
		return UrlTagger.rawUrlDetectPattern.test(text);
	}

	static async getTaggedText(selectedText: string) {
		if (UrlTitleFetcher.isOffline()) {
			new Notice("You appear to be offline. Links were left unchanged.");
			return selectedText;
		}

		const promises: Promise<string>[] = [];

		selectedText.replace(
			UrlTagger.rawUrlPattern,
			(fullMatch, prefix: string, url: string, offset: number) => {
				if (UrlTagger.isAlreadyLinked(selectedText, offset, prefix)) {
					return fullMatch;
				}
				const { cleanUrl } = UrlTagger.splitTrailingPunctuation(url);
				promises.push(UrlTitleFetcher.getNamedUrlTag(cleanUrl));
				return fullMatch;
			},
		);

		const namedTags = await Promise.all(promises);

		new Notice(`Processed ${namedTags.length} urls.`);

		return selectedText.replace(
			UrlTagger.rawUrlPattern,
			(fullMatch, prefix: string, url: string, offset: number) => {
				if (UrlTagger.isAlreadyLinked(selectedText, offset, prefix)) {
					return fullMatch;
				}
				const { cleanUrl, trailingPunctuation } =
					UrlTagger.splitTrailingPunctuation(url);
				return prefix + (namedTags.shift() ?? cleanUrl) + trailingPunctuation;
			},
		);
	}

	private static splitTrailingPunctuation(url: string): {
		cleanUrl: string;
		trailingPunctuation: string;
	} {
		let end = url.length;
		while (end > 0 && ".,!?;:".includes(url.charAt(end - 1))) {
			end--;
		}
		return {
			cleanUrl: url.substring(0, end),
			trailingPunctuation: url.substring(end),
		};
	}

	// Returns true if the URL is already inside a Markdown link like [text](url)
	private static isAlreadyLinked(
		text: string,
		offset: number,
		prefix: string,
	): boolean {
		return prefix === "(" && text.charAt(offset - 1) === "]";
	}
}

class UrlNamerSettingTab extends PluginSettingTab {
	plugin: UrlNamer;

	constructor(app: App, plugin: UrlNamer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Auto-name links on paste")
			.setDesc(
				"When enabled, pasted plain-text links are converted to Markdown links with fetched page titles.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoNameUrlsOnPaste)
					.onChange(async (value) => {
						this.plugin.settings.autoNameUrlsOnPaste = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}

class UrlTitleFetcher {
	static htmlTitlePattern = /<title[^>]*>\s*([\s\S]*?)\s*<\/title>/im;
	static metaTagPattern = /<meta\b[^>]*>/gim;
	static metaAttrPattern =
		/([a-zA-Z_:][a-zA-Z0-9:._-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
	static offlineNoticeShown = false;

	static isOffline(): boolean {
		if (typeof navigator === "undefined") {
			return false;
		}
		return navigator.onLine === false;
	}

	static notifyOfflineOnce() {
		if (!this.offlineNoticeShown) {
			new Notice("You appear to be offline. Links were left unchanged.");
			this.offlineNoticeShown = true;
		}
	}

	static isValidUrl(s: string): boolean {
		try {
			new URL(s);
			return true;
		} catch {
			return false;
		}
	}

	static parseTitle(reqUrl: string, body: string): string {
		const titleMatch = body.match(this.htmlTitlePattern);
		if (titleMatch && typeof titleMatch[1] === "string") {
			const htmlTitle = titleMatch[1].trim();
			if (htmlTitle.length > 0) {
				return htmlTitle;
			}
		}

		const metaTitle = this.parseMetaTitle(body);
		if (metaTitle) {
			return metaTitle;
		}

		throw new Error(
			"Unable to parse title from <title>, og:title, or twitter:title",
		);
	}

	private static parseMetaTitle(body: string): string | null {
		const metaTags = body.match(this.metaTagPattern);
		if (!metaTags) {
			return null;
		}

		for (const metaTag of metaTags) {
			const attrs = new Map<string, string>();
			const matches = metaTag.matchAll(this.metaAttrPattern);
			for (const match of matches) {
				const key = match[1];
				if (!key) {
					continue;
				}
				const value = (match[2] ?? match[3] ?? match[4] ?? "").trim();
				if (value.length > 0) {
					attrs.set(key.toLowerCase(), value);
				}
			}

			const property = (
				attrs.get("property") ??
				attrs.get("name") ??
				""
			).toLowerCase();
			if (
				(property === "og:title" || property === "twitter:title") &&
				attrs.has("content")
			) {
				return attrs.get("content") ?? null;
			}
		}

		return null;
	}

	static async getNamedUrlTag(url: string): Promise<string> {
		if (this.isOffline()) {
			this.notifyOfflineOnce();
			return url;
		}

		this.offlineNoticeShown = false;
		const reqUrl = url.startsWith("http") ? url : `http://${url}`;

		if (!this.isValidUrl(reqUrl)) {
			new Notice(`${url} is not a valid URL.`);
			return url;
		}

		try {
			const res = await requestUrl({ url: reqUrl });
			if (res.status != 200) {
				throw new Error(`status code ${res.status}`);
			}

			const body = res.text;
			const title = this.parseTitle(reqUrl, body);
			return `[${title}](${url})`;
		} catch (error) {
			if (this.isOffline()) {
				this.notifyOfflineOnce();
				return url;
			}
			new Notice(`Error handling URL ${url}: ${String(error)}`);
			return url;
		}
	}
}
