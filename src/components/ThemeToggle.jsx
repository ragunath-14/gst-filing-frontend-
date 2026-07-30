import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark / light mode"
    >
      <span className={`theme-toggle-track ${theme}`}>
        <span className="theme-toggle-thumb">
          {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
        </span>
      </span>
    </button>
  );
}
