import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { appHasDailyNotesPluginLoaded } from 'obsidian-daily-notes-interface';
import { whiteNoiseUrl } from './audio_urls';
import PomoTimerPlugin from './main';
import { WhiteNoise } from './white_noise';

export interface PomoSettings {
	pomo: number;
	shortBreak: number;
	longBreak: number;
	longBreakInterval: number;
	autostartTimer: boolean;
	numAutoCycles: number;
	ribbonIcon: boolean;
	notificationSound: boolean;
	backgroundNoiseFile: string;
	logging: boolean;
	logFile: string;
	logText: string;
	logToDaily: boolean;
	logActiveNote: boolean;
	logPomodoroDuration: boolean;
	fancyStatusBar: boolean;
	whiteNoise: boolean;
	showActiveNoteInTimer: boolean;
	allowExtendedPomodoro: boolean;
}

export const DEFAULT_SETTINGS: PomoSettings = {
	pomo: 25,
	shortBreak: 5,
	longBreak: 15,
	longBreakInterval: 4,
	autostartTimer: true,
	numAutoCycles: 0,
	ribbonIcon: true,
	notificationSound: true,
	backgroundNoiseFile: "",
	logging: false,
	logFile: "Pomodoro Log.md",
	logToDaily: false,
	logText: "[🍅] dddd, MMMM DD YYYY, h:mm A",
	logActiveNote: false,
	logPomodoroDuration: false,
	fancyStatusBar: false,
	whiteNoise: false,
	showActiveNoteInTimer: false,
	allowExtendedPomodoro: false,
}


export class PomoSettingTab extends PluginSettingTab {
	plugin: PomoTimerPlugin;

