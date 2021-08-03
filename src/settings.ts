import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { whiteNoiseUrl } from './audio_urls';
import PomoTimer from './main';

export interface PomoSettings {
	pomo: number;
	shortBreak: number;
	longBreak: number;
	longBreakInterval: number;
	notificationSound: boolean;
	logging: boolean;
	logToDaily: boolean;
	logFile: string;
	logText: string;
	logActiveNote: boolean;
	fancyStatusBar: boolean;
	whiteNoise: boolean;
}

export const DEFAULT_SETTINGS: PomoSettings = {
	pomo: 25,
	shortBreak: 5,
	longBreak: 15,
	longBreakInterval: 4,
	notificationSound: true,
	logging: false,
	logToDaily: false,
	logFile: "Pomodoro Log.md",
	logText: "[🍅] dddd, MMMM DD YYYY, h:mm A",
	logActiveNote: false,
	fancyStatusBar: false,
	whiteNoise: false,
}

export class PomoSettingTab extends PluginSettingTab {
	plugin: PomoTimer;

	constructor(app: App, plugin: PomoTimer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Status Bar Pomodoro Timer - Settings' });

	
		/**************  Timer settings **************/

		new Setting(containerEl)
			.setName('Pomodoro time (minutes)')
			.setDesc('Leave blank for default')
			.addText(text => text
				.setValue(this.plugin.settings.pomo.toString())
				.onChange(value => {
					this.plugin.settings.pomo = this.setTimerValue(value, 'pomo');
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Short break time (minutes)')
			.setDesc('Leave blank for default')
			.addText(text => text
				.setValue(this.plugin.settings.shortBreak.toString())
				.onChange(value => {
					this.plugin.settings.shortBreak = this.setTimerValue(value, 'shortBreak');
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Long break time (minutes)')
			.setDesc('Leave blank for default')
			.addText(text => text
				.setValue(this.plugin.settings.longBreak.toString())
				.onChange(value => {
					this.plugin.settings.longBreak = this.setTimerValue(value, 'longBreak');
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Long break interval')
			.setDesc('Number of pomos before a long break; leave blank for default')
			.addText(text => text
				.setValue(this.plugin.settings.longBreakInterval.toString())
				.onChange(value => {
					this.plugin.settings.longBreakInterval = this.setTimerValue(value, 'longBreakInterval');
					this.plugin.saveSettings();
				}));


		/**************  Sound settings **************/
			
		new Setting(containerEl)
			.setName('Notification sound')
			.setDesc('Play notification sound at the end of each pomodoro and break')
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.notificationSound)
					.onChange(value => {
						this.plugin.settings.notificationSound = value;
						this.plugin.saveSettings();
					}));

		new Setting(containerEl)
			.setName('White noise')
			.setDesc('Play white noise while timer is active')
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.whiteNoise)
					.onChange(value => {
						this.plugin.settings.whiteNoise = value;
						this.plugin.saveSettings();

						if (this.plugin.settings.whiteNoise === true) {
							this.plugin.whiteNoisePlayer = new Audio(whiteNoiseUrl);
							this.plugin.whiteNoise()
						} else { //if false, turn it off immediately
							this.plugin.stopWhiteNoise();
						}
					}));


		/**************  Logging settings **************/

		new Setting(containerEl)
			.setName('Logging')
			.setDesc('Enable a log of completed pomodoros')
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.logging)
					.onChange(async value => {
						this.plugin.settings.logging = value;
						this.plugin.saveSettings();
						this.display(); //force refresh
					}));

		//various logging settings; only show if logging is enabled (currently does not autohide, only)
		if (this.plugin.settings.logging === true) {

			new Setting(containerEl)
				.setName('Log file')
				.setDesc(`If file doesn't already exist, it will be created; leave blank for current file, ${this.plugin.settings.logFile}.`)
				.addText(text => text
					.setValue(this.plugin.settings.logFile.toString())
					.onChange(value => {
						this.plugin.settings.logFile = value;
						this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Timestamp Format')
				.setDesc('Specify format for the logtext using moment syntax')
				.addMomentFormat(text => text
					.setDefaultFormat(this.plugin.settings.logText)
					.onChange(value => {
						this.plugin.settings.logText = value;
						this.plugin.saveSettings();
					}));

			new Setting(containerEl)
			.setName('Log active note')
			.setDesc('In log, append wikilink pointing to the note that was active when you started the pomodoro')
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.logActiveNote)
					.onChange(value => {
						this.plugin.settings.logActiveNote = value;
						this.plugin.saveSettings();
					}));
		}
	}


	//sets the setting for the given timer to value if valid, default if empty, otherwise sends user error notice
	setTimerValue(value, timer_type: string): number {
		var timer_settings: number;
		var timer_default: number;

		switch (timer_type) {
			case ('pomo'): {
				timer_settings = this.plugin.settings.pomo;
				timer_default = DEFAULT_SETTINGS.pomo;
				break;
			}
			case ('shortBreak'): {
				timer_settings = this.plugin.settings.shortBreak;
				timer_default = DEFAULT_SETTINGS.shortBreak;
				break;
			}
			case ('longBreak'): {
				timer_settings = this.plugin.settings.longBreak;
				timer_default = DEFAULT_SETTINGS.longBreak;
				break;
			}
			case ('longBreakInterval'): {
				timer_settings = this.plugin.settings.longBreakInterval;
				timer_default = DEFAULT_SETTINGS.longBreakInterval;
				break;
			}
		}

		if (value === '') { //empty string -> reset to default
			return timer_default;
		} else if (!isNaN(Number(value)) && (Number(value) > 0)) { //if positive number, set setting
			return Number(value);
		} else { //invalid input
			new Notice('Please specify a valid number.');
			return timer_settings;
		}
	}
}
