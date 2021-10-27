import { Notice, moment, TFolder, TFile } from 'obsidian';
import { getDailyNote, createDailyNote, getAllDailyNotes } from 'obsidian-daily-notes-interface';
import type { Moment } from 'moment';
import { notificationUrl, whiteNoiseUrl } from './audio_urls';
import { WhiteNoise } from './white_noise';
import { PomoSettings } from './settings';
import PomoTimerPlugin from './main';
import {confirmWithModal} from "./extend_modal";


const MILLISECS_IN_MINUTE = 60 * 1000;

export const enum Mode {
	Pomo,
	ShortBreak,
	LongBreak,
	NoTimer
}


export class Timer {
	plugin: PomoTimerPlugin;
	settings: PomoSettings;
	originalStartTime: Moment;
	startTime: Moment; /*when currently running timer started*/
	endTime: Moment;   /*when currently running timer will end if not paused*/
	mode: Mode;
	pausedTime: number;  /*Time left on paused timer, in milliseconds*/
	paused: boolean;
	pomosSinceStart: number;
	cyclesSinceLastAutoStop: number;
	activeNote: TFile;
	whiteNoisePlayer: WhiteNoise;
	extendPomodoroTime: boolean;
	triggered: boolean;
	extendedTime: Moment;

	constructor(plugin: PomoTimerPlugin) {
		this.plugin = plugin;
		this.settings = plugin.settings;
		this.mode = Mode.NoTimer;
		this.paused = false;
		this.pomosSinceStart = 0;
		this.cyclesSinceLastAutoStop = 0;
		this.extendPomodoroTime = false;
		this.triggered = false;

		// initialize white noise player even if it it started as false so that it can be toggled.
		this.whiteNoisePlayer = new WhiteNoise(plugin, whiteNoiseUrl);
	}

	onRibbonIconClick() {
		if (this.mode === Mode.NoTimer) {  //if starting from not having a timer running/paused
			this.startTimer(Mode.Pomo);
		} else { //if timer exists, pause or unpause
			this.togglePause();
		}
	}

	/*Set status bar to remaining time or empty string if no timer is running*/
	//handling switching logic here, should spin out
	async setStatusBarText(): Promise<string> {
		if (this.mode !== Mode.NoTimer) {
			if(this.extendPomodoroTime === false) {
				if (this.paused === true) {
					return this.activeNote && this.plugin.settings.logActiveNote && this.plugin.settings.showActiveNoteInTimer ? '( ' + this.activeNote.basename + ' ) ' + millisecsToString(this.pausedTime) : millisecsToString(this.pausedTime); //just show the paused time
				}
				/*if reaching the end of the current timer, end of current timer*/
				else if (moment().isSameOrAfter(this.endTime)) {
					if(!this.triggered && this.mode === Mode.Pomo) {
						await this.handleTimerEnd();
					} else {
						await this.handleTimerEnd();
					}
				}
				return this.activeNote && this.plugin.settings.logActiveNote && this.plugin.settings.showActiveNoteInTimer ? '( ' + this.activeNote.basename + ' ) ' + millisecsToString(this.getCountdown()) : millisecsToString(this.getCountdown()); //return display value
			} else {
				if (this.paused === true) {
					return this.activeNote && this.plugin.settings.logActiveNote && this.plugin.settings.showActiveNoteInTimer ? '( ' + this.activeNote.basename + ' ) ' + millisecsToString(this.pausedTime) : millisecsToString(this.pausedTime); //just show the paused time
				}
				return this.activeNote && this.plugin.settings.logActiveNote && this.plugin.settings.showActiveNoteInTimer ? '( ' + this.activeNote.basename + ' ) ' + millisecsToString(this.getStopwatch()) : millisecsToString(this.getStopwatch()); //return display value
			}

		} else {
			return ""; //fixes TypeError: failed to execute 'appendChild' on 'Node https://github.com/kzhovn/statusbar-pomo-obsidian/issues/4
		}
	}

	 stopTimerEarly() {
		if (this.settings.logging === true) {
			this.logPomo();
	   }
	}

	async handleTimerEnd() {
		this.triggered = true;
		this.pauseTimer();
		if(this.settings.allowExtendedPomodoro && this.mode === Mode.Pomo) {
			await confirmWithModal(this.plugin.app, "Do You Want To Extend Your Pomodoro Session ? ", this.plugin)
		} else {
			this.extendPomodoroTime = false;
		}
		if(this.extendPomodoroTime && this.mode === Mode.Pomo) {
			
			this.restartTimer();
			this.extendedTime = moment();
		} else {
			if (this.mode === Mode.Pomo) { //completed another pomo
				this.pomosSinceStart += 1;

				if (this.settings.logging === true) {
					await this.logPomo();
				}
			} else if (this.mode === Mode.ShortBreak || this.mode === Mode.LongBreak) {
				this.cyclesSinceLastAutoStop += 1;
			}

			//switch mode
			if (this.settings.notificationSound === true) { //play sound end of timer
				playNotification();
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

			if (this.settings.autostartTimer === false && this.settings.numAutoCycles <= this.cyclesSinceLastAutoStop) { //if autostart disabled, pause and allow user to start manually
				this.pauseTimer();
				this.cyclesSinceLastAutoStop = 0;
			}
		}

	}

	async quitTimer(): Promise<void> {
		this.mode = Mode.NoTimer;
		this.startTime = moment(0);
		this.endTime = moment(0);
		this.paused = false;
		this.pomosSinceStart = 0;

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.stopWhiteNoise();
		}

		await this.plugin.loadSettings(); //why am I loading settings on quit? to ensure that when I restart everything is correct? seems weird
	}

