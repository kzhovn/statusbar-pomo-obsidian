import { Modal, App } from 'obsidian';
import PomoTimer from '../main';

export class PomoStatsModal extends Modal {
    plugin: PomoTimer;

	constructor(app: App, plugin: PomoTimer) {
		super(app);
        this.plugin = plugin;
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText(`Total pomodoros completed: ${this.plugin.settings.totalPomosCompleted}`);
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}
}