export function getDefaultAvatar(username: string | undefined | null): string {
	const name = username || 'Unknown';
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}

	const colors = ['#5865F2', '#4E5D94', '#34495E', '#8E44AD', '#2C3E50'];
	const color = colors[Math.abs(hash) % colors.length];

	const r = parseInt(color.slice(1, 3), 16);
	const g = parseInt(color.slice(3, 5), 16);
	const b = parseInt(color.slice(5, 7), 16);

	const factor = 0.5;
	const darkR = Math.floor(r * factor)
		.toString(16)
		.padStart(2, '0');
	const darkG = Math.floor(g * factor)
		.toString(16)
		.padStart(2, '0');
	const darkB = Math.floor(b * factor)
		.toString(16)
		.padStart(2, '0');
	const bgColor = `#${darkR}${darkG}${darkB}`;

	// SVG kodunda gölge (drop shadow) filtresini yumuşattık
	const svg = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1" stdDeviation="12" flood-color="#000000" flood-opacity="0.3" />
    </filter>
  </defs>
  <rect width="100" height="100" fill="${bgColor}" />
  <g filter="url(#shadow)">
    <circle cx="50" cy="40" r="13" fill="${color}" />
    <path d="M 25 82 C 25 66 38 62 50 62 C 62 62 75 66 75 82 Q 75 86 71 86 H 29 Q 25 86 25 82 Z" fill="${color}" />
  </g>
</svg>
`.trim();

	return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
