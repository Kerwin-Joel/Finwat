import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import useThemeStore from "@/stores/themeStore";

// Colorea la barra del navegador móvil (<meta name="theme-color">) para que combine:
// en las pantallas con aurora usa su marino superior; dentro de la app, el fondo del tema.
const AURORA_TOP = "#050a1c";
const AURORA_ROUTES = ["/login", "/register", "/splash"];
const THEME_BG = { light: "#f3f5fa", dark: "#070b17" } as const;

const ThemeColorSync = () => {
  const { pathname } = useLocation();
  const theme = useThemeStore((s) => s.theme);
  const customBg = useThemeStore((s) => s.customColors.background);

  useEffect(() => {
    const color = AURORA_ROUTES.includes(pathname)
      ? AURORA_TOP
      : theme === "custom"
        ? `hsl(${customBg})`
        : THEME_BG[theme];

    let metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    if (metas.length === 0) {
      const m = document.createElement("meta");
      m.name = "theme-color";
      document.head.appendChild(m);
      metas = [m];
    }
    // Una sola etiqueta sin media query: manda el color de la pantalla actual
    metas.slice(1).forEach((m) => m.remove());
    metas[0].removeAttribute("media");
    metas[0].content = color;
  }, [pathname, theme, customBg]);

  return null;
};

export default ThemeColorSync;
