/*if I export from main rollup complains about mixing named and default exports
* not sure if Obsidian will complain about changing the rollup.config export setting*/

export enum Mode {
	Pomo,
	ShortBreak,
	LongBreak,
	NoTimer
}