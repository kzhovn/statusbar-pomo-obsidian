import { addIcon, MarkdownView, Plugin } from 'obsidian';
import * as feather from 'feather-icons'; //import just icons I want?
import { PomoSettingTab, PomoSettings, DEFAULT_SETTINGS } from './settings';
import { getDailyNoteFile, Mode, Timer } from './timer';


export default class PomoTimerPlugin extends Plugin {
	settings: PomoSettings;
	statusBar: HTMLElement;
	timer: Timer;

	async onload() {
		console.log('Loading status bar pomodoro timer');

		await this.loadSettings();
		this.addSettingTab(new PomoSettingTab(this.app, this));

		this.statusBar = this.addStatusBarItem();
		this.statusBar.addClass("statusbar-pomo");
		if (this.settings.logging === true) {
			this.openLogFileOnClick();
		}
		this.timer = new Timer(this);
		/*Adds icon to the left side bar which starts the pomo timer when clicked
		  if no timer is currently running, and otherwise quits current timer*/
		if (this.settings.ribbonIcon === true) {
			this.addRibbonIcon('clock', 'Start pomodoro', async () => {
				this.timer.onRibbonIconClick();
			});
		}

		/*Update status bar timer ever half second
		  Ideally should change so only updating when in timer mode
		  - regular conditional doesn't remove after quit, need unload*/
		this.registerInterval(window.setInterval(async () =>
			this.statusBar.setText(await this.timer.setStatusBarText()), 500));

		addIcon("feather-play", feather.icons.play.toString());
		addIcon("feather-pause", feather.icons.pause.toString());
		addIcon("feather-quit", feather.icons.x.toSvg({viewBox: "0 0 24 24", width: "100", height: "100"}).toString()); //https://github.com/phibr0/obsidian-customizable-sidebar/blob/master/src/ui/icons.ts
		addIcon("feather-headphones", feather.icons.headphones.toString());

		this.addCommand({
			id: 'start-satusbar-pomo',
			name: 'Start pomodoro',
			icon: 'feather-play',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						this.timer = new Timer(this);
						this.timer.triggered = false;
						this.timer.startTimer(Mode.Pomo);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'log-and-quit-statusbar-pomo',
			name: 'Log Pomodoro Time and Quit.',
			icon: 'feather-log-and-quit',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf && this.timer.mode !== Mode.NoTimer) {
					if (!checking) {
						this.timer.extendPomodoroTime = false;
						this.timer.triggered = false;
						this.timer.stopTimerEarly();
						this.timer.quitTimer();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'open-activenote-statusbar-pomo',
			name: 'Open Active Note',
			icon: 'feather-open-active-note',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf && this.timer.mode !== Mode.NoTimer) {
					if (!checking) {
						let view = this.app.workspace.getActiveViewOfType(MarkdownView)
						if ( view ) {
							let file = view.file;
							if(file.basename !== this.timer.activeNote.basename) {
								let rightLeaf = this.app.workspace.splitActiveLeaf('vertical')
								this.app.workspace.setActiveLeaf(rightLeaf)
								rightLeaf.openFile(this.timer.activeNote);
							}
						}
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'start-shortbreak',
			name: 'Start Short Break',
			icon: 'feather-play',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						this.timer.startTimer(Mode.ShortBreak);
					}
					return true;
				}
				return false;
			}
		})

		this.addCommand({
			id: 'start-longbreak',
			name: 'Start Long Break',
			icon: 'feather-play',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						this.timer.startTimer(Mode.LongBreak);
					}
					return true;
				}
				return false;
			}
		})

		this.addCommand({
			id: 'pause-satusbar-pomo',
			name: 'Toggle timer pause',
			icon: 'feather-pause',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf && this.timer.mode !== Mode.NoTimer) {
					if (!checking) {
						this.timer.togglePause();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'quit-satusbar-pomo',
			name: 'Quit timer',
			icon: 'feather-quit',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf && this.timer.mode !== Mode.NoTimer) {
					if (!checking) {
						this.timer.quitTimer();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'toggle-white-noise',
			name: 'Toggle White noise',
			icon: 'feather-headphones',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf && this.timer.mode === Mode.Pomo) {
					if (!checking) {
						if(this.settings.whiteNoise) {
							this.settings.whiteNoise = false;
							this.timer.whiteNoisePlayer.stopWhiteNoise();
						} else {
							this.settings.whiteNoise = true;
							this.timer.whiteNoisePlayer.whiteNoise();
						}
					}
					return true;
				}
				return false;
			}
		});
	}


	//on click, open log file; from Day Planner https://github.com/lynchjames/obsidian-day-planner/blob/c8d4d33af294bde4586a943463e8042c0f6a3a2d/src/status-bar.ts#L53
	openLogFileOnClick() {
		this.statusBar.addClass("statusbar-pomo-logging");

		this.statusBar.onClickEvent(async (ev: any) => {
			if (this.settings.logging === true) { //this is hacky, ideally I'd just unwatch the onClickEvent as soon as I turned logging off
				try {
					var file: string;
					if (this.settings.logToDaily === true) {
						file = (await getDailyNoteFile()).path;
					} else {
						file = this.settings.logFile;
					}

					this.app.workspace.openLinkText(file, '', false);
				} catch (error) {
					console.log(error);
				}
			}
		});
	}

	/**************  Meta  **************/

	onunload() {
		this.timer.quitTimer();
		console.log('Unloading status bar pomodoro timer');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}