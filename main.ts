import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, moment } from 'obsidian';

interface PomoSettings {
	pomo: number;
	shortBreak: number;
	longBreak: number;
	longBreakInterval: number;
	sessionsCompleted: number;
}

const DEFAULT_SETTINGS: PomoSettings = {
	pomo: 25,
	shortBreak: 5,
	longBreak: 15,
	longBreakInterval: 4,
	sessionsCompleted: 0
}

export default class PomoTimer extends Plugin {
	settings: PomoSettings;
	statusBar: HTMLElement; /*why is it an HTML element? what does this mean? */

	async onload() {
		console.log('Loading status bar pomo timer...');

		await this.loadSettings();

		/*this.addRibbonIcon('dice', 'Sample Plugin', () => {
			new Notice('This is a notice!');
		});*/

		/*this.addCommand({
			id: 'open-sample-modal',
			name: 'Open Sample Modal',
			// callback: () => {
			// 	console.log('Simple Callback');
			// },
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						new SampleModal(this.app).open();
					}
					return true;
				}
				return false;
			}
		});*/

		this.statusBar = this.addStatusBarItem();
		var startTime = moment()
		
		this.registerInterval(window.setInterval(() => 
			this.statusBar.setText(this.setStatusBarText(startTime)), 500));


		

		/*this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			console.log('codemirror', cm);
		});

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});*/

	}

	setStatusBarText(startTime): string {
		const secsSinceStart = moment().diff(startTime, "seconds")
		const secCountDown = (DEFAULT_SETTINGS.pomo * 60)- secsSinceStart
		const formatedCountDown = moment.utc(secCountDown * 1000).format("mm:ss") /*NOTE: this one works with times <60 minutes*/
		return formatedCountDown.toString()
	}

	onunload() {
		console.log('unloading plugin');
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

	onOpen() {
		let { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

/*
class SampleSettingTab extends PluginSettingTab {
	plugin: PomoTimer;

	constructor(app: App, plugin: PomoTimer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Settings for my awesome plugin.' });

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue('')
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.PomoSettings = value;
					await this.plugin.saveSettings();
				}));
	}
}*/
