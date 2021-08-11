import { Notice, moment, TFolder, TFile } from 'obsidian';
import { getDailyNote, createDailyNote, getAllDailyNotes } from 'obsidian-daily-notes-interface';
import type { Moment } from 'moment';

import { notificationUrl, whiteNoiseUrl } from './audio_urls';
import { WhiteNoise } from './white_noise';
import { PomoSettings } from './settings';
import PomoTimerPlugin from './main';

const MILLISECS_IN_MINUTE = 60 * 1000;

export enum Mode {
	Pomo,
	ShortBreak,
	LongBreak,
	NoTimer
}

export class Timer {
	plugin: PomoTimerPlugin;
	settings: PomoSettings;
	startTime: Moment; /*when currently running timer started*/
	endTime: Moment;   /*when currently running timer will end if not paused*/
	mode: Mode;
	pausedTime: number;  /*Time left on paused timer, in milliseconds*/
	paused: boolean;
	pomosSinceStart: number;
	cyclesSinceLastAutoStop: number;
	activeNote: TFile;
	whiteNoisePlayer: WhiteNoise;

	constructor(plugin: PomoTimerPlugin) {
		this.plugin = plugin;
		this.settings = plugin.settings;
		this.mode = Mode.NoTimer;
		this.paused = false;
		this.pomosSinceStart = 0;
		this.cyclesSinceLastAutoStop = 0;

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer = new WhiteNoise(plugin, whiteNoiseUrl);
		}
	}

	async onRibbonIconClick() {
		if (this.mode === Mode.NoTimer) {  //if starting from not having a timer running/paused
			await this.startTimer(Mode.Pomo);
		} else { //if timer exists, pause or unpause
			await this.togglePause();
		}
	}

	/*Set status bar to remaining time or empty string if no timer is running*/
	//handling switching logic here, should spin out
	async setStatusBarText(): Promise<string> {
		if (this.mode !== Mode.NoTimer) {
			if (this.paused === true) {
				return millisecsToString(this.pausedTime);
			}

			/*if reaching the end of the current timer, switch to the next one (e.g. pomo -> break)*/
			else if (moment().isSameOrAfter(this.endTime)) {
				await this.handleTimerEnd();
			}

			return millisecsToString(this.getCountdown());
		} else {
			return ""; //fixes TypeError: failed to execute 'appendChild' on 'Node https://github.com/kzhovn/statusbar-pomo-obsidian/issues/4
		}
	}

	async handleTimerEnd() {
		if (this.mode === Mode.Pomo) { /*completed another pomo*/
			this.pomosSinceStart += 1;

			if (this.settings.logging === true) {
				this.logPomo();
			}
		} else if (this.mode === Mode.ShortBreak || this.mode === Mode.LongBreak) {
			this.cyclesSinceLastAutoStop += 1;
		}
		await this.switchMode();
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

	async pauseTimer(): Promise<void> {
		this.paused = true;
		this.pausedTime = this.getCountdown();

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.stopWhiteNoise();
		}
	}

	async togglePause() {
		if (this.paused === true) {
			this.restartTimer();
		} else if (this.mode !== Mode.NoTimer) { //if some timer running
			this.pauseTimer();
			new Notice("Timer paused.")
		}
	}

	async restartTimer(): Promise<void> {
		this.setStartEndTime(this.pausedTime);
		await this.modeRestartingNotification();
		this.paused = false;

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.whiteNoise();
		}
	}

	async startTimer(mode: Mode): Promise<void> {
		this.mode = mode;

		if (this.settings.logActiveNote === true) {
			const activeView = this.plugin.app.workspace.getActiveFile();
			if (activeView) {
				this.activeNote = activeView;
			}
		}

		this.setStartEndTime(this.getTotalModeMillisecs());
		await this.modeStartingNotification();

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.whiteNoise();
		}
	}

	setStartEndTime(millisecsLeft: number): void {
		this.startTime = moment(); //start time to current time
		this.endTime = moment().add(millisecsLeft, 'milliseconds');
	}

	/*Return milliseconds left until end of timer*/
	getCountdown(): number {
		let endTimeClone = this.endTime.clone(); //rewrite with freeze?
		return endTimeClone.diff(moment());
	}

	/*switch from pomos to long or short breaks as appropriate*/
	async switchMode(): Promise<void> {
		if (this.settings.notificationSound === true) { //play sound end of timer
			await playNotification();
		}

		if (this.mode === Mode.Pomo) {
			if (this.pomosSinceStart % this.settings.longBreakInterval === 0) {
				await this.startTimer(Mode.LongBreak);
			} else {
				await this.startTimer(Mode.ShortBreak);
			}
		} else { //short break. long break, or no timer
			await this.startTimer(Mode.Pomo);
		}

		if (this.settings.autostartTimer === false && this.settings.numAutoCycles <= this.cyclesSinceLastAutoStop) { //if autostart disabled, pause and allow user to start manually
			await this.pauseTimer();
			this.cyclesSinceLastAutoStop = 0;
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
			case Mode.NoTimer: {
				throw new Error("Mode NoTimer does not have an associated time value");
			}
		}
	}



	/**************  Notifications  **************/
	/*Sends notification corresponding to whatever the mode is at the moment it's called*/
	async modeStartingNotification(): Promise<void> {
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

	async modeRestartingNotification(): Promise<void> {
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
		}

		if (this.settings.logToDaily === true) { //use today's note
			let file = (await getDailyNoteFile()).path;
			await this.appendFile(file, logText);
		} else { //use file given in settings
			let file = this.plugin.app.vault.getAbstractFileByPath(this.settings.logFile);

			if (!file || file! instanceof TFolder) { //if no file, create
				console.log("Creating pomodoro log file");
				await this.plugin.app.vault.create(this.settings.logFile, "");
			}

			await this.appendFile(this.settings.logFile, logText);
		}
	}

	//from Note Refactor plugin by James Lynch, https://github.com/lynchjames/note-refactor-obsidian/blob/80c1a23a1352b5d22c70f1b1d915b4e0a1b2b33f/src/obsidian-file.ts#L69
	async appendFile(filePath: string, note: string) {
		let existingContent = await this.plugin.app.vault.adapter.read(filePath);
		if (existingContent.length > 0) {
			existingContent = existingContent + '\r';
		}
		await this.plugin.app.vault.adapter.write(filePath, existingContent + note);
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

async function playNotification() {
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






