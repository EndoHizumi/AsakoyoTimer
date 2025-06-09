<script>
  import { onMount } from 'svelte';
  import { deviceApi } from '../stores/api.js';
  import { devices } from '../stores/websocket.js';

  let loading = true;
  let error = null;
  let scanning = false;
  let testingDevices = new Set();

  onMount(async () => {
    await loadDevices();
  });

  async function loadDevices() {
    try {
      const deviceList = await deviceApi.getAll();
      devices.set(deviceList);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function scanDevices() {
    scanning = true;
    error = null;
    
    try {
      const result = await deviceApi.scan();
      await loadDevices();
      
      if (result.count === 0) {
        error = 'ChromeCastデバイスが見つかりませんでした';
      }
    } catch (err) {
      error = err.message;
    } finally {
      scanning = false;
    }
  }

  async function testDevice(deviceId) {
    testingDevices.add(deviceId);
    testingDevices = testingDevices;
    
    try {
      const result = await deviceApi.test(deviceId);
      if (result.isConnectable) {
        // 成功時の表示は一時的なメッセージで行う
        setTimeout(() => {
          // 2秒後に自動で状態をクリア
        }, 2000);
      } else {
        error = 'デバイスに接続できませんでした';
      }
    } catch (err) {
      error = err.message;
    } finally {
      testingDevices.delete(deviceId);
      testingDevices = testingDevices;
    }
  }

  async function updateDevice(deviceId, field, value) {
    try {
      const device = $devices.find(d => d.id === deviceId);
      if (!device) return;

      const updateData = { ...device, [field]: value };
      await deviceApi.update(deviceId, updateData);
      await loadDevices();
    } catch (err) {
      error = err.message;
    }
  }

  function formatLastSeen(lastSeen) {
    if (!lastSeen) return '未確認';
    return new Date(lastSeen).toLocaleString('ja-JP');
  }
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-100 transition-colors duration-200" style="font-weight: 500;">ChromeCastデバイス管理</h1>
    <button
      on:click={scanDevices}
      disabled={scanning}
      class="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center"
      style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
    >
      <span class="material-icons mr-2 text-sm">{scanning ? 'search' : 'search'}</span>
      {scanning ? 'スキャン中...' : 'デバイススキャン'}
    </button>
  </div>

  {#if error}
    <div class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 rounded-md p-4 transition-colors duration-200" style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div class="flex justify-between items-start">
        <div class="flex">
          <span class="material-icons text-red-400 dark:text-red-300 mr-3">error</span>
          <p class="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
        <button
          on:click={() => error = null}
          class="ml-4 text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200"
        >
          <span class="material-icons text-sm">close</span>
        </button>
      </div>
    </div>
  {/if}

  {#if scanning}
    <div class="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 rounded-md p-4 transition-colors duration-200" style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div class="flex items-center">
        <div class="animate-spin mr-3">
          <span class="material-icons text-blue-600 dark:text-blue-400">refresh</span>
        </div>
        <p class="text-sm text-blue-700 dark:text-blue-300">ネットワーク上のChromeCastデバイスを検索しています...</p>
      </div>
    </div>
  {/if}

  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-200" style="box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    {#if loading}
      <div class="p-6">
        <div class="animate-pulse space-y-4">
          {#each Array(3) as _}
            <div class="h-16 bg-gray-200 rounded"></div>
          {/each}
        </div>
      </div>
    {:else if $devices.length === 0}
      <div class="p-6 text-center text-gray-500">
        <p class="mb-2">デバイスが見つかりません</p>
        <p class="text-sm">「デバイススキャン」ボタンでChromeCastデバイスを検索してください</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                デバイス名
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IPアドレス
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                最終確認
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状態
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                デフォルト
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each $devices as device}
              <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{device.name}</div>
                  <div class="text-sm text-gray-500">ポート: {device.port}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {device.ip_address}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatLastSeen(device.last_seen)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      checked={device.is_active}
                      on:change={(e) => updateDevice(device.id, 'is_active', e.target.checked)}
                      class="mr-2"
                    />
                    <span class="text-sm {device.is_active ? 'text-green-600' : 'text-gray-400'}">
                      {device.is_active ? '有効' : '無効'}
                    </span>
                  </label>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      checked={device.is_default}
                      on:change={(e) => updateDevice(device.id, 'is_default', e.target.checked)}
                      class="mr-2"
                    />
                    <span class="text-sm">デフォルト</span>
                  </label>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    on:click={() => testDevice(device.id)}
                    disabled={testingDevices.has(device.id)}
                    class="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                  >
                    {testingDevices.has(device.id) ? 'テスト中...' : '接続テスト'}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- 使用方法の説明 -->
  <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
    <h3 class="text-sm font-medium text-blue-800 mb-2">使用方法</h3>
    <ul class="text-sm text-blue-700 space-y-1">
      <li>• 「デバイススキャン」でネットワーク上のChromeCastデバイスを検索します</li>
      <li>• 「有効」チェックボックスでデバイスの使用可否を設定できます</li>
      <li>• 「デフォルト」チェックボックスで優先的に使用するデバイスを設定できます</li>
      <li>• 「接続テスト」でデバイスへの接続を確認できます</li>
    </ul>
  </div>
</div>