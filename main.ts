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
	pomo: 1,
	shortBreak: 2,
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
	endTime: Moment;
	mode: Mode;

	async onload() {


		console.log('Loading status bar pomo timer...');

		await this.loadSettings();

		this.statusBar = this.addStatusBarItem();
		this.mode = Mode.NoTimer;

		/*Adds icon to the left side bar which starts the pomo timer when clicked*/
		/*if no timer is currently running, and otherwise restarts current timer*/
		this.addRibbonIcon('clock', 'Start pomo', () => {
			if (this.mode === Mode.NoTimer) {  /* otherwise just restart current session*/
				this.mode = Mode.Pomo;
				this.modeStartingNotification();
			} else {
				this.modeRestartingNotification()
			}
			
			this.startTime = moment();
			this.endTime = moment().add(DEFAULT_SETTINGS.pomo, "minutes"); /*for some reason, works with moment().add() but not startTime.add()*/
		});
		
		/*Update status bar timer ever half second*/
		this.registerInterval(window.setInterval(() => 
			this.statusBar.setText(this.setStatusBarText()), 500));

	}

	/*text is *not* set if no timer is running*/
	setStatusBarText(): string {
		if (this.mode !== Mode.NoTimer) {
			if (moment().isSameOrAfter(this.endTime)) {
				this.switchMode();
			}

			return this.getCountdown();
		}
	}

	/*Returns mm:ss, where mm is the number of minutes and ss is the number of seconds left on the current timer*/
	getCountdown(): string {
		const millisecsSinceStart = moment().diff(this.startTime)
		const millisecCountDown = (this.totalModeTime() * 60 * 1000)- millisecsSinceStart
		const formatedCountDown = moment.utc(millisecCountDown).format("mm:ss") /*NOTE: this one works with times <60 minutes*/
		return formatedCountDown.toString()
	}

	/*switch from pomos to breaks and vv. long break not implemented*/
	switchMode(): void {
		if (this.mode === Mode.Pomo) {
			this.mode = Mode.ShortBreak;
		} else { /*switch to pomo from breaks and not having a timer*/
			this.mode = Mode.Pomo;
		}

		this.startTime = moment()
		this.endTime = moment().add(this.totalModeTime(), "minutes")
		this.modeStartingNotification()
	}

	/*Sends notification corresponding to whatever the mode is at the moment it's called*/
	modeStartingNotification(): void {
		const time = this.totalModeTime();
		
		switch (this.mode) {
			case (Mode.Pomo): {
				new Notice(`Starting ${time} minute pomodoro.`);
				break;
			}
			case (Mode.ShortBreak): {
				new Notice(`Starting ${time} minute short break.`);
				break;
			}
			case (Mode.LongBreak): {
				new Notice(`Starting ${time} minute long break.`);
				break;
			}
			case (Mode.NoTimer): {
				new Notice("Quitting pomodoro timer.");
				break;
			}
		}	
	}

	modeRestartingNotification(): void {
		const time = this.totalModeTime();
		
		switch (this.mode) {
			case (Mode.Pomo): {
				new Notice(`Restarting ${time} minute pomodoro.`);
				break;
			}
			case (Mode.ShortBreak): {
				new Notice(`Restarting ${time} minute short break.`);
				break;
			}
			case (Mode.LongBreak): {
				new Notice(`Restarting ${time} minute long break.`);
				break;
			}
			
		}
	}

	totalModeTime(): number {
		switch (this.mode) {
			case Mode.Pomo: {
				return DEFAULT_SETTINGS.pomo;
			}
			case Mode.ShortBreak: {
				return DEFAULT_SETTINGS.shortBreak;
			}
			case Mode.LongBreak: {
				return DEFAULT_SETTINGS.longBreak;
			}
		}
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
