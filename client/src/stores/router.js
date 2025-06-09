import { writable } from 'svelte/store';

export const currentRoute = writable('/');

export function navigate(path) {
    currentRoute.set(path);
    history.pushState({}, '', path);
}

// ブラウザの戻る/進むボタンに対応
if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
        currentRoute.set(window.location.pathname);
    });
    
    // 初期化時に現在のパスを設定
    currentRoute.set(window.location.pathname);
}