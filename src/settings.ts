import { App, DropdownComponent, Notice, PluginSettingTab, Setting } from 'obsidian';
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
	endTimerBehavior: EndTimerBehavior;
	numAutoCycles: number;
	ribbonIcon: boolean;
	notificationSound: boolean;
	backgroundNoiseFile: string;
	logging: boolean;
	logFile: string;
	logText: string;
	logToDaily: boolean;
	logActiveNote: boolean;
	fancyStatusBar: boolean;
	whiteNoise: boolean;
}

export const DEFAULT_SETTINGS: PomoSettings = {
	pomo: 25,
	shortBreak: 5,
	longBreak: 15,
	longBreakInterval: 4,
	autostartTimer: true,
	endTimerBehavior: EndTimerBehavior.Continue,
	numAutoCycles: 0,
	ribbonIcon: true,
	notificationSound: true,
	backgroundNoiseFile: "",
	logging: false,
	logFile: "Pomodoro Log.md",
	logToDaily: false,
	logText: "[🍅] dddd, MMMM DD YYYY, h:mm A",
	logActiveNote: false,
	fancyStatusBar: false,
	whiteNoise: false,
}

export const enum EndTimerBehavior {
	Continue,
	Pause,
	Negative
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
			.setName('Pomodoro time (minutes)')
			.setDesc('Leave blank for default')
			.addText(text => text
				.setValue(this.plugin.settings.pomo.toString())
				.onChange(value => {
					this.plugin.settings.pomo = setNumericValue(value, DEFAULT_SETTINGS.pomo, this.plugin.settings.pomo);;
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Short break time (minutes)')
			.setDesc('Leave blank for default')
			.addText(text => text
				.setValue(this.plugin.settings.shortBreak.toString())
				.onChange(value => {
					this.plugin.settings.shortBreak = setNumericValue(value, DEFAULT_SETTINGS.shortBreak, this.plugin.settings.shortBreak);;
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Long break time (minutes)')
			.setDesc('Leave blank for default')
			.addText(text => text
				.setValue(this.plugin.settings.longBreak.toString())
				.onChange(value => {
					this.plugin.settings.longBreak = setNumericValue(value, DEFAULT_SETTINGS.longBreak, this.plugin.settings.longBreak);;
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Long break interval')
			.setDesc('Number of pomos before a long break; leave blank for default')
			.addText(text => text
				.setValue(this.plugin.settings.longBreakInterval.toString())
				.onChange(value => {
					this.plugin.settings.longBreakInterval = setNumericValue(value, DEFAULT_SETTINGS.longBreakInterval, this.plugin.settings.longBreakInterval);
					this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sidebar icon')
			.setDesc('Toggle left sidebar icon. Restart Obsidian for the change to take effect')
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.ribbonIcon)
					.onChange(value => {
						this.plugin.settings.ribbonIcon = value;
						this.plugin.saveSettings();
					}));

		new Setting(containerEl)
			.setName('Timer end behavior')
			.setDesc('Default is to continue to the next timer, can also pause or continue counting down in the negatives until manually paused')
			.addDropdown(drop => {
					drop.addOption("continue", "Continue to next timer");
					drop.addOption("pause", "Pause timer");
					drop.addOption("negative", "Run negative timer until paused");
					drop.onChange(value => {
						if (value === "continue") {
							this.plugin.settings.endTimerBehavior = EndTimerBehavior.Continue;
						} else if (value === "pause") {
							this.plugin.settings.endTimerBehavior = EndTimerBehavior.Pause;
						} else if (value === "negative") {
							this.plugin.settings.endTimerBehavior = EndTimerBehavior.Negative;
						}
						drop.setValue(value); //not setting -> saves
						this.plugin.saveSettings();
						this.display() //force refresh
					})});

		if (this.plugin.settings.endTimerBehavior !== EndTimerBehavior.Continue) { //if setting the number of cycles does something
			new Setting(containerEl)
				.setName('Cycles before pause')
				.setDesc('Number of pomodoro + break cycles to run automatically before end timer behavior kicks in. Default is 0 (after every pomodoro and every break). Set to 1 to stop after every pomo/break pair')
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
							this.plugin.timer.whiteNoisePlayer = new WhiteNoise(this.plugin, whiteNoiseUrl);
							this.plugin.timer.whiteNoisePlayer.whiteNoise()
						} else { //if false, turn it off immediately
							this.plugin.timer.whiteNoisePlayer.stopWhiteNoise();
						}

						this.display();
					}));


		/**************  Logging settings **************/

		new Setting(containerEl)
			.setName('Logging')
			.setDesc('Enable a log of completed pomodoros')
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.logging)
					.onChange(async value => {
						this.plugin.settings.logging = value;

						if (value === true) {
							this.plugin.openLogFileOnClick();
						} else {
							this.plugin.statusBar.removeClass("statusbar-pomo-logging")
						}

						this.plugin.saveSettings();
						this.display(); //force refresh
					}));

		//various logging settings; only show if logging is enabled (currently does not autohide, only)
		if (this.plugin.settings.logging === true) {

			new Setting(containerEl)
				.setName('Log file')
				.setDesc(`If file doesn't already exist, it will be created`)
				.addText(text => text
					.setValue(this.plugin.settings.logFile.toString())
					.onChange(value => {
						this.plugin.settings.logFile = value;
						this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Log to daily note')
				.setDesc(`Logs to the end of today's daily note`)
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
}

//sets the setting for the given to value if it's a valid, default if empty, otherwise sends user error notice
function setNumericValue(value: string, default_setting: number, current_setting: number){
	if (value === '') { //empty string -> reset to default
		return default_setting;
	} else if (!isNaN(Number(value)) && (Number(value) > 0)) { //if positive number, set setting
		return Number(value);
	} else { //invalid input
		new Notice('Please specify a valid number.');
		return current_setting;
	}
}
