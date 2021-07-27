import { Notice, Plugin, moment, TAbstractFile } from 'obsidian';
import { PomoSettingTab, PomoSettings, DEFAULT_SETTINGS } from './settings';
import { PomoStatsModal } from './stats'
import type {Moment} from 'moment';

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
		this.statusBar.addClass("statusbar-pomo")
		
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
					this.saveSettings();
					this.pomosSinceStart += 1;

					if (this.settings.logging === true) {
						this.logPomo();
					}
				}
				this.switchMode();
			}

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
		if (this.settings.notificationSound === true) { //play sound end of timer
			playSound();
		}

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

	async logPomo(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.settings.logFile);
		const logText = moment().format(this.settings.logText);
		console.log(file)
		console.log(file instanceof TAbstractFile)

		//this is a sin, please fix it so that it checks for being a folder without doing terrible things
		if (!file) { //if no file, create
			console.log("Creating file")
			await this.app.vault.create(this.settings.logFile, "");
		}
		
		await this.appendFile(this.settings.logFile, logText);
		
	}

	//Note Refactor plugin
	async appendFile(filePath: string, note: string) {
		let existingContent = await this.app.vault.adapter.read(filePath);
		if(existingContent.length > 0) {
		  existingContent = existingContent + '\r';
		}
		await this.app.vault.adapter.write(filePath, existingContent + note);
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

//sorry for the horrible long string, splitting it out into a file the obvious way didn't work
function playSound() {
    const audioUrl = 'data:audio/ogg;base64,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'
    const audio = new Audio(audioUrl);
    audio.play();
}



