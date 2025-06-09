<script>
  import { onMount, onDestroy } from 'svelte';
  import { castStatus, scheduleStatus, nextSchedule, connected } from '../stores/websocket.js';
  import { systemApi, castApi } from '../stores/api.js';

  let systemInfo = null;
  let error = null;
  let loading = true;
  let retryInProgress = false;

  onMount(async () => {
    try {
      systemInfo = await systemApi.getStatus();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  async function handleStopCast() {
    try {
      await castApi.stop();
    } catch (err) {
      error = err.message;
    }
  }

  async function handleRetryCast() {
    if (retryInProgress) return;
    
    try {
      retryInProgress = true;
      const response = await fetch('/api/cast/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          maxRetries: 3,
          retryDelay: 5000
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'リトライに失敗しました');
      }
      
      // 成功通知は WebSocket 経由で受信される
    } catch (err) {
      error = err.message;
    } finally {
      retryInProgress = false;
    }
  }

  function formatNextSchedule(schedule) {
    if (!schedule) return null;
    
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName = days[schedule.day_of_week];
    
    return {
      ...schedule,
      dayName,
      nextExecutionFormatted: schedule.nextExecution 
        ? new Date(schedule.nextExecution).toLocaleString('ja-JP')
        : null
    };
  }

  $: formattedNextSchedule = formatNextSchedule($nextSchedule);
  $: statusColor = $castStatus.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  $: statusText = $castStatus.isActive ? 'キャスト中' : '待機中';
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-100 transition-colors duration-200" style="font-weight: 500;">配信ダッシュボード</h1>
    <div class="flex items-center space-x-2 px-3 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-200" style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div class="w-2 h-2 rounded-full {$connected ? 'bg-green-500' : 'bg-red-500'}"></div>
      <span class="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-200">
        WebSocket: {$connected ? '接続中' : '切断'}
      </span>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 rounded-md p-4 transition-colors duration-200" style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div class="flex">
        <span class="material-icons text-red-400 dark:text-red-300 mr-3">error</span>
        <div>
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">エラー</h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    </div>
  {/if}

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <!-- 配信状況カード -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors duration-200" style="box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div class="flex items-center mb-4">
        <span class="material-icons text-blue-600 dark:text-blue-400 mr-2">cast</span>
        <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">配信状況</h2>
      </div>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-3 h-3 rounded-full {$castStatus.isActive ? 'bg-green-500' : 'bg-gray-400'}"></div>
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{statusText}</span>
          </div>
          
          <div class="flex space-x-2">
            {#if $castStatus.isActive}
              <button
                on:click={handleStopCast}
                class="px-4 py-2 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-md text-sm transition-colors shadow-sm"
                style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
              >
                <span class="material-icons text-sm mr-1">stop</span>
                停止
              </button>
            {/if}
            
            {#if $castStatus.lastCastAttempt}
              <button
                on:click={handleRetryCast}
                disabled={retryInProgress}
                class="px-4 py-2 bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md text-sm transition-colors shadow-sm flex items-center"
                style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
              >
                <span class="material-icons text-sm mr-1 {retryInProgress ? 'animate-spin' : ''}">
                  refresh
                </span>
                {retryInProgress ? 'リトライ中...' : 'リトライ'}
              </button>
            {/if}
          </div>
        </div>
        
        {#if $castStatus.isActive}
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 space-y-1 transition-colors duration-200">
            <div class="flex items-center">
              <span class="material-icons text-gray-500 dark:text-gray-400 text-sm mr-2">device_hub</span>
              <span class="text-sm text-gray-600 dark:text-gray-300">デバイス: {$castStatus.deviceName || '不明'}</span>
            </div>
            <div class="flex items-center">
              <span class="material-icons text-gray-500 dark:text-gray-400 text-sm mr-2">video_library</span>
              <span class="text-sm text-gray-600 dark:text-gray-300">動画ID: {$castStatus.videoId || '不明'}</span>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- スケジュール状況カード -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors duration-200" style="box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div class="flex items-center mb-4">
        <span class="material-icons text-green-600 dark:text-green-400 mr-2">schedule</span>
        <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">スケジュール状況</h2>
      </div>
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center">
            <span class="material-icons text-sm mr-1">power</span>
            状態
          </span>
          <span class="px-2 py-1 rounded-full text-xs font-medium {$scheduleStatus.isInitialized ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}">
            {$scheduleStatus.isInitialized ? '稼働中' : '停止中'}
          </span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center">
            <span class="material-icons text-sm mr-1">work</span>
            アクティブジョブ
          </span>
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{$scheduleStatus.activeJobs || 0}個</span>
        </div>
      </div>
    </div>

    <!-- 次回配信予定カード -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors duration-200" style="box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div class="flex items-center mb-4">
        <span class="material-icons text-orange-600 dark:text-orange-400 mr-2">upcoming</span>
        <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">次回配信予定</h2>
      </div>
      {#if formattedNextSchedule}
        <div class="space-y-3">
          <div class="flex items-center">
            <span class="material-icons text-gray-500 dark:text-gray-400 text-sm mr-2">tv</span>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{formattedNextSchedule.channel_name}</p>
          </div>
          <div class="flex items-center">
            <span class="material-icons text-gray-500 dark:text-gray-400 text-sm mr-2">event</span>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              {formattedNextSchedule.dayName}曜日 {formattedNextSchedule.start_time}
            </p>
          </div>
          {#if formattedNextSchedule.nextExecutionFormatted}
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-md p-2 transition-colors duration-200">
              <p class="text-xs text-blue-700 dark:text-blue-300 flex items-center">
                <span class="material-icons text-xs mr-1">alarm</span>
                次回実行: {formattedNextSchedule.nextExecutionFormatted}
              </p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="flex items-center justify-center h-16">
          <div class="text-center">
            <span class="material-icons text-gray-400 dark:text-gray-500 text-2xl mb-1">event_busy</span>
            <p class="text-sm text-gray-500 dark:text-gray-400">予定されている配信はありません</p>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- システム情報 -->
  {#if systemInfo && !loading}
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors duration-200" style="box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div class="flex items-center mb-4">
        <span class="material-icons text-purple-600 dark:text-purple-400 mr-2">info</span>
        <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">システム情報</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 transition-colors duration-200">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center">
              <span class="material-icons text-sm mr-1">api</span>
              YouTube API
            </span>
            <span class="px-2 py-1 rounded-full text-xs font-medium {systemInfo.youtube?.apiKeyConfigured ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}">
              {systemInfo.youtube?.apiKeyConfigured ? '設定済み' : '未設定'}
            </span>
          </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 transition-colors duration-200">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center">
              <span class="material-icons text-sm mr-1">cable</span>
              WebSocket
            </span>
            <span class="px-2 py-1 rounded-full text-xs font-medium {systemInfo.websocket?.isRunning ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'}">
              {systemInfo.websocket?.isRunning ? '稼働中' : '停止中'}
            </span>
          </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 transition-colors duration-200">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center">
              <span class="material-icons text-sm mr-1">people</span>
              接続数
            </span>
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{systemInfo.websocket?.connectedClients || 0}台</span>
          </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 transition-colors duration-200">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center">
              <span class="material-icons text-sm mr-1">access_time</span>
              最終更新
            </span>
            <span class="text-xs font-medium text-gray-900 dark:text-gray-100">
              {systemInfo.timestamp ? new Date(systemInfo.timestamp).toLocaleTimeString('ja-JP') : '不明'}
            </span>
          </div>
        </div>
      </div>
    </div>
  {:else if loading}
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors duration-200" style="box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div class="animate-pulse">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
        <div class="space-y-2">
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        </div>
      </div>
    </div>
  {/if}
</div>