	constructor(app: App, plugin: PomoTimerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Status Bar Pomodoro Timer - Settings' });

	
		/**************  Timer settings **************/

		new Setting(containerEl)
			.setName("Pomodoro time (minutes)")
			.setDesc("Leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.pomo.toString())
				.onChange(value => {
					this.plugin.settings.pomo = setNumericValue(value, DEFAULT_SETTINGS.pomo, this.plugin.settings.pomo);
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Short break time (minutes)")
			.setDesc("Leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.shortBreak.toString())
				.onChange(value => {
					this.plugin.settings.shortBreak = setNumericValue(value, DEFAULT_SETTINGS.shortBreak, this.plugin.settings.shortBreak);
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Long break time (minutes)")
			.setDesc("Leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.longBreak.toString())
				.onChange(value => {
					this.plugin.settings.longBreak = setNumericValue(value, DEFAULT_SETTINGS.longBreak, this.plugin.settings.longBreak);
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Long break interval")
			.setDesc("Number of pomos before a long break; leave blank for default")
			.addText(text => text
				.setValue(this.plugin.settings.longBreakInterval.toString())
				.onChange(value => {
					this.plugin.settings.longBreakInterval = setNumericValue(value, DEFAULT_SETTINGS.longBreakInterval, this.plugin.settings.longBreakInterval);
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Sidebar icon")
			.setDesc("Toggle left sidebar icon. Restart Obsidian for the change to take effect")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.ribbonIcon)
					.onChange(value => {
						this.plugin.settings.ribbonIcon = value;
						this.plugin.saveSettings();
					}));

		new Setting(containerEl)
			.setName("Autostart timer")
			.setDesc("Start each pomodoro and break automatically. When off, click the sidebar icon on the left or use the toggle pause command to start the next timer")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.autostartTimer)
					.onChange(value => {
						this.plugin.settings.autostartTimer = value;
						this.plugin.saveSettings();
						this.display() //force refresh
					}));

		if (this.plugin.settings.autostartTimer === false) {
			new Setting(containerEl)
				.setName("Cycles before pause")
				.setDesc("Number of pomodoro + break cycles to run automatically before stopping. Default is 0 (stops after every pomodoro and every break)")
				.addText(text => text
					.setValue(this.plugin.settings.numAutoCycles.toString())
					.onChange(value => {
						this.plugin.settings.numAutoCycles = setNumericValue(value, DEFAULT_SETTINGS.numAutoCycles, this.plugin.settings.numAutoCycles);
						this.plugin.timer.cyclesSinceLastAutoStop = 0;
						this.plugin.saveSettings();
					}));
		}




		/**************  Sound settings **************/
			
		new Setting(containerEl)
			.setName("Notification sound")
			.setDesc("Play notification sound at the end of each pomodoro and break")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.notificationSound)
					.onChange(value => {
						this.plugin.settings.notificationSound = value;
						this.plugin.saveSettings();
					}));

		new Setting(containerEl)
			.setName("White noise")
			.setDesc("Play white noise while timer is active")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.whiteNoise)
					.onChange(value => {
						this.plugin.settings.whiteNoise = value;
						this.plugin.saveSettings();

						if (this.plugin.settings.whiteNoise === true) {
							this.plugin.timer.whiteNoisePlayer = new WhiteNoise(this.plugin, whiteNoiseUrl);
							this.plugin.timer.whiteNoisePlayer.whiteNoise();
						} else { //if false, turn it off immediately
							this.plugin.timer.whiteNoisePlayer.stopWhiteNoise();
						}

						this.display();
					}));


		/**************  Logging settings **************/

		new Setting(containerEl)
			.setName("Logging")
			.setDesc("Enable a log of completed pomodoros")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.logging)
					.onChange(value => {
						this.plugin.settings.logging = value;

						if (value === true) {
							this.plugin.openLogFileOnClick();
						} else {
							this.plugin.statusBar.removeClass("statusbar-pomo-logging");
						}

						this.plugin.saveSettings();
						this.display(); //force refresh
					}));

		//various logging settings; only show if logging is enabled (currently does not autohide, only)
		if (this.plugin.settings.logging === true) {

			new Setting(containerEl)
				.setName("Log file")
				.setDesc("If file doesn't already exist, it will be created")
				.addText(text => text
					.setValue(this.plugin.settings.logFile.toString())
					.onChange(value => {
						this.plugin.settings.logFile = value;
						this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName("Log to daily note")
				.setDesc("Logs to the end of today's daily note")
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.logToDaily)
					.onChange(value => {
						if (appHasDailyNotesPluginLoaded() === true) {
							this.plugin.settings.logToDaily = value;
						} else if (value === true) {
							this.plugin.settings.logToDaily = false;
							new Notice("Please enable daily notes plugin");
						}
						this.plugin.saveSettings();

					}));
	

			new Setting(containerEl)
				.setName("Timestamp Format")
				.setDesc("Specify format for the logtext using moment syntax")
				.addMomentFormat(text => text
					.setDefaultFormat(this.plugin.settings.logText)
					.onChange(value => {
						this.plugin.settings.logText = value;
						this.plugin.saveSettings();
					}));

			new Setting(containerEl)
			.setName("Log active note")
			.setDesc("In log, append link pointing to the note that was active when you started the pomodoro")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.logActiveNote)
					.onChange(value => {
						this.plugin.settings.logActiveNote = value;
						this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName("Log pomodoro duration")
				.setDesc("Log pomodoro duration in minutes in your active log file.")
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.logPomodoroDuration)
					.onChange(value => {
						this.plugin.settings.logPomodoroDuration = value;
						this.plugin.saveSettings();
					}));

			new Setting(containerEl)
			.setName("Show active note in status bar")
			.setDesc("In the status bar, show active note that pomodor was started in.")
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showActiveNoteInTimer)
					.onChange(value => {
						this.plugin.settings.showActiveNoteInTimer = value;
						this.plugin.saveSettings();
					}));
			new Setting(containerEl)
				.setName("Allow extended Pomodoro")
				.setDesc("Allow Extended Pomodoro")
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.allowExtendedPomodoro)
					.onChange(value => {
						this.plugin.settings.allowExtendedPomodoro = value;
						this.plugin.saveSettings();
					}));
		}
	}
}

//sets the setting for the given to value if it's a valid, default if empty, otherwise sends user error notice
function setNumericValue(value: string, defaultSetting: number, currentSetting: number){
	if (value === '') { //empty string -> reset to default
		return defaultSetting;
	} else if (!isNaN(Number(value)) && (Number(value) > 0)) { //if positive number, set setting
		return Number(value);
	} else { //invalid input
		new Notice("Please specify a valid number.");
		return currentSetting;
	}
}
