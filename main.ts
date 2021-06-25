import { Moment } from 'moment';
import { Notice, Plugin, moment } from 'obsidian';
import { PomoSettingTab, PomoSettings, DEFAULT_SETTINGS } from './src/settings';
import { PomoStatsModal } from './src/stats'

enum Mode {
	Pomo,
	ShortBreak,
	LongBreak,
	NoTimer,
}

const MILLISECS_IN_MINUTE = 60 * 1000;

export default class PomoTimer extends Plugin {
	settings: PomoSettings;
	statusBar: HTMLElement;
	startTime: Moment; /*when currently running timer started*/
	endTime: Moment;   /*when currently running timer will end if not paused*/
	mode: Mode;
	pausedTime: number;  /*Time left on paused timer, in milliseconds*/
	paused: boolean;
	pomosSinceStart: number;

	async onload() {
		console.log('Loading status bar pomo timer...');

		await this.loadSettings();
		this.addSettingTab(new PomoSettingTab(this.app, this));

		this.statusBar = this.addStatusBarItem();
		this.mode = Mode.NoTimer;
		this.paused = false;
		this.pomosSinceStart = 0;

		/*Adds icon to the left side bar which starts the pomo timer when clicked
		  if no timer is currently running, and otherwise quits current timer*/
		this.addRibbonIcon('clock', 'Start pomo', () => {
			if (this.mode === Mode.NoTimer) {  //if starting from not having a timer running/paused
				this.startTimer(Mode.Pomo);
			} else if (this.paused === true) { //if paused, start
				this.restartTimer();
			} else if (this.paused === false) { //if unpaused, pause
				this.pauseTimer();
			}
		});
		
		/*Update status bar timer ever half second
		  Ideally should change so only updating when in timer mode */
		this.registerInterval(window.setInterval(() => 
			this.statusBar.setText(this.setStatusBarText()), 500));

		this.addCommand({
			id: 'start-satusbar-pomo',
			name: 'Start pomodoro',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) { //start pomo
						this.startTimer(Mode.Pomo);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'quit-satusbar-pomo',
			name: 'Quit timer',
			hotkeys: [ //sets default hotkey - if no such property, hotkey left blank
				{
					modifiers: ['Ctrl'],
					key: 'q',
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

		this.addCommand({
			id: 'pause-satusbar-pomo',
			name: 'Toggle timer pause',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						if (this.paused) {
							this.restartTimer();
						} else if (this.mode !== Mode.NoTimer) { //if some timer running
							this.pauseTimer();
						}
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'satusbar-pomo-stats',
			name: 'Open pomodoro stats',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						new PomoStatsModal(this.app, this).open();
					}
					return true;
				}
				return false;
			}

		});
	}

	quitTimer(): void {
		this.mode = Mode.NoTimer;
		this.startTime = moment(0); //would be good to do this automatically on mode set
		this.endTime = moment(0);		
	}

	pauseTimer(): void { //currently implemented as quit
		this.paused = true;
		this.pausedTime = this.getCountdown();
		new Notice('Timer paused.');
		this.setStartEndTime(0); //reset start/end time (to start of unix epoch)
	}

	restartTimer(): void {
		this.setStartEndTime(this.pausedTime);
		this.modeRestartingNotification();
		this.paused = false;
	}

	startTimer(mode: Mode): void {
		this.mode = mode;
		this.setStartEndTime(this.getTotalModeMillisecs());
		this.modeStartingNotification();
	}

	setStartEndTime(millisecsLeft: number): void {
		this.startTime = moment(); //start time to current time
		this.endTime = moment().add(millisecsLeft, 'milliseconds');
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
					this.settings.totalPomosCompleted += 1;
					this.pomosSinceStart += 1;
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

	/*switch from pomos to long or short breaks as appropriate*/
	switchMode(): void {
		switch (this.mode) {
			case (Mode.Pomo): {
				if (this.pomosSinceStart % this.settings.longBreakInterval === 0){
					this.startTimer(Mode.LongBreak);
				} else {
					this.startTimer(Mode.ShortBreak);
				}
				break;
			}
			case (Mode.ShortBreak):
			case (Mode.LongBreak): {
				this.startTimer(Mode.Pomo);
				break;
			}
		}
	}

	/*Sends notification corresponding to whatever the mode is at the moment it's called*/
	modeStartingNotification(): void {
		var time = this.getTotalModeMillisecs();
		var unit: string;
		
		if (time >= MILLISECS_IN_MINUTE) { /*display in minutes*/
			time = Math.floor(time / MILLISECS_IN_MINUTE);
			unit = 'minute'
		} else { /*less than a minute, display in seconds*/
			time = Math.floor(time / 1000); //convert to secs
			unit = 'second'
		}
		
		switch (this.mode) {
			case (Mode.Pomo): {
				new Notice(`Starting ${time} ${unit} pomodoro.`);
				break;
			}
			case (Mode.ShortBreak):
			case (Mode.LongBreak): {
				new Notice(`Starting ${time} ${unit} break.`);
				break;
			}
			case (Mode.NoTimer): {
				new Notice('Quitting pomodoro timer.');
				break;
			}
		}	
	}

	modeRestartingNotification(): void {
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
			//handle Mode.NoTimer?
		}
	}

	onunload() {
		console.log('unloading plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); //understand why removing this fixes default issue
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/*Returns mm:ss, where mm is the number of minutes and ss is the number of seconds left on the current timer*/
function millisecsToString(millisecs: number): string {
	var formatedCountDown: string;
	
	if (millisecs >= 60 * 60 * 1000) { /* >= 1 hour*/
		formatedCountDown = moment.utc(millisecs).format('HH:mm:ss');
	} else {
		formatedCountDown = moment.utc(millisecs).format('mm:ss');
	}

	return formatedCountDown.toString();
}


