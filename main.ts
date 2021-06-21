import { Moment } from 'moment';
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

enum Mode {
	Pomo,
	ShortBreak,
	LongBreak,
	NoTimer
}

export default class PomoTimer extends Plugin {
	settings: PomoSettings;
	statusBar: HTMLElement; /*why is it an HTML element? what does this mean? */
	startTime: Moment;
	mode: Mode;

	async onload() {
		console.log('Loading status bar pomo timer...');

		await this.loadSettings();

		this.statusBar = this.addStatusBarItem();
		this.mode = Mode.NoTimer;

		this.addRibbonIcon('clock', 'Start pomo', () => {
			this.startTime = moment();
			this.mode = Mode.Pomo;
		});
		
		this.registerInterval(window.setInterval(() => 
			this.statusBar.setText(this.setStatusBarText()), 500));

	}

	setStatusBarText(): string {
		switch(this.mode) {
			case Mode.Pomo: {
				return this.getCountdownPomo();
			}
			case Mode.ShortBreak: {
				return "";
			}
			case Mode.ShortBreak: {
				return "";
			}
			case Mode.NoTimer: {
				return "";
			}

		}
	}

	getCountdownPomo(): string {
		const secsSinceStart = moment().diff(this.startTime, "seconds")
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
