import { writable } from 'svelte/store';

// ローカルストレージからテーマ設定を読み込み
function createThemeStore() {
  // デフォルトはライトモード、ローカルストレージから設定を読み込み
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
  const initial = stored || 'light';
  
  const { subscribe, set, update } = writable(initial);

  return {
    subscribe,
    setTheme: (theme) => {
      set(theme);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('theme', theme);
      }
      // HTMLのクラスを更新してTailwind CSSのダークモードを有効化
      if (typeof document !== 'undefined') {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },
    toggleTheme: () => {
      update(current => {
        const newTheme = current === 'light' ? 'dark' : 'light';
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('theme', newTheme);
        }
        // HTMLのクラスを更新
        if (typeof document !== 'undefined') {
          if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        return newTheme;
      });
    },
    // 初期化時にHTMLクラスを設定
    initialize: () => {
      if (typeof document !== 'undefined') {
        const currentTheme = stored || 'light';
        if (currentTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    }
  };
}

export const theme = createThemeStore();