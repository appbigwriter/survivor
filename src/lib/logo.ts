// Logo "Trilha": um caminho em S que sobe até um ponto, sobre o verde do app.
// Desenhado numa grade de 96. Usado pelos ícones gerados e pela marca na tela.

export const LOGO_BG = "#1b5e40";
export const LOGO_DOT = "#5cc995";
export const LOGO_PATH = "M30 72 H54 a12 12 0 0 0 0 -24 H42 a12 12 0 0 1 0 -24 H62";

/**
 * SVG do logo. `radius` arredonda o fundo (0 para ícones que o sistema recorta);
 * `scale` encolhe o desenho em volta do centro, para a área segura do ícone maskable.
 */
export function logoSvg({ radius = 24, scale = 1 }: { radius?: number; scale?: number } = {}) {
  const t = 48 * (1 - scale);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" rx="${radius}" fill="${LOGO_BG}"/>` +
    `<g transform="translate(${t} ${t}) scale(${scale})">` +
    `<path d="${LOGO_PATH}" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="68" cy="24" r="5.5" fill="${LOGO_DOT}"/>` +
    `</g></svg>`
  );
}

export const logoDataUri = (opts?: Parameters<typeof logoSvg>[0]) =>
  `data:image/svg+xml;base64,${Buffer.from(logoSvg(opts)).toString("base64")}`;
