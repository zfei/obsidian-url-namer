import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, requestUrl, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
    mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    mySetting: 'default'
}

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    urlFetcher: UrlFetcher = new UrlFetcher();
    modal: SampleModal = new SampleModal(this.app);

    async onload() {
        await this.loadSettings();

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

        // This adds a complex command that can check whether the current state of the app allows execution of the command
        this.addCommand({
            id: 'open-sample-modal-complex',
            name: 'Open sample modal (complex)',
            checkCallback: (checking: boolean) => {
                // Conditions to check
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (markdownView) {
                    // If checking is true, we're simply "checking" if the command can be run.
                    // If checking is false, then we want to actually perform the operation.
                    if (!checking) {
                        new SampleModal(this.app).open();
                    }

                    // This command will only show up in Command Palette when the check function returns true
                    return true;
                }
            }
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new SampleSettingTab(this.app, this));

        // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
        // Using this function will automatically remove the event listener when this plugin is disabled.
        // this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
        //     console.log('click', evt);
        // });

        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        // this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SampleModal extends Modal {
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

class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'URL Namer Settings' });

        new Setting(containerEl)
            .setName('Setting #1')
            .setDesc('It\'s a secret')
            .addText(text => text
                .setPlaceholder('Enter your secret')
                .setValue(this.plugin.settings.mySetting)
                .onChange(async (value) => {
                    console.log('Secret: ' + value);
                    this.plugin.settings.mySetting = value;
                    await this.plugin.saveSettings();
                }));
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
