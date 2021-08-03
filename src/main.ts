import { Notice, Plugin, moment, TFile } from 'obsidian';
import { PomoSettingTab, PomoSettings, DEFAULT_SETTINGS } from './settings';
import type { Moment } from 'moment';
import { notificationUrl } from './audio_urls';
import { backgroundNoiseUrl } from './audio_urls_background_noise';

enum Mode {
	Pomo,
	ShortBreak,
	LongBreak,
	NoTimer,
}

const MILLISECS_IN_MINUTE = 60 * 1000;



var myAudioRepeat = new Audio(backgroundNoiseUrl);
var stopPlaying = false;



export default class PomoTimer extends Plugin {
	settings: PomoSettings;
	statusBar: HTMLElement;
	startTime: Moment; /*when currently running timer started*/
	endTime: Moment;   /*when currently running timer will end if not paused*/
	mode: Mode;
	pausedTime: number;  /*Time left on paused timer, in milliseconds*/
	paused: boolean;
	pomosSinceStart: number;
	activeNote: TFile;

	async onload() {
		console.log('Loading status bar pomodoro timer');

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
		  Ideally should change so only updating when in timer mode
		  - regular conditional doesn't remove after quit, need unload*/
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
						if (this.paused === true) {
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
	}

	async quitTimer(): Promise<void> {
        stopPlayingSound();
		this.mode = Mode.NoTimer;
		this.startTime = moment(0);
		this.endTime = moment(0);
		this.paused = false;
		this.pomosSinceStart = 0;
		await this.loadSettings();
	}

	pauseTimer(): void {
		stopPlayingSound();
		this.paused = true;
		this.pausedTime = this.getCountdown();
		this.startTime = moment(0);
		this.endTime = moment(0);
		new Notice('Timer paused.');
	}

	restartTimer(): void {
		
		if (this.mode === Mode.Pomo) {
			playSoundWithRepeat();
        } else {
			stopPlayingSound();
		}
		this.setStartEndTime(this.pausedTime);
		this.modeRestartingNotification();
		this.paused = false;
	}

	startTimer(mode: Mode): void {
		this.mode = mode;
		
		if (this.mode === Mode.Pomo) {
			playSoundWithRepeat();
        } else {
			stopPlayingSound();
		}
		if (this.settings.logActiveNote === true) {
			const activeView = this.app.workspace.getActiveFile();
			if (activeView) {
				this.activeNote = activeView;
			}
		}

		this.setStartEndTime(this.getTotalModeMillisecs());
		this.modeStartingNotification();
	}

	setStartEndTime(millisecsLeft: number): void {
		this.startTime = moment(); //start time to current time
		this.endTime = moment().add(millisecsLeft, 'milliseconds');
	}

	/*Set status bar to remaining time or empty string if no timer is running*/
	setStatusBarText(): string {
		if (this.mode !== Mode.NoTimer) {
			if (this.paused === true) {
				return millisecsToString(this.pausedTime);
			}
			/*if reaching the end of the current timer, switch to the next one (e.g. pomo -> break)*/
			else if (moment().isSameOrAfter(this.endTime)) {
				if (this.mode === Mode.Pomo) { /*completed another pomo*/
					this.pomosSinceStart += 1;

					if (this.settings.logging === true) {
						this.logPomo();
					}
				}
				this.switchMode();
			}

			return millisecsToString(this.getCountdown());
		} else {
			return ""; //fixes TypeError: failed to execute 'appendChild' on 'Node https://github.com/kzhovn/statusbar-pomo-obsidian/issues/4
		}
	}

	/*Return milliseconds left until end of timer*/
	getCountdown(): number {
		let endTimeClone = this.endTime.clone(); //rewrite with freeze?
		return endTimeClone.diff(moment());
	}

	/*switch from pomos to long or short breaks as appropriate*/
	switchMode(): void {
		if (this.settings.notificationSound === true) { //play sound end of timer
			playSound();
		}

		if (this.mode === Mode.Pomo) {
			if (this.pomosSinceStart % this.settings.longBreakInterval === 0) {
					this.startTimer(Mode.LongBreak);
				} else {
					this.startTimer(Mode.ShortBreak);
				}
		} else { //short break. long break, or no timer
			this.startTimer(Mode.Pomo);
		}
	}

	/*Sends notification corresponding to whatever the mode is at the moment it's called*/
	modeStartingNotification(): void {
		let time = this.getTotalModeMillisecs();
		let unit: string;

		if (time >= MILLISECS_IN_MINUTE) { /*display in minutes*/
			time = Math.floor(time / MILLISECS_IN_MINUTE);
			unit = 'minute';
		} else { /*less than a minute, display in seconds*/
			time = Math.floor(time / 1000); //convert to secs
			unit = 'second';
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
		let logText = moment().format(this.settings.logText);

		if (this.settings.logActiveNote === true) {
			logText = logText + " " + this.app.fileManager.generateMarkdownLink(this.activeNote, '');
		}

		//this is a sin, please fix it so that it checks for being a folder without doing terrible things
		if (!file) { //if no file, create
			console.log("Creating file");
			await this.app.vault.create(this.settings.logFile, "");
		}

		await this.appendFile(this.settings.logFile, logText);

	}

	//from Note Refactor plugin
	async appendFile(filePath: string, note: string) {
		let existingContent = await this.app.vault.adapter.read(filePath);
		if (existingContent.length > 0) {
			existingContent = existingContent + '\r';
		}
		await this.app.vault.adapter.write(filePath, existingContent + note);
	}

	onunload() {
		this.quitTimer();
		console.log('Unloading status bar pomodoro timer');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/*Returns [HH:]mm:ss left on the current timer*/
function millisecsToString(millisecs: number): string {
	let formatedCountDown: string;

	if (millisecs >= 60 * 60 * 1000) { /* >= 1 hour*/
		formatedCountDown = moment.utc(millisecs).format('HH:mm:ss');
	} else {
		formatedCountDown = moment.utc(millisecs).format('mm:ss');
	}

	return formatedCountDown.toString();
}

function playSound() {
	const audio = new Audio(notificationUrl);
	audio.play();
}

function playSoundWithRepeat() {
    stopPlaying = false;
    myAudioRepeat.play();
    if (typeof myAudioRepeat.loop == 'boolean') {
        myAudioRepeat.loop = true;
    }
    else {
        myAudioRepeat.addEventListener('ended', function() {
                this.currentTime = 0;
                if(!stopPlaying) {
                    this.play();
                }
            }, false);
    }
    myAudioRepeat.play();
}

function stopPlayingSound() {
    myAudioRepeat.pause();
    myAudioRepeat.currentTime = 0;
    stopPlaying = true;
}





