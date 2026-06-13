import { ref, onMounted } from 'vue';

export const REPO = 'AzizhanKaya/ThisCrow-frontend';
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

export type OS = 'windows' | 'macos' | 'linux';

export interface PlatformDownload {
	os: OS;
	label: string;
	icon: string;
	url: string | null;
	assetName: string | null;
}

interface GithubAsset {
	name: string;
	browser_download_url: string;
}

interface GithubRelease {
	tag_name: string;
	assets: GithubAsset[];
}

function matchAsset(assets: GithubAsset[], exts: string[]): GithubAsset | undefined {
	return assets.find((a) => exts.some((ext) => a.name.toLowerCase().endsWith(ext)));
}

export function detectOS(): OS {
	const ua = navigator.userAgent.toLowerCase();
	const platform = (navigator.platform || '').toLowerCase();
	if (ua.includes('win') || platform.includes('win')) return 'windows';
	if (ua.includes('mac') || platform.includes('mac')) return 'macos';
	if (ua.includes('linux') || ua.includes('x11') || platform.includes('linux')) return 'linux';
	return 'windows';
}

const OS_META: Record<OS, { label: string; icon: string }> = {
	windows: { label: 'Windows', icon: 'mdi:microsoft-windows' },
	macos: { label: 'macOS', icon: 'mdi:apple' },
	linux: { label: 'Linux', icon: 'mdi:linux' },
};

export function useReleases() {
	const version = ref<string | null>(null);
	const loading = ref(true);
	const error = ref(false);

	const downloads = ref<Record<OS, PlatformDownload>>({
		windows: { os: 'windows', ...OS_META.windows, url: null, assetName: null },
		macos: { os: 'macos', ...OS_META.macos, url: null, assetName: null },
		linux: { os: 'linux', ...OS_META.linux, url: null, assetName: null },
	});

	onMounted(async () => {
		try {
			const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
				headers: { Accept: 'application/vnd.github+json' },
			});
			if (!res.ok) throw new Error(`status ${res.status}`);

			const release: GithubRelease = await res.json();
			version.value = release.tag_name;

			const win = matchAsset(release.assets, ['.exe', '.msi']);
			const mac = matchAsset(release.assets, ['.dmg']);
			const linux = matchAsset(release.assets, ['.appimage', '.deb', '.rpm']);

			if (win) downloads.value.windows = { ...downloads.value.windows, url: win.browser_download_url, assetName: win.name };
			if (mac) downloads.value.macos = { ...downloads.value.macos, url: mac.browser_download_url, assetName: mac.name };
			if (linux) downloads.value.linux = { ...downloads.value.linux, url: linux.browser_download_url, assetName: linux.name };
		} catch (e) {
			error.value = true;
		} finally {
			loading.value = false;
		}
	});

	return { version, loading, error, downloads };
}
