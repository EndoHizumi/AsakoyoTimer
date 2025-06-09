<script>
  import { onMount } from 'svelte';
  import { systemApi } from '../stores/api.js';

  let logs = [];
  let loading = true;
  let error = null;
  let limit = 50;

  onMount(async () => {
    await loadLogs();
  });

  async function loadLogs() {
    try {
      logs = await systemApi.getLogs(limit);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function refreshLogs() {
    loading = true;
    await loadLogs();
  }

  function getStatusColor(status) {
    switch (status) {
      case 'started':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'stopped':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'error':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-300';
    }
  }

  function getStatusText(status) {
    switch (status) {
      case 'started':
        return '開始';
      case 'stopped':
        return '停止';
      case 'error':
        return 'エラー';
      default:
        return status;
    }
  }

  function formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
  }

  function calculateDuration(startedAt, endedAt) {
    if (!startedAt || !endedAt) return '-';
    
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diffMs = end - start;
    
    if (diffMs <= 0) return '-';
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (hours > 0) {
      return `${hours}時間${minutes}分`;
    } else {
      return `${minutes}分`;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-100 transition-colors duration-200" style="font-weight: 500;">キャストログ</h1>
    <div class="flex space-x-2">
      <select
        bind:value={limit}
        on:change={loadLogs}
        class="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
      >
        <option value={25}>25件</option>
        <option value={50}>50件</option>
        <option value={100}>100件</option>
        <option value={200}>200件</option>
      </select>
      <button
        on:click={refreshLogs}
        disabled={loading}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md disabled:opacity-50 transition-colors shadow-sm flex items-center"
        style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
      >
        <span class="material-icons mr-1 text-sm">refresh</span>
        {loading ? '読み込み中...' : '更新'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 rounded-md p-4 transition-colors duration-200" style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div class="flex">
        <span class="material-icons text-red-400 dark:text-red-300 mr-3">error</span>
        <p class="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    </div>
  {/if}

  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-200" style="box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    {#if loading}
      <div class="p-6">
        <div class="animate-pulse space-y-4">
          {#each Array(5) as _}
            <div class="h-16 bg-gray-200 dark:bg-gray-700 rounded transition-colors duration-200"></div>
          {/each}
        </div>
      </div>
    {:else if logs.length === 0}
      <div class="p-6 text-center text-gray-500 dark:text-gray-400">
        <span class="material-icons text-gray-400 dark:text-gray-500 text-4xl mb-2">assignment</span>
        <p>ログが見つかりません</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700/50 transition-colors duration-200">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                開始時刻
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                チャンネル
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                動画タイトル
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                デバイス
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                状態
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                時間
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                終了時刻
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 transition-colors duration-200">
            {#each logs as log}
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatDateTime(log.started_at)}
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {log.channel_name || '-'}
                  </div>
                  {#if log.video_id}
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      ID: {log.video_id}
                    </div>
                  {/if}
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                    {log.video_title || '-'}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {log.device_name || '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-1 text-xs font-semibold rounded-full {getStatusColor(log.status)}">
                    {getStatusText(log.status)}
                  </span>
                  {#if log.error_message}
                    <div class="text-xs text-red-600 dark:text-red-400 mt-1 max-w-xs truncate" title={log.error_message}>
                      {log.error_message}
                    </div>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {calculateDuration(log.started_at, log.ended_at)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatDateTime(log.ended_at)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- 統計情報 -->
  {#if logs.length > 0}
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors duration-200" style="box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div class="flex items-center mb-4">
        <span class="material-icons text-purple-600 dark:text-purple-400 mr-2">analytics</span>
        <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">統計情報</h2>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 transition-colors duration-200">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {logs.length}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">総ログ数</div>
        </div>
        <div class="text-center bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 transition-colors duration-200">
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {logs.filter(log => log.status === 'started').length}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">成功</div>
        </div>
        <div class="text-center bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 transition-colors duration-200">
          <div class="text-2xl font-bold text-red-600 dark:text-red-400">
            {logs.filter(log => log.status === 'error').length}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">エラー</div>
        </div>
        <div class="text-center bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 transition-colors duration-200">
          <div class="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {new Set(logs.map(log => log.channel_name).filter(Boolean)).size}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">チャンネル数</div>
        </div>
      </div>
    </div>
  {/if}
</div>