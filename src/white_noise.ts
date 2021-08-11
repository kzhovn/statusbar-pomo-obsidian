import PomoTimer from './main';
import { Mode } from './consts_defs'

export class WhiteNoise {
	plugin: PomoTimer;
	whiteNoisePlayer: HTMLAudioElement;

	constructor(plugin: PomoTimer, whiteNoiseUrl: string) {
		this.plugin = plugin;
		this.whiteNoisePlayer = new Audio(whiteNoiseUrl);
		this.whiteNoisePlayer.loop = true;
	}

	stopWhiteNoise() {
		this.whiteNoisePlayer.pause();
		this.whiteNoisePlayer.currentTime = 0;
	}

	whiteNoise() {
		if (this.plugin.mode === Mode.Pomo && this.plugin.paused === false) {
			this.whiteNoisePlayer.play();
		} else {
			this.stopWhiteNoise();
		}
	}
}
