import PomoTimerPlugin from './main';
import { Mode } from './mode'

export class WhiteNoise {
	plugin: PomoTimerPlugin;
	whiteNoisePlayer: HTMLAudioElement;

	constructor(plugin: PomoTimerPlugin, whiteNoiseUrl: string) {
		this.plugin = plugin;
		this.whiteNoisePlayer = new Audio(whiteNoiseUrl);
		this.whiteNoisePlayer.loop = true;
	}

	stopWhiteNoise() {
		this.whiteNoisePlayer.pause();
		this.whiteNoisePlayer.currentTime = 0;
	}

	whiteNoise() {
		if (this.plugin.timer.mode === Mode.Pomo && this.plugin.timer.paused === false) {
			this.whiteNoisePlayer.play();
		} else {
			this.stopWhiteNoise();
		}
	}
}
