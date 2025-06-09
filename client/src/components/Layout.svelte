<script>
  import { onMount } from 'svelte';
  import { currentRoute, navigate } from '../stores/router.js';
  import { connected } from '../stores/websocket.js';
  import { theme } from '../stores/theme.js';

  const navigation = [
    { path: '/', label: 'ダッシュボード', icon: 'dashboard' },
    { path: '/schedules', label: 'スケジュール', icon: 'schedule' },
    { path: '/devices', label: 'デバイス', icon: 'devices' },
    { path: '/logs', label: 'ログ', icon: 'assignment' }
  ];

  $: currentPath = $currentRoute;

  onMount(() => {
    // テーマストアを初期化
    theme.initialize();
  });
</script>

<div class="h-screen flex flex-col bg-whitesmoke dark:bg-gray-900 transition-colors duration-200">
  <!-- App Bar -->
  <header class="bg-white dark:bg-gray-800 shadow-md w-full flex-shrink-0 transition-colors duration-200" style="box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div class="w-full px-6">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center min-w-0 flex-1">
          <div class="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded mr-3 flex items-center justify-center flex-shrink-0">
            <span class="material-icons text-white text-lg">cast</span>
          </div>
          <h1 class="text-xl font-medium text-gray-900 dark:text-gray-100 truncate transition-colors duration-200" style="font-weight: 500;">
            YouTube自動Cast配信システム
          </h1>
        </div>
        
        <div class="flex items-center space-x-4 flex-shrink-0">
          <!-- Theme Toggle Button -->
          <button
            on:click={theme.toggleTheme}
            class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            title="テーマ切り替え"
          >
            <span class="material-icons text-gray-600 dark:text-gray-300">
              {$theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          
          <div class="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
            <div class="w-2 h-2 rounded-full {$connected ? 'bg-green-500' : 'bg-red-500'}"></div>
            <span class="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap transition-colors duration-200" style="font-weight: 400;">
              {$connected ? '接続中' : '切断'}
            </span>
          </div>
        </div>
      </div>
    </div>
  </header>

  <div class="flex flex-1 min-h-0">
    <!-- Navigation Drawer -->
    <nav class="w-72 bg-white dark:bg-gray-800 flex-shrink-0 transition-colors duration-200" style="box-shadow: 2px 0 8px rgba(0,0,0,0.1);">
      <div class="py-4 w-full">
        <ul class="space-y-1 px-3">
          {#each navigation as item}
            <li>
              <button
                on:click={() => navigate(item.path)}
                class="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                  {currentPath === item.path 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}"
                style="font-weight: {currentPath === item.path ? '500' : '400'};"
              >
                <span class="material-icons mr-4 text-xl flex-shrink-0">{item.icon}</span>
                <span class="truncate">{item.label}</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    </nav>

    <!-- Main content -->
    <main class="flex-1 min-w-0 p-6 bg-whitesmoke dark:bg-gray-900 transition-colors duration-200 overflow-y-auto">
      <slot />
    </main>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
  
  :global(*) {
    box-sizing: border-box;
  }
  
  :global(body) {
    font-family: 'Roboto', sans-serif;
    margin: 0;
    padding: 0;
    width: 100%;
    overflow-x: hidden;
  }
  
  :global(html) {
    width: 100%;
    overflow-x: hidden;
  }
  
  /* ブラウザ間の一貫性を保つための追加スタイル */
  header {
    width: 100% !important;
    box-sizing: border-box;
  }
  
  nav {
    box-sizing: border-box;
  }
  
  main {
    box-sizing: border-box;
  }
</style>