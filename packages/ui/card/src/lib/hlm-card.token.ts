import { inject, InjectionToken, type ValueProvider } from '@angular/core';

export type HlmCardConfig = {
	/** `nested` : une carte posée dans une autre, un cran plus haut sur la rampe de surfaces. */
	variant: 'default' | 'nested';
};

const defaultConfig: HlmCardConfig = {
	variant: 'default',
};

const HlmCardConfigToken = new InjectionToken<HlmCardConfig>('HlmCardConfig');

export function provideHlmCardConfig(config: Partial<HlmCardConfig>): ValueProvider {
	return { provide: HlmCardConfigToken, useValue: { ...defaultConfig, ...config } };
}

export function injectHlmCardConfig(): HlmCardConfig {
	return inject(HlmCardConfigToken, { optional: true }) ?? defaultConfig;
}
