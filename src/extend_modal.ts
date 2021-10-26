import { App, ButtonComponent, Modal } from "obsidian";
import PomoTimerPlugin from './main';

export async function confirmWithModal(
    app: App,
    text: string,
    plugin: PomoTimerPlugin,
    buttons: { cta: string; secondary: string } = {
        cta: "Yes",
        secondary: "No"
    }
): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const modal = new ExtendPomodoroModal(app, plugin, text, buttons);
        modal.onClose = () => {
            resolve(modal.confirmed);
        };
        modal.open();
    });
}

export class ExtendPomodoroModal extends Modal {
    constructor(
        app: App,
        plugin: PomoTimerPlugin,
        public text: string,
        public buttons: { cta: string; secondary: string }
    ) {
        super(app);
        this._plugin = plugin;
    }
    confirmed: boolean = false;
    _plugin: PomoTimerPlugin;

    async display() {
        new Promise((resolve) => {
            this.contentEl.empty();
            this.contentEl.addClass("confirm-modal");
            this.contentEl.createEl("p", {
                text: this.text
            });
            const buttonEl = this.contentEl.createDiv(
                "fantasy-calendar-confirm-buttons"
            );
            new ButtonComponent(buttonEl)
                .setButtonText(this.buttons.cta)
                .setCta()
                .onClick(() => {
                    this.confirmed = true;
                    this._plugin.timer.extendPomodoroTime = true;
                    this.close();
                });
            new ButtonComponent(buttonEl)
                .setButtonText(this.buttons.secondary)
                .onClick(() => {
                    this.close();
                });
        });
    }
    onOpen() {
        this.display();
    }
}