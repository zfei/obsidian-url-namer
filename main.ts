import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, requestUrl, Setting } from 'obsidian';

export default class UrlNamer extends Plugin {

    modal: MsgModal = new MsgModal(this.app);

    async onload() {
        this.addCommand({
            id: 'url-namer-selection',
            name: 'Name the URL links in the selected text',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                UrlTagger.getTaggedText(editor.getSelection())
                    .then(taggedText => {
                        editor.replaceSelection(taggedText);
                    })
                    .catch(e => this.modal.showMsg(e.message));
            }
        });
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

    static rawUrlPattern = /(?<!\]\(\s*)(?<=\s|\(|\[|^)(?:https?:\/\/)?[a-zA-Z0-9]+[a-zA-Z0-9\-_.]*\.[a-z]{2,6}[^\s]*\b/gim;

    static async getTaggedText(selectedText: string) {
        const promises: any[] = [];

        selectedText.replace(UrlTagger.rawUrlPattern, match => {
            const promise = UrlTitleFetcher.getNamedUrlTag(match);
            promises.push(promise);
            return match;
        });

        const namedTags = await Promise.all(promises);

        new Notice(`Processed ${namedTags.length} urls.`);

        return selectedText.replace(UrlTagger.rawUrlPattern, () => namedTags.shift());
    }

}

class UrlTitleFetcher {

    static htmlTitlePattern = /<title>([^<]*)<\/title>/im;
    static wxTitlePattern = /<meta property="og:title" content="([^<]*)" \/>/im;

    static isValidUrl(s: string): boolean {
        try {
            new URL(s);
            return true;
        } catch (err) {
            return false;
        }
    };

    static parseTitle(url: string, body: string): string {
        let match = url.includes('mp.weixin.qq.com') ?
            body.match(this.wxTitlePattern)
            : body.match(this.htmlTitlePattern);

        if (!match || typeof match[1] !== 'string') {
            throw new Error('Unable to parse the title tag');
        }

        return match[1];
    }

    static async getNamedUrlTag(url: string): Promise<string> {
        const reqUrl = url.startsWith('http') ? url : `http://${url}`;

        if (!this.isValidUrl(reqUrl)) {
            new Notice(`${url} is not a valid URL.`);
            return url;
        }

        try {
            const res = await requestUrl({ url: reqUrl });
            const body = res.text;
            const title = this.parseTitle(url, body);
            return `[${title}](${url})`;
        } catch (error) {
            new Notice(`Error handling URL ${url}: ${error}`);
            return url;
        }
    }

}
