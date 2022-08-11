import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, requestUrl, Setting } from 'obsidian';

export default class MyPlugin extends Plugin {

    urlFetcher: UrlFetcher = new UrlFetcher();
    modal: MsgModal = new MsgModal(this.app);

    async onload() {
        this.addCommand({
            id: 'url-namer-selection',
            name: 'Name the selected URL',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                const selectedText = editor.getSelection();

                if (!this.urlFetcher.isValidUrl(selectedText)) {
                    new Notice(`${selectedText} is not a valid URL.`);
                    return;
                }

                this.urlFetcher.fetchTitle(selectedText)
                    .then(title => {
                        editor.replaceSelection(`[${title}](${selectedText})`);
                        new Notice(`Named the URL ${title}`);
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

    msg: string = 'Woah!';

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

class UrlFetcher {

    isValidUrl(s: string): boolean {
        try {
            new URL(s);
            return true;
        } catch (err) {
            return false;
        }
    };

    parseTitle(url: string, body: string): string {
        let match = url.includes('mp.weixin.qq.com') ?
            body.match(/<meta property="og:title" content="([^<]*)" \/>/im)
            : body.match(/<title>([^<]*)<\/title>/im);
        if (!match || typeof match[1] !== 'string') {
            throw new Error('Unable to parse the title tag');
        }
        console.log(match);
        return match[1];
    }

    async fetchTitle(url: string): Promise<string> {
        const res = await requestUrl({ url: url });
        const body = res.text;
        const title = this.parseTitle(url, body);
        console.log(title);
        return title;
    }

}