	pauseTimer(): void {
		this.paused = true;
		this.pausedTime = this.getCountdown();

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.stopWhiteNoise();
		}
	}

	togglePause() {
		if (this.paused === true) {
			this.restartTimer();
		} else if (this.mode !== Mode.NoTimer) { //if some timer running
			this.pauseTimer();
			new Notice("Timer paused.")
		}
	}

	restartTimer(): void {
		this.setStartAndEndTime(this.pausedTime);
		this.modeRestartingNotification();
		this.paused = false;
		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.whiteNoise();
		}
	}

	startTimer(mode: Mode): void {
		this.mode = mode;
		this.paused = false;

		if (this.settings.logActiveNote === true) {
			const activeView = this.plugin.app.workspace.getActiveFile();
			if (activeView) {
				this.activeNote = activeView;
			}
		}

		this.setStartAndEndTime(this.getTotalModeMillisecs());
		this.originalStartTime = moment();
		this.modeStartingNotification();

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.whiteNoise();
		}
	}

	setStartAndEndTime(millisecsLeft: number): void {
		this.startTime = moment(); //start time to current time
		this.endTime = moment().add(millisecsLeft, 'milliseconds');
	}

	/*Return milliseconds left until end of timer*/
	getCountdown(): number {
		let endTimeClone = this.endTime.clone(); //rewrite with freeze?
		return endTimeClone.diff(moment());
	}

	getStopwatch(): number {
		let startTimeClone = this.extendedTime.clone(); //rewrite with freeze?
		return moment().diff(startTimeClone);
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
			case Mode.NoTimer: {
				throw new Error("Mode NoTimer does not have an associated time value");
			}
		}
	}



	/**************  Notifications  **************/
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
				new Notice(`Starting ${time} ${unit} pomodoro. \n` + (this.settings.logActiveNote && this.activeNote ? `(` + this.activeNote.basename + `)`: ``));
				break;
			}
			case (Mode.ShortBreak):
			case (Mode.LongBreak): {
				new Notice(`Starting ${time} ${unit} break.` + `carlo`);
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

	/**************  Logging  **************/
	async logPomo(): Promise<void> {
		var logText = moment().format(this.settings.logText);

		if (this.settings.logActiveNote === true) { //append link to note that was active when pomo started
			logText = logText + " " + this.plugin.app.fileManager.generateMarkdownLink(this.activeNote, '');
			if(this.settings.logPomodoroDuration === true) {
				logText = logText + ' ' + Math.floor(moment.duration(moment().diff(this.originalStartTime)).asMinutes()) + ' minute/s. ';
			}
		}

		if (this.settings.logToDaily === true) { //use today's note
			let file = (await getDailyNoteFile()).path;
			await this.appendFile(file, logText);
		} else { //use file given in settings
			let file = this.plugin.app.vault.getAbstractFileByPath(this.settings.logFile);

			if (!file || file !instanceof TFolder) { //if no file, create
				console.log("Creating pomodoro log file");
				await this.plugin.app.vault.create(this.settings.logFile, "");
			}

			await this.appendFile(this.settings.logFile, logText);
		}
	}

	//from Note Refactor plugin by James Lynch, https://github.com/lynchjames/note-refactor-obsidian/blob/80c1a23a1352b5d22c70f1b1d915b4e0a1b2b33f/src/obsidian-file.ts#L69
	async appendFile(filePath: string, note: string): Promise<void> {
		let existingContent = await this.plugin.app.vault.adapter.read(filePath);
		if (existingContent.length > 0) {
			existingContent = existingContent + '\r';
		}
		await this.plugin.app.vault.adapter.write(filePath, existingContent + note);
	}
}

/*Returns [HH:]mm:ss left on the current timer*/
function millisecsToString(millisecs: number): string {
	let formattedCountDown: string;

	if (millisecs >= 60 * 60 * 1000) { /* >= 1 hour*/
		formattedCountDown = moment.utc(millisecs).format('HH:mm:ss');
	} else {
		formattedCountDown = moment.utc(millisecs).format('mm:ss');
	}

	return formattedCountDown.toString();
}

function playNotification(): void {
	const audio = new Audio(notificationUrl);
	audio.play();
}

export async function getDailyNoteFile(): Promise<TFile> {
	const file = getDailyNote(moment(), getAllDailyNotes());

	if (!file) {
		return await createDailyNote(moment());
	}

	return file;
}






