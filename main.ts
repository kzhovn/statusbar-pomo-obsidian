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
	pomo: .5,
	shortBreak: .2,
	longBreak: 15,
	longBreakInterval: 4,
	sessionsCompleted: 0
}

enum Mode {
	Pomo,
	ShortBreak,
	LongBreak,
	NoTimer,
}

const MILLISECS_IN_MINUTE = 60 * 1000;



export default class PomoTimer extends Plugin {
	settings: PomoSettings;
	statusBar: HTMLElement; /*why is it an HTML element? what does this mean? */
	startTime: Moment; /*when currently running timer started*/
	endTime: Moment;   /*when currently running timer will end if not paused*/
	mode: Mode;
	pausedTime: number;  /*Time left on paused timer, in milliseconds*/
	paused: boolean;

	async onload() {
		console.log('Loading status bar pomo timer...');

		await this.loadSettings();

		this.statusBar = this.addStatusBarItem();
		this.mode = Mode.NoTimer;
		this.paused = false;

		/*Adds icon to the left side bar which starts the pomo timer when clicked*/
		/*if no timer is currently running, and otherwise quits current timer*/
		this.addRibbonIcon('clock', 'Start pomo', () => {

			if (this.mode === Mode.NoTimer) {  /*if starting from not having a timer running/paused*/
				this.mode = Mode.Pomo;
				this.startTimer(this.getTotalModeMillisecs());
			} else if (this.paused === true) { /*if paused, start*/
				this.restartTimer();
			} else if (this.paused === false) { /*if unpaused, pause*/
				this.pauseTimer();
			}
		});
		
		/*Update status bar timer ever half second*/
		/*Ideally should change so only updating when in timer mode */
		this.registerInterval(window.setInterval(() => 
			this.statusBar.setText(this.setStatusBarText()), 500));
	
		this.addCommand({
			id: 'quit-satusbar-pomo',
			name: 'Pause Timer',
			hotkeys: [ /*sets default hotkey - if no such property, hotkey left blank*/
				{
					modifiers: ["Shift"],
					key: "q",
				},
			],
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						this.quitTimer();
					}
					return true;
				}
				return false;
			}
		});
	}

	quitTimer(): void {
		this.mode = Mode.NoTimer;
		this.startTime = moment(0); /*would be good to do this automatically on mode set*/
		this.endTime = moment(0);		
	}

	pauseTimer(): void { /*currently implemented as quit*/
		this.paused = true;
		this.pausedTime = this.getCountdown();
		new Notice("Timer paused.");
		/*maybe reset start/end time? decide*/	
		this.setStartEndTime(0);	
	}

	restartTimer(): void {
		this.setStartEndTime(this.pausedTime);
		this.modeRestartingNotification();
		this.paused = false;
	}

	startTimer(millisecsLeft: number): void {
		this.setStartEndTime(millisecsLeft);
		this.modeStartingNotification();
	}

	setStartEndTime(millisecsLeft: number): void {
		this.startTime = moment(); //start time to current time
		this.endTime = moment().add(millisecsLeft, "milliseconds");
	}

	/*text is *not* set if no timer is running*/
	setStatusBarText(): string {
		if (this.mode !== Mode.NoTimer) {
			if (this.paused === true) {
				return millisecsToString(this.pausedTime);
			}
			/*if reaching the end of the current timer, switch to the next one (e.g. pomo -> break*/
			else if (moment().isSameOrAfter(this.endTime)) {
				if (this.mode === Mode.Pomo) { /*completed another pomo*/
					this.settings.sessionsCompleted += 1;
				}
				this.switchMode();
			}

			console.log(this.mode.toString());

			return millisecsToString(this.getCountdown());
		} 
	}

	/*Return milliseconds left until end of timer*/
	getCountdown(): number {
		var endTimeClone = this.endTime.clone(); //rewrite with freeze?
		return endTimeClone.diff(moment());
	}

	/*switch from pomos to breaks and vv., paused to unpaused long break not implemented*/
	switchMode(): void {
		switch (this.mode) {
			case (Mode.Pomo): {
				this.mode = Mode.ShortBreak;
				this.startTimer(this.getTotalModeMillisecs());
				break;
			}
			case (Mode.ShortBreak):
			case (Mode.LongBreak): {
				this.mode = Mode.Pomo; /*switch to pomo from any break*/
				this.startTimer(this.getTotalModeMillisecs());
				break;
			}
		}
	}

	/*Sends notification corresponding to whatever the mode is at the moment it's called*/
	modeStartingNotification(): void {
		const minutes = Math.floor(this.getTotalModeMillisecs() / MILLISECS_IN_MINUTE);
		
		switch (this.mode) {
			case (Mode.Pomo): {
				new Notice(`Starting ${minutes} minute pomodoro.`);
				break;
			}
			case (Mode.ShortBreak):
			case (Mode.LongBreak): {
				new Notice(`Starting ${minutes} minute short break.`);
				break;
			}
			case (Mode.NoTimer): {
				new Notice("Quitting pomodoro timer.");
				break;
			}
		}	
	}

	modeRestartingNotification(): void {
		const minutes = Math.floor(this.pausedTime / MILLISECS_IN_MINUTE);
		
		switch (this.mode) {
			case (Mode.Pomo): {
				new Notice(`Restarting pomodoro.`);
				break;
			}
			case (Mode.ShortBreak):
			case (Mode.LongBreak): {
				new Notice(`Restarting break.`);
				break;
			}			
		}
	}

	getTotalModeMillisecs(): number {
		switch (this.mode) {
			case Mode.Pomo: {
				return this.settings.pomo * MILLISECS_IN_MINUTE;
			}
			case Mode.ShortBreak: {
				return this.settings.shortBreak * MILLISECS_IN_MINUTE;
			}
			case Mode.LongBreak: {
				return this.settings.longBreak * MILLISECS_IN_MINUTE;
			}
			/*handle Mode.NoTimer*/
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

/*Returns mm:ss, where mm is the number of minutes and ss is the number of seconds left on the current timer*/
function millisecsToString(millisecs: number): string {
	var formatedCountDown: string;
	
	if (millisecs >= 60 * 60 * 1000) { /* >= 1 hour*/
		formatedCountDown = moment.utc(millisecs).format("HH:mm:ss");
	} else {
		formatedCountDown = moment.utc(millisecs).format("mm:ss");
	}

	return formatedCountDown.toString();
}

