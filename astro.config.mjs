// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://tarou-jp.github.io',
	base: '/swift-concurrency-tutorial',
	vite: {
		server: {
			watch: {
				usePolling: true,
				interval: 100,
			},
		},
	},
	integrations: [
		starlight({
			title: 'Swift Concurrencyチュートリアル',
			description: 'Swift Concurrencyを思想から学ぶ',
			sidebar: [
				{
					label: 'はじめに',
					items: [{ label: 'トップ', slug: 'index' }],
				},
				{
					label: 'Swift Concurrencyの思想',
					items: [{ autogenerate: { directory: 'philosophy' } }],
				},
				{
					label: '第1部：非同期処理を扱いやすくする',
					items: [{ autogenerate: { directory: 'async' } }],
				},
				{
					label: '第2部：可変状態を安全に扱う',
					items: [
						{ slug: 'race/shared-mutable-state' },
						{ slug: 'race/data-race' },
						{ slug: 'race/race-condition' },
						{ slug: 'race/gcd' },
						{ slug: 'race/not-sharing' },
						{ slug: 'actor/theory' },
						{ slug: 'isolation/domain' },
						{ slug: 'isolation/nonisolated' },
						{ slug: 'actor/swift-actor' },
						{ slug: 'isolation/main-actor' },
						{ slug: 'isolation/boundary' },
					],
				},
				{
					label: '参考',
					items: [{ label: '参考資料', slug: 'references' }],
				},
			],
		}),
	],
});
