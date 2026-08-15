import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";
export type DensityPref = "comfortable" | "compact";

const THEME_KEY = "sartori-theme";
const DENSITY_KEY = "sartori-density";

function resolveDark(pref: ThemePref) {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(pref: ThemePref) {
  document.documentElement.classList.toggle("dark", resolveDark(pref));
}

function applyDensity(pref: DensityPref) {
  document.documentElement.classList.toggle("density-compact", pref === "compact");
}

// Tema e densidade são preferência de MÁQUINA/navegador, não de conta — por
// isso ficam em localStorage, não no banco (diferente da preferência de
// notificação por e-mail, que precisa ser lida pelo servidor).
export function useThemePref() {
  const [theme, setThemeState] = useState<ThemePref>(
    () => (localStorage.getItem(THEME_KEY) as ThemePref) || "system",
  );

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    // Se está no modo "sistema", reage a trocas de tema do SO em tempo real.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (value: ThemePref) => {
    localStorage.setItem(THEME_KEY, value);
    setThemeState(value);
  };

  return { theme, setTheme };
}

export function useDensityPref() {
  const [density, setDensityState] = useState<DensityPref>(
    () => (localStorage.getItem(DENSITY_KEY) as DensityPref) || "comfortable",
  );

  useEffect(() => applyDensity(density), [density]);

  const setDensity = (value: DensityPref) => {
    localStorage.setItem(DENSITY_KEY, value);
    setDensityState(value);
  };

  return { density, setDensity };
}

// Script inline (roda antes do React hidratar) pra aplicar tema/densidade
// salvos ANTES da primeira pintura da tela — sem isso, a página abriria
// sempre clara por um instante e "piscaria" pro escuro depois.
export const THEME_BLOCKING_SCRIPT = `
(function() {
  try {
    var theme = localStorage.getItem('${THEME_KEY}') || 'system';
    var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    var density = localStorage.getItem('${DENSITY_KEY}');
    if (density === 'compact') document.documentElement.classList.add('density-compact');
  } catch (e) {}
})();
`;